document.addEventListener('DOMContentLoaded', async () => {
    // Esperar a que se carguen todos los servicios
    function waitForServices() {
        return new Promise((resolve) => {
            const checkServices = () => {
                if (window.StorageService && window.TaskService && window.utils) {
                    resolve();
                } else {
                    setTimeout(checkServices, 50);
                }
            };
            checkServices();
        });
    }

    await waitForServices();
    
    window.draggedTask = null;
    const { showToast, initLucideIcons, showFocusModal, hideFocusModal } = window.utils;
    const newListInput = document.getElementById('new-list-input');
    const addListBtn = document.getElementById('add-list-btn');
    const listsContainer = document.getElementById('lists-container');
    const suggestionsList = document.getElementById('suggestions-list');
    
    const themeToggle = document.getElementById('dark-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    if (themeToggle) {
        themeToggle.setAttribute('aria-label', 'Cambiar tema');
        themeToggle.onclick = () => {
            const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        };
    }

    // Crear lista con Enter
    newListInput.onkeypress = (e) => { 
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            addListBtn.click(); 
        } 
    };

    let predefinedLists = window.StorageService.loadSuggestions();

    // CORRECCIÓN: Función expuesta globalmente para que TaskService pueda llamarla al guardar
    window.renderSuggestions = function renderSuggestions() {
        // Recargar los datos del storage antes de renderizar
        predefinedLists = window.StorageService.loadSuggestions();
        
        suggestionsList.innerHTML = '';
        predefinedLists.forEach((list, index) => {
            const vars = window.TaskService.extractVariables(list);
            const li = document.createElement('li');
            
            const span = document.createElement('span');
            span.textContent = list.name.split(' - ')[0];
            li.appendChild(span);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-suggestion-btn';
            deleteBtn.setAttribute('aria-label', 'Eliminar sugerencia');
            const iX = document.createElement('i');
            iX.dataset.lucide = 'x';
            deleteBtn.appendChild(iX);
            li.appendChild(deleteBtn);
            
            li.onclick = (e) => {
                if (e.target.closest('.delete-suggestion-btn')) return;
                if (vars.length > 0) {
                    window.utils.showModal(`Plantilla: ${list.name}`, vars.map(v => ({ 
                        var: v, label: v, type: v === 'fecha' ? 'date' : 'text' 
                    })), (values) => {
                        const replace = (t) => t.replace(/{([a-zA-Z]+)}/g, (m, v) => values[v.toLowerCase()] || m);
                        createNewList({
                            name: replace(list.name),
                            tasks: list.tasks.map(t => ({ 
                                ...t, text: replace(t.text), 
                                subtasks: t.subtasks ? t.subtasks.map(s => ({...s, text: replace(s.text)})) : [] 
                            }))
                        });
                    });
                } else createNewList(list);
            };
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                predefinedLists = window.StorageService.deleteSuggestion(index);
                window.renderSuggestions(); // Uso de la referencia global
                window.utils.showToast("Sugerencia eliminada", "info");
            };
            suggestionsList.appendChild(li);
        });
        initLucideIcons();
    };

    function createNewList(listData) {
        window.TaskService.createNewList(listData, listsContainer);
    }

    addListBtn.onclick = () => {
        if (newListInput.value.trim()) {
            createNewList({ name: newListInput.value.trim(), tasks: [] });
            newListInput.value = '';
            window.StorageService.saveActiveListsFromDOM(listsContainer);
            window.utils.showToast("Lista creada", "exito"); // Implementación de Toast
        } else {
            window.utils.showToast("Escribe un nombre para la lista", "advertencia"); // Implementación de Toast
        }
    };

    // Render inicial
    window.renderSuggestions();

    // FIX GLOBAL ENTER para subtareas y task-input
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const target = e.target;
            if (target.classList.contains('task-input')) {
                e.preventDefault();
                const btn = target.closest('.list-footer')?.querySelector('.add-task-btn');
                if (btn) btn.click();
            } else if (target.classList.contains('sub-input')) {
                e.preventDefault();
                const controls = target.closest('.subtask-controls');
                if (controls) {
                    const btn = controls.querySelector('.add-sub-btn');
                    if (btn) btn.click();
                }
            }
        }
    });

    // Cargar listas guardadas
    const saved = window.StorageService.loadActiveLists();
    if (saved) saved.forEach(l => createNewList(l));
    window.StorageService.saveActiveListsFromDOM(listsContainer);
});