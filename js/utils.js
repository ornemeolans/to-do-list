window.utils = {
    showToast: (msg) => {
        const toast = document.createElement('div');
        toast.style.cssText = `position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:var(--accent-blue); color:white; padding:12px 25px; border-radius:20px; z-index:10005; font-weight:500; box-shadow:var(--shadow);`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    },

showModal: (title, fields, onConfirm) => {
    const modal = document.getElementById('template-modal');
    
    // Clear and build secure DOM tree
    modal.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    // overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(5px);';
    
    // content
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = 'background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:24px;padding:30px;width:90%;max-width:400px;';
    
    // title h3
    const h3 = document.createElement('h3');
    h3.style.cssText = 'color:var(--accent-blue);margin-bottom:20px;';
    h3.textContent = title;
    content.appendChild(h3);
    
    // fields
    fields.forEach(f => {
        const fieldDiv = document.createElement('div');
        fieldDiv.style.cssText = 'margin-bottom:15px;';
        
        const label = document.createElement('label');
        label.style.cssText = 'display:block;font-size:0.9rem;margin-bottom:5px;';
        label.textContent = f.label;
        fieldDiv.appendChild(label);
        
        const input = document.createElement('input');
        input.type = f.type || 'text';
        input.dataset.var = f.var;
        input.style.cssText = 'width:100%;padding:10px;border-radius:10px;border:1px solid var(--glass-border);';
        fieldDiv.appendChild(input);
        
        content.appendChild(fieldDiv);
    });
    
    // buttons
    const btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'modal-cancel';
    cancelBtn.style.cssText = 'background:#eee;color:#333;border:none;padding:10px;border-radius:10px;cursor:pointer;';
    cancelBtn.textContent = 'Cancelar';
    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'modal-confirm';
    confirmBtn.style.cssText = 'background:var(--accent-blue);color:white;border:none;padding:10px;border-radius:10px;cursor:pointer;';
    confirmBtn.textContent = 'Confirmar';
    
    btnDiv.appendChild(cancelBtn);
    btnDiv.appendChild(confirmBtn);
    content.appendChild(btnDiv);
    
    overlay.appendChild(content);
    fragment.appendChild(overlay);
    modal.appendChild(fragment);
    
    modal.style.display = 'block';
    
    // Events (use event delegation for dynamic fields)
    cancelBtn.onclick = () => modal.style.display = 'none';
    confirmBtn.onclick = () => {
        const vals = {};
        content.querySelectorAll('input').forEach(i => vals[i.dataset.var] = i.value);
        onConfirm(vals);
        modal.style.display = 'none';
    };
},

    showTimePickerModal: (onSelect) => {
        const modal = document.getElementById('template-modal');
        const times = [15, 25, 45, 60];
        
        // Build secure DOM (no innerHTML)
        modal.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(5px);';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = 'background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:24px;padding:30px;width:90%;max-width:350px;text-align:center;';
        
        const h3 = document.createElement('h3');
        h3.style.cssText = 'color:var(--accent-blue);margin-bottom:20px;';
        h3.textContent = '¿Cuánto tiempo quieres enfocarte? ⏱️';
        content.appendChild(h3);
        
        const gridDiv = document.createElement('div');
        gridDiv.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;';
        
        times.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'time-opt';
            btn.dataset.mins = t;
            btn.style.cssText = 'background:rgba(255,255,255,0.3); border:1px solid var(--glass-border); padding:15px; border-radius:15px; font-weight:bold; cursor:pointer;';
            btn.textContent = `${t} min`;
            gridDiv.appendChild(btn);
        });
        
        content.appendChild(gridDiv);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'modal-cancel';
        cancelBtn.style.cssText = 'background:none; color:var(--accent-red); border:none; cursor:pointer;';
        cancelBtn.textContent = 'Cancelar';
        content.appendChild(cancelBtn);
        
        overlay.appendChild(content);
        fragment.appendChild(overlay);
        modal.appendChild(fragment);
        
        modal.style.display = 'block';
        
        // Wire static events
        content.querySelectorAll('.time-opt').forEach(btn => {
            btn.onclick = () => {
                onSelect(parseInt(btn.dataset.mins));
                modal.style.display = 'none';
            };
        });
        cancelBtn.onclick = () => modal.style.display = 'none';
    },

    showFocusModal: (taskData, minutes, onExit) => {
        const overlay = document.getElementById('focus-overlay');
        
        if (window.currentFocusTimer) {
            clearInterval(window.currentFocusTimer);
            window.currentFocusTimer = null;
        }

        // Secure DOM build for pomodoro timer
        overlay.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        const panel = document.createElement('div');
        panel.className = 'focus-panel';
        
        const h2 = document.createElement('h2');
        h2.style.cssText = 'color:var(--accent-blue);';
        h2.textContent = taskData.text;
        panel.appendChild(h2);
        
        const pomodoroDiv = document.createElement('div');
        pomodoroDiv.className = 'pomodoro-container';
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'timer-svg';
        svg.setAttribute('viewBox', '0 0 150 150');
        
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.className = 'timer-circle-bg';
        bgCircle.setAttribute('cx', '75');
        bgCircle.setAttribute('cy', '75');
        bgCircle.setAttribute('r', '70');
        svg.appendChild(bgCircle);
        
        const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        progressCircle.className = 'timer-circle-progress';
        progressCircle.id = 'progress-bar';
        progressCircle.setAttribute('cx', '75');
        progressCircle.setAttribute('cy', '75');
        progressCircle.setAttribute('r', '70');
        progressCircle.style.stroke = '#a8e6cf';
        svg.appendChild(progressCircle);
        pomodoroDiv.appendChild(svg);
        
        const display = document.createElement('div');
        display.className = 'timer-display';
        display.id = 'timer-display';
        display.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:2rem; font-weight:bold;';
        display.textContent = `${minutes}:00`;
        pomodoroDiv.appendChild(display);
        
        panel.appendChild(pomodoroDiv);
        
        const btnDiv = document.createElement('div');
        btnDiv.style.cssText = 'display:flex; gap:10px; justify-content:center;';
        
        const playBtn = document.createElement('button');
        playBtn.id = 'play-pause';
        playBtn.style.cssText = 'background:#00b894; color:white; border:none; padding:12px 25px; border-radius:15px; cursor:pointer; font-weight:bold;';
        playBtn.textContent = '▶️ Iniciar';
        const exitBtn = document.createElement('button');
        exitBtn.id = 'exit-focus';
        exitBtn.style.cssText = 'background:var(--accent-red); color:white; border:none; padding:12px 25px; border-radius:15px; cursor:pointer; font-weight:bold;';
        exitBtn.textContent = '❌ Salir';
        
        btnDiv.appendChild(playBtn);
        btnDiv.appendChild(exitBtn);
        panel.appendChild(btnDiv);
        
        fragment.appendChild(panel);
        overlay.appendChild(fragment);
        
        overlay.style.display = 'flex';
        document.body.classList.add('focus-active');
        
        let timeLeft = minutes * 60;
        let totalSeconds = minutes * 60;
        const circ = 2 * Math.PI * 70;
        const progress = document.getElementById('progress-bar');
        const timerDisplay = document.getElementById('timer-display');
        progress.style.strokeDasharray = circ;
        progress.style.strokeDashoffset = 0;

        const update = () => {
            if (timeLeft <= 0) {
                clearInterval(window.currentFocusTimer);
                window.currentFocusTimer = null;
                window.utils.showToast('¡Tiempo cumplido! 🌟');
                timerDisplay.textContent = "0:00";
                return;
            }
            timeLeft--;
            const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
            timerDisplay.textContent = `${m}:${s.toString().padStart(2,'0')}`;
            progress.style.strokeDashoffset = circ - (timeLeft / totalSeconds) * circ;
            
            const percent = timeLeft / totalSeconds;
            if (percent < 0.2) progress.style.stroke = '#ffaaa5';
            else if (percent < 0.5) progress.style.stroke = '#ffd3a5';
        };

        playBtn.onclick = (e) => {
            if (window.currentFocusTimer) {
                clearInterval(window.currentFocusTimer);
                window.currentFocusTimer = null;
                e.target.textContent = '▶️ Continuar';
            } else {
                window.currentFocusTimer = setInterval(update, 1000);
                e.target.textContent = '⏸️ Pausar';
            }
        };

        exitBtn.onclick = () => {
            if (window.currentFocusTimer) {
                clearInterval(window.currentFocusTimer);
                window.currentFocusTimer = null;
            }
            onExit();
        };
    },

    hideFocusModal: () => {
        document.getElementById('focus-overlay').style.display = 'none';
        document.body.classList.remove('focus-active');
    },

    // FUNCIÓN AÑADIDA: Modal de edición de tareas compatible con Moodboard
    showTaskEditModal: (title, taskData, onSave) => {
        const modal = document.getElementById('template-modal');
        
        // Secure DOM build
        modal.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(10px);';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = 'background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:24px;padding:30px;width:90%;max-width:450px;';
        
        const h3 = document.createElement('h3');
        h3.style.cssText = 'color:var(--accent-blue);margin-bottom:20px;';
        h3.textContent = title;
        content.appendChild(h3);
        
        // Task name
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'margin-bottom:15px;';
        const nameLabel = document.createElement('label');
        nameLabel.style.cssText = 'display:block;font-size:0.9rem;margin-bottom:5px;';
        nameLabel.textContent = 'Nombre de la tarea';
        nameDiv.appendChild(nameLabel);
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'edit-task-name';
        nameInput.value = taskData.text;
        nameInput.style.cssText = 'width:100%;padding:12px;border-radius:10px;border:1px solid var(--glass-border);';
        nameDiv.appendChild(nameInput);
        content.appendChild(nameDiv);
        
        // Subtasks section
        const subtasksDiv = document.createElement('div');
        subtasksDiv.style.cssText = 'margin-bottom:15px;';
        const subtasksLabel = document.createElement('label');
        subtasksLabel.style.cssText = 'display:block;font-size:0.9rem;margin-bottom:10px;';
        subtasksLabel.textContent = 'Subtareas y Visuales';
        subtasksDiv.appendChild(subtasksLabel);
        const subtasksList = document.createElement('div');
        subtasksList.id = 'edit-subtasks-list';
        subtasksList.style.cssText = 'max-height:200px; overflow-y:auto; padding-right:5px;';
        
        // Dynamic subtasks
        taskData.subtasks.forEach(s => {
            const subRow = document.createElement('div');
            subRow.style.cssText = 'display:flex; gap:10px; margin-bottom:8px;';
            
            const subInput = document.createElement('input');
            subInput.type = 'text';
            subInput.value = s.text;
            subInput.style.cssText = 'flex-grow:1; padding:8px; border-radius:8px; border:1px solid var(--glass-border);';
            subRow.appendChild(subInput);
            
            const subDelete = document.createElement('button');
            subDelete.style.cssText = 'background:var(--accent-red); color:white; border:none; padding:5px 10px; border-radius:8px; cursor:pointer;';
            subDelete.textContent = '✕';
            subDelete.onclick = () => subRow.remove();
            subRow.appendChild(subDelete);
            
            subtasksList.appendChild(subRow);
        });
        
        subtasksDiv.appendChild(subtasksList);
        content.appendChild(subtasksDiv);
        
        // Buttons
        const btnDiv = document.createElement('div');
        btnDiv.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:20px;';
        
        const editCancel = document.createElement('button');
        editCancel.id = 'edit-cancel';
        editCancel.style.cssText = 'background:#eee;color:#333;border:none;padding:10px 15px;border-radius:10px;cursor:pointer;';
        editCancel.textContent = 'Cancelar';
        const editSave = document.createElement('button');
        editSave.id = 'edit-save';
        editSave.style.cssText = 'background:var(--accent-blue);color:white;border:none;padding:10px 15px;border-radius:10px;cursor:pointer;';
        editSave.textContent = 'Guardar';
        
        btnDiv.appendChild(editCancel);
        btnDiv.appendChild(editSave);
        content.appendChild(btnDiv);
        
        overlay.appendChild(content);
        fragment.appendChild(overlay);
        modal.appendChild(fragment);
        
        modal.style.display = 'block';
        
        editCancel.onclick = () => modal.style.display = 'none';
        editSave.onclick = () => {
            const newText = window.TaskService.validateTaskText(nameInput.value);
            if (!newText) {
                window.utils.showToast('Nombre de tarea requerido');
                return;
            }
            
            const newData = {
                text: newText,
                subtasks: Array.from(subtasksList.querySelectorAll('div')).map(div => ({
                    text: div.querySelector('input').value,
                    completed: false
                })).filter(s => s.text.trim())
            };
            onSave(newData);
            modal.style.display = 'none';
        };
    },

    initLucideIcons: () => { if (window.lucide) window.lucide.createIcons(); },
    ready: Promise.resolve()
};