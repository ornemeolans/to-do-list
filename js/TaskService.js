window.TaskService = {
    extractVariables: function (list) {
        let allText = list.name;
        list.tasks.forEach(t => {
            allText += " " + t.text;
            if (t.subtasks) t.subtasks.forEach(s => allText += " " + s.text);
        });
        const varMatch = allText.match(/{([a-zA-Z]+)}/g);
        return varMatch ? [...new Set(varMatch.map(v => v.slice(1, -1).toLowerCase()))] : [];
    },

    validateVisual: function (text) {
        const isColor = /^#[0-9A-F]{6}$/i.test(text);
        const isDataUrl = /^data:image\/[a-z]+;base64,/i.test(text);
        const isImgUrl = /^(http|https):\/\/.*\.(jpg|jpeg|png|webp|gif|svg)/i.test(text);
        return { isColor, isImg: isDataUrl || isImgUrl, content: text };
    },

    validateTaskText: function (text) {
        const trimmed = text ? text.trim() : '';
        return trimmed || null;  // null = inválido (vacío post-trim)
    },

    handleInlineEdit: function (element) {
        const text = element.textContent.trim();
        if (!this.validateTaskText(text)) {
            window.utils.showToast('El texto no puede estar vacío');
            element.textContent = element.dataset.originalText || (element.classList.contains('task-text') ? 'Nueva tarea' : 'Nueva subtarea');
            return;
        }
        element.dataset.originalText = text;
        const listsContainer = document.getElementById('lists-container');
        if (listsContainer) {
            window.StorageService.saveActiveListsFromDOM(listsContainer);
        }
    },

    addLocalImage: function (taskLi) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.opacity = '0';
        input.style.position = 'fixed';
        input.style.top = '0';
        input.style.left = '0';
        input.style.width = '100vw';
        input.style.height = '100vh';
        input.style.cursor = 'pointer';
        document.body.appendChild(input);
        input.click();
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    this.addSubtask(taskLi, base64, null);
                    window.utils.showToast('Imagen agregada al moodboard');
                };
                reader.readAsDataURL(file);
            }
            input.remove();
        };
        input.onblur = () => input.remove();
    },

    showLocalFilePicker: function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.opacity = '0';
        input.style.position = 'fixed';
        input.style.top = '0';
        input.style.left = '0';
        input.style.width = '100vw';
        input.style.height = '100vh';
        input.style.cursor = 'pointer';
        document.body.appendChild(input);
        input.click();
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                this.showFullVisual(url, false);
                // Cleanup
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            }
            input.remove();
        };
        input.onblur = () => input.remove();
    },

    showFullVisual: function (content, isColor) {
        const viewer = document.createElement('div');
        viewer.className = 'visual-viewer-overlay';

        // Build content securely with createElement
        let viewerContent;
        if (isColor) {
            viewerContent = document.createElement('div');
            viewerContent.className = 'viewer-content';
            viewerContent.style.cssText = `background:${content}; width:300px; height:300px; border-radius:30px; border:4px solid white;`;
        } else {
            viewerContent = document.createElement('img');
            viewerContent.src = content;
            viewerContent.className = 'viewer-content';
            viewerContent.style.cssText = 'max-width:90%; max-height:80%; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.5);';
        }
        viewer.appendChild(viewerContent);

        viewer.onclick = () => viewer.remove();
        document.body.appendChild(viewer);
    },

    renderSubtasksFromData: function(taskLi) {
        try {
            const dataStr = taskLi.dataset.subtasks || '[]';
            const subtasks = JSON.parse(dataStr);
            
            const moodboard = taskLi.querySelector('.moodboard-container');
            const subtaskList = taskLi.querySelector('.subtask-list');
            
            moodboard.innerHTML = '';
            subtaskList.innerHTML = '';
            
            subtasks.forEach((sub, index) => {
                const text = sub.text;
                const validation = this.validateVisual(text);
                
                if (sub.isVisual && (validation.isColor || validation.isImg)) {
                    // Visual mood-item (no hidden li)
                    const item = document.createElement('div');
                    item.className = 'mood-item';
                    item.style.cssText = `position:relative; width:45px; height:45px; border-radius:12px; cursor:pointer; border:2px solid var(--glass-border); background-size:cover; background-position:center;`;
                    if (validation.isColor) item.style.backgroundColor = text;
                    else item.style.backgroundImage = `url(${text})`;
                    
                    item.onclick = (e) => {
                        if (e.target.closest('.delete-mood-btn')) return;
                        this.showFullVisual(text, validation.isColor);
                    };
                    item.oncontextmenu = (e) => {
                        e.preventDefault();
                        this.showLocalFilePicker();
                    };
                    
                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-mood-btn';
                    delBtn.textContent = '✕';
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        // Update data: remove by index
                        const updated = JSON.parse(taskLi.dataset.subtasks || '[]');
                        updated.splice(index, 1);
                        taskLi.dataset.subtasks = JSON.stringify(updated);
                        this.renderSubtasksFromData(taskLi);
                        this.updateTaskStatus(taskLi, false);
                    };
                    item.appendChild(delBtn);
                    moodboard.appendChild(item);
                    
                } else {
                    // Text subtask
                    const subLi = document.createElement('li');
                    subLi.className = 'subtask-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = sub.completed || false;
                    
                    const textSpan = document.createElement('span');
                    textSpan.contentEditable = true;
                    textSpan.textContent = text;
                    textSpan.dataset.originalText = text;
                    textSpan.addEventListener('blur', () => this.handleInlineEdit(textSpan));
                    
                    const deleteBtnSub = document.createElement('button');
                    deleteBtnSub.className = 'delete-sub-btn';
                    deleteBtnSub.style.cssText = 'margin-left:auto; background:none; color:var(--accent-red); border:none; cursor:pointer;';
                    const trashIcon = document.createElement('i');
                    trashIcon.dataset.lucide = 'trash-2';
                    trashIcon.style.cssText = 'width:12px;';
                    deleteBtnSub.appendChild(trashIcon);
                    
                    subLi.appendChild(checkbox);
                    subLi.appendChild(textSpan);
                    subLi.appendChild(deleteBtnSub);
                    subtaskList.appendChild(subLi);
                    
                    // Events update data
                    checkbox.addEventListener('change', (e) => {
                        e.stopPropagation();
                        const updated = JSON.parse(taskLi.dataset.subtasks || '[]');
                        updated[index].completed = checkbox.checked;
                        taskLi.dataset.subtasks = JSON.stringify(updated);
                        this.updateTaskStatus(taskLi, false);
                    });
                    
                    deleteBtnSub.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const updated = JSON.parse(taskLi.dataset.subtasks || '[]');
                        updated.splice(index, 1);
                        taskLi.dataset.subtasks = JSON.stringify(updated);
                        this.renderSubtasksFromData(taskLi);
                        this.updateTaskStatus(taskLi, false);
                    });
                }
            });
            
            window.utils.initLucideIcons();
        } catch (e) {
            console.error('Render subtasks error:', e);
            taskLi.dataset.subtasks = '[]';
        }
    },

    addSubtask: function (taskLi, sub, subInput) {
        const text = typeof sub === 'string' ? sub : ((sub && sub.text) || (subInput && subInput.value ? subInput.value.trim() : ''));
        if (!text || text === '') return;

        const validation = this.validateVisual(text);
        const isVisual = validation.isColor || validation.isImg;
        
        try {
            const subtasks = JSON.parse(taskLi.dataset.subtasks || '[]');
            subtasks.push({
                text: text,
                completed: false,
                isVisual: isVisual
            });
            taskLi.dataset.subtasks = JSON.stringify(subtasks);
        } catch (e) {
            console.error('addSubtask data error:', e);
            taskLi.dataset.subtasks = JSON.stringify([{
                text: text,
                completed: false,
                isVisual: isVisual
            }]);
        }
        
        this.renderSubtasksFromData(taskLi);
        this.updateTaskStatus(taskLi, false);
        
        if (subInput) subInput.value = '';
        window.utils.initLucideIcons();
    },

    updateTaskStatus: function (taskLi, isManualStatusChange = true) {
        const listDiv = taskLi.closest('.task-list');
        const statusSelect = taskLi.querySelector('.status-select');
        const currentStatus = statusSelect.value;
        
        let subtasks = JSON.parse(taskLi.dataset.subtasks || '[]');

        // 1. Si el cambio es manual (el usuario cambió el select), sincronizamos subtareas
        if (isManualStatusChange) {
            subtasks.forEach((sub, index) => {
                if (!sub.isVisual) {
                    subtasks[index].completed = (currentStatus === 'Realizada');
                }
            });
            taskLi.dataset.subtasks = JSON.stringify(subtasks);
            this.renderSubtasksFromData(taskLi); // Renderizamos cambios en los checkboxes
        } else {
            // 2. Si el cambio viene de una subtarea, verificamos si la tarea general debe cambiar
            const textSubtasks = subtasks.filter(s => !s.isVisual);
            const allTextDone = textSubtasks.length > 0 && textSubtasks.every(s => s.completed);
            const autoStatus = allTextDone ? 'Realizada' : 'Pendiente';
            
            if (autoStatus !== currentStatus) {
                statusSelect.value = autoStatus;
            }
        }

        // 3. Mover al contenedor correcto inmediatamente
        const targetCol = listDiv.querySelector(`.task-column[data-status="${statusSelect.value}"] ul`);
        if (taskLi.parentElement !== targetCol) {
            targetCol.appendChild(taskLi);
        }

        // 4. Persistir
        const listsContainer = document.getElementById('lists-container');
        if (listsContainer) {
            window.StorageService.saveActiveListsFromDOM(listsContainer);
        }
    },

createNewList: function (listData, container) {
    const listDiv = document.createElement('div');
    listDiv.className = 'task-list';

    // Build with createElement + DocumentFragment (secure & performant)
    const fragment = document.createDocumentFragment();

    // h3
    const h3 = document.createElement('h3');
    h3.contentEditable = true;
    h3.setAttribute('aria-label', 'Nombre de la lista (editar)');
    h3.textContent = listData.name;
    fragment.appendChild(h3);

    // task-columns container
    const taskColumns = document.createElement('div');
    taskColumns.className = 'task-columns';
    taskColumns.style.cssText = 'display:flex; gap:15px; margin-bottom:20px;';
    taskColumns.setAttribute('role', 'region');
    taskColumns.setAttribute('aria-label', 'Columnas de tareas');

    // Pendiente column
    const colPending = document.createElement('div');
    colPending.className = 'task-column';
    colPending.dataset.status = 'Pendiente';
    colPending.style.cssText = 'flex:1';
    const h4Pending = document.createElement('h4');
    h4Pending.style.cssText = 'font-size:0.7rem; opacity:0.5;';
    h4Pending.textContent = 'PENDIENTES';
    const ulPending = document.createElement('ul');
    ulPending.style.cssText = 'padding:0; list-style:none;';
    ulPending.setAttribute('aria-label', 'Tareas pendientes');
    colPending.appendChild(h4Pending);
    colPending.appendChild(ulPending);

    // Realizada column  
    const colDone = document.createElement('div');
    colDone.className = 'task-column';
    colDone.dataset.status = 'Realizada';
    colDone.style.cssText = 'flex:1';
    const h4Done = document.createElement('h4');
    h4Done.style.cssText = 'font-size:0.7rem; opacity:0.5;';
    h4Done.textContent = 'REALIZADAS';
    const ulDone = document.createElement('ul');
    ulDone.style.cssText = 'padding:0; list-style:none;';
    ulDone.setAttribute('aria-label', 'Tareas realizadas');
    colDone.appendChild(h4Done);
    colDone.appendChild(ulDone);

    taskColumns.appendChild(colPending);
    taskColumns.appendChild(colDone);
    fragment.appendChild(taskColumns);

    // list-footer
    const listFooter = document.createElement('div');
    listFooter.className = 'list-footer';
    listFooter.style.cssText = 'display:flex; gap:10px; align-items:center;';

    const taskInput = document.createElement('input');
    taskInput.type = 'text';
    taskInput.placeholder = 'Nueva tarea...';
    taskInput.className = 'task-input';
    taskInput.style.cssText = 'flex-grow:1';
    taskInput.setAttribute('aria-label', 'Nueva tarea');

    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'add-task-btn';
    addTaskBtn.setAttribute('aria-label', 'Agregar tarea');
    const iPlus = document.createElement('i');
    iPlus.dataset.lucide = 'plus';
    addTaskBtn.appendChild(iPlus);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-suggestion-btn';
    saveBtn.style.cssText = 'background:#00b894';
    saveBtn.setAttribute('aria-label', 'Guardar como sugerencia');
    const iSave = document.createElement('i');
    iSave.dataset.lucide = 'save';
    saveBtn.appendChild(iSave);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-list-btn';
    deleteBtn.style.cssText = 'background:#ff7675';
    deleteBtn.setAttribute('aria-label', 'Eliminar lista');
    const iTrash = document.createElement('i');
    iTrash.dataset.lucide = 'trash-2';
    deleteBtn.appendChild(iTrash);

    listFooter.appendChild(taskInput);
    listFooter.appendChild(addTaskBtn);
    listFooter.appendChild(saveBtn);
    listFooter.appendChild(deleteBtn);
    fragment.appendChild(listFooter);

    listDiv.appendChild(fragment);

    // Use DOM ref instead of re-query (fix TS 2451)
    const inputRef = listDiv.querySelector('.task-input');
    inputRef.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); listDiv.querySelector('.add-task-btn').click(); } };

    // Wire events
    listDiv.querySelector('.save-suggestion-btn').onclick = () => {
        const tasks = [];
        listDiv.querySelectorAll('.task-item').forEach(taskLi => {
            const subtasks = JSON.parse(taskLi.dataset.subtasks || '[]');
            tasks.push({
                text: taskLi.querySelector('.task-text').textContent,
                status: taskLi.querySelector('.status-select').value,
                subtasks
            });
        });
        const name = listDiv.querySelector('h3').textContent;
        
        window.StorageService.saveListAsSuggestion({ name, tasks });
        window.utils.showToast("¡Lista guardada en sugerencias! ✨", "exito");
        
        if (typeof window.renderSuggestions === 'function') {
            window.renderSuggestions();
        }
    };

    listDiv.querySelector('.delete-list-btn').onclick = () => {
        listDiv.remove();
        window.StorageService.saveActiveListsFromDOM(container);
        window.utils.showToast("Lista eliminada", "info");
    };

    listDiv.querySelector('.add-task-btn').onclick = () => {
        const taskText = inputRef.value.trim();
        if (!taskText) {
            window.utils.showToast('No se pueden crear tareas vacías', 'advertencia');
            return;
        }
        this.addTask(listDiv, { text: taskText, status: 'Pendiente', subtasks: [] });
        inputRef.value = '';
        window.StorageService.saveActiveListsFromDOM(container);
    };

    // Drag & Drop for columns
    listDiv.querySelectorAll('.task-column ul').forEach(ul => {
        ul.addEventListener('dragover', (e) => {
            e.preventDefault();
            ul.classList.add('drag-over');
        });
        ul.addEventListener('dragleave', () => ul.classList.remove('drag-over'));
        ul.addEventListener('drop', (e) => {
            e.preventDefault();
            ul.classList.remove('drag-over');
            if (window.draggedTask) {
                const targetColumn = ul.closest('.task-column');
                const targetStatus = targetColumn.dataset.status;
                const statusSelect = window.draggedTask.querySelector('.status-select');
                statusSelect.value = targetStatus;
                // Importante: forzar actualización al soltar
                this.updateTaskStatus(window.draggedTask, true);
            }
        });
    });

    container.appendChild(listDiv);
    if (listData.tasks) listData.tasks.forEach(t => this.addTask(listDiv, t));
    window.utils.initLucideIcons();
    return listDiv;
},

    addTask: function (listDiv, taskData) {
        const validText = this.validateTaskText(taskData.text);
        if (!validText) return;

        const targetCol = listDiv.querySelector(`.task-column[data-status="${taskData.status || 'Pendiente'}"] ul`);
        const taskLi = document.createElement('li');
        taskLi.className = 'task-item';
        taskLi.draggable = true;
        taskLi.classList.add('draggable-task');
        taskLi.addEventListener('dragstart', (e) => { window.draggedTask = taskLi; e.dataTransfer.effectAllowed = 'move'; });
        taskLi.addEventListener('dragend', () => { window.draggedTask = null; });

        const taskFragment = document.createDocumentFragment();
        const taskMain = document.createElement('div');
        taskMain.className = 'task-main';
        taskMain.style.cssText = 'display:flex; align-items:center; gap:10px;';

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.style.cssText = 'flex-grow:1;';
        taskText.contentEditable = true;
        taskText.textContent = validText;
        taskText.dataset.originalText = validText;
        taskText.addEventListener('blur', () => this.handleInlineEdit(taskText));
        taskMain.appendChild(taskText);

        const statusSelect = document.createElement('select');
        statusSelect.className = 'status-select';
        statusSelect.setAttribute('aria-label', 'Estado de la tarea');
        const optPending = document.createElement('option');
        optPending.value = 'Pendiente';
        optPending.textContent = '⏳ Pendiente';
        if (taskData.status === 'Pendiente') optPending.selected = true;
        const optDone = document.createElement('option');
        optDone.value = 'Realizada';
        optDone.textContent = '✅ Realizada';
        if (taskData.status === 'Realizada') optDone.selected = true;
        statusSelect.appendChild(optPending);
        statusSelect.appendChild(optDone);
        taskMain.appendChild(statusSelect);

        const editBtn = document.createElement('button');
        editBtn.className = 'task-edit-btn';
        editBtn.title = 'Editar';
        editBtn.setAttribute('aria-label', 'Editar tarea');
        const iEdit = document.createElement('i');
        iEdit.dataset.lucide = 'edit-3';
        iEdit.style.cssText = 'width:16px;';
        editBtn.appendChild(iEdit);
        taskMain.appendChild(editBtn);

        const focusBtn = document.createElement('button');
        focusBtn.className = 'focus-btn';
        focusBtn.title = 'Enfoque';
        focusBtn.setAttribute('aria-label', 'Modo enfoque');
        const iFocus = document.createElement('i');
        iFocus.dataset.lucide = 'target';
        iFocus.style.cssText = 'width:16px;';
        focusBtn.appendChild(iFocus);
        taskMain.appendChild(focusBtn);

        const deleteBtnTask = document.createElement('button');
        deleteBtnTask.className = 'delete-task-btn';
        deleteBtnTask.setAttribute('aria-label', 'Eliminar tarea');
        deleteBtnTask.style.cssText = 'background:none; color:var(--accent-red);';
        const iDelete = document.createElement('i');
        iDelete.dataset.lucide = 'x';
        deleteBtnTask.appendChild(iDelete);
        taskMain.appendChild(deleteBtnTask);

        taskFragment.appendChild(taskMain);

        const moodboard = document.createElement('div');
        moodboard.className = 'moodboard-container';
        moodboard.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;';
        taskFragment.appendChild(moodboard);

        const subtaskList = document.createElement('ul');
        subtaskList.className = 'subtask-list';
        subtaskList.style.cssText = 'list-style:none; padding-left:15px; margin-top:10px;';
        taskFragment.appendChild(subtaskList);

        const subControls = document.createElement('div');
        subControls.className = 'subtask-controls';
        subControls.style.cssText = 'display:flex; gap:5px; margin-top:10px;';

        const subInput = document.createElement('input');
        subInput.type = 'text';
        subInput.placeholder = 'Subtarea...';
        subInput.className = 'sub-input';
        subInput.style.cssText = 'font-size:0.8rem; flex-grow:1; flex-basis:0;';
        subControls.appendChild(subInput);

        const addSubBtn = document.createElement('button');
        addSubBtn.className = 'add-sub-btn';
        addSubBtn.setAttribute('aria-label', 'Agregar subtarea');
        addSubBtn.textContent = '+';
        subControls.appendChild(addSubBtn);

        const imageBtn = document.createElement('button');
        imageBtn.className = 'add-image-btn';
        imageBtn.setAttribute('aria-label', 'Agregar imagen local');
        imageBtn.innerHTML = '📁';
        imageBtn.style.cssText = 'padding:8px; border-radius:8px; background:var(--accent-blue); color:white; border:none; cursor:pointer; font-size:1rem;';
        imageBtn.onclick = () => this.addLocalImage(taskLi);
        subControls.appendChild(imageBtn);
        taskFragment.appendChild(subControls);

        taskLi.appendChild(taskFragment);

        // CORRECCIÓN: Evento change directo para respuesta inmediata
        statusSelect.addEventListener('change', (e) => {
            this.updateTaskStatus(taskLi, true);
        });

        subControls.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-sub-btn')) {
                this.addSubtask(taskLi, null, subInput);
            }
        });

        subInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addSubtask(taskLi, null, subInput);
            }
        });

        editBtn.addEventListener('click', () => {
            const subtasks = JSON.parse(taskLi.dataset.subtasks || '[]');
            const current = { 
                text: taskText.textContent, 
                subtasks: subtasks.map(s => ({ text: s.text, completed: s.completed })) 
            };
            window.utils.showTaskEditModal('Editar Tarea', current, (newData) => {
                taskText.textContent = newData.text;
                taskLi.dataset.subtasks = JSON.stringify(newData.subtasks.map(s => ({
                    text: s.text,
                    completed: s.completed || false,
                    isVisual: this.validateVisual(s.text).isImg || /^#[0-9A-F]{6}$/i.test(s.text)
                })));
                this.renderSubtasksFromData(taskLi);
                this.updateTaskStatus(taskLi, false);
            });
        });

        focusBtn.addEventListener('click', () => {
            const data = {
                text: taskText.textContent,
                subtasks: JSON.parse(taskLi.dataset.subtasks || '[]').filter(s => !s.isVisual)
            };
            window.utils.showTimePickerModal((mins) => {
                window.utils.showFocusModal(data, mins, window.utils.hideFocusModal);
            });
        });

        deleteBtnTask.addEventListener('click', () => {
            taskLi.remove();
            window.StorageService.saveActiveListsFromDOM(document.getElementById('lists-container'));
        });

        taskLi.dataset.subtasks = JSON.stringify(taskData.subtasks || []);
        this.renderSubtasksFromData(taskLi);
        
        targetCol.appendChild(taskLi);
        window.utils.initLucideIcons();
    }
};