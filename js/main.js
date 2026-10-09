// main.js — punto de entrada. Conecta estado, render y la UI "de página"
// (hero, plantillas, tema, loader, reveals). ES Modules garantizan el orden
// de carga, así que no hace falta polling de globals.
import { StateManager } from './StateManager.js';
import { StorageService } from './StorageService.js';
import { SyncService } from './SyncService.js';
import { extractVariables, renderAll } from './TaskService.js';
import { icon } from './icons.js';
import * as utils from './utils.js';

const { el } = utils;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const $ = (sel) => document.querySelector(sel);

async function init() {
    const listsContainer = $('#lists-container');
    const newListForm = $('#new-list-form');
    const newListInput = $('#new-list-input');

    setupTheme();
    setupToday();
    setupShortcuts(newListInput);
    setupSpotlight(listsContainer);
    const reveal = setupReveal();

    // Único punto donde "estado cambió → re-render".
    // Si el cambio llega de otro dispositivo mientras escribes, se preserva
    // el texto y el foco del input activo.
    StateManager.onChange = (activeLists, source) => {
        const draft = source === 'remote' ? captureDraft() : null;
        renderAll(activeLists, listsContainer);
        updateStats();
        reveal.observe(listsContainer.querySelectorAll('.reveal:not(.is-visible)'));
        if (draft) restoreDraft(draft);
    };

    await StateManager.load();
    StateManager.onChange(StateManager.activeLists);

    newListForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = newListInput.value.trim();
        if (!name) {
            newListInput.setAttribute('aria-invalid', 'true');
            newListInput.focus();
            utils.showToast('Escribe un nombre para la lista', 'warning');
            return;
        }
        newListInput.removeAttribute('aria-invalid');
        StateManager.addList(name);
        newListInput.value = '';
        utils.showToast('Lista creada', 'success');
        scrollToNewestList(listsContainer);
    });
    newListInput.addEventListener('input', () => newListInput.removeAttribute('aria-invalid'));

    renderSuggestions(listsContainer);
    document.addEventListener('suggestions:changed', () => renderSuggestions(listsContainer));

    reveal.observe(document.querySelectorAll('[data-reveal]'));
    hideLoader();

    setupSync();
    registerServiceWorker();
}

/* ------------------------------------------------------------------
   Sincronización: indicador de estado + cuenta
------------------------------------------------------------------ */
const SYNC_LABELS = {
    local: 'Guardado en este dispositivo',
    connecting: 'Conectando…',
    'signed-out': 'Solo en este dispositivo',
    syncing: 'Sincronizando…',
    synced: 'Sincronizado',
    offline: 'Sin conexión · se sincroniza al volver',
    error: 'Error al sincronizar'
};

function setupSync() {
    const pill = $('#sync-status');
    const label = pill.querySelector('.sync__label');
    const accountBtn = $('#account-btn');

    SyncService.onChange(({ configured, status, user }) => {
        // Sin conexión el estado de la cuenta se ve igual: lo local nunca se pierde.
        const text = !user && status === 'offline' && configured
            ? 'Sin conexión · guardado aquí'
            : SYNC_LABELS[status] || SYNC_LABELS.local;
        pill.dataset.status = status;
        label.textContent = text;
        pill.title = user ? `${text} — ${user.email}` : text;

        accountBtn.hidden = !configured;
        accountBtn.replaceChildren();
        if (user) {
            accountBtn.setAttribute('aria-label', `Cuenta: ${user.name}`);
            accountBtn.append(user.photoURL
                ? el('img', { className: 'account__avatar', src: user.photoURL, alt: '', referrerpolicy: 'no-referrer' })
                : el('span', { className: 'account__avatar', text: (user.name || '?').charAt(0).toUpperCase() }));
            accountBtn.onclick = () => openAccountDialog(user, status);
        } else {
            accountBtn.removeAttribute('aria-label');
            accountBtn.append(icon('cloud', { size: 16 }), el('span', { className: 'account__text', text: 'Sincronizar' }));
            accountBtn.onclick = openSignInDialog;
        }
    });

    document.addEventListener('sync:too-big', (e) => {
        utils.showToast(`“${e.detail.name}” supera el límite de la nube (demasiadas imágenes). Se guarda solo aquí.`, 'warning');
    });

    SyncService.init();
}

function openSignInDialog() {
    const { close } = utils.openDialog({
        eyebrow: 'Sincronización',
        title: 'Tu avance, en cualquier navegador',
        size: 'sm',
        body: [
            el('ul', { className: 'sync-perks' }, [
                el('li', { text: 'Tus listas actuales se suben a tu cuenta.' }),
                el('li', { text: 'Sin conexión sigue funcionando; los cambios se guardan al volver la red.' }),
                el('li', { text: 'Solo tú puedes leer tus datos.' })
            ]),
            el('button', {
                type: 'button', className: 'btn btn--google', autofocus: true,
                onclick: async () => {
                    if (!navigator.onLine) {
                        utils.showToast('Necesitas conexión para iniciar sesión', 'warning');
                        return;
                    }
                    try {
                        await SyncService.signIn();
                        close();
                        utils.showToast('Sesión iniciada. Sincronizando tus listas', 'success');
                    } catch (err) {
                        console.error(err);
                        utils.showToast('No se pudo iniciar sesión. Inténtalo de nuevo.', 'warning');
                    }
                }
            }, [googleLogo(), 'Continuar con Google'])
        ]
    });
}

function openAccountDialog(user) {
    utils.openDialog({
        eyebrow: 'Tu cuenta',
        title: user.name,
        size: 'sm',
        body: [
            el('p', { className: 'dialog__hint', text: user.email }),
            el('p', { className: 'dialog__hint', text: 'Al cerrar sesión se borra la copia de este navegador. Tus listas siguen a salvo en tu cuenta.' })
        ],
        actions: [
            { label: 'Cancelar' },
            {
                label: 'Cerrar sesión', variant: 'danger',
                onClick: () => { SyncService.signOut(); }
            }
        ]
    });
}

function googleLogo() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    [
        ['#EA4335', 'M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z'],
        ['#4285F4', 'M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z'],
        ['#FBBC05', 'M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z'],
        ['#34A853', 'M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z']
    ].forEach(([fill, d]) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', fill);
        path.setAttribute('d', d);
        svg.append(path);
    });
    return svg;
}

// Input activo dentro de las listas → se recupera tras un re-render remoto.
function captureDraft() {
    const active = document.activeElement;
    if (!active || active.tagName !== 'INPUT' || !active.value) return null;
    const list = active.closest('[data-list-id]');
    const task = active.closest('[data-task-id]');
    if (!list) return null;
    const scope = task ? `[data-task-id="${task.dataset.taskId}"]` : `[data-list-id="${list.dataset.listId}"]`;
    const selector = `${scope} .${active.classList.contains('sub-input') ? 'sub-input' : 'composer__input'}`;
    return { selector, value: active.value, caret: active.selectionStart };
}

function restoreDraft({ selector, value, caret }) {
    const input = document.querySelector(selector);
    if (!input) return;
    input.value = value;
    input.focus();
    input.setSelectionRange(caret, caret);
}

/* ------------------------------------------------------------------
   Service worker: la app carga aunque no haya conexión.
------------------------------------------------------------------ */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW no registrado:', err));
}

/* ------------------------------------------------------------------
   Plantillas (sidebar)
------------------------------------------------------------------ */
function renderSuggestions(listsContainer) {
    const container = $('#suggestions-list');
    const templates = StorageService.loadSuggestions();
    container.replaceChildren();

    if (!templates.length) {
        container.append(el('li', { className: 'templates__empty', text: 'Guarda cualquier lista con el marcador para reutilizarla aquí.' }));
        return;
    }

    templates.forEach((template, index) => {
        const vars = extractVariables(template);
        const [emoji, ...rest] = splitEmoji(template.name.split(' - ')[0]);

        const useBtn = el('button', { type: 'button', className: 'template__use' }, [
            el('span', { className: 'template__emoji', 'aria-hidden': 'true', text: emoji || '✳︎' }),
            el('span', { className: 'template__text' }, [
                el('span', { className: 'template__name', text: rest.join('') }),
                el('span', {
                    className: 'template__meta',
                    text: `${template.tasks.length} ${template.tasks.length === 1 ? 'tarea' : 'tareas'}${vars.length ? ` · ${vars.map(v => `{${v}}`).join(' ')}` : ''}`
                })
            ])
        ]);
        useBtn.addEventListener('click', () => useTemplate(template, vars, listsContainer));

        const del = el('button', {
            type: 'button', className: 'icon-btn icon-btn--danger icon-btn--xs template__delete',
            'aria-label': `Eliminar plantilla ${template.name}`, title: 'Eliminar plantilla'
        }, icon('x', { size: 14 }));
        del.addEventListener('click', () => {
            StorageService.deleteSuggestion(index);
            renderSuggestions(listsContainer);
            utils.showToast('Plantilla eliminada', 'info');
        });

        container.append(el('li', { className: 'template', style: `--stagger:${index}` }, [useBtn, del]));
    });
}

function useTemplate(template, vars, listsContainer) {
    const create = (data) => {
        StateManager.addListWithTasks(data);
        utils.showToast('Lista creada desde plantilla', 'success');
        scrollToNewestList(listsContainer);
    };
    if (!vars.length) return create(template);

    utils.showModal(template.name, vars.map(v => ({
        var: v, label: v.charAt(0).toUpperCase() + v.slice(1), type: v === 'fecha' ? 'date' : 'text'
    })), (values) => {
        const replace = (t) => t.replace(/{([a-zA-Z]+)}/g, (m, v) => values[v.toLowerCase()] || m);
        create({
            name: replace(template.name),
            tasks: template.tasks.map(t => ({
                ...t,
                text: replace(t.text),
                subtasks: (t.subtasks || []).map(s => ({ ...s, text: replace(s.text) }))
            }))
        });
    });
}

// "🛒 Compras" → ['🛒', ' Compras']. Si no hay emoji inicial, emoji = ''.
function splitEmoji(name) {
    const match = name.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
    return match ? [match[1], match[2]] : ['', name];
}

function scrollToNewestList(container) {
    const last = container.lastElementChild;
    if (!last) return;
    last.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
}

/* ------------------------------------------------------------------
   Hero: métricas con contador animado + anillo de progreso
------------------------------------------------------------------ */
const statCache = {};

function updateStats() {
    const s = StateManager.getStats();
    animateNumber('lists', s.lists);
    animateNumber('pending', s.pending);
    animateNumber('done', s.done);
    animateNumber('progress', Math.round(s.progress * 100));

    const ring = $('#progress-ring');
    if (ring) ring.style.setProperty('--progress', s.progress);
    $('#stats-caption').textContent = s.total
        ? (s.pending ? `Te quedan ${s.pending} ${s.pending === 1 ? 'tarea' : 'tareas'} por cerrar.` : 'Todo hecho. Merecido descanso.')
        : 'Todavía no hay tareas para medir.';
}

function animateNumber(key, to) {
    const node = document.querySelector(`[data-stat="${key}"]`);
    if (!node) return;
    const from = statCache[key] ?? 0;
    statCache[key] = to;
    if (from === to || reducedMotion.matches) { node.textContent = to; return; }

    const start = performance.now();
    const duration = 650;
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        node.textContent = Math.round(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function setupToday() {
    const node = $('#today');
    if (!node) return;
    const now = new Date();
    node.dateTime = now.toISOString().slice(0, 10);
    node.textContent = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
}

/* ------------------------------------------------------------------
   Tema: preferencia guardada > preferencia del sistema.
   (El valor inicial lo aplica un script inline en <head> para evitar
   el destello de tema incorrecto.)
------------------------------------------------------------------ */
function setupTheme() {
    const toggle = $('#theme-toggle');
    const root = document.documentElement;

    const paint = () => {
        const isDark = root.dataset.theme === 'dark';
        toggle.setAttribute('aria-pressed', String(isDark));
        toggle.setAttribute('aria-label', isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
        toggle.title = toggle.getAttribute('aria-label');
        toggle.replaceChildren(icon(isDark ? 'sun' : 'moon'));
    };

    toggle.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.classList.add('theme-transition');
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch { /* modo privado */ }
        paint();
        setTimeout(() => root.classList.remove('theme-transition'), 400);
    });
    paint();
}

/* ------------------------------------------------------------------
   Atajos: "/" o "n" enfocan el input de nueva lista.
------------------------------------------------------------------ */
function setupShortcuts(input) {
    document.addEventListener('keydown', (e) => {
        const typing = e.target.closest('input, textarea, [contenteditable="true"], dialog');
        if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === '/' || e.key.toLowerCase() === 'n') {
            e.preventDefault();
            input.focus();
            input.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        }
    });
}

/* ------------------------------------------------------------------
   Reveal al hacer scroll (IntersectionObserver, una sola vez por nodo)
------------------------------------------------------------------ */
function setupReveal() {
    if (!('IntersectionObserver' in window) || reducedMotion.matches) {
        return { observe: (nodes) => nodes.forEach(n => n.classList.add('is-visible')) };
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    return { observe: (nodes) => nodes.forEach(n => io.observe(n)) };
}

/* ------------------------------------------------------------------
   Spotlight: el borde de la tarjeta se ilumina bajo el cursor.
   Un solo listener delegado; solo escribe dos custom properties.
------------------------------------------------------------------ */
function setupSpotlight(container) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    container.addEventListener('pointermove', (e) => {
        const card = e.target.closest('.list-card');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
}

/* ------------------------------------------------------------------
   Loader: se va cuando la app está lista (mínimo breve para que el
   trazo del logo llegue a dibujarse y no "parpadee").
------------------------------------------------------------------ */
function hideLoader() {
    const loader = $('#app-loader');
    if (!loader) return;
    const elapsed = performance.now();
    const wait = reducedMotion.matches ? 0 : Math.max(0, 900 - elapsed);
    setTimeout(() => {
        document.documentElement.classList.remove('is-loading');
        loader.addEventListener('transitionend', () => loader.remove(), { once: true });
        setTimeout(() => loader.remove(), 800); // por si no hay transición
    }, wait);
}

document.addEventListener('DOMContentLoaded', init);
