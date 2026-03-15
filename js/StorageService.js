window.StorageService = {
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

    saveActiveLists: function(activeLists) {
        localStorage.setItem('activeLists', JSON.stringify(activeLists));
    },

    loadActiveLists: function() {
        return JSON.parse(localStorage.getItem('activeLists')) || [];
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

    saveActiveListsFromDOM: function(listsContainer) {
        const activeLists = [];
        listsContainer.querySelectorAll('.task-list').forEach(listDiv => {
            const tasks = [];
            listDiv.querySelectorAll('.task-item').forEach(taskLi => {
                // Single source: dataset.subtasks (no DOM scraping!)
                const subtasks = JSON.parse(taskLi.dataset.subtasks || '[]');
                tasks.push({ 
                    text: taskLi.querySelector('.task-text').textContent, 
                    status: taskLi.querySelector('.status-select').value, 
                    subtasks 
                });
            });
            activeLists.push({ name: listDiv.querySelector('h3').textContent, tasks });
        });
        this.saveActiveLists(activeLists);
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

