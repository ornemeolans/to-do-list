// utils.js: UI efímera — toasts, diálogos y el timer de foco (pomodoro).
// No conoce el estado de la app, por eso no depende de StateManager.
import { icon } from './icons.js';

const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Pequeño helper para crear nodos sin innerHTML (evita XSS por diseño).
export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (value == null || value === false) return;
        if (key === 'className') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : value);
    });
    [].concat(children).forEach(child => {
        if (child == null || child === false) return;
        node.append(typeof child === 'object' ? child : String(child));
    });
    return node;
}

/* ------------------------------------------------------------------
   Toasts — una región aria-live; se muestra un toast por vez.
   `action` opcional: { label, onClick } (ej. "Deshacer").
------------------------------------------------------------------ */
let toastTimer = null;

export function showToast(msg, type = 'info', action = null) {
    const region = document.getElementById('toast-region') || document.body;
    region.querySelectorAll('.toast').forEach(t => t.remove());
    clearTimeout(toastTimer);

    const toast = el('div', { className: `toast toast--${type}`, role: 'status' }, [
        el('span', { className: 'toast__dot', 'aria-hidden': 'true' }),
        el('span', { className: 'toast__msg', text: msg })
    ]);

    if (action) {
        toast.append(el('button', {
            type: 'button',
            className: 'toast__action',
            text: action.label,
            onclick: () => { action.onClick(); dismiss(); }
        }));
    }
    region.append(toast);

    function dismiss() {
        toast.classList.add('is-leaving');
        setTimeout(() => toast.remove(), prefersReducedMotion() ? 0 : 250);
    }
    toastTimer = setTimeout(dismiss, action ? 5500 : 2800);
}

/* ------------------------------------------------------------------
   Diálogo genérico sobre <dialog> nativo: Esc, foco atrapado y
   backdrop vienen gratis del navegador. Todos los modales de la app
   son composiciones de este único componente.
------------------------------------------------------------------ */
export function openDialog({ eyebrow, title, body, actions = [], size = 'md', onSubmit }) {
    const dialog = document.getElementById('app-dialog');
    dialog.className = `dialog dialog--${size}`;
    dialog.replaceChildren();

    const titleId = 'dialog-title';
    dialog.setAttribute('aria-labelledby', titleId);

    const form = el('form', { className: 'dialog__form', method: 'dialog', novalidate: true });
    const header = el('header', { className: 'dialog__head' }, [
        el('div', {}, [
            eyebrow && el('p', { className: 'eyebrow', text: eyebrow }),
            el('h2', { className: 'dialog__title', id: titleId, text: title })
        ]),
        el('button', {
            type: 'button', className: 'icon-btn', 'aria-label': 'Cerrar', title: 'Cerrar',
            onclick: () => close()
        }, icon('x'))
    ]);
    const content = el('div', { className: 'dialog__body' }, body);
    const footer = el('footer', { className: 'dialog__actions' },
        actions.map(a => el('button', {
            type: a.submit ? 'submit' : 'button',
            className: `btn btn--${a.variant || 'ghost'}`,
            text: a.label,
            onclick: a.submit ? null : () => { if (a.onClick?.() !== false) close(); }
        }))
    );

    form.append(header, content);
    if (actions.length) form.append(footer);
    dialog.append(form);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (onSubmit?.() !== false) close();
    });

    // Click en el backdrop (fuera del panel) cierra.
    dialog.onclick = (e) => { if (e.target === dialog) close(); };

    function close() {
        if (!dialog.open) return;
        if (prefersReducedMotion()) { dialog.close(); return; }
        dialog.classList.add('is-closing');
        setTimeout(() => { dialog.classList.remove('is-closing'); dialog.close(); }, 180);
    }

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    dialog.querySelector('[autofocus]')?.focus();
    return { close, dialog };
}

/* Modal de variables de plantilla: {cliente}, {fecha}, ... */
export function showModal(title, fields, onConfirm) {
    const inputs = fields.map((f, i) => {
        const id = `field-${f.var}`;
        const input = el('input', {
            id, type: f.type || 'text', className: 'field__input',
            dataset: { var: f.var }, autofocus: i === 0, required: true,
            placeholder: f.type === 'date' ? null : `Ej. ${f.var === 'cliente' ? 'Lucía Ferreyra' : '…'}`
        });
        return { input, node: el('div', { className: 'field' }, [
            el('label', { className: 'field__label', for: id, text: f.label }), input
        ]) };
    });

    openDialog({
        eyebrow: 'Plantilla',
        title,
        body: [
            el('p', { className: 'dialog__hint', text: 'Completa los campos y la lista se crea con todo reemplazado.' }),
            ...inputs.map(i => i.node)
        ],
        actions: [
            { label: 'Cancelar' },
            { label: 'Crear lista', variant: 'primary', submit: true }
        ],
        onSubmit: () => {
            const vals = {};
            inputs.forEach(({ input }) => { vals[input.dataset.var] = input.value.trim(); });
            onConfirm(vals);
        }
    });
}

export function showTimePickerModal(onSelect) {
    const options = [
        { mins: 15, label: 'Sprint' },
        { mins: 25, label: 'Pomodoro' },
        { mins: 45, label: 'Profundo' },
        { mins: 60, label: 'Maratón' }
    ];
    let dialogRef;
    const grid = el('div', { className: 'time-grid' }, options.map((o, i) =>
        el('button', {
            type: 'button', className: 'time-opt', autofocus: i === 1,
            onclick: () => { dialogRef.close(); onSelect(o.mins); }
        }, [
            el('span', { className: 'time-opt__mins', text: o.mins }),
            el('span', { className: 'time-opt__unit', text: 'min' }),
            el('span', { className: 'time-opt__label', text: o.label })
        ])
    ));

    dialogRef = openDialog({
        eyebrow: 'Modo enfoque',
        title: '¿Cuánto tiempo quieres enfocarte?',
        body: grid,
        size: 'sm'
    });
}

// Modal de edición de tarea. Las subtareas visuales (colores/imágenes) se
// muestran como miniatura y no como un input con 300KB de base64 adentro.
// `validateTaskText` llega por parámetro para no importar TaskService.
export function showTaskEditModal(title, taskData, onSave, validateTaskText) {
    const nameInput = el('input', {
        id: 'edit-task-name', type: 'text', className: 'field__input', autofocus: true
    });
    nameInput.value = taskData.text;

    const rows = el('ul', { className: 'edit-rows' });

    const addRow = (sub = { text: '', completed: false, isVisual: false }) => {
        const row = el('li', { className: 'edit-row', dataset: {
            completed: String(!!sub.completed), visual: String(!!sub.isVisual)
        } });

        if (sub.isVisual) {
            const isColor = /^#[0-9a-f]{6}$/i.test(sub.text);
            const thumb = el('span', { className: 'edit-row__thumb' });
            if (isColor) thumb.style.background = sub.text;
            else thumb.style.backgroundImage = `url("${sub.text}")`;
            row.append(thumb, el('span', { className: 'edit-row__label', text: isColor ? sub.text : 'Imagen del moodboard' }));
            row.dataset.value = sub.text;
        } else {
            const input = el('input', { type: 'text', className: 'field__input', 'aria-label': 'Subtarea', placeholder: 'Subtarea…' });
            input.value = sub.text;
            row.append(input);
        }
        row.append(el('button', {
            type: 'button', className: 'icon-btn icon-btn--danger', 'aria-label': 'Quitar', title: 'Quitar',
            onclick: () => row.remove()
        }, icon('x', { size: 16 })));
        rows.append(row);
        return row;
    };
    taskData.subtasks.forEach(addRow);

    openDialog({
        eyebrow: 'Editar',
        title,
        size: 'md',
        body: [
            el('div', { className: 'field' }, [
                el('label', { className: 'field__label', for: 'edit-task-name', text: 'Nombre de la tarea' }),
                nameInput
            ]),
            el('div', { className: 'field' }, [
                el('span', { className: 'field__label', text: 'Subtareas y visuales' }),
                rows,
                el('button', {
                    type: 'button', className: 'btn btn--link',
                    onclick: () => addRow().querySelector('input')?.focus()
                }, [icon('plus', { size: 16 }), 'Añadir subtarea'])
            ])
        ],
        actions: [
            { label: 'Cancelar' },
            { label: 'Guardar cambios', variant: 'primary', submit: true }
        ],
        onSubmit: () => {
            const newText = validateTaskText(nameInput.value);
            if (!newText) {
                nameInput.setAttribute('aria-invalid', 'true');
                nameInput.focus();
                showToast('El nombre de la tarea es obligatorio', 'warning');
                return false;
            }
            const subtasks = Array.from(rows.children).map(row => ({
                text: row.dataset.visual === 'true' ? row.dataset.value : row.querySelector('input').value.trim(),
                completed: row.dataset.completed === 'true',
                isVisual: row.dataset.visual === 'true'
            })).filter(s => s.text);
            onSave({ text: newText, subtasks });
        }
    });
}

/* ------------------------------------------------------------------
   Modo enfoque — timer basado en timestamps (no en contar ticks),
   así no se atrasa si la pestaña queda en segundo plano.
------------------------------------------------------------------ */
let focusTimerHandle = null;
const BASE_TITLE = document.title;

export function showFocusModal(taskData, minutes, onExit) {
    const dialog = document.getElementById('focus-dialog');
    stopTimer();

    const total = minutes * 60 * 1000;
    let remaining = total;
    let endsAt = null;

    const R = 100;
    const CIRC = 2 * Math.PI * R;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.setAttribute('class', 'focus__ring');
    svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(SVG_NS, 'circle');
    const bar = document.createElementNS(SVG_NS, 'circle');
    [track, bar].forEach(c => {
        c.setAttribute('cx', 110); c.setAttribute('cy', 110); c.setAttribute('r', R);
    });
    track.setAttribute('class', 'focus__track');
    bar.setAttribute('class', 'focus__bar');
    bar.style.strokeDasharray = CIRC;
    bar.style.strokeDashoffset = 0;
    svg.append(track, bar);

    const display = el('time', { className: 'focus__time', text: format(total) });
    const playBtn = el('button', { type: 'button', className: 'btn btn--primary btn--lg' });
    const resetBtn = el('button', { type: 'button', className: 'btn btn--ghost btn--lg', 'aria-label': 'Reiniciar' }, [icon('reset'), 'Reiniciar']);
    const exitBtn = el('button', { type: 'button', className: 'btn btn--ghost btn--lg' }, [icon('x'), 'Salir']);
    setPlayLabel('Iniciar', 'play');

    const subtasks = (taskData.subtasks || []).length
        ? el('ul', { className: 'focus__subtasks' }, taskData.subtasks.map(s =>
            el('li', { className: s.completed ? 'is-done' : '' }, [
                el('span', { className: 'focus__bullet', 'aria-hidden': 'true' }), s.text
            ])))
        : null;

    dialog.replaceChildren(el('div', { className: 'focus__panel' }, [
        el('p', { className: 'eyebrow', text: `Modo enfoque · ${minutes} min` }),
        el('h2', { className: 'focus__title', id: 'focus-title', text: taskData.text }),
        el('div', { className: 'focus__timer', role: 'timer', 'aria-live': 'off' }, [svg, display]),
        subtasks,
        el('div', { className: 'focus__actions' }, [playBtn, resetBtn, exitBtn])
    ]));
    dialog.setAttribute('aria-labelledby', 'focus-title');

    function format(ms) {
        const s = Math.ceil(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    function setPlayLabel(text, iconName) {
        playBtn.replaceChildren(icon(iconName), text);
    }
    function paint() {
        const ratio = remaining / total;
        display.textContent = format(remaining);
        bar.style.strokeDashoffset = CIRC * (1 - ratio);
        dialog.dataset.phase = ratio < 0.2 ? 'end' : ratio < 0.5 ? 'mid' : 'start';
        if (endsAt) document.title = `${format(remaining)} · ${taskData.text}`;
    }
    function tick() {
        remaining = Math.max(0, endsAt - Date.now());
        paint();
        if (remaining === 0) {
            stopTimer();
            endsAt = null;
            dialog.classList.add('is-complete');
            setPlayLabel('Otra vuelta', 'reset');
            showToast('Tiempo cumplido. Buen trabajo.', 'success');
        }
    }

    playBtn.onclick = () => {
        if (focusTimerHandle) {
            stopTimer();
            remaining = Math.max(0, endsAt - Date.now());
            endsAt = null;
            setPlayLabel('Continuar', 'play');
        } else {
            if (remaining === 0) { remaining = total; dialog.classList.remove('is-complete'); }
            endsAt = Date.now() + remaining;
            focusTimerHandle = setInterval(tick, 250);
            setPlayLabel('Pausar', 'pause');
        }
        dialog.classList.toggle('is-running', !!focusTimerHandle);
    };
    resetBtn.onclick = () => {
        stopTimer();
        endsAt = null;
        remaining = total;
        dialog.classList.remove('is-running', 'is-complete');
        setPlayLabel('Iniciar', 'play');
        paint();
    };
    exitBtn.onclick = () => onExit();
    dialog.oncancel = (e) => { e.preventDefault(); onExit(); }; // Esc

    dialog.classList.remove('is-running', 'is-complete');
    paint();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.documentElement.classList.add('is-focusing');
    playBtn.focus();
}

function stopTimer() {
    if (focusTimerHandle) clearInterval(focusTimerHandle);
    focusTimerHandle = null;
    document.title = BASE_TITLE;
}

export function hideFocusModal() {
    stopTimer();
    const dialog = document.getElementById('focus-dialog');
    if (dialog?.open) dialog.close();
    else dialog?.removeAttribute('open');
    document.documentElement.classList.remove('is-focusing');
}
