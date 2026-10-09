// syncMerge.js — lógica PURA de fusión entre dispositivos (sin red ni DOM,
// por eso se puede testear con node directamente).
//
// Estrategia: "gana el cambio más reciente" por lista (last-write-wins),
// usando `updatedAt`. Los borrados se representan con marcas de borrado
// (tombstones) para que una lista eliminada en un dispositivo no "resucite"
// cuando se conecta otro que todavía la tenía.

/**
 * @param {Array}  localLists     listas en memoria de este dispositivo
 * @param {Array}  remoteDocs     documentos remotos: lista + { deleted?, updatedAt }
 * @param {Object} localDeletes   { [listId]: deletedAt } borrados hechos aquí
 * @returns {{ lists: Array, pushLists: Array, pushDeletes: Array<{id, deletedAt}> }}
 *   lists       → estado resultante, ordenado por fecha de creación
 *   pushLists   → listas locales que le ganaron a la nube y hay que subir
 *   pushDeletes → borrados locales que la nube todavía no conoce
 */
export function mergeLists(localLists, remoteDocs, localDeletes = {}) {
    const remote = new Map(remoteDocs.map(d => [d.id, d]));
    const result = new Map();
    const pushLists = [];
    const pushDeletes = [];

    localLists.forEach(local => {
        const r = remote.get(local.id);
        const lt = local.updatedAt || 0;
        const rt = r?.updatedAt || 0;

        if (!r || lt > rt) {
            // Local es nuevo o más reciente (incluso si en la nube estaba borrado:
            // p. ej. "Deshacer" después de un borrado).
            result.set(local.id, local);
            pushLists.push(local);
        } else if (lt === rt && !r.deleted) {
            // Misma versión (típicamente el "eco" de lo que acabamos de subir):
            // se conserva el objeto local para no provocar un re-render.
            result.set(local.id, local);
        } else if (!r.deleted) {
            result.set(local.id, clean(r));
        }
        // r.deleted && rt >= lt → se borró en otro dispositivo después: se descarta.
    });

    remote.forEach((r, id) => {
        if (result.has(id) || r.deleted) return;
        const deletedAt = localDeletes[id];
        if (deletedAt && deletedAt >= (r.updatedAt || 0)) {
            // Se borró aquí (quizás sin conexión) después del último cambio remoto.
            pushDeletes.push({ id, deletedAt });
            return;
        }
        if (localLists.some(l => l.id === id)) return; // ya resuelto arriba
        result.set(id, clean(r));
    });

    const lists = [...result.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return { lists, pushLists, pushDeletes };
}

// Firestore no acepta `undefined`; además quitamos campos de control.
function clean({ deleted, ...list }) {
    return list;
}

export function serializeList(list) {
    return JSON.parse(JSON.stringify({ ...list, deleted: false }));
}

// Compara estados con claves ordenadas: Firestore no garantiza el orden de
// los campos, y un falso "cambió" provocaría re-renders innecesarios.
export function sameLists(a, b) {
    return stableStringify(a) === stableStringify(b);
}

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
