// main.js — punto de entrada de la app.
// Con ES Modules el orden de carga y ejecución está garantizado por el grafo
// de imports, así que ya no hace falta el polling `waitForServices` (setTimeout
// cada 50ms chequeando si `window.X` ya existía) que tenía la versión anterior.
import { StateManager } from './StateManager.js';
import { StorageService } from './StorageService.js';
import { extractVariables, renderAll as renderTasksAll } from './TaskService.js';
import * as utils from './utils.js';

async function init() {
    const listsContainer = document.getElementById('lists-container');
    const suggestionsList = document.getElementById('suggestions-list');
    const newListInput = document.getElementById('new-list-input');
    const addListBtn = document.getElementById('add-list-btn');
    const themeToggle = document.getElementById('dark-toggle');

    // StateManager notifica acá cada vez que el estado cambia; este es el
    // único lugar que sabe "estado cambió -> re-render la lista de listas".
    StateManager.onChange = (activeLists) => {
        renderTasksAll(activeLists, listsContainer);
    };

    await StateManager.load();
    renderTasksAll(StateManager.activeLists, listsContainer);

    // Tema claro/oscuro
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
        if (e.key === 'Enter') { e.preventDefault(); addListBtn.click(); }
    };

    addListBtn.onclick = () => {
        const name = newListInput.value.trim();
        if (!name) {
            utils.showToast('Escribe un nombre para la lista', 'advertencia');
            return;
        }
        StateManager.addList(name);
        newListInput.value = '';
        utils.showToast('Lista creada', 'exito');
    };

    // Sugerencias / plantillas
    let predefinedLists = StorageService.loadSuggestions();

    window.renderSuggestions = function renderSuggestions() {
        predefinedLists = StorageService.loadSuggestions();
        suggestionsList.innerHTML = '';

        predefinedLists.forEach((list, index) => {
            const vars = extractVariables(list);
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
                    utils.showModal(`Plantilla: ${list.name}`, vars.map(v => ({
                        var: v, label: v, type: v === 'fecha' ? 'date' : 'text'
                    })), (values) => {
                        const replace = (t) => t.replace(/{([a-zA-Z]+)}/g, (m, v) => values[v.toLowerCase()] || m);
                        createListFromTemplate({
                            name: replace(list.name),
                            tasks: list.tasks.map(t => ({
                                ...t, text: replace(t.text),
                                subtasks: t.subtasks ? t.subtasks.map(s => ({ ...s, text: replace(s.text) })) : []
                            }))
                        });
                    });
                } else {
                    createListFromTemplate(list);
                }
            };

            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                predefinedLists = StorageService.deleteSuggestion(index);
                window.renderSuggestions();
                utils.showToast('Sugerencia eliminada', 'info');
            };

            suggestionsList.appendChild(li);
        });

        utils.initLucideIcons();
    };

    // Antes: `StateManager.addList(listData.name)` descartaba `listData.tasks`
    // y las plantillas creaban listas vacías. Ahora usa addListWithTasks.
    function createListFromTemplate(listData) {
        StateManager.addListWithTasks(listData);
    }

    // Enter global para inputs de tarea/subtarea dentro de las listas
    document.addEventListener('keypress', (e) => {
        if (e.key !== 'Enter') return;
        const target = e.target;
        if (target.classList.contains('task-input')) {
            e.preventDefault();
            const btn = target.closest('.list-footer')?.querySelector('.add-task-btn');
            if (btn) btn.click();
        } else if (target.classList.contains('sub-input')) {
            e.preventDefault();
            const controls = target.closest('.subtask-controls');
            const btn = controls?.querySelector('.add-sub-btn');
            if (btn) btn.click();
        }
    });

    window.renderSuggestions();
}

document.addEventListener('DOMContentLoaded', init);
