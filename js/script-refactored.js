document.addEventListener('DOMContentLoaded', async () => {
    await window.utils.ready;
    const { showToast, initLucideIcons, showFocusModal, hideFocusModal } = window.utils;
    const newListInput = document.getElementById('new-list-input');
    const addListBtn = document.getElementById('add-list-btn');
    const listsContainer = document.getElementById('lists-container');
    const suggestionsList = document.getElementById('suggestions-list');
    
    const themeToggle = document.getElementById('dark-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    if (themeToggle) {
        themeToggle.onclick = () => {
            const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        };
    }

    // Mejora 1: Crear lista con Enter
newListInput.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); addListBtn.click(); } };

    let predefinedLists = JSON.parse(localStorage.getItem('suggestions')) || [
        { name: "🏠 Tareas Hogar", tasks: [{ text: "Lavar ropa", status: "Pendiente", subtasks: [] }] },
        { name: "🛒 Compras para el Hogar", tasks: [
        { text: "Verduleria", status: "Pendiente", subtasks: [{ text: "Cebolla", completed: false }] },
        { text: "Carneceria", status: "Pendiente", subtasks: [{ text: "Bife", completed: false }] }]},
        { 
            name: "📸 Sesión Fotográfica - {cliente}", 
            tasks: [
                { text: "Enviar presupuesto a {cliente}", status: "Pendiente", subtasks: [] },
                { text: "Confirmar ubicación con {cliente}", status: "Pendiente", subtasks: [] },
                { text: "Limpiar lentes para el {fecha}", status: "Pendiente", subtasks: [] },
                { text: "Preparar equipo de ilumincaión antes del {fecha}", status: "Pendiente", subtasks: [] }
            ] 
        }
    ];

    function saveActiveLists() {
        const activeLists = [];
        document.querySelectorAll('.task-list').forEach(listDiv => {
            const tasks = [];
            listDiv.querySelectorAll('.task-item').forEach(taskLi => {
                const subtasks = Array.from(taskLi.querySelectorAll('.subtask-item')).map(subLi => ({
                    text: subLi.dataset.originalText || subLi.querySelector('span').textContent,
                    completed: subLi.querySelector('input').checked,
                    isVisual: subLi.classList.contains('visual-hidden-sub')
                }));
                tasks.push({ text: taskLi.querySelector('.task-text').textContent, status: taskLi.querySelector('.status-select').value, subtasks });
            });
            activeLists.push({ name: listDiv.querySelector('h3').textContent, tasks });
        });
        localStorage.setItem('activeLists', JSON.stringify(activeLists));
    }

    function extractVariables(list) {
        let allText = list.name;
        list.tasks.forEach(t => {
            allText += " " + t.text;
            if(t.subtasks) t.subtasks.forEach(s => allText += " " + s.text);
        });
        const varMatch = allText.match(/{([a-zA-Z]+)}/g);
        return varMatch ? [...new Set(varMatch.map(v => v.slice(1, -1).toLowerCase()))] : [];
    }

    function renderSuggestions() {
        suggestionsList.innerHTML = '';
        predefinedLists.forEach((list, index) => {
            const vars = extractVariables(list);
            const li = document.createElement('li');
            li.innerHTML = `<span>${list.name.split(' - ')[0]}</span><button class="delete-suggestion-btn"><i data-lucide="x"></i></button>`;
            
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

    function createNewList(listData) {
        const listDiv = document.createElement('div');
        listDiv.className = 'task-list';
        listDiv.innerHTML = `
            <h3 contenteditable="true">${listData.name}</h3>
            <div class="task-columns" style="display:flex; gap:15px; margin-bottom:20px;">
                <div class="task-column" data-status="Pendiente" style="flex:1"><h4 style="font-size:0.7rem; opacity:0.5;">PENDIENTES</h4><ul style="padding:0; list-style:none;"></ul></div>
                <div class="task-column" data-status="Realizada" style="flex:1"><h4 style="font-size:0.7rem; opacity:0.5;">REALIZADAS</h4><ul style="padding:0; list-style:none;"></ul></div>
            </div>
            <div class="list-footer" style="display:flex; gap:10px; align-items:center;">
                <input type="text" placeholder="Nueva tarea..." class="task-input" style="flex-grow:1">
                <button class="add-task-btn"><i data-lucide="plus"></i></button>
                <button class="save-suggestion-btn" style="background:#00b894" title="Guardar"><i data-lucide="save"></i></button>
                <button class="delete-list-btn" style="background:#ff7675" title="Eliminar"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        
        // Mejora 1.2: Crear tarea con Enter
        const taskInput = listDiv.querySelector('.task-input');
        taskInput.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); listDiv.querySelector('.add-task-btn').click(); } };

        listDiv.querySelector('.save-suggestion-btn').onclick = () => {
            const tasks = [];
            listDiv.querySelectorAll('.task-item').forEach(taskLi => {
                const subtasks = Array.from(taskLi.querySelectorAll('.subtask-item')).map(subLi => ({
                    text: subLi.dataset.originalText || subLi.querySelector('span').textContent,
                    completed: subLi.querySelector('input').checked
                }));
                tasks.push({ text: taskLi.querySelector('.task-text').textContent, status: taskLi.querySelector('.status-select').value, subtasks });
            });
            const name = listDiv.querySelector('h3').textContent;
            const existingIndex = predefinedLists.findIndex(l => l.name === name);
            if (existingIndex > -1) predefinedLists[existingIndex] = { name, tasks };
            else predefinedLists.push({ name, tasks });
            localStorage.setItem('suggestions', JSON.stringify(predefinedLists));
            renderSuggestions(); 
            showToast('Lista guardada ✨');
        };

        listDiv.querySelector('.delete-list-btn').onclick = () => { listDiv.remove(); saveActiveLists(); };
        listDiv.querySelector('.add-task-btn').onclick = () => {
            if (taskInput.value.trim()) {
                addTask(listDiv, { text: taskInput.value, status: 'Pendiente', subtasks: [] });
                taskInput.value = '';
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
                <button class="task-edit-btn" title="Editar"><i data-lucide="edit-3" style="width:16px;"></i></button>
                <button class="focus-btn" title="Enfoque"><i data-lucide="target" style="width:16px;"></i></button>
                <button class="delete-task-btn" style="background:none; color:var(--accent-red);"><i data-lucide="x"></i></button>
            </div>
            <div class="moodboard-container" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;"></div>
            <ul class="subtask-list" style="list-style:none; padding-left:15px; margin-top:10px;"></ul>
            <div class="subtask-controls" style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" placeholder="Subtarea..." class="sub-input" style="font-size:0.8rem; flex-grow:1;">
                <button class="add-sub-btn">+</button>
            </div>
        `;

        const subInput = taskLi.querySelector('.sub-input');
        const moodboard = taskLi.querySelector('.moodboard-container');
        const statusSelect = taskLi.querySelector('.status-select');

        const updateStatus = (e) => {
            const textCheckboxes = Array.from(taskLi.querySelectorAll('.subtask-item:not(.visual-hidden-sub) input'));
            if (e && e.target.tagName === 'SELECT') {
                if (e.target.value === 'Pendiente') textCheckboxes.forEach(c => c.checked = false);
            } else if (textCheckboxes.length > 0) {
                const allDone = textCheckboxes.every(c => c.checked);
                statusSelect.value = allDone ? 'Realizada' : 'Pendiente';
            }
            listDiv.querySelector(`.task-column[data-status="${statusSelect.value}"] ul`).appendChild(taskLi);
            saveActiveLists();
        };

        const addSub = (sub) => {
            const text = typeof sub === 'string' ? sub : (sub.text || subInput.value.trim());
            if (!text) return;

            const isColor = /^#[0-9A-F]{6}$/i.test(text);
            const isImg = /^(http|https):\/\/.*\.(jpg|jpeg|png|webp|gif|svg)/i.test(text);

            if (isColor || isImg) {
                // Mejora 2 y 3: Moodboard con visualización y eliminación estándar
                const item = document.createElement('div');
                item.className = 'mood-item';
                item.style.cssText = `position:relative; width:45px; height:45px; border-radius:12px; cursor:pointer; border:2px solid var(--glass-border); background-size:cover; background-position:center;`;
                if (isColor) item.style.backgroundColor = text;
                else item.style.backgroundImage = `url(${text})`;
                
                // Clic para tamaño completo
                item.onclick = (e) => {
                    if (e.target.closest('.delete-mood-btn')) return;
                    showFullVisual(text, isColor);
                };

                // Botón de eliminar integrado
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-mood-btn';
                delBtn.innerHTML = '✕';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    item.remove();
                    taskLi.querySelector(`.visual-hidden-sub[data-ref="${text}"]`)?.remove();
                    updateStatus();
                };
                item.appendChild(delBtn);
                moodboard.appendChild(item);

                const hiddenSub = document.createElement('li');
                hiddenSub.className = 'subtask-item visual-hidden-sub';
                hiddenSub.style.display = 'none';
                hiddenSub.dataset.originalText = text;
                hiddenSub.dataset.ref = text;
                hiddenSub.innerHTML = `<input type="checkbox" checked> <span>${text}</span>`;
                taskLi.querySelector('.subtask-list').appendChild(hiddenSub);
            } else {
                const subLi = document.createElement('li');
                subLi.className = 'subtask-item';
                subLi.innerHTML = `<input type="checkbox" ${sub.completed ? 'checked' : ''}> <span>${text}</span> <button class="delete-sub-btn" style="margin-left:auto; background:none; color:var(--accent-red); border:none; cursor:pointer;"><i data-lucide="trash-2" style="width:12px;"></i></button>`;
                subLi.querySelector('input').onchange = () => updateStatus();
                subLi.querySelector('.delete-sub-btn').onclick = () => { subLi.remove(); updateStatus(); };
                taskLi.querySelector('.subtask-list').appendChild(subLi);
            }
            subInput.value = '';
            initLucideIcons();
            updateStatus();
        };

        // Función para mostrar visuales en grande
        function showFullVisual(content, isColor) {
            const viewer = document.createElement('div');
            viewer.className = 'visual-viewer-overlay';
            viewer.innerHTML = isColor 
                ? `<div class="viewer-content" style="background:${content}; width:300px; height:300px; border-radius:30px; border:4px solid white;"></div>`
                : `<img src="${content}" class="viewer-content" style="max-width:90%; max-height:80%; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.5);">`;
            viewer.onclick = () => viewer.remove();
            document.body.appendChild(viewer);
        }

        taskLi.querySelector('.add-sub-btn').onclick = addSub;
        subInput.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } };
        statusSelect.onchange = updateStatus;
        
        taskLi.querySelector('.task-edit-btn').onclick = () => {
            const current = { text: taskLi.querySelector('.task-text').textContent, subtasks: Array.from(taskLi.querySelectorAll('.subtask-item')).map(s => ({ text: s.dataset.originalText || s.querySelector('span').textContent, completed: s.querySelector('input').checked })) };
            window.utils.showTaskEditModal('Editar Tarea', current, (newData) => {
                taskLi.querySelector('.task-text').textContent = newData.text;
                moodboard.innerHTML = '';
                taskLi.querySelector('.subtask-list').innerHTML = '';
                newData.subtasks.forEach(s => addSub(s));
                saveActiveLists();
            });
        };

        taskLi.querySelector('.focus-btn').onclick = () => {
            const data = { text: taskLi.querySelector('.task-text').textContent, subtasks: Array.from(taskLi.querySelectorAll('.subtask-item:not(.visual-hidden-sub)')).map(s => ({ text: s.querySelector('span').textContent, completed: s.querySelector('input').checked })) };
            window.utils.showTimePickerModal((mins) => showFocusModal(data, mins, hideFocusModal));
        };

        taskLi.querySelector('.delete-task-btn').onclick = () => { taskLi.remove(); saveActiveLists(); };
        targetCol.appendChild(taskLi);
        if (taskData.subtasks) taskData.subtasks.forEach(s => addSub(s));
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

// FIX GLOBAL ENTER - V2: Más robusto para subtareas
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const target = e.target;
        if (target.classList.contains('task-input')) {
            const btn = target.closest('.list-footer')?.querySelector('.add-task-btn');
            if (btn) btn.click();
        } else if (target.classList.contains('sub-input')) {
            const controls = target.closest('.subtask-controls');
            if (controls) {
                const btn = controls.querySelector('.add-sub-btn');
                if (btn) btn.click();
            }
        }
    }
});

    const saved = JSON.parse(localStorage.getItem('activeLists'));
    if (saved) saved.forEach(l => createNewList(l));
});
