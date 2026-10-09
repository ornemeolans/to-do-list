// TaskService: capa de RENDER. Toma datos de StateManager y arma el DOM.
// Los eventos nunca guardan estado en el DOM: llaman a StateManager, que
// muta el estado y dispara el próximo render vía `onChange`.
import { StateManager } from './StateManager.js';
import { StorageService } from './StorageService.js';
import { icon, iconButton } from './icons.js';
import * as utils from './utils.js';

const { el } = utils;

// Tarea que se está arrastrando (sin globals en window).
let draggedTaskInfo = null; // { listId, taskId }

// Qué listas ya se pintaron alguna vez: solo las NUEVAS se animan al entrar,
// así un re-render por tildar una subtarea no vuelve a disparar animaciones.
const seenListIds = new Set();
let firstRender = true;

// Tarea recién marcada como realizada → se anima el trazo de tachado.
let justCompletedTaskId = null;

export function extractVariables(list) {
    let allText = list.name;
    list.tasks.forEach(t => {
        allText += ' ' + t.text;
        if (t.subtasks) t.subtasks.forEach(s => allText += ' ' + s.text);
    });
    const varMatch = allText.match(/{([a-zA-Z]+)}/g);
    return varMatch ? [...new Set(varMatch.map(v => v.slice(1, -1).toLowerCase()))] : [];
}

export function validateVisual(text) {
    const isColor = /^#[0-9A-F]{6}$/i.test(text);
    const isDataUrl = /^data:image\/[a-z+]+;base64,/i.test(text);
    const isImgUrl = /^(http|https):\/\/.*\.(jpg|jpeg|png|webp|gif|svg)/i.test(text);
    return { isColor, isImg: isDataUrl || isImgUrl, content: text };
}

export function validateTaskText(text) {
    const trimmed = text ? text.trim() : '';
    return trimmed || null;
}

/* ------------------------------------------------------------------
   Entrada principal
------------------------------------------------------------------ */
export function renderAll(activeLists, container) {
    if (!Array.isArray(activeLists)) {
        console.warn('activeLists no es un array:', activeLists);
        return;
    }

    container.replaceChildren();
    container.setAttribute('aria-busy', 'false');

    if (activeLists.length === 0) {
        container.append(renderEmptyState());
        return;
    }

    activeLists.forEach((list, index) => {
        const card = renderList(list, index);
        if (!seenListIds.has(list.id)) {
            // Primera carga: reveal escalonado. Después: solo la lista nueva.
            card.classList.add(firstRender ? 'reveal' : 'is-new');
            card.style.setProperty('--stagger', firstRender ? index : 0);
            seenListIds.add(list.id);
        }
        container.append(card);
    });

    firstRender = false;
    justCompletedTaskId = null;
}

function renderEmptyState() {
    return el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-state__art', 'aria-hidden': 'true' }, [
            el('span', { className: 'empty-state__sheet' }),
            el('span', { className: 'empty-state__sheet' }),
            el('span', { className: 'empty-state__sheet' }, icon('check', { size: 28 }))
        ]),
        el('h2', { className: 'empty-state__title', text: 'Una página en blanco.' }),
        el('p', { className: 'empty-state__text', text: 'Crea tu primera lista desde arriba o arranca con una plantilla de la columna izquierda.' })
    ]);
}

/* ------------------------------------------------------------------
   Lista (tarjeta con tablero de dos columnas)
------------------------------------------------------------------ */
function renderList(list, index) {
    const done = list.tasks.filter(t => t.status === 'Realizada').length;
    const total = list.tasks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const titleId = `list-title-${list.id}`;

    const title = editable('h2', 'list-card__title', list.name, 'Nombre de la lista', (text) => {
        StateManager.updateListName(list.id, text);
    }, 'El nombre de la lista no puede estar vacío');
    title.id = titleId;

    const saveBtn = iconButton('bookmark', 'Guardar como plantilla');
    saveBtn.addEventListener('click', () => {
        StorageService.saveListAsSuggestion({ name: list.name, tasks: list.tasks });
        document.dispatchEvent(new CustomEvent('suggestions:changed'));
        utils.showToast('Guardada en tus plantillas', 'success');
    });

    const deleteBtn = iconButton('trash', 'Eliminar lista', 'icon-btn--danger');
    deleteBtn.addEventListener('click', () => {
        const removed = StateManager.deleteList(list.id);
        if (!removed) return;
        seenListIds.delete(list.id);
        utils.showToast(`“${list.name}” eliminada`, 'info', {
            label: 'Deshacer',
            onClick: () => StateManager.insertList(removed.list, removed.index)
        });
    });

    const header = el('header', { className: 'list-card__head' }, [
        el('div', { className: 'list-card__heading' }, [
            el('p', { className: 'eyebrow', text: `Lista ${String(index + 1).padStart(2, '0')}` }),
            title
        ]),
        el('div', { className: 'list-card__tools' }, [saveBtn, deleteBtn])
    ]);

    const progress = el('div', { className: 'list-card__progress' }, [
        el('div', {
            className: 'meter', role: 'progressbar', 'aria-label': 'Progreso de la lista',
            'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct
        }, el('span', { className: 'meter__fill', style: `--p:${pct}%` })),
        el('span', { className: 'list-card__count', text: `${done}/${total}` })
    ]);

    const pending = buildColumn(list, 'Pendiente', 'Pendientes');
    const completed = buildColumn(list, 'Realizada', 'Realizadas');
    list.tasks.forEach(task => {
        (task.status === 'Realizada' ? completed : pending).ul.append(renderTask(list, task));
    });
    [pending, completed].forEach(col => {
        if (!col.ul.children.length) {
            col.ul.append(el('li', {
                className: 'column__empty',
                text: col.status === 'Pendiente'
                    ? (total ? 'Todo listo por aquí.' : 'Sin tareas todavía.')
                    : 'Arrastra tareas aquí al terminarlas.'
            }));
        }
        col.count.textContent = col.ul.querySelectorAll('.task-item').length;
    });

    // Composer: un <form> real → Enter funciona sin listeners globales.
    const input = el('input', {
        type: 'text', className: 'composer__input', placeholder: 'Añadir una tarea…',
        'aria-label': `Nueva tarea en ${list.name}`, maxlength: 140
    });
    const composer = el('form', { className: 'composer' }, [
        input,
        el('button', { type: 'submit', className: 'composer__submit', 'aria-label': 'Agregar tarea', title: 'Agregar tarea' }, icon('plus'))
    ]);
    composer.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) {
            composer.classList.remove('is-shaking');
            void composer.offsetWidth; // reinicia la animación
            composer.classList.add('is-shaking');
            utils.showToast('Escribe algo antes de agregar la tarea', 'warning');
            return;
        }
        StateManager.addTask(list.id, { text, status: 'Pendiente', subtasks: [] });
        // Re-render: devolvemos el foco al composer de esta misma lista.
        requestAnimationFrame(() => {
            document.querySelector(`[data-list-id="${list.id}"] .composer__input`)?.focus();
        });
    });

    return el('article', {
        className: `list-card${total && pct === 100 ? ' is-complete' : ''}`,
        dataset: { listId: list.id },
        'aria-labelledby': titleId
    }, [
        header,
        progress,
        el('div', { className: 'board' }, [pending.col, completed.col]),
        composer
    ]);
}

function buildColumn(list, status, label) {
    const count = el('span', { className: 'column__count' });
    const ul = el('ul', { className: 'column__list', 'aria-label': `Tareas ${label.toLowerCase()}` });
    const col = el('section', { className: 'column', dataset: { status } }, [
        el('h3', { className: 'column__label' }, [
            el('span', { className: 'column__dot', 'aria-hidden': 'true' }), label, count
        ]),
        ul
    ]);

    // Drag & drop nativo — toda la columna es zona de drop, no solo el <ul>.
    col.addEventListener('dragover', (e) => {
        if (!draggedTaskInfo) return;
        e.preventDefault();
        col.classList.add('is-drop-target');
    });
    col.addEventListener('dragleave', (e) => {
        if (!col.contains(e.relatedTarget)) col.classList.remove('is-drop-target');
    });
    col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('is-drop-target');
        if (!draggedTaskInfo) return;
        if (draggedTaskInfo.listId !== list.id) {
            utils.showToast('Las tareas solo se mueven dentro de su lista', 'warning');
            return;
        }
        const task = StateManager.getTask(list.id, draggedTaskInfo.taskId);
        if (!task || task.status === status) return;
        if (status === 'Realizada') justCompletedTaskId = task.id;
        StateManager.setTaskStatus(list.id, task.id, status, true);
    });

    return { col, ul, count, status };
}

/* ------------------------------------------------------------------
   Tarea
------------------------------------------------------------------ */
function renderTask(list, task) {
    const isDone = task.status === 'Realizada';
    const textSubs = task.subtasks.filter(s => !s.isVisual);
    const subsDone = textSubs.filter(s => s.completed).length;

    const li = el('li', {
        className: `task-item${isDone ? ' is-done' : ''}${task.id === justCompletedTaskId ? ' just-done' : ''}`,
        draggable: 'true',
        dataset: { taskId: task.id }
    });
    li.addEventListener('dragstart', (e) => {
        draggedTaskInfo = { listId: list.id, taskId: task.id };
        e.dataTransfer?.setData('text/plain', task.text);
        requestAnimationFrame(() => li.classList.add('is-dragging'));
    });
    li.addEventListener('dragend', () => {
        draggedTaskInfo = null;
        li.classList.remove('is-dragging');
    });

    // Check circular: alternativa accesible (teclado) al drag & drop.
    const check = el('button', {
        type: 'button', className: 'task-check',
        'aria-pressed': String(isDone),
        'aria-label': isDone ? 'Marcar como pendiente' : 'Marcar como realizada'
    }, icon('check', { size: 14 }));
    check.addEventListener('click', () => {
        const next = isDone ? 'Pendiente' : 'Realizada';
        if (next === 'Realizada') justCompletedTaskId = task.id;
        StateManager.setTaskStatus(list.id, task.id, next, true);
    });

    const text = editable('span', 'task-text', task.text, 'Texto de la tarea', (value) => {
        StateManager.updateTask(list.id, task.id, { text: value });
    }, 'El texto no puede estar vacío');

    const editBtn = iconButton('pencil', 'Editar tarea', '', 16);
    editBtn.addEventListener('click', () => {
        utils.showTaskEditModal('Editar tarea', {
            text: task.text,
            subtasks: task.subtasks.map(s => ({ ...s }))
        }, (newData) => {
            StateManager.updateTask(list.id, task.id, newData);
        }, validateTaskText);
    });

    const focusBtn = iconButton('target', 'Modo enfoque', '', 16);
    focusBtn.addEventListener('click', () => {
        const data = { text: task.text, subtasks: textSubs };
        utils.showTimePickerModal((mins) => utils.showFocusModal(data, mins, utils.hideFocusModal));
    });

    const deleteBtn = iconButton('x', 'Eliminar tarea', 'icon-btn--danger', 16);
    deleteBtn.addEventListener('click', () => {
        li.classList.add('is-leaving');
        const remove = () => StateManager.deleteTask(list.id, task.id);
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) remove();
        else setTimeout(remove, 200);
    });

    const meta = textSubs.length
        ? el('span', { className: 'task-meta', title: 'Subtareas completadas' }, `${subsDone}/${textSubs.length}`)
        : null;

    li.append(el('div', { className: 'task-row' }, [
        el('span', { className: 'task-grip', 'aria-hidden': 'true' }, icon('grip', { size: 14 })),
        check,
        el('div', { className: 'task-body' }, [text, meta]),
        el('div', { className: 'task-tools' }, [focusBtn, editBtn, deleteBtn])
    ]));

    const visuals = task.subtasks.map((s, i) => ({ s, i, v: validateVisual(s.text) }))
        .filter(({ s, v }) => s.isVisual && (v.isColor || v.isImg));
    if (visuals.length) li.append(renderMoodboard(list, task, visuals));

    const subList = el('ul', { className: 'subtasks' });
    task.subtasks.forEach((sub, index) => {
        const v = validateVisual(sub.text);
        if (sub.isVisual && (v.isColor || v.isImg)) return;
        subList.append(renderSubtask(list, task, sub, index));
    });
    if (subList.children.length) li.append(subList);

    li.append(renderSubComposer(list, task));
    return li;
}

function renderSubtask(list, task, sub, index) {
    const id = `sub-${task.id}-${index}`;
    const checkbox = el('input', { type: 'checkbox', id, className: 'subtask__check' });
    checkbox.checked = !!sub.completed;
    checkbox.addEventListener('change', () => {
        StateManager.updateSubtask(list.id, task.id, index, { completed: checkbox.checked });
    });

    const text = editable('span', 'subtask__text', sub.text, 'Texto de la subtarea', (value) => {
        StateManager.updateSubtask(list.id, task.id, index, { text: value });
    }, 'La subtarea no puede estar vacía');

    const del = iconButton('x', 'Eliminar subtarea', 'icon-btn--danger icon-btn--xs', 14);
    del.addEventListener('click', () => StateManager.deleteSubtask(list.id, task.id, index));

    return el('li', { className: `subtask${sub.completed ? ' is-done' : ''}` }, [
        checkbox,
        el('label', { className: 'subtask__box', for: id, 'aria-label': 'Completar subtarea' }, icon('check', { size: 12 })),
        text,
        del
    ]);
}

function renderSubComposer(list, task) {
    const input = el('input', {
        type: 'text', className: 'sub-input', placeholder: 'Subtarea, #color o URL…',
        'aria-label': 'Nueva subtarea', maxlength: 2000
    });
    const imageBtn = iconButton('image', 'Subir imagen al moodboard', 'icon-btn--xs', 16);
    imageBtn.addEventListener('click', async () => {
        const base64 = await pickLocalImage();
        if (base64) {
            StateManager.addSubtask(list.id, task.id, { text: base64, isVisual: true });
            utils.showToast('Imagen agregada al moodboard', 'success');
        }
    });

    const form = el('form', { className: 'sub-composer' }, [
        el('span', { className: 'sub-composer__plus', 'aria-hidden': 'true' }, icon('plus', { size: 14 })),
        input,
        imageBtn
    ]);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const v = validateVisual(text);
        StateManager.addSubtask(list.id, task.id, { text, isVisual: v.isColor || v.isImg });
        requestAnimationFrame(() => {
            document.querySelector(`[data-task-id="${task.id}"] .sub-input`)?.focus();
        });
    });
    return form;
}

function renderMoodboard(list, task, visuals) {
    return el('div', { className: 'moodboard', role: 'list', 'aria-label': 'Moodboard' },
        visuals.map(({ s, i, v }) => {
            const tile = el('button', {
                type: 'button', className: 'mood-tile', role: 'listitem',
                'aria-label': v.isColor ? `Color ${s.text}` : 'Ver imagen',
                title: v.isColor ? s.text : 'Ver imagen'
            });
            if (v.isColor) tile.style.backgroundColor = s.text;
            else tile.style.backgroundImage = `url("${s.text}")`;
            tile.addEventListener('click', () => showFullVisual(s.text, v.isColor));

            const del = iconButton('x', 'Quitar del moodboard', 'mood-tile__remove', 12);
            del.addEventListener('click', () => StateManager.deleteSubtask(list.id, task.id, i));
            return el('div', { className: 'mood-item' }, [tile, del]);
        })
    );
}

/* ------------------------------------------------------------------
   Texto editable inline: Enter confirma, Esc revierte, vacío no se acepta.
------------------------------------------------------------------ */
function editable(tag, className, value, label, onCommit, emptyMsg) {
    const node = el(tag, {
        className: `${className} editable`, role: 'textbox', 'aria-label': label,
        spellcheck: 'false', text: value
    });
    node.contentEditable = 'true';
    node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
        if (e.key === 'Escape') { node.textContent = value; node.blur(); }
    });
    node.addEventListener('blur', () => {
        const text = validateTaskText(node.textContent);
        if (!text) {
            utils.showToast(emptyMsg, 'warning');
            node.textContent = value;
            return;
        }
        if (text !== value) onCommit(text);
    });
    return node;
}

/* ------------------------------------------------------------------
   Imágenes locales (moodboard)
------------------------------------------------------------------ */
function pickLocalImage() {
    return new Promise((resolve) => {
        const input = el('input', { type: 'file', accept: 'image/*', className: 'visually-hidden' });
        document.body.append(input);

        input.addEventListener('change', () => {
            const file = input.files[0];
            input.remove();
            if (!file) return resolve(null);

            if (file.size > 20 * 1024 * 1024) {
                utils.showToast('La imagen supera los 20 MB', 'warning');
                return resolve(null);
            }
            downscaleImage(file).then((dataUrl) => {
                if (StorageService.isBigImage(dataUrl)) {
                    utils.showToast('La imagen sigue siendo demasiado pesada tras comprimirla', 'warning');
                    return resolve(null);
                }
                resolve(dataUrl);
            }).catch(() => {
                utils.showToast('No se pudo leer la imagen', 'warning');
                resolve(null);
            });
        });
        input.addEventListener('cancel', () => { input.remove(); resolve(null); });
        input.click();
    });
}

// Redimensiona a 1280px como máximo y re-codifica (WebP, o JPEG si el navegador
// no lo soporta): una foto de 4 MB del celular queda en ~150 KB, lo que
// cuida localStorage y el límite de 1 MB por documento de Firestore.
async function downscaleImage(file, maxSide = 1280) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const webp = canvas.toDataURL('image/webp', 0.82);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82);
}

function showFullVisual(content, isColor) {
    const media = isColor
        ? el('div', { className: 'viewer__swatch', style: `background:${content}` }, el('span', { text: content }))
        : el('img', { className: 'viewer__img', src: content, alt: 'Imagen del moodboard' });

    utils.openDialog({
        eyebrow: 'Moodboard',
        title: isColor ? 'Color' : 'Imagen',
        body: media,
        size: 'lg'
    });
}
