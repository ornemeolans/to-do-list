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
    }
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