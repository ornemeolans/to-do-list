// utils.js: toasts, modales y el timer de foco (pomodoro). No maneja estado
// de la app -solo UI efímera-, por eso no depende de StateManager.

let focusTimerHandle = null;

export function showToast(msg, type = 'info') {
    document.querySelectorAll('.toast-container').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

export function showModal(title, fields, onConfirm) {
    const modal = document.getElementById('template-modal');
    modal.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const h3 = document.createElement('h3');
    h3.className = 'modal-title';
    h3.textContent = title;
    content.appendChild(h3);

    fields.forEach(f => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'modal-field';

        const label = document.createElement('label');
        label.textContent = f.label;
        fieldDiv.appendChild(label);

        const input = document.createElement('input');
        input.type = f.type || 'text';
        input.dataset.var = f.var;
        fieldDiv.appendChild(input);

        content.appendChild(fieldDiv);
    });

    const btnDiv = document.createElement('div');
    btnDiv.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn modal-btn-cancel';
    cancelBtn.textContent = 'Cancelar';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn modal-btn-confirm';
    confirmBtn.textContent = 'Confirmar';

    btnDiv.appendChild(cancelBtn);
    btnDiv.appendChild(confirmBtn);
    content.appendChild(btnDiv);

    overlay.appendChild(content);
    fragment.appendChild(overlay);
    modal.appendChild(fragment);
    modal.style.display = 'block';

    cancelBtn.onclick = () => modal.style.display = 'none';
    confirmBtn.onclick = () => {
        const vals = {};
        content.querySelectorAll('input').forEach(i => vals[i.dataset.var] = i.value);
        onConfirm(vals);
        modal.style.display = 'none';
    };
}

export function showTimePickerModal(onSelect) {
    const modal = document.getElementById('template-modal');
    const times = [15, 25, 45, 60];

    modal.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content modal-content-center';

    const h3 = document.createElement('h3');
    h3.className = 'modal-title';
    h3.textContent = '¿Cuánto tiempo quieres enfocarte? ⏱️';
    content.appendChild(h3);

    const gridDiv = document.createElement('div');
    gridDiv.className = 'time-picker-grid';

    times.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'time-opt';
        btn.dataset.mins = t;
        btn.textContent = `${t} min`;
        gridDiv.appendChild(btn);
    });

    content.appendChild(gridDiv);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn modal-btn-text-cancel';
    cancelBtn.textContent = 'Cancelar';
    content.appendChild(cancelBtn);

    overlay.appendChild(content);
    fragment.appendChild(overlay);
    modal.appendChild(fragment);
    modal.style.display = 'block';

    content.querySelectorAll('.time-opt').forEach(btn => {
        btn.onclick = () => {
            onSelect(parseInt(btn.dataset.mins, 10));
            modal.style.display = 'none';
        };
    });
    cancelBtn.onclick = () => modal.style.display = 'none';
}

export function showFocusModal(taskData, minutes, onExit) {
    const overlay = document.getElementById('focus-overlay');

    if (focusTimerHandle) {
        clearInterval(focusTimerHandle);
        focusTimerHandle = null;
    }

    overlay.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const panel = document.createElement('div');
    panel.className = 'focus-panel';

    const h2 = document.createElement('h2');
    h2.className = 'focus-title';
    h2.textContent = taskData.text;
    panel.appendChild(h2);

    const pomodoroDiv = document.createElement('div');
    pomodoroDiv.className = 'pomodoro-container';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'timer-svg';
    svg.setAttribute('viewBox', '0 0 150 150');

    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('class', 'timer-circle-bg');
    bgCircle.setAttribute('cx', '75');
    bgCircle.setAttribute('cy', '75');
    bgCircle.setAttribute('r', '70');
    svg.appendChild(bgCircle);

    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('class', 'timer-circle-progress');
    progressCircle.id = 'progress-bar';
    progressCircle.setAttribute('cx', '75');
    progressCircle.setAttribute('cy', '75');
    progressCircle.setAttribute('r', '70');
    svg.appendChild(progressCircle);
    pomodoroDiv.appendChild(svg);

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.id = 'timer-display';
    display.textContent = `${minutes}:00`;
    pomodoroDiv.appendChild(display);

    panel.appendChild(pomodoroDiv);

    const btnDiv = document.createElement('div');
    btnDiv.className = 'focus-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'focus-btn-play';
    playBtn.textContent = '▶️ Iniciar';
    const exitBtn = document.createElement('button');
    exitBtn.className = 'focus-btn-exit';
    exitBtn.textContent = '❌ Salir';

    btnDiv.appendChild(playBtn);
    btnDiv.appendChild(exitBtn);
    panel.appendChild(btnDiv);

    fragment.appendChild(panel);
    overlay.appendChild(fragment);

    overlay.style.display = 'flex';
    document.body.classList.add('focus-active');

    let timeLeft = minutes * 60;
    const totalSeconds = minutes * 60;
    const circ = 2 * Math.PI * 70;
    const progress = document.getElementById('progress-bar');
    const timerDisplay = document.getElementById('timer-display');
    progress.style.strokeDasharray = circ;
    progress.style.strokeDashoffset = 0;

    const update = () => {
        if (timeLeft <= 0) {
            clearInterval(focusTimerHandle);
            focusTimerHandle = null;
            showToast('¡Tiempo cumplido! 🌟');
            timerDisplay.textContent = '0:00';
            return;
        }
        timeLeft--;
        const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
        timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        progress.style.strokeDashoffset = circ - (timeLeft / totalSeconds) * circ;

        const percent = timeLeft / totalSeconds;
        if (percent < 0.2) progress.style.stroke = '#ffaaa5';
        else if (percent < 0.5) progress.style.stroke = '#ffd3a5';
    };

    playBtn.onclick = (e) => {
        if (focusTimerHandle) {
            clearInterval(focusTimerHandle);
            focusTimerHandle = null;
            e.target.textContent = '▶️ Continuar';
        } else {
            focusTimerHandle = setInterval(update, 1000);
            e.target.textContent = '⏸️ Pausar';
        }
    };

    exitBtn.onclick = () => {
        if (focusTimerHandle) {
            clearInterval(focusTimerHandle);
            focusTimerHandle = null;
        }
        onExit();
    };
}

export function hideFocusModal() {
    if (focusTimerHandle) {
        clearInterval(focusTimerHandle);
        focusTimerHandle = null;
    }
    document.getElementById('focus-overlay').style.display = 'none';
    document.body.classList.remove('focus-active');
}

// Modal de edición de tarea (texto + subtareas). `validateTaskText` se pasa
// como parámetro para no depender de TaskService (evita import circular).
export function showTaskEditModal(title, taskData, onSave, validateTaskText) {
    const modal = document.getElementById('template-modal');
    modal.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content modal-content-wide';

    const h3 = document.createElement('h3');
    h3.className = 'modal-title';
    h3.textContent = title;
    content.appendChild(h3);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'modal-field';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nombre de la tarea';
    nameDiv.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'edit-task-name';
    nameInput.value = taskData.text;
    nameDiv.appendChild(nameInput);
    content.appendChild(nameDiv);

    const subtasksDiv = document.createElement('div');
    subtasksDiv.className = 'modal-field';
    const subtasksLabel = document.createElement('label');
    subtasksLabel.textContent = 'Subtareas y Visuales';
    subtasksDiv.appendChild(subtasksLabel);
    const subtasksList = document.createElement('div');
    subtasksList.id = 'edit-subtasks-list';
    subtasksList.className = 'edit-subtasks-list';

    taskData.subtasks.forEach(s => {
        const subRow = document.createElement('div');
        subRow.className = 'edit-subtask-row';

        const subInput = document.createElement('input');
        subInput.type = 'text';
        subInput.value = s.text;
        subRow.appendChild(subInput);

        const subDelete = document.createElement('button');
        subDelete.className = 'edit-subtask-delete';
        subDelete.textContent = '✕';
        subDelete.onclick = () => subRow.remove();
        subRow.appendChild(subDelete);

        subtasksList.appendChild(subRow);
    });

    subtasksDiv.appendChild(subtasksList);
    content.appendChild(subtasksDiv);

    const btnDiv = document.createElement('div');
    btnDiv.className = 'modal-actions';

    const editCancel = document.createElement('button');
    editCancel.className = 'modal-btn modal-btn-cancel';
    editCancel.textContent = 'Cancelar';
    const editSave = document.createElement('button');
    editSave.className = 'modal-btn modal-btn-confirm';
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
        const newText = validateTaskText(nameInput.value);
        if (!newText) {
            showToast('Nombre de tarea requerido');
            return;
        }

        const newData = {
            text: newText,
            subtasks: Array.from(subtasksList.querySelectorAll('.edit-subtask-row')).map(row => ({
                text: row.querySelector('input').value,
                completed: false
            })).filter(s => s.text.trim())
        };
        onSave(newData);
        modal.style.display = 'none';
    };
}

export function initLucideIcons() {
    if (window.lucide) window.lucide.createIcons();
}
