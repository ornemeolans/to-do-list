// StateManager: ÚNICA fuente de verdad del estado de la app.
// Todo lo que se ve en pantalla vive acá, en `activeLists`. Nada se guarda
// "solo en el DOM".
//
// StateManager no sabe nada de DOM ni de red. Cuando algo cambia avisa a:
//  - `onChange(activeLists, source)` → la capa de render (main.js)
//  - los suscriptores de `subscribe()` → p. ej. SyncService
// `source` es 'local' (lo hizo el usuario en este dispositivo) o 'remote'
// (llegó de otro dispositivo), para que la sincronización no se re-envíe a sí misma.
//
// Cada lista lleva `updatedAt` (ms): es la base del "gana el cambio más
// reciente" al fusionar dispositivos.
import { StorageService } from './StorageService.js';

export const StateManager = {
    activeLists: [],
    nextId: 1, // Fallback si crypto.randomUUID no está disponible
    onChange: null,
    _listeners: new Set(),

    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `id_${Date.now()}_${this.nextId++}`;
    },

    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    },

    // `touchedListId`: lista modificada → se le actualiza `updatedAt`.
    _notify(touchedListId = null, source = 'local') {
        if (touchedListId) {
            const list = this.getList(touchedListId);
            if (list) list.updatedAt = Date.now();
        }
        StorageService.saveActiveLists(this.activeLists);
        if (typeof this.onChange === 'function') this.onChange(this.activeLists, source);
        this._listeners.forEach(fn => fn(this.activeLists, source));
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
            // Listas de versiones anteriores sin marcas de tiempo: se conserva
            // su orden y quedan "más viejas" que cualquier cambio sincronizado.
            this.activeLists.forEach((l, i) => {
                l.createdAt ??= i;
                l.updatedAt ??= 0;
            });
        } catch (e) {
            console.error('Load failed:', e);
            this.activeLists = [];
        }
    },

    // Guardado inmediato (sin debounce).
    save() {
        StorageService.saveActiveListsNow(this.activeLists);
    },

    // --- Listas ---

    addList(name) {
        return this.addListWithTasks({ name, tasks: [] });
    },

    // Crea una lista ya con tareas (usado por plantillas).
    addListWithTasks(listData) {
        const now = Date.now();
        const list = {
            id: this.generateId(),
            name: listData.name,
            createdAt: now,
            updatedAt: now,
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
        this._notify(list.id);
        return list.id;
    },

    updateListName(listId, name) {
        const list = this.getList(listId);
        if (!list) return;
        list.name = name;
        this._notify(listId);
    },

    // Devuelve la lista borrada y su posición, para poder ofrecer "Deshacer".
    deleteList(listId) {
        const index = this.activeLists.findIndex(l => l.id === listId);
        if (index === -1) return null;
        const [removed] = this.activeLists.splice(index, 1);
        const deleted = StorageService.loadDeletedLists();
        deleted[listId] = Date.now();
        StorageService.saveDeletedLists(deleted);
        this._notify();
        return { list: removed, index };
    },

    insertList(list, index = this.activeLists.length) {
        const deleted = StorageService.loadDeletedLists();
        if (deleted[list.id]) {
            delete deleted[list.id];
            StorageService.saveDeletedLists(deleted);
        }
        this.activeLists.splice(Math.min(index, this.activeLists.length), 0, list);
        this._notify(list.id); // updatedAt nuevo: le gana a la marca de borrado
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
        this._notify(listId);
        return task.id;
    },

    updateTask(listId, taskId, updates) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        Object.assign(task, updates);
        this._notify(listId);
    },

    // Cambia el status (drag&drop o botón) y, si es manual, sincroniza el
    // "completed" de las subtareas de texto.
    setTaskStatus(listId, taskId, status, syncSubtasks = true) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        task.status = status;
        if (syncSubtasks) {
            task.subtasks.forEach(sub => {
                if (!sub.isVisual) sub.completed = (status === 'Realizada');
            });
        }
        this._notify(listId);
    },

    deleteTask(listId, taskId) {
        const list = this.getList(listId);
        if (!list) return;
        list.tasks = list.tasks.filter(t => t.id !== taskId);
        this._notify(listId);
    },

    // --- Subtareas ---

    addSubtask(listId, taskId, subtaskData) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        task.subtasks.push({
            text: subtaskData.text,
            completed: false,
            isVisual: !!subtaskData.isVisual
        });
        this._syncTaskStatusFromSubtasks(task);
        this._notify(listId);
    },

    updateSubtask(listId, taskId, index, updates) {
        const task = this.getTask(listId, taskId);
        if (!task || !task.subtasks[index]) return;
        Object.assign(task.subtasks[index], updates);
        this._syncTaskStatusFromSubtasks(task);
        this._notify(listId);
    },

    deleteSubtask(listId, taskId, index) {
        const task = this.getTask(listId, taskId);
        if (!task) return;
        task.subtasks.splice(index, 1);
        this._syncTaskStatusFromSubtasks(task);
        this._notify(listId);
    },

    // Si todas las subtareas de texto están completas, la tarea pasa a
    // "Realizada" automáticamente.
    _syncTaskStatusFromSubtasks(task) {
        const textSubtasks = task.subtasks.filter(s => !s.isVisual);
        const allDone = textSubtasks.length > 0 && textSubtasks.every(s => s.completed);
        task.status = allDone ? 'Realizada' : 'Pendiente';
    },

    // Métricas agregadas para el panel del hero.
    getStats() {
        let pending = 0, done = 0;
        this.activeLists.forEach(l => l.tasks.forEach(t => {
            if (t.status === 'Realizada') done++; else pending++;
        }));
        const total = pending + done;
        return { lists: this.activeLists.length, pending, done, total, progress: total ? done / total : 0 };
    },

    // `source: 'remote'` → cambios que llegan de otro dispositivo.
    replaceAll(activeLists, source = 'local') {
        this.activeLists = Array.isArray(activeLists) ? activeLists : [];
        this._notify(null, source);
    }
};
