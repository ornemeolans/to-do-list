window.utils = {
    showToast: (msg) => {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: #6c5ce7; color: white; padding: 12px 25px; 
            border-radius: 20px; z-index: 10000; font-weight: 500;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1); animation: slideUp 0.3s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2500);
    },
    initLucideIcons: () => {
        if (window.lucide) window.lucide.createIcons();
    },
    showModal: (title, fields, onConfirm) => {
        const modal = document.getElementById('template-modal');
        if (!modal) return;
        modal.innerHTML = `
            <div class="modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001;">
                <div class="modal-content" style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:24px;padding:30px;max-width:450px;width:90%;max-height:80vh;overflow:auto;">
                    <h3 style="margin:0 0 20px 0;color:var(--accent-blue);">${title}</h3>
                    ${fields.map(f => {
                        const inputType = f.var.toLowerCase().includes('fecha') || f.var.toLowerCase().includes('date') ? 'date' : 'text';
                        const placeholder = inputType === 'date' ? '' : (f.placeholder || '');
                        return `<div style="margin-bottom:15px;"><label style="display:block;margin-bottom:5px;font-weight:500;">${f.label}</label><input type="${inputType}" data-var="${f.var}" style="width:100%;padding:12px;border:1px solid var(--glass-border);border-radius:12px;background:rgba(255,255,255,0.5);" placeholder="${placeholder}"></div>`;
                    }).join('')}
                    <div style="display:flex;gap:12px;justify-content:flex-end;">
                        <button id="modal-cancel" style="background:#ddd;color:var(--text-main);padding:10px 20px;border-radius:12px;border:none;cursor:pointer;">Cancelar</button>
                        <button id="modal-confirm" style="background:var(--accent-blue);color:white;padding:10px 20px;border-radius:12px;border:none;cursor:pointer;font-weight:500;">Crear Lista</button>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'block';
        modal.querySelector('#modal-cancel').onclick = () => window.utils.hideModal();
        modal.querySelector('#modal-confirm').onclick = () => {
            const values = {};
            modal.querySelectorAll('input[data-var]').forEach(inp => {
                values[inp.dataset.var] = inp.value.trim();
            });
            if (Object.values(values).every(v => v)) {
                onConfirm(values);
                window.utils.hideModal();
            } else {
                window.utils.showToast('Por favor completa todos los campos');
            }
        };
    },
    hideModal: () => {
        const modal = document.getElementById('template-modal');
        if (modal) modal.style.display = 'none';
    },
    ready: Promise.resolve()
};

// Añadir animación de toast al documento
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translate(-50%, 50px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
`;
document.head.appendChild(style);
