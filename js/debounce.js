// Debounce con `flush()`: permite forzar la ejecución pendiente (p. ej. al
// cerrar la pestaña, para no perder el último cambio).
export function debounce(func, delay) {
    let timeoutId;
    let pendingArgs = null;

    const debounced = (...args) => {
        pendingArgs = args;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(debounced.flush, delay);
    };

    debounced.flush = () => {
        clearTimeout(timeoutId);
        if (!pendingArgs) return;
        const args = pendingArgs;
        pendingArgs = null;
        func.apply(null, args);
    };

    return debounced;
}
