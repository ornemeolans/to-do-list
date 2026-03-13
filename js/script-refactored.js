document.addEventListener('DOMContentLoaded', async () => {
    await window.utils.ready;
    const { showToast, initLucideIcons } = window.utils;
    const newListInput = document.getElementById('new-list-input');
    const addListBtn = document.getElementById('add-list-btn');
    const listsContainer = document.getElementById('lists-container');
    const suggestionsList = document.getElementById('suggestions-list');

    // Cargar sugerencias iniciales
    let predefinedLists = JSON.parse(localStorage.getItem('suggestions')) || [
    { name: "🏠 Tareas Hogar", tasks: [{ text: "Lavar ropa", status: "Pendiente", subtasks: [] }] },
    { name: "🛒 Compras para el Hogar", tasks: [
        { text: "Verduleria", status: "Pendiente", subtasks: [{ text: "Cebolla", completed: false }] },
        { text: "Carneceria", status: "Pendiente", subtasks: [{ text: "Bife", completed: false }] }
    ]},
    { name: "📸 Sesión Fotográfica - {cliente}", tasks: [
        { text: "Enviar presupuesto a {cliente}", status: "Pendiente", subtasks: [] },
        { text: "Limpiar lentes para el {fecha}", status: "Pendiente", subtasks: [] },
        { text: "Confirmar ubicación con {cliente}", status: "Pendiente", subtasks: [] },
        { text: "Preparar equipo de iluminación", status: "Pendiente", subtasks: [] }
    ]}
];


    function saveActiveLists() {
        const activeLists = [];
        document.querySelectorAll('.task-list').forEach(listDiv => {
            const tasks = [];
            listDiv.querySelectorAll('.task-item').forEach(taskLi => {
                const subtasks = [];
                taskLi.querySelectorAll('.subtask-item').forEach(subLi => {
                    subtasks.push({
                        text: subLi.querySelector('span').textContent,
                        completed: subLi.querySelector('input').checked 
                    });
                });
                tasks.push({
                    text: taskLi.querySelector('.task-text').textContent,
                    status: taskLi.querySelector('.status-select').value,
                    subtasks
                });
            });
            activeLists.push({ name: listDiv.querySelector('h3').textContent, tasks });
        });
        localStorage.setItem('activeLists', JSON.stringify(activeLists));
    }

    function extractVariables(text) {
        const varMatch = text.match(/{([a-zA-Z]+)}/g);
        if (!varMatch) return [];
        return [...new Set(varMatch.map(v => v.slice(1, -1).toLowerCase()))];
    }

    function isSmartTemplate(list) {
        const vars = new Set(extractVariables(list.name));
        for (const task of list.tasks) {
            extractVariables(task.text).forEach(v => vars.add(v));
            for (const sub of task.subtasks || []) {
                extractVariables(sub.text).forEach(v => vars.add(v));
            }
        }
        return vars.size > 0 ? Array.from(vars) : null;
    }

    function replaceVariables(list, values) {
        const replaceInText = (text) => text.replace(/{([a-zA-Z]+)}/g, (match, varName) => values[varName.toLowerCase()] || match);
        
        const processed = {
            name: replaceInText(list.name),
            tasks: list.tasks.map(task => ({
                ...task,
                text: replaceInText(task.text),
                subtasks: (task.subtasks || []).map(sub => ({
                    ...sub,
                    text: replaceInText(sub.text)
                }))
            }))
        };
        return processed;
    }

    function renderSuggestions() {
        suggestionsList.innerHTML = '';
        predefinedLists.forEach((list, index) => {
            const li = document.createElement('li');
            const vars = isSmartTemplate(list);
            const isSmart = !!vars;
            const displayName = isSmart ? list.name.split(' - ')[0] : list.name;
            const tooltipName = isSmart ? list.name.split(' - ')[0] : list.name;
            li.innerHTML = `
                <span class="suggestion-name" title="${isSmart ? 'Plantilla Inteligente' : ''}">${displayName}</span>
                <button class="delete-suggestion-btn" style="background:none; color:inherit; padding:5px;">
                    <i data-lucide="x"></i>
                </button>
            `;
            
            li.querySelector('.suggestion-name').onclick = () => {
                if (isSmart) {
                    const fields = vars.map(v => ({ 
                        var: v, 
                        label: v.charAt(0).toUpperCase() + v.slice(1), 
                        placeholder: v.toLowerCase().includes('fecha') || v.toLowerCase().includes('date') ? '' : `Ingresa ${v}`
                    }));
                    window.utils.showModal(
                        `Plantilla: ${list.name}`,
                        fields,
                        (values) => createNewList(replaceVariables(list, values))
                    );
                } else {
                    createNewList(list);
                }
            };
            li.querySelector('.delete-suggestion-btn').onclick = (e) => {
                e.stopPropagation();
                predefinedLists.splice(index, 1);
                localStorage.setItem('suggestions', JSON.stringify(predefinedLists));
                renderSuggestions();
            };
            suggestionsList.appendChild(li);
        });
        initLucideIcons();
    }

    function saveListAsSuggestion(name, listDiv) {
        const tasks = [];
        listDiv.querySelectorAll('.task-item').forEach(taskEl => {
            const subtasks = [];
            taskEl.querySelectorAll('.subtask-item').forEach(sub => {
                subtasks.push({ text: sub.querySelector('span').textContent, completed: sub.querySelector('input').checked });
            });
            tasks.push({ text: taskEl.querySelector('.task-text').textContent, status: taskEl.querySelector('.status-select').value, subtasks });
        });

        const existingIndex = predefinedLists.findIndex(l => l.name === name);
        if (existingIndex > -1) predefinedLists[existingIndex] = { name, tasks };
        else predefinedLists.push({ name, tasks });

        localStorage.setItem('suggestions', JSON.stringify(predefinedLists));
        renderSuggestions(); 
        showToast('Sugerencia guardada ✨');
    }

    function createNewList(listData) {
        const listDiv = document.createElement('div');
        listDiv.className = 'task-list';
        listDiv.innerHTML = `
            <h3 contenteditable="true">${listData.name}</h3>
            <div class="task-columns" style="display:flex; gap:15px; margin-bottom:20px;">
                <div class="task-column" data-status="Pendiente" style="flex:1">
                    <h4 style="font-size:0.8rem; opacity:0.6; margin-bottom:10px;">PENDIENTES</h4>
                    <ul style="padding:0; list-style:none;"></ul>
                </div>
                <div class="task-column" data-status="Realizada" style="flex:1">
                    <h4 style="font-size:0.8rem; opacity:0.6; margin-bottom:10px;">REALIZADAS</h4>
                    <ul style="padding:0; list-style:none;"></ul>
                </div>
            </div>
            <div class="list-footer" style="display:flex; gap:10px; align-items:center;">
                <input type="text" placeholder="Nueva tarea..." class="task-input" style="flex-grow:1">
                <button class="add-task-btn"><i data-lucide="plus"></i></button>
                <button class="save-suggestion-btn" style="background:#00b894" title="Guardar sugerencia"><i data-lucide="save"></i></button>
                <button class="delete-list-btn" style="background:#ff7675" title="Eliminar lista"><i data-lucide="trash-2"></i></button>
            </div>
        `;

        const input = listDiv.querySelector('.task-input');
        const addTaskBtn = listDiv.querySelector('.add-task-btn');

        const addTaskHandler = () => {
            if (input.value.trim()) {
                addTask(listDiv, { text: input.value, status: 'Pendiente', subtasks: [] });
                input.value = '';
                saveActiveLists();
            }
        };

        addTaskBtn.onclick = addTaskHandler;
        input.onkeypress = (e) => { if(e.key === 'Enter') addTaskHandler(); };

        listDiv.querySelector('.save-suggestion-btn').onclick = () => saveListAsSuggestion(listDiv.querySelector('h3').textContent, listDiv);
        listDiv.querySelector('.delete-list-btn').onclick = () => { 
            listDiv.remove(); 
            saveActiveLists(); 
        };

        listsContainer.appendChild(listDiv);
        if (listData.tasks) listData.tasks.forEach(t => addTask(listDiv, t));
        saveActiveLists();
        initLucideIcons();
    }

    function addTask(listDiv, taskData) {
        let targetCol = listDiv.querySelector(`.task-column[data-status="${taskData.status || 'Pendiente'}"] ul`);
        if (!targetCol) {
            targetCol = listDiv.querySelector('.task-column[data-status="Pendiente"] ul');
        }
        const taskLi = document.createElement('li');
        taskLi.className = 'task-item';
        taskLi.innerHTML = `
            <div class="task-main" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <span class="task-text" style="flex-grow:1;">${taskData.text}</span>
                <select class="status-select" style="padding:4px; border-radius:8px; border:1px solid #ddd;">
                    <option value="Pendiente" ${taskData.status === 'Pendiente' ? 'selected' : ''}>⏳</option>
                    <option value="Realizada" ${taskData.status === 'Realizada' ? 'selected' : ''}>✅</option>
                </select>
                <button class="delete-task-btn" style="background:none; color:#ff7675; padding:5px;"><i data-lucide="x"></i></button>
            </div>
            <ul class="subtask-list" style="list-style:none; padding-left:15px; margin-bottom:10px;"></ul>
            <div class="subtask-controls" style="display:flex; gap:5px;">
                <input type="text" placeholder="Subtarea..." class="sub-input" style="font-size:0.8rem; padding:5px 10px; flex-grow:1;">
                <button class="add-sub-btn" style="padding:5px 12px;">+</button>
            </div>
        `;

        const statusSelect = taskLi.querySelector('.status-select');
        statusSelect.onchange = updateParentTaskStatus.bind(null, taskLi, listDiv, statusSelect);

        taskLi.querySelector('.delete-task-btn').onclick = () => {
            taskLi.remove();
            saveActiveLists();
        };

        const subIn = taskLi.querySelector('.sub-input');
        const addSubBtn = taskLi.querySelector('.add-sub-btn');

        const addSubHandler = () => {
            if (subIn.value.trim()) {
                const subLi = document.createElement('li');
                subLi.className = 'subtask-item';
                subLi.style.cssText = "display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:4px;";
                subLi.innerHTML = `<input type="checkbox"> <span>${subIn.value}</span> <button class="delete-sub-btn" style="background:none;border:none;color:#ff7675;padding:2px 5px;margin-left:auto;font-size:0.8rem;cursor:pointer;"><i data-lucide="x" style="width:14px;height:14px;"></i></button>`;
                subLi.querySelector('input').onchange = updateParentTaskStatus.bind(null, taskLi, listDiv, statusSelect);
                subLi.querySelector('.delete-sub-btn').onclick = (e) => {
                    e.stopPropagation();
                    subLi.remove();
                    updateParentTaskStatus(taskLi, listDiv, statusSelect);
                    saveActiveLists();
                };
                taskLi.querySelector('.subtask-list').appendChild(subLi);
                subIn.value = '';
                saveActiveLists();
            }
        };

        addSubBtn.onclick = addSubHandler;
        subIn.onkeypress = (e) => { if(e.key === 'Enter') addSubHandler(); };

        targetCol.appendChild(taskLi);

        if (taskData.subtasks) {
            taskData.subtasks.forEach(s => {
                const subLi = document.createElement('li');
                subLi.className = 'subtask-item';
                subLi.style.cssText = "display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:4px;";
                subLi.innerHTML = `<input type="checkbox" ${s.completed ? 'checked' : ''}> <span>${s.text}</span> <button class="delete-sub-btn" style="background:none;border:none;color:#ff7675;padding:2px 5px;margin-left:auto;font-size:0.8rem;cursor:pointer;"><i data-lucide="x" style="width:14px;height:14px;"></i></button>`;
                subLi.querySelector('input').onchange = updateParentTaskStatus.bind(null, taskLi, listDiv, statusSelect);
                subLi.querySelector('.delete-sub-btn').onclick = (e) => {
                    e.stopPropagation();
                    subLi.remove();
                    updateParentTaskStatus(taskLi, listDiv, statusSelect);
                    saveActiveLists();
                };
                taskLi.querySelector('.subtask-list').appendChild(subLi);
            });
        }
        initLucideIcons();
    }

function updateParentTaskStatus(taskLi, listDiv, statusSelect, e) {
    const subtasks = taskLi.querySelectorAll('.subtask-item input');
    
    // CASO A: El cambio vino desde el SELECT de la tarea principal
    if (e && e.target.tagName === 'SELECT') {
        const newStatus = e.target.value;
        if (newStatus === 'Pendiente') {
            // Si el usuario vuelve a Pendiente, desmarcamos todas las subtareas
            subtasks.forEach(cb => cb.checked = false);
        }
    } 
    // CASO B: El cambio vino desde un CHECKBOX de subtarea
    else {
        if (subtasks.length > 0) {
            const allDone = Array.from(subtasks).every(cb => cb.checked);
            statusSelect.value = allDone ? 'Realizada' : 'Pendiente';
        }
    }

    // Mover la tarea a la columna correspondiente
    const targetColName = statusSelect.value;
    const targetCol = listDiv.querySelector(`.task-column[data-status="${targetColName}"] ul`);
    if (targetCol) {
        targetCol.appendChild(taskLi);
    }

    saveActiveLists();
    initLucideIcons();
}

    // Evento para crear lista nueva
    addListBtn.addEventListener('click', () => {
        if (newListInput.value.trim()) {
            createNewList({ name: newListInput.value.trim(), tasks: [] });
            newListInput.value = '';
        }
    });

    newListInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addListBtn.click();
    });

    // Modo Oscuro
    document.getElementById('dark-toggle').onclick = () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    };

    // Inicialización
    if (localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    renderSuggestions();
    const savedLists = JSON.parse(localStorage.getItem('activeLists'));
    if (savedLists && savedLists.length > 0) {
        savedLists.forEach(l => createNewList(l));
    }
});