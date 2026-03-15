window.StateManager = {
    activeLists: [],
    nextId: 1,  // Fallback counter if crypto unavailable
    
    generateId: function() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `id_${this.nextId++}`;
    },
    
    addList: function(name) {
        const list = {
            id: this.generateId(),
            name: name,
            tasks: []
        };
        this.activeLists.push(list);
        this.renderAll();
        return list.id;
    },
    
    addTask: function(listId, taskData) {
        const list = this.activeLists.find(l => l.id === listId);
        if (!list) return null;
        
        const task = {
            id: this.generateId(),
            text: taskData.text || 'Nueva tarea',
            status: taskData.status || 'Pendiente',
            subtasks: taskData.subtasks || []
        };
        list.tasks.push(task);
        this.renderAll();
        window.StorageService.saveActiveLists(this.activeLists);
        return task.id;
    },
    
    updateTask: function(listId, taskId, updates) {
        const list = this.activeLists.find(l => l.id === listId);
        if (!list) return;
        
        const task = list.tasks.find(t => t.id === taskId);
        if (task) {
            Object.assign(task, updates);
            this.renderAll();
            window.StorageService.saveActiveLists(this.activeLists);
        }
    },
    
    deleteTask: function(listId, taskId) {
        const list = this.activeLists.find(l => l.id === listId);
        if (!list) return;
        
        list.tasks = list.tasks.filter(t => t.id !== taskId);
        this.renderAll();
        window.StorageService.saveActiveLists(this.activeLists);
    },
    
    updateListName: function(listId, name) {
        const list = this.activeLists.find(l => l.id === listId);
        if (list) {
            list.name = name;
            this.renderAll();
            window.StorageService.saveActiveLists(this.activeLists);
        }
    },
    
    deleteList: function(listId) {
        this.activeLists = this.activeLists.filter(l => l.id !== listId);
        this.renderAll();
        window.StorageService.saveActiveLists(this.activeLists);
    },
    
    // Undo stack for UX
    undoStack: [],
    pushUndo: function(action, data) {
        this.undoStack.push({action, data, timestamp: Date.now()});
        if (this.undoStack.length > 10) this.undoStack.shift();
    },
    
    undo: function() {
        const last = this.undoStack.pop();
        if (!last) return;
        // Revert logic based on action type
        // Simplified: reload from storage
        this.load();
    },
    
    load: async function() {
        try {
            this.activeLists = await window.StorageService.loadActiveLists() || [];
        } catch (e) {
            console.error('Load failed:', e);
            this.activeLists = [];
        }
    },
    
    save: function() {
        window.StorageService.saveActiveLists(this.activeLists);
    },
    
    renderAll: function() {
        const container = document.getElementById('lists-container');
        if (!container) return;
        
        // Ensure activeLists is array
        if (!Array.isArray(this.activeLists)) {
            console.warn('activeLists is not array:', this.activeLists);
            this.activeLists = [];
        }
        
        container.innerHTML = '';
        this.activeLists.forEach(list => {
            window.TaskService.createNewList(list, container, list.id);
        });
    }
};
