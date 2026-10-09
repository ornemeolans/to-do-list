// SyncService — sincronización entre dispositivos con Firebase (offline-first).
//
// Cómo funciona:
//  1. La app SIEMPRE trabaja contra el estado local (StateManager +
//     localStorage). La nube es una réplica, no un requisito.
//  2. Al iniciar sesión con Google, cada lista se guarda como un documento en
//     Firestore: users/{uid}/lists/{listId}. Las plantillas, en users/{uid}/meta/templates.
//  3. Firestore usa caché persistente (IndexedDB): las escrituras hechas sin
//     conexión quedan en cola y se suben solas al reconectar, incluso si se
//     cerró la pestaña entretanto.
//  4. Cada snapshot remoto se fusiona con `mergeLists` (gana el cambio más
//     reciente por lista; los borrados viajan como marcas de borrado).
//
// El SDK se importa dinámicamente desde el CDN solo si hay configuración, así
// la app local no paga ni un byte de Firebase.
import { firebaseConfig } from './firebase-config.js';
import { StateManager } from './StateManager.js';
import { StorageService } from './StorageService.js';
import { mergeLists, serializeList, sameLists } from './syncMerge.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const MAX_DOC_BYTES = 950_000; // Firestore admite ~1 MiB por documento

const configured = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

let fb = null;          // { auth, db, a: authModule, f: firestoreModule }
let session = null;     // { uid, unsubs: [] }
let remoteDocs = new Map();
const inflight = new Set();
let pushTimer = null;

const listeners = new Set();
const state = { configured, status: configured ? 'connecting' : 'local', user: null };

function emit(patch) {
    Object.assign(state, patch);
    listeners.forEach(fn => fn({ ...state }));
}

export const SyncService = {
    onChange(fn) {
        listeners.add(fn);
        fn({ ...state });
        return () => listeners.delete(fn);
    },

    async init() {
        if (!configured) return;

        window.addEventListener('online', () => refreshStatus());
        window.addEventListener('offline', () => refreshStatus());

        try {
            await loadFirebase();
        } catch (e) {
            // Sin conexión y sin el SDK en caché: se reintenta al volver la red.
            console.warn('No se pudo cargar Firebase:', e);
            emit({ status: 'offline' });
            window.addEventListener('online', () => this.init(), { once: true });
            return;
        }

        fb.a.onAuthStateChanged(fb.auth, (user) => {
            if (user) startSession(user);
            else stopSession();
        });
    },

    async signIn() {
        if (!fb) throw new Error('Firebase no está disponible');
        const provider = new fb.a.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await fb.a.signInWithPopup(fb.auth, provider);
        } catch (e) {
            if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) return;
            throw e;
        }
    },

    // Cierra sesión y borra la copia local (datos, caché de Firestore) para
    // que el próximo usuario de este navegador no vea nada ajeno.
    async signOut() {
        if (!fb) return;
        await fb.a.signOut(fb.auth);
        StorageService.clearAll();
        try {
            await fb.f.terminate(fb.db);
            await fb.f.clearIndexedDbPersistence(fb.db);
        } catch (e) {
            console.warn('No se pudo limpiar la caché de Firestore:', e);
        }
        location.reload();
    }
};

async function loadFirebase() {
    const [appMod, a, f] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`)
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    const auth = a.getAuth(app);
    const db = f.initializeFirestore(app, {
        localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() })
    });
    fb = { auth, db, a, f };
}

function startSession(user) {
    stopSession();
    const { collection, doc, onSnapshot } = fb.f;
    session = { uid: user.uid, unsubs: [], lastMeta: null };

    emit({
        user: { name: user.displayName || user.email, email: user.email, photoURL: user.photoURL },
        status: navigator.onLine ? 'syncing' : 'offline'
    });

    const listsRef = collection(fb.db, 'users', user.uid, 'lists');
    session.unsubs.push(onSnapshot(listsRef, { includeMetadataChanges: true }, (snap) => {
        remoteDocs = new Map(snap.docs.map(d => [d.id, d.data()]));
        session.lastMeta = snap.metadata;
        reconcile();
        refreshStatus();
    }, onError));

    const templatesRef = doc(fb.db, 'users', user.uid, 'meta', 'templates');
    session.unsubs.push(onSnapshot(templatesRef, (snap) => {
        const remote = snap.data();
        const localAt = StorageService.suggestionsUpdatedAt();
        if (remote && remote.updatedAt > localAt) {
            StorageService.saveSuggestions(remote.items || [], { updatedAt: remote.updatedAt, remote: true });
            document.dispatchEvent(new CustomEvent('suggestions:changed'));
        } else if (localAt > (remote?.updatedAt || 0)) {
            pushTemplates();
        }
    }, onError));

    // Cambios hechos por el usuario → subir (con debounce).
    session.unsubs.push(StateManager.subscribe((_lists, source) => {
        if (source !== 'local') return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(pushLocalChanges, 400);
    }));

    const onTemplates = () => pushTemplates();
    document.addEventListener('templates:local-change', onTemplates);
    session.unsubs.push(() => document.removeEventListener('templates:local-change', onTemplates));
}

function stopSession() {
    if (session) session.unsubs.forEach(unsub => unsub());
    session = null;
    remoteDocs = new Map();
    clearTimeout(pushTimer);
    emit({ user: null, status: configured ? 'signed-out' : 'local' });
}

// Fusiona la nube con el estado local y sube lo que haya ganado lo local.
function reconcile() {
    const { lists, pushLists, pushDeletes } = mergeLists(
        StateManager.activeLists,
        [...remoteDocs.values()],
        StorageService.loadDeletedLists()
    );
    if (!sameLists(lists, StateManager.activeLists)) {
        StateManager.replaceAll(lists, 'remote');
    }
    pushLists.forEach(writeList);
    pushDeletes.forEach(writeDelete);
}

function pushLocalChanges() {
    if (!session) return;
    StateManager.activeLists.forEach(list => {
        const remote = remoteDocs.get(list.id);
        if (!remote || (list.updatedAt || 0) > (remote.updatedAt || 0)) writeList(list);
    });
    Object.entries(StorageService.loadDeletedLists()).forEach(([id, deletedAt]) => {
        const remote = remoteDocs.get(id);
        if (remote && !remote.deleted && deletedAt >= (remote.updatedAt || 0)) writeDelete({ id, deletedAt });
    });
}

function writeList(list) {
    const key = `${list.id}:${list.updatedAt}`;
    if (!session || inflight.has(key)) return;

    const data = serializeList(list);
    if (new Blob([JSON.stringify(data)]).size > MAX_DOC_BYTES) {
        document.dispatchEvent(new CustomEvent('sync:too-big', { detail: { name: list.name } }));
        return;
    }
    inflight.add(key);
    // La promesa de setDoc se resuelve cuando el servidor confirma; sin conexión
    // queda pendiente (la escritura ya está en la cola persistente).
    fb.f.setDoc(fb.f.doc(fb.db, 'users', session.uid, 'lists', list.id), data)
        .catch(onError)
        .finally(() => { inflight.delete(key); refreshStatus(); });
}

function writeDelete({ id, deletedAt }) {
    if (!session) return;
    fb.f.setDoc(fb.f.doc(fb.db, 'users', session.uid, 'lists', id), { id, deleted: true, updatedAt: deletedAt })
        .catch(onError);
}

function pushTemplates() {
    if (!session) return;
    const items = JSON.parse(JSON.stringify(StorageService.loadSuggestions()));
    fb.f.setDoc(fb.f.doc(fb.db, 'users', session.uid, 'meta', 'templates'), {
        items,
        updatedAt: StorageService.suggestionsUpdatedAt()
    }).catch(onError);
}

function refreshStatus() {
    if (!configured) return;
    if (!navigator.onLine) return emit({ status: 'offline' });
    if (!session) return emit({ status: fb ? 'signed-out' : 'connecting' });
    const pending = session.lastMeta?.hasPendingWrites || inflight.size > 0;
    emit({ status: pending ? 'syncing' : 'synced' });
}

function onError(err) {
    console.error('Error de sincronización:', err);
    emit({ status: 'error' });
}
