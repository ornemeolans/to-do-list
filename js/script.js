document.addEventListener('DOMContentLoaded', () => {
    const { showToast, initLucideIcons } = window.utils || {};
    const newListInput = document.getElementById('new-list-input');
    const addListBtn = document.getElementById('add-list-btn');
    const listsContainer = document.getElementById('lists-container');
    const suggestionsList = document.getElementById('suggestions-list');

    // Cargar sugerencias iniciales
    let predefinedLists = JSON.parse(localStorage.getItem('suggestions')) || [
        { name: "🏠 Tareas Hogar", tasks: [{ text: "Lavar ropa", status: "Pendiente", subtasks: [] }] }
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

    function renderSuggestions() {
        suggestionsList.innerHTML = '';
        predefinedLists.forEach((list, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="suggestion-name">${list.name}</span>
                <button class="delete-suggestion-btn" style="background:none; color:inherit; padding:5px;">
                    <i data-lucide="x"></i>
                </button>
            `;
            
            li.querySelector('.suggestion-name').onclick = () => createNewList(list);
            li.querySelector('.delete-suggestion-btn').onclick = (e) => {
                e.stopPropagation();
                predefinedLists.splice(index, 1);
                localStorage.setItem('suggestions', JSON.stringify(predefinedLists));
                renderSuggestions();
            };
            suggestionsList.appendChild(li);
        });
        if (initLucideIcons) initLucideIcons();
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
        if (showToast) showToast('Sugerencia guardada ✨');
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
        if (initLucideIcons) initLucideIcons();
    }

    function addTask(listDiv, taskData) {
        const targetCol = listDiv.querySelector(`.task-column[data-status="${taskData.status || 'Pendiente'}"] ul`);
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
        statusSelect.onchange = (e) => {
            listDiv.querySelector(`.task-column[data-status="${e.target.value}"] ul`).appendChild(taskLi);
            saveActiveLists();
        };

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
                subLi.innerHTML = `<input type="checkbox"> <span>${subIn.value}</span>`;
                subLi.querySelector('input').onchange = saveActiveLists;
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
                subLi.innerHTML = `<input type="checkbox" ${s.completed ? 'checked' : ''}> <span>${s.text}</span>`;
                subLi.querySelector('input').onchange = saveActiveLists;
                taskLi.querySelector('.subtask-list').appendChild(subLi);
            });
        }
        if (initLucideIcons) initLucideIcons();
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