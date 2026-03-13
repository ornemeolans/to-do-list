document.addEventListener('DOMContentLoaded', async () => {
    await window.utils.ready;
    const { showToast, initLucideIcons, showFocusModal, hideFocusModal } = window.utils;
    const newListInput = document.getElementById('new-list-input');
    const addListBtn = document.getElementById('add-list-btn');
    const listsContainer = document.getElementById('lists-container');
    const suggestionsList = document.getElementById('suggestions-list');

    let predefinedLists = JSON.parse(localStorage.getItem('suggestions')) || [
        { name: "🏠 Tareas Hogar", tasks: [{ text: "Lavar ropa", status: "Pendiente", subtasks: [] }] },
        { name: "🛒 Compras para el Hogar", tasks: [
        { text: "Verduleria", status: "Pendiente", subtasks: [{ text: "Cebolla", completed: false }] },
        { text: "Carneceria", status: "Pendiente", subtasks: [{ text: "Bife", completed: false }] }]},
        { 
            name: "📸 Sesión Fotográfica - {cliente}", 
            tasks: [
                { text: "Enviar presupuesto a {cliente}", status: "Pendiente", subtasks: [] },
                { text: "Limpiar lentes para el {fecha}", status: "Pendiente", subtasks: [] }
            ] 
        }
    ];

    function saveActiveLists() {
        const activeLists = [];
        document.querySelectorAll('.task-list').forEach(listDiv => {
            const tasks = [];
            listDiv.querySelectorAll('.task-item').forEach(taskLi => {
                const subtasks = Array.from(taskLi.querySelectorAll('.subtask-item')).map(subLi => ({
                    text: subLi.querySelector('span').textContent,
                    completed: subLi.querySelector('input').checked
                }));
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
        return varMatch ? [...new Set(varMatch.map(v => v.slice(1, -1).toLowerCase()))] : [];
    }

    function renderSuggestions() {
        suggestionsList.innerHTML = '';
        predefinedLists.forEach((list, index) => {
            const vars = extractVariables(list.name);
            const li = document.createElement('li');
            li.innerHTML = `<span>${list.name.split(' - ')[0]}</span><button class="delete-suggestion-btn"><i data-lucide="x"></i></button>`;
            
            li.onclick = (e) => {
                if (e.target.closest('.delete-suggestion-btn')) return;
                if (vars.length > 0) {
                    window.utils.showModal(`Plantilla: ${list.name}`, vars.map(v => ({ var: v, label: v })), (values) => {
                        const replace = (t) => t.replace(/{([a-zA-Z]+)}/g, (m, v) => values[v.toLowerCase()] || m);
                        createNewList({
                            name: replace(list.name),
                            tasks: list.tasks.map(t => ({ ...t, text: replace(t.text), subtasks: t.subtasks || [] }))
                        });
                    });
                } else createNewList(list);
            };
            suggestionsList.appendChild(li);
        });
        initLucideIcons();
    }

    function createNewList(listData) {
        const listDiv = document.createElement('div');
        listDiv.className = 'task-list';
        listDiv.innerHTML = `
            <h3 contenteditable="true">${listData.name}</h3>
            <div class="task-columns" style="display:flex; gap:15px; margin-bottom:20px;">
                <div class="task-column" data-status="Pendiente" style="flex:1"><h4 style="font-size:0.7rem; opacity:0.5;">PENDIENTES</h4><ul style="padding:0; list-style:none;"></ul></div>
                <div class="task-column" data-status="Realizada" style="flex:1"><h4 style="font-size:0.7rem; opacity:0.5;">REALIZADAS</h4><ul style="padding:0; list-style:none;"></ul></div>
            </div>
            <div class="list-footer" style="display:flex; gap:10px;">
                <input type="text" placeholder="Nueva tarea..." class="task-input" style="flex-grow:1">
                <button class="add-task-btn"><i data-lucide="plus"></i></button>
            </div>
        `;

        listDiv.querySelector('.add-task-btn').onclick = () => {
            const input = listDiv.querySelector('.task-input');
            if (input.value.trim()) {
                addTask(listDiv, { text: input.value, status: 'Pendiente', subtasks: [] });
                input.value = '';
                saveActiveLists();
            }
        };

        listsContainer.appendChild(listDiv);
        if (listData.tasks) listData.tasks.forEach(t => addTask(listDiv, t));
        initLucideIcons();
    }

    function addTask(listDiv, taskData) {
        const targetCol = listDiv.querySelector(`.task-column[data-status="${taskData.status || 'Pendiente'}"] ul`);
        const taskLi = document.createElement('li');
        taskLi.className = 'task-item';
        taskLi.innerHTML = `
            <div class="task-main" style="display:flex; align-items:center; gap:10px;">
                <span class="task-text" style="flex-grow:1;">${taskData.text}</span>
                <select class="status-select">
                    <option value="Pendiente" ${taskData.status === 'Pendiente' ? 'selected' : ''}>⏳</option>
                    <option value="Realizada" ${taskData.status === 'Realizada' ? 'selected' : ''}>✅</option>
                </select>
                <button class="focus-btn" title="Modo Enfoque 🎯" style="background:none; color:var(--accent-blue);"><i data-lucide="target"></i></button>
                <button class="delete-task-btn" style="background:none; color:var(--accent-red);"><i data-lucide="x"></i></button>
            </div>
            <ul class="subtask-list" style="list-style:none; padding-left:15px; margin-top:10px;"></ul>
            <div class="subtask-controls" style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" placeholder="Subtarea..." class="sub-input" style="font-size:0.8rem; flex-grow:1;">
                <button class="add-sub-btn">+</button>
            </div>
        `;

        const statusSelect = taskLi.querySelector('.status-select');
        
        const updateStatus = (e) => {
            const checkboxes = taskLi.querySelectorAll('.subtask-item input');
            if (e && e.target.tagName === 'SELECT') {
                if (e.target.value === 'Pendiente') checkboxes.forEach(c => c.checked = false);
            } else if (checkboxes.length > 0) {
                const allDone = Array.from(checkboxes).every(c => c.checked);
                statusSelect.value = allDone ? 'Realizada' : 'Pendiente';
            }
            listDiv.querySelector(`.task-column[data-status="${statusSelect.value}"] ul`).appendChild(taskLi);
            saveActiveLists();
        };

        statusSelect.onchange = updateStatus;

        taskLi.querySelector('.focus-btn').onclick = () => {
            const data = { 
                text: taskLi.querySelector('.task-text').textContent, 
                subtasks: Array.from(taskLi.querySelectorAll('.subtask-item')).map(s => ({ 
                    text: s.querySelector('span').textContent, 
                    completed: s.querySelector('input').checked 
                }))
            };
            // Llamamos al modal de selección de tiempo antes de mostrar el foco
            window.utils.showTimePickerModal((selectedMinutes) => {
                showFocusModal(data, selectedMinutes, hideFocusModal);
            });
        };

        const addSub = () => {
            const subIn = taskLi.querySelector('.sub-input');
            if (!subIn.value.trim()) return;
            const subLi = document.createElement('li');
            subLi.className = 'subtask-item';
            subLi.innerHTML = `<input type="checkbox"> <span>${subIn.value}</span> <button class="delete-sub-btn" style="margin-left:auto; background:none; color:var(--accent-red); border:none; cursor:pointer;"><i data-lucide="trash-2" style="width:12px;"></i></button>`;
            subLi.querySelector('input').onchange = updateStatus;
            subLi.querySelector('.delete-sub-btn').onclick = () => { subLi.remove(); updateStatus(); };
            taskLi.querySelector('.subtask-list').appendChild(subLi);
            subIn.value = '';
            updateStatus();
            initLucideIcons();
        };

        taskLi.querySelector('.add-sub-btn').onclick = addSub;
        taskLi.querySelector('.delete-task-btn').onclick = () => { taskLi.remove(); saveActiveLists(); };
        
        targetCol.appendChild(taskLi);
        if (taskData.subtasks) taskData.subtasks.forEach(s => {
            const subLi = document.createElement('li');
            subLi.className = 'subtask-item';
            subLi.innerHTML = `<input type="checkbox" ${s.completed ? 'checked' : ''}> <span>${s.text}</span> <button class="delete-sub-btn" style="margin-left:auto; background:none; color:var(--accent-red); border:none; cursor:pointer;"><i data-lucide="trash-2" style="width:12px;"></i></button>`;
            subLi.querySelector('input').onchange = updateStatus;
            subLi.querySelector('.delete-sub-btn').onclick = () => { subLi.remove(); updateStatus(); };
            taskLi.querySelector('.subtask-list').appendChild(subLi);
        });
        initLucideIcons();
    }

    addListBtn.onclick = () => {
        if (newListInput.value.trim()) {
            createNewList({ name: newListInput.value.trim(), tasks: [] });
            newListInput.value = '';
            saveActiveLists();
        }
    };

    renderSuggestions();
    const saved = JSON.parse(localStorage.getItem('activeLists'));
    if (saved) saved.forEach(l => createNewList(l));
});