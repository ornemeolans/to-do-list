// TaskService: capa de RENDER. Toma datos de StateManager y arma el DOM.
// Los eventos que arma no tocan el DOM de estado directamente -llaman a
// métodos de StateManager-, que es quien decide qué cambió y dispara el
// próximo render vía `onChange`. Antes, buena parte de esto vivía como JSON
// pegado en `dataset.subtasks`, desincronizado de StateManager: ese es el
// bug que se resolvió unificando todo acá.
import { StateManager } from './StateManager.js';
import { StorageService } from './StorageService.js';
import * as utils from './utils.js';

// Info de la tarea que se está arrastrando (reemplaza el `window.draggedTask` global)
let draggedTaskInfo = null; // { listId, taskId }

export function extractVariables(list) {
    let allText = list.name;
    list.tasks.forEach(t => {
        allText += " " + t.text;
        if (t.subtasks) t.subtasks.forEach(s => allText += " " + s.text);
    });
    const varMatch = allText.match(/{([a-zA-Z]+)}/g);
    return varMatch ? [...new Set(varMatch.map(v => v.slice(1, -1).toLowerCase()))] : [];
}

export function validateVisual(text) {
    const isColor = /^#[0-9A-F]{6}$/i.test(text);
    const isDataUrl = /^data:image\/[a-z]+;base64,/i.test(text);
    const isImgUrl = /^(http|https):\/\/.*\.(jpg|jpeg|png|webp|gif|svg)/i.test(text);
    return { isColor, isImg: isDataUrl || isImgUrl, content: text };
}

export function validateTaskText(text) {
    const trimmed = text ? text.trim() : '';
    return trimmed || null;
}

// --- Entrada principal de render ---

export function renderAll(activeLists, container) {
    container.innerHTML = '';
    if (!Array.isArray(activeLists)) {
        console.warn('activeLists no es un array:', activeLists);
        return;
    }
    activeLists.forEach(list => renderList(list, container));
    utils.initLucideIcons();
}

function renderList(list, container) {
    const listDiv = document.createElement('div');
    listDiv.className = 'task-list';
    listDiv.dataset.listId = list.id;

    const fragment = document.createDocumentFragment();

    const h3 = document.createElement('h3');
    h3.contentEditable = true;
    h3.setAttribute('aria-label', 'Nombre de la lista (editar)');
    h3.textContent = list.name;
    h3.addEventListener('blur', () => {
        const text = validateTaskText(h3.textContent);
        if (!text) {
            utils.showToast('El nombre de la lista no puede estar vacío');
            h3.textContent = list.name; // revertir al último valor válido conocido
            return;
        }
        StateManager.updateListName(list.id, text);
    });
    fragment.appendChild(h3);

    const taskColumns = document.createElement('div');
    taskColumns.className = 'task-columns';
    taskColumns.setAttribute('role', 'region');
    taskColumns.setAttribute('aria-label', 'Columnas de tareas');

    const colPending = buildColumn('Pendiente', 'PENDIENTES');
    const colDone = buildColumn('Realizada', 'REALIZADAS');
    taskColumns.appendChild(colPending.col);
    taskColumns.appendChild(colDone.col);
    fragment.appendChild(taskColumns);

    const listFooter = document.createElement('div');
    listFooter.className = 'list-footer';

    const taskInput = document.createElement('input');
    taskInput.type = 'text';
    taskInput.placeholder = 'Nueva tarea...';
    taskInput.className = 'task-input';
    taskInput.setAttribute('aria-label', 'Nueva tarea');

    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'add-task-btn';
    addTaskBtn.setAttribute('aria-label', 'Agregar tarea');
    addTaskBtn.appendChild(iconEl('plus'));

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-suggestion-btn';
    saveBtn.setAttribute('aria-label', 'Guardar como sugerencia');
    saveBtn.appendChild(iconEl('save'));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-list-btn';
    deleteBtn.setAttribute('aria-label', 'Eliminar lista');
    deleteBtn.appendChild(iconEl('trash-2'));

    listFooter.appendChild(taskInput);
    listFooter.appendChild(addTaskBtn);
    listFooter.appendChild(saveBtn);
    listFooter.appendChild(deleteBtn);
    fragment.appendChild(listFooter);

    listDiv.appendChild(fragment);
    container.appendChild(listDiv);

    // Render de tareas ya existentes en el estado
    list.tasks.forEach(task => {
        const targetUl = task.status === 'Realizada' ? colDone.ul : colPending.ul;
        targetUl.appendChild(renderTask(list, task));
    });

    // --- Eventos de la lista ---

    const submitNewTask = () => {
        const text = taskInput.value.trim();
        if (!text) {
            utils.showToast('No se pueden crear tareas vacías', 'advertencia');
            return;
        }
        StateManager.addTask(list.id, { text, status: 'Pendiente', subtasks: [] });
        taskInput.value = '';
    };
    addTaskBtn.onclick = submitNewTask;
    taskInput.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitNewTask(); } };

    saveBtn.onclick = () => {
        // Como ahora `list` ES el estado real, guardamos la lista tal cual
        // está -antes había que reconstruirla leyendo el DOM tarea por tarea-.
        StorageService.saveListAsSuggestion({ name: list.name, tasks: list.tasks });
        utils.showToast('¡Lista guardada en sugerencias! ✨', 'exito');
        if (typeof window.renderSuggestions === 'function') window.renderSuggestions();
    };

    deleteBtn.onclick = () => {
        StateManager.deleteList(list.id);
        utils.showToast('Lista eliminada', 'info');
    };

    // Drag & drop: solo se admite mover tareas entre columnas de LA MISMA lista.
    [colPending.ul, colDone.ul].forEach(ul => {
        ul.addEventListener('dragover', (e) => {
            e.preventDefault();
            ul.classList.add('drag-over');
        });
        ul.addEventListener('dragleave', () => ul.classList.remove('drag-over'));
        ul.addEventListener('drop', (e) => {
            e.preventDefault();
            ul.classList.remove('drag-over');
            if (!draggedTaskInfo) return;
            if (draggedTaskInfo.listId !== list.id) {
                // La versión anterior "aceptaba" este drop pero no movía nada
                // realmente entre listas (bug silencioso). Ahora se avisa.
                utils.showToast('No se pueden mover tareas entre listas distintas', 'advertencia');
                return;
            }
            const targetStatus = ul.closest('.task-column').dataset.status;
            StateManager.setTaskStatus(draggedTaskInfo.listId, draggedTaskInfo.taskId, targetStatus, true);
        });
    });
}

function buildColumn(status, label) {
    const col = document.createElement('div');
    col.className = 'task-column';
    col.dataset.status = status;
    const h4 = document.createElement('h4');
    h4.className = 'task-column-label';
    h4.textContent = label;
    const ul = document.createElement('ul');
    ul.className = 'task-column-list';
    ul.setAttribute('aria-label', `Tareas ${label.toLowerCase()}`);
    col.appendChild(h4);
    col.appendChild(ul);
    return { col, ul };
}

function iconEl(name) {
    const i = document.createElement('i');
    i.dataset.lucide = name;
    return i;
}

// --- Render de una tarea ---

function renderTask(list, task) {
    const taskLi = document.createElement('li');
    taskLi.className = 'task-item';
    taskLi.draggable = true;
    taskLi.addEventListener('dragstart', () => {
        draggedTaskInfo = { listId: list.id, taskId: task.id };
    });
    taskLi.addEventListener('dragend', () => { draggedTaskInfo = null; });

    const taskMain = document.createElement('div');
    taskMain.className = 'task-main';

    const taskText = document.createElement('span');
    taskText.className = 'task-text';
    taskText.contentEditable = true;
    taskText.textContent = task.text;
    taskText.addEventListener('blur', () => {
        const text = validateTaskText(taskText.textContent);
        if (!text) {
            utils.showToast('El texto no puede estar vacío');
            taskText.textContent = task.text;
            return;
        }
        StateManager.updateTask(list.id, task.id, { text });
    });
    taskMain.appendChild(taskText);

    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select';
    statusSelect.setAttribute('aria-label', 'Estado de la tarea');
    const optPending = new Option('⏳ Pendiente', 'Pendiente', false, task.status === 'Pendiente');
    const optDone = new Option('✅ Realizada', 'Realizada', false, task.status === 'Realizada');
    statusSelect.appendChild(optPending);
    statusSelect.appendChild(optDone);
    statusSelect.addEventListener('change', () => {
        StateManager.setTaskStatus(list.id, task.id, statusSelect.value, true);
    });
    taskMain.appendChild(statusSelect);

    const editBtn = document.createElement('button');
    editBtn.className = 'task-edit-btn';
    editBtn.title = 'Editar';
    editBtn.setAttribute('aria-label', 'Editar tarea');
    editBtn.appendChild(iconEl('edit-3'));
    editBtn.addEventListener('click', () => {
        const current = {
            text: task.text,
            subtasks: task.subtasks.map(s => ({ text: s.text, completed: s.completed }))
        };
        utils.showTaskEditModal('Editar Tarea', current, (newData) => {
            const newSubtasks = newData.subtasks.map(s => ({
                text: s.text,
                completed: s.completed || false,
                isVisual: validateVisual(s.text).isImg || /^#[0-9A-F]{6}$/i.test(s.text)
            }));
            StateManager.updateTask(list.id, task.id, { text: newData.text, subtasks: newSubtasks });
        }, validateTaskText);
    });
    taskMain.appendChild(editBtn);

    const focusBtn = document.createElement('button');
    focusBtn.className = 'focus-btn';
    focusBtn.title = 'Enfoque';
    focusBtn.setAttribute('aria-label', 'Modo enfoque');
    focusBtn.appendChild(iconEl('target'));
    focusBtn.addEventListener('click', () => {
        const data = { text: task.text, subtasks: task.subtasks.filter(s => !s.isVisual) };
        utils.showTimePickerModal((mins) => {
            utils.showFocusModal(data, mins, utils.hideFocusModal);
        });
    });
    taskMain.appendChild(focusBtn);

    const deleteBtnTask = document.createElement('button');
    deleteBtnTask.className = 'delete-task-btn';
    deleteBtnTask.setAttribute('aria-label', 'Eliminar tarea');
    deleteBtnTask.appendChild(iconEl('x'));
    deleteBtnTask.addEventListener('click', () => {
        StateManager.deleteTask(list.id, task.id);
    });
    taskMain.appendChild(deleteBtnTask);

    taskLi.appendChild(taskMain);

    const moodboard = document.createElement('div');
    moodboard.className = 'moodboard-container';
    taskLi.appendChild(moodboard);

    const subtaskList = document.createElement('ul');
    subtaskList.className = 'subtask-list';
    taskLi.appendChild(subtaskList);

    const subControls = document.createElement('div');
    subControls.className = 'subtask-controls';

    const subInput = document.createElement('input');
    subInput.type = 'text';
    subInput.placeholder = 'Subtarea...';
    subInput.className = 'sub-input';
    subControls.appendChild(subInput);

    const addSubBtn = document.createElement('button');
    addSubBtn.className = 'add-sub-btn';
    addSubBtn.setAttribute('aria-label', 'Agregar subtarea');
    addSubBtn.textContent = '+';
    subControls.appendChild(addSubBtn);

    const imageBtn = document.createElement('button');
    imageBtn.className = 'add-image-btn';
    imageBtn.setAttribute('aria-label', 'Agregar imagen local');
    imageBtn.textContent = '📁';
    imageBtn.addEventListener('click', async () => {
        const base64 = await pickLocalImage();
        if (base64) {
            StateManager.addSubtask(list.id, task.id, { text: base64, isVisual: true });
            utils.showToast('Imagen agregada al moodboard');
        }
    });
    subControls.appendChild(imageBtn);
    taskLi.appendChild(subControls);

    const submitSubtask = () => {
        const text = subInput.value.trim();
        if (!text) return;
        const isVisual = validateVisual(text).isColor || validateVisual(text).isImg;
        StateManager.addSubtask(list.id, task.id, { text, isVisual });
        subInput.value = '';
    };
    addSubBtn.onclick = submitSubtask;
    subInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitSubtask(); }
    });

    renderSubtasks(list, task, moodboard, subtaskList);

    return taskLi;
}

function renderSubtasks(list, task, moodboard, subtaskList) {
    moodboard.innerHTML = '';
    subtaskList.innerHTML = '';

    task.subtasks.forEach((sub, index) => {
        const validation = validateVisual(sub.text);

        if (sub.isVisual && (validation.isColor || validation.isImg)) {
            const item = document.createElement('div');
            item.className = 'mood-item';
            if (validation.isColor) item.style.backgroundColor = sub.text;
            else item.style.backgroundImage = `url(${sub.text})`;

            item.onclick = (e) => {
                if (e.target.closest('.delete-mood-btn')) return;
                showFullVisual(sub.text, validation.isColor);
            };
            item.oncontextmenu = async (e) => {
                e.preventDefault();
                const base64 = await pickLocalImage();
                if (base64) StateManager.addSubtask(list.id, task.id, { text: base64, isVisual: true });
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-mood-btn';
            delBtn.textContent = '✕';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                StateManager.deleteSubtask(list.id, task.id, index);
            };
            item.appendChild(delBtn);
            moodboard.appendChild(item);
        } else {
            const subLi = document.createElement('li');
            subLi.className = 'subtask-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = sub.completed || false;
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                StateManager.updateSubtask(list.id, task.id, index, { completed: checkbox.checked });
            });

            const textSpan = document.createElement('span');
            textSpan.contentEditable = true;
            textSpan.textContent = sub.text;
            textSpan.addEventListener('blur', () => {
                const text = validateTaskText(textSpan.textContent);
                if (!text) {
                    utils.showToast('La subtarea no puede estar vacía');
                    textSpan.textContent = sub.text;
                    return;
                }
                StateManager.updateSubtask(list.id, task.id, index, { text });
            });

            const deleteBtnSub = document.createElement('button');
            deleteBtnSub.className = 'delete-sub-btn';
            deleteBtnSub.appendChild(iconEl('trash-2'));
            deleteBtnSub.addEventListener('click', (e) => {
                e.stopPropagation();
                StateManager.deleteSubtask(list.id, task.id, index);
            });

            subLi.appendChild(checkbox);
            subLi.appendChild(textSpan);
            subLi.appendChild(deleteBtnSub);
            subtaskList.appendChild(subLi);
        }
    });

    utils.initLucideIcons();
}

// --- Imágenes locales (moodboard) ---

function pickLocalImage() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.className = 'visually-hidden-file-input';
        document.body.appendChild(input);
        input.click();

        input.onchange = (e) => {
            const file = e.target.files[0];
            input.remove();

            if (!file) { resolve(null); return; }

            if (file.size > StorageService.MAX_IMAGE_SIZE) {
                utils.showToast(`Imagen muy grande (${(file.size / 1024 / 1024).toFixed(1)}MB > 1MB)`, 'advertencia');
                resolve(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        };

        input.onblur = () => {
            input.remove();
            resolve(null);
        };
    });
}

function showFullVisual(content, isColor) {
    const viewer = document.createElement('div');
    viewer.className = 'visual-viewer-overlay';

    let viewerContent;
    if (isColor) {
        viewerContent = document.createElement('div');
        viewerContent.className = 'viewer-content viewer-content-color';
        viewerContent.style.background = content;
    } else {
        viewerContent = document.createElement('img');
        viewerContent.src = content;
        viewerContent.className = 'viewer-content viewer-content-img';
    }
    viewer.appendChild(viewerContent);

    viewer.onclick = () => viewer.remove();
    document.body.appendChild(viewer);
}
