window.StorageService = {
    MAX_IMAGE_SIZE: 1024 * 1024,  // 1MB
    
    db: null,
    
    initIDB: async function() {
        if (this.db) return this.db;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ToDoDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'key' });
                }
            };
        });
    },
    
    saveImageToIDB: async function(key, base64) {
        try {
            await this.initIDB();
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('images', 'readwrite');
                const store = tx.objectStore('images');
                const request = store.put({ key, data: base64 });
                
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.warn('IDB save failed:', e);
            return false;
        }
    },
    
    loadImageFromIDB: async function(key) {
        try {
            await this.initIDB();
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('images', 'readonly');
                const store = tx.objectStore('images');
                const request = store.get(key);
                
                request.onsuccess = () => resolve(request.result ? request.result.data : null);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.warn('IDB load failed:', e);
            return null;
        }
    },
    
    isBigImage: function(base64) {
        const base64data = base64.split(',')[1] || '';
        const padding = base64data.endsWith('==') ? 2 : (base64data.endsWith('=') ? 1 : 0);
        const bytes = (base64data.length / 4) * 3 - padding;
        return bytes > this.MAX_IMAGE_SIZE;
    },
    
    processImageForStorage: async function(base64, taskId, index) {
        if (!this.isBigImage(base64)) {
            return { type: 'local', data: base64 };
        }
        
        const idbKey = `${taskId}_img_${index}`;
        const saved = await this.saveImageToIDB(idbKey, base64);
        if (saved) {
            return { type: 'idb', key: idbKey };
        }
        // Fallback to local
        return { type: 'local', data: base64 };
    },
    predefinedListsInit: [
        { name: "🏠 Tareas Hogar", tasks: [{ text: "Lavar ropa", status: "Pendiente", subtasks: [] }] },
        { name: "🛒 Compras para el Hogar", tasks: [
            { text: "Verduleria", status: "Pendiente", subtasks: [{ text: "Cebolla", completed: false }] },
            { text: "Carneceria", status: "Pendiente", subtasks: [{ text: "Bife", completed: false }] }
        ]},
        { 
            name: "📸 Sesión Fotográfica - {cliente}", 
            tasks: [
                { text: "Enviar presupuesto a {cliente}", status: "Pendiente", subtasks: [] },
                { text: "Confirmar ubicación con {cliente}", status: "Pendiente", subtasks: [] },
                { text: "Limpiar lentes para el {fecha}", status: "Pendiente", subtasks: [] },
                { text: "Preparar equipo de iluminación antes del {fecha}", status: "Pendiente", subtasks: [] }
            ]
        }
    ],

    saveActiveLists: async function(activeLists) {
        // Migrate any IDB refs on save
        for (const list of activeLists) {
            for (const task of list.tasks) {
                for (let i = 0; i < task.subtasks.length; i++) {
                    const sub = task.subtasks[i];
                    if (sub.isVisual && typeof sub.data === 'object' && sub.data.type === 'idb') {
                        // Ensure ref exists
                        const img = await this.loadImageFromIDB(sub.data.key);
                        if (!img) {
                            // Recover from local if possible or remove
                            sub.data = null;
                        }
                    }
                }
            }
        }
        localStorage.setItem('activeLists', JSON.stringify(activeLists));
    },

    loadActiveLists: async function() {
        const lists = JSON.parse(localStorage.getItem('activeLists')) || [];
        // Future: resolve IDB refs to base64 for compatibility
        return lists;
    },

    saveSuggestions: function(predefinedLists) {
        localStorage.setItem('suggestions', JSON.stringify(predefinedLists));
    },

    loadSuggestions: function() {
        const saved = localStorage.getItem('suggestions');
        if (saved) return JSON.parse(saved);
        // Fallback to init
        this.saveSuggestions(this.predefinedListsInit);
        return this.predefinedListsInit.slice();
    },

    deleteSuggestion: function(index) {
        const predefinedLists = this.loadSuggestions();
        predefinedLists.splice(index, 1);
        this.saveSuggestions(predefinedLists);
        return predefinedLists;
    },

    // DEPRECATED: Use StateManager.save() instead
    saveActiveListsFromDOM: function() {
        console.warn('saveActiveListsFromDOM deprecated. Use window.StateManager.save()');
        if (window.StateManager) {
            window.StateManager.save();
        }
    },

    saveListAsSuggestion: function(listData) {
        const predefinedLists = this.loadSuggestions();
        const existingIndex = predefinedLists.findIndex(l => l.name === listData.name);
        if (existingIndex > -1) {
            predefinedLists[existingIndex] = listData;
        } else {
            predefinedLists.push(listData);
        }
        this.saveSuggestions(predefinedLists);
    }
};

