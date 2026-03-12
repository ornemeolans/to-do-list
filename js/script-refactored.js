document.addEventListener('DOMContentLoaded', () => {

    const newListInput = document.getElementById('new-list-input');
    const addListBtn = document.getElementById('add-list-btn');
    const listsContainer = document.getElementById('lists-container');
    const suggestionsList = document.getElementById('suggestions-list');

    let predefinedLists = [];

    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    localStorage.removeItem('suggestions');

    function saveActiveLists() {
      const activeLists = [];
      document.querySelectorAll('#lists-container .task-list').forEach(listDiv => {
        const listId = listDiv.dataset.id;
        const name = listDiv.querySelector('h3').textContent;
        const color = listDiv.style.backgroundColor;
        const tasks = [];
        listDiv.querySelectorAll('.task-item').forEach(taskLi => {
          const taskId = taskLi.dataset.id;
          const spanEl = taskLi.querySelector('span');
          const text = spanEl.dataset.originalText || spanEl.textContent;
          const statusSelect = taskLi.querySelector('select');
          const taskStatus = statusSelect ? statusSelect.value : '';
          const subtasks = [];
          taskLi.querySelectorAll('.subtask-item').forEach(subLi => {
            const checkbox = subLi.querySelector('input[type="checkbox"]');
            const label = subLi.querySelector('span');
            subtasks.push({
              text: label.textContent,
              completed: checkbox.checked 
            });
          });
          tasks.push({ id: taskId, text, status: taskStatus, subtasks });
        });
        activeLists.push({ id: listId, name, color, tasks });
      });
      localStorage.setItem('activeLists', JSON.stringify(activeLists));
    }

    function loadActiveLists() {
      const stored = localStorage.getItem('activeLists');
      if (stored) {
        const lists = JSON.parse(stored);
        lists.forEach(listData => {
          createNewList(listData);
        });
      }
    }

    function loadSuggestions() {
        const stored = localStorage.getItem('suggestions');
        if (stored) {
            const parsed = JSON.parse(stored);
            predefinedLists = (Array.isArray(parsed) && parsed.length > 0) ? parsed : getDefaultSuggestions();
        } else {
            predefinedLists = getDefaultSuggestions();
        }
        console.log("Sugerencias cargadas:", predefinedLists);
        renderSuggestions();
    }

    function getDefaultSuggestions() {
        return [
            {
                name: "Lista de Compras",
                tasks: [
                    { text: "Pan", status: "", subtasks: [{ text: "Integral", completed: false }, { text: "Blanco", completed: true }] }
                ],
                color: "#FFFFFF"
            },
            {
                name: "Tareas del Hogar",
                tasks: [
                    { text: "Limpiar la cocina", status:"", subtasks: [] },
                    { text: "Lavar la ropa", status: "", subtasks: [] }
                ],
                color: "#FFFFFF"
            }
        ];
    }

    function renderSuggestions() {
        suggestionsList.innerHTML = '';
        predefinedLists.forEach((list, index) => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = list.name;
            span.style.cursor = 'pointer';
            span.addEventListener('click', () => {
                console.log('Cargando sugerencia:', list);
                list.tasks.forEach(task => {
                    task.status = task.status || '';
                    task.subtasks = task.subtasks || [];
                });
                createNewList(list);
            });

            const delBtn = document.createElement('button');
            delBtn.classList.add('delete-suggestion-btn');
            delBtn.innerHTML = '<img src="assets/img/papelera-xmark.png" alt="Eliminar sugerencia">';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                predefinedLists.splice(index, 1);
                saveSuggestions();
                renderSuggestions();
            });

            li.appendChild(span);
            li.appendChild(delBtn);
            suggestionsList.appendChild(li);
        });
    }

    function saveSuggestions() {
        localStorage.setItem('suggestions', JSON.stringify(predefinedLists));
    }

    function createNewList(listData) {
        const id = listData.id || generateId();
        const { name, tasks = [], color = "#FFFFFF" } = listData;

        const listDiv = document.createElement('div');
        listDiv.classList.add('task-list');
        listDiv.dataset.id = id;
        listDiv.style.backgroundColor = color;

        const title = document.createElement('h3');
        title.textContent = name;

        const columnsContainer = document.createElement('div');
        columnsContainer.classList.add('task-columns');

        const columnData = {};
        ['','Pendiente','Realizada'].forEach(status => {
            const column = document.createElement('div');
            column.classList.add('task-column');
            column.style.display = 'none';
            const colTitle = document.createElement('h3');
            colTitle.textContent = status || '' || 'Tareas';
            const ul = document.createElement('ul');
            ul.dataset.status = status;
            column.appendChild(colTitle);
            column.appendChild(ul);
            columnsContainer.appendChild(column);
            columnData[status] = ul;
        });

        tasks.forEach(task => {
            addTask(columnData[task.status || ''], task, columnData, columnsContainer);
        });
        updateColumnsDisplay();

        const taskInput = document.createElement('input');
        taskInput.type = 'text';
        taskInput.placeholder = 'Nueva tarea...';

        const addTaskBtn = document.createElement('button');
        addTaskBtn.textContent = 'Agregar';
        addTaskBtn.addEventListener('click', () => {
            if (taskInput.value.trim()) {
                addTask(columnData[''], { text: taskInput.value.trim(), status: '', subtasks: [] }, columnData, columnsContainer);
                updateColumnsDisplay();
                saveActiveLists();
                taskInput.value = '';
            }
        });

        const saveBtn = document.createElement('button');
        saveBtn.classList.add('save-suggestion-btn');
        saveBtn.innerHTML = '<img src="assets/img/guardar.png" alt="Guardar">';
        saveBtn.addEventListener('click', () => saveListAsSuggestion(name, columnsContainer, color));

        const delListBtn = document.createElement('button');
        delListBtn.classList.add('delete-list-btn');
        delListBtn.innerHTML = '<img src="assets/img/basura.png" alt="Eliminar">';
        delListBtn.addEventListener('click', () => {
            listDiv.remove();
            saveActiveLists();
        });

        listDiv.appendChild(title);
        listDiv.appendChild(columnsContainer);
        listDiv.appendChild(taskInput);
        listDiv.appendChild(addTaskBtn);
        listDiv.appendChild(saveBtn);
        listDiv.appendChild(delListBtn);
        listsContainer.appendChild(listDiv);
        saveActiveLists();

        function updateColumnsDisplay() {
            columnsContainer.querySelectorAll('.task-column').forEach(col => {
                col.style.display = col.querySelector('ul').children.length ? 'flex' : 'none';
            });
        }
    }

    function createTaskElement(taskData) {
        const { text, status = '', subtasks = [] } = taskData;
        const taskId = taskData.id || generateId();

        const li = document.createElement('li');
        li.classList.add('task-item');
        li.dataset.id = taskId;

        const span = document.createElement('span');
        span.textContent = text;
        span.dataset.originalText = text;

        const statusSelect = document.createElement('select');
        ['', 'Pendiente', 'Realizada'].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt || '';
            if (opt === status) option.selected = true;
            statusSelect.appendChild(option);
        });

        const subtaskContainer = document.createElement('div');
        const subtaskList = document.createElement('ul');
        subtaskContainer.appendChild(subtaskList);

        const subtaskInput = document.createElement('input');
        subtaskInput.type = 'text';
        subtaskInput.placeholder = 'Agregar subtarea...';

        const addSubBtn = document.createElement('button');
        addSubBtn.textContent = 'Agregar subtarea';

        subtasks.forEach(st => addSubtaskToElement(subtaskList, st, null)); // add later with events

        subtaskContainer.appendChild(subtaskInput);
        subtaskContainer.appendChild(addSubBtn);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<img src="assets/img/papelera-vacia.png" alt="Eliminar tarea">';

        li.appendChild(span);
        li.appendChild(statusSelect);
        li.appendChild(subtaskContainer);
        li.appendChild(delBtn);

        subtaskContainer.style.display = (status === 'Pendiente') ? 'block' : 'none';
        if (status === 'Realizada') {
            subtaskInput.disabled = true;
            addSubBtn.disabled = true;
        }

        return li;
    }

    function attachTaskEvents(li, taskData, columnData, columnsContainer) {
        const taskId = li.dataset.id;
        const statusSelect = li.querySelector('select');
        const subtaskContainer = li.querySelector('div');
        const subtaskList = li.querySelector('ul');
        const subtaskInput = li.querySelector('input[type="text"]');
        const addSubBtn = li.querySelector('button:nth-of-type(2)');
        const delBtn = li.querySelector('button:last-child');

        function checkAllSubtasksCompleted() {
            const checkboxes = subtaskList.querySelectorAll('input[type="checkbox"]');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            if (allChecked && checkboxes.length > 0) {
                statusSelect.value = 'Realizada';
                statusSelect.dispatchEvent(new Event('change'));
            }
        }

        delBtn.addEventListener('click', () => {
            li.remove();
            saveActiveLists();
        });

        statusSelect.addEventListener('change', () => {
            const newStatus = statusSelect.value;
            columnData[newStatus].appendChild(li);
            saveActiveLists();
            subtaskContainer.style.display = (newStatus === 'Pendiente') ? 'block' : 'none';
            if (newStatus === 'Realizada') {
                subtaskInput.disabled = true;
                addSubBtn.disabled = true;
            } else {
                subtaskInput.disabled = false;
                addSubBtn.disabled = false;
            }
            columnsContainer.querySelectorAll('.task-column').forEach(col => {
                col.style.display = col.querySelector('ul').children.length ? 'flex' : 'none';
            });
        });

        addSubBtn.addEventListener('click', () => {
            if (subtaskInput.value.trim()) {
                const newSubtask = {
                    text: subtaskInput.value.trim(),
                    completed: false
                };
                addSubtaskToElement(subtaskList, newSubtask, checkAllSubtasksCompleted);
                subtaskInput.value = '';
                saveActiveLists();
            }
        });

        // Re-attach events to existing subtasks
        li.querySelectorAll('.subtask-item input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                checkAllSubtasksCompleted();
                saveActiveLists();
            });
        });
        li.querySelectorAll('.subtask-item button').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.subtask-item').remove();
                saveActiveLists();
            });
        });
    }

    function addSubtaskToElement(subtaskList, subtaskData, checkCallback) {
        const subLi = document.createElement('li');
        subLi.classList.add('subtask-item');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = subtaskData.completed;
        const label = document.createElement('span');
        label.textContent = subtaskData.text;

        const deleteSubBtn = document.createElement('button');
        deleteSubBtn.textContent = '❌';
        deleteSubBtn.addEventListener('click', () => subLi.remove());

        checkbox.addEventListener('change', checkCallback);

        subLi.appendChild(checkbox);
        subLi.appendChild(label);
        subLi.appendChild(deleteSubBtn);
        subtaskList.appendChild(subLi);
    }

    function addTask(taskList, taskData, columnData, columnsContainer) {
        const li = createTaskElement(taskData);
        attachTaskEvents(li, taskData, columnData, columnsContainer);
        taskList.appendChild(li);
        saveActiveLists();
    }

    function saveListAsSuggestion(name, columnsContainer, color) {
        const tasks = [];
        columnsContainer.querySelectorAll('.task-column').forEach(column => {
            column.querySelectorAll('.task-item').forEach(taskEl => {
                const text = taskEl.querySelector('span').textContent;
                const status = taskEl.querySelector('select').value;
                const subtasks = [];
                const subtaskList = taskEl.querySelector('ul');
                if (subtaskList) {
                    subtaskList.querySelectorAll('li').forEach(subEl => {
                        const checkbox = subEl.querySelector('input[type="checkbox"]');
                        const label = subEl.querySelector('span');
                        if (label) {
                            subtasks.push({
                                text: label.textContent,
                                completed: checkbox ? checkbox.checked : false
                            });
                        }
                    });
                }
                tasks.push({
                    text,
                    status,
                    subtasks
                });
            });
        });
        const index = predefinedLists.findIndex(l => l.name === name);
        if (index >= 0) {
            predefinedLists[index] = {
                name: name,
                tasks: tasks,
                color: color
            };
        } else {
            predefinedLists.push({
                name: name,
                tasks: tasks,
                color: color
            });
        }
        saveSuggestions();
        renderSuggestions();
    }

    addListBtn.addEventListener('click', () => {
        if (newListInput.value.trim()) {
            createNewList({ name: newListInput.value.trim(), tasks: [] });
            newListInput.value = '';
        }
    });

    newListInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addListBtn.click();
    });

    loadSuggestions();
    loadActiveLists();
});
