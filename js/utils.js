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
        modal.innerHTML = `
            <div class="modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(5px);">
                <div class="modal-content" style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:24px;padding:30px;width:90%;max-width:400px;">
                    <h3 style="color:var(--accent-blue);margin-bottom:20px;">${title}</h3>
                    ${fields.map(f => `<div style="margin-bottom:15px;"><label style="display:block;font-size:0.9rem;margin-bottom:5px;">${f.label}</label><input type="text" data-var="${f.var}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--glass-border);"></div>`).join('')}
                    <div style="display:flex;gap:10px;justify-content:flex-end;">
                        <button id="modal-cancel" style="background:#eee;color:#333;border:none;padding:10px;border-radius:10px;cursor:pointer;">Cancelar</button>
                        <button id="modal-confirm" style="background:var(--accent-blue);color:white;border:none;padding:10px;border-radius:10px;cursor:pointer;">Confirmar</button>
                    </div>
                </div>
            </div>`;
        modal.style.display = 'block';
        modal.querySelector('#modal-cancel').onclick = () => modal.style.display = 'none';
        modal.querySelector('#modal-confirm').onclick = () => {
            const vals = {};
            modal.querySelectorAll('input').forEach(i => vals[i.dataset.var] = i.value);
            onConfirm(vals);
            modal.style.display = 'none';
        };
    },

    showTimePickerModal: (onSelect) => {
        const modal = document.getElementById('template-modal');
        const times = [15, 25, 45, 60];
        modal.innerHTML = `
            <div class="modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(5px);">
                <div class="modal-content" style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:24px;padding:30px;width:90%;max-width:350px;text-align:center;">
                    <h3 style="color:var(--accent-blue);margin-bottom:20px;">¿Cuánto tiempo quieres enfocarte? ⏱️</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;">
                        ${times.map(t => `<button class="time-opt" data-mins="${t}" style="background:rgba(255,255,255,0.3); border:1px solid var(--glass-border); padding:15px; border-radius:15px; font-weight:bold; cursor:pointer;">${t} min</button>`).join('')}
                    </div>
                    <button id="modal-cancel" style="background:none; color:var(--accent-red); border:none; cursor:pointer;">Cancelar</button>
                </div>
            </div>`;
        modal.style.display = 'block';
        modal.querySelectorAll('.time-opt').forEach(btn => {
            btn.onclick = () => {
                onSelect(parseInt(btn.dataset.mins));
                modal.style.display = 'none';
            };
        });
        modal.querySelector('#modal-cancel').onclick = () => modal.style.display = 'none';
    },

    showFocusModal: (taskData, minutes, onExit) => {
        const overlay = document.getElementById('focus-overlay');
        
        // Limpiamos cualquier rastro de temporizadores previos antes de iniciar uno nuevo
        if (window.currentFocusTimer) {
            clearInterval(window.currentFocusTimer);
            window.currentFocusTimer = null;
        }

        overlay.innerHTML = `
            <div class="focus-panel">
                <h2 style="color:var(--accent-blue);">${taskData.text}</h2>
                <div class="pomodoro-container">
                    <svg id="timer-svg" viewBox="0 0 150 150"><circle class="timer-circle-bg" cx="75" cy="75" r="70"></circle><circle class="timer-circle-progress" cx="75" cy="75" r="70" id="progress-bar" style="stroke:#a8e6cf;"></circle></svg>
                    <div class="timer-display" id="timer-display" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:2rem; font-weight:bold;">${minutes}:00</div>
                </div>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button id="play-pause" style="background:#00b894; color:white; border:none; padding:12px 25px; border-radius:15px; cursor:pointer; font-weight:bold;">▶️ Iniciar</button>
                    <button id="exit-focus" style="background:var(--accent-red); color:white; border:none; padding:12px 25px; border-radius:15px; cursor:pointer; font-weight:bold;">❌ Salir</button>
                </div>
            </div>`;
        
        overlay.style.display = 'flex';
        document.body.classList.add('focus-active');
        
        let timeLeft = minutes * 60;
        let totalSeconds = minutes * 60;
        const circ = 2 * Math.PI * 70;
        const progress = document.getElementById('progress-bar');
        const display = document.getElementById('timer-display');
        progress.style.strokeDasharray = circ;
        progress.style.strokeDashoffset = 0;

        const update = () => {
            if (timeLeft <= 0) {
                clearInterval(window.currentFocusTimer);
                window.currentFocusTimer = null;
                window.utils.showToast('¡Tiempo cumplido! 🌟');
                display.textContent = "0:00";
                return;
            }
            timeLeft--;
            const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
            display.textContent = `${m}:${s.toString().padStart(2,'0')}`;
            progress.style.strokeDashoffset = circ - (timeLeft / totalSeconds) * circ;
            
            const percent = timeLeft / totalSeconds;
            if (percent < 0.2) progress.style.stroke = '#ffaaa5';
            else if (percent < 0.5) progress.style.stroke = '#ffd3a5';
        };

        overlay.querySelector('#play-pause').onclick = (e) => {
            if (window.currentFocusTimer) {
                clearInterval(window.currentFocusTimer);
                window.currentFocusTimer = null;
                e.target.textContent = '▶️ Continuar';
            } else {
                window.currentFocusTimer = setInterval(update, 1000);
                e.target.textContent = '⏸️ Pausar';
            }
        };

        overlay.querySelector('#exit-focus').onclick = () => {
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

    initLucideIcons: () => { if (window.lucide) window.lucide.createIcons(); },
    ready: Promise.resolve()
};