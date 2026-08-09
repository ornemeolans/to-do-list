// StateManager: ÚNICA fuente de verdad del estado de la app.
// Todo lo que se ve en pantalla (listas, tareas, subtareas, imágenes del
// moodboard) vive acá, en `activeLists`. Nada se guarda "solo en el DOM":
// así se evita el bug de la versión anterior donde subtareas y cambios de
// estado se perdían al re-renderizar porque solo existían en dataset attrs.
//
// StateManager no sabe nada de DOM. Cuando algo cambia, llama a `onChange`
// (inyectado desde main.js) para que la capa de render se entere. Así se
// evita un import circular con TaskService.
import { StorageService } from './StorageService.js';

export const StateManager = {
    activeLists: [],
    nextId: 1, // Fallback si crypto.randomUUID no está disponible
    onChange: null, // callback(activeLists) — lo setea main.js

    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `id_${Date.now()}_${this.nextId++}`;
    },

    _notify() {
        StorageService.saveActiveLists(this.activeLists);
        if (typeof this.onChange === 'function') this.onChange(this.activeLists);
    },

    getList(listId) {
        return this.activeLists.find(l => l.id === listId) || null;
    },

    getTask(listId, taskId) {
        const list = this.getList(listId);
        if (!list) return null;
        return list.tasks.find(t => t.id === taskId) || null;
    },

    async load() {
        try {
            this.activeLists = await StorageService.loadActiveLists() || [];
        } catch (e) {
            console.error('Load failed:', e);
            this.activeLists = [];
        }
    },

    // Guardado inmediato (sin debounce) — útil antes de una acción irreversible
    // como cerrar un modal de edición.
    save() {
        StorageService.saveActiveListsNow(this.activeLists);
    },

    // --- Listas ---

    addList(name) {
        const list = { id: this.generateId(), name, tasks: [] };
        this.activeLists.push(list);
        this._notify();
        return list.id;
    },

    // Crea una lista ya con tareas (usado por plantillas/sugerencias).
    // La versión anterior perdía las tareas de la plantilla porque `addList`
    // solo aceptaba el nombre.
    addListWithTasks(listData) {
        const list = {
            id: this.generateId(),
            name: listData.name,
            tasks: (listData.tasks || []).map(t => ({
                id: this.generateId(),
                text: t.text,
                status: t.status || 'Pendiente',
                subtasks: (t.subtasks || []).map(s => ({
                    text: s.text,
                    completed: s.completed || false,
                    isVisual: s.isVisual || false
                }))
            }))
        };
        this.activeLists.push(list);
        this._notify();
        return list.id;
    },

    updateListName(listId, name) {
        const list = this.getList(listId);
        if (!list) return;
        list.name = name;
        this._notify();
    },

    deleteList(listId) {
        this.activeLists = this.activeLists.filter(l => l.id !== listId);
        this._notify();
    },

    // --- Tareas ---

    addTask(listId, taskData) {
        const list = this.getList(listId);
        if (!list) return null;
        const task = {
            id: this.generateId(),
            text: taskData.text || 'Nueva tarea',
            status: taskData.status || 'Pendiente',
            subtasks: taskData.subtasks || []
        };
        list.tasks.push(task);
        this._notify();
        return task.id;
    },

    updateTask(listId, taskId, updates) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        Object.assign(task, updates);
        this._notify();
    },

    // Cambia el status de una tarea (por drag&drop o por el <select>) y,
    // si el cambio es manual, sincroniza el estado "completed" de las
    // subtareas de texto (igual que hacía la versión anterior).
    setTaskStatus(listId, taskId, status, syncSubtasks = true) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        task.status = status;
        if (syncSubtasks) {
            task.subtasks.forEach(sub => {
                if (!sub.isVisual) sub.completed = (status === 'Realizada');
            });
        }
        this._notify();
    },

    deleteTask(listId, taskId) {
        const list = this.getList(listId);
        if (!list) return;
        list.tasks = list.tasks.filter(t => t.id !== taskId);
        this._notify();
    },

    // --- Subtareas (antes vivían solo en dataset.subtasks del DOM) ---

    addSubtask(listId, taskId, subtaskData) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        task.subtasks.push({
            text: subtaskData.text,
            completed: false,
            isVisual: !!subtaskData.isVisual
        });
        this._syncTaskStatusFromSubtasks(task);
        this._notify();
    },

    updateSubtask(listId, taskId, index, updates) {
        const task = this.getTask(listId, taskId);
        if (!task || !task.subtasks[index]) return;
        Object.assign(task.subtasks[index], updates);
        this._syncTaskStatusFromSubtasks(task);
        this._notify();
    },

    deleteSubtask(listId, taskId, index) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        task.subtasks.splice(index, 1);
        this._syncTaskStatusFromSubtasks(task);
        this._notify();
    },

    // Si todas las subtareas de texto están completas, la tarea pasa a
    // "Realizada" automáticamente (mismo comportamiento que la v. anterior).
    _syncTaskStatusFromSubtasks(task) {
        const textSubtasks = task.subtasks.filter(s => !s.isVisual);
        const allDone = textSubtasks.length > 0 && textSubtasks.every(s => s.completed);
        task.status = allDone ? 'Realizada' : 'Pendiente';
    },

    replaceAll(activeLists) {
        this.activeLists = Array.isArray(activeLists) ? activeLists : [];
        this._notify();
    }
};
