// StorageService: única capa de acceso a localStorage.
// No hace merge de estado ni sabe nada de DOM: recibe datos, los guarda; los pide, los devuelve.
import { debounce } from './debounce.js';

// NOTA DE DISEÑO: la versión anterior tenía una integración a medio construir
// con IndexedDB para imágenes "grandes" (>1MB) que nunca llegó a conectarse
// con el render (se guardaban pero nunca se volvían a leer). En vez de dejar
// código muerto, se simplifica todo a localStorage con un límite claro y un
// aviso al usuario cuando una imagen no entra. Si más adelante el moodboard
// necesita soportar imágenes pesadas, ahí sí vale la pena reintroducir IndexedDB
// -pero completo, con la lectura incluida-.
export const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB

export const predefinedListsInit = [
    { name: "🏠 Tareas Hogar", tasks: [{ text: "Lavar ropa", status: "Pendiente", subtasks: [] }] },
    { name: "🛒 Compras para el Hogar", tasks: [
        { text: "Verduleria", status: "Pendiente", subtasks: [{ text: "Cebolla", completed: false }] },
        { text: "Carneceria", status: "Pendiente", subtasks: [{ text: "Bife", completed: false }] }
    ]},
    {
        name: "📸 Sesión Fotográfica - {cliente}",
        tasks: [
            { text: "Enviar presupuesto a {cliente}", status: "Pendiente", subtasks: [] },
            { text: "Confirmar ubicación con {cliente}", status: "Pendiente", subtasks: [] },
            { text: "Limpiar lentes para el {fecha}", status: "Pendiente", subtasks: [] },
            { text: "Preparar equipo de iluminación antes del {fecha}", status: "Pendiente", subtasks: [] }
        ]
    }
];

function isBigImage(base64) {
    const base64data = base64.split(',')[1] || '';
    const padding = base64data.endsWith('==') ? 2 : (base64data.endsWith('=') ? 1 : 0);
    const bytes = (base64data.length / 4) * 3 - padding;
    return bytes > MAX_IMAGE_SIZE;
}

function writeActiveLists(activeLists) {
    try {
        localStorage.setItem('activeLists', JSON.stringify(activeLists));
        return true;
    } catch (e) {
        // Motivo típico: QuotaExceededError si se acumulan muchas imágenes base64.
        console.error('No se pudo guardar en localStorage:', e);
        return false;
    }
}

// Guardado con debounce: si el usuario dispara varios cambios de estado seguidos
// (tildar varias subtareas rápido, escribir varias tareas), no escribimos a disco
// en cada una — esperamos a que se calme un poco. El estado en memoria siempre
// queda actualizado al instante; esto solo afecta cuándo se persiste a localStorage.
const debouncedWrite = debounce(writeActiveLists, 250);

export const StorageService = {
    MAX_IMAGE_SIZE,

    isBigImage,

    // Guardado inmediato (para cuando necesitamos la certeza de que ya escribió,
    // ej. antes de cerrar un modal o salir de un flujo importante).
    saveActiveListsNow(activeLists) {
        return writeActiveLists(activeLists);
    },

    // Guardado normal: debounced, usado por la mayoría de las mutaciones de estado.
    saveActiveLists(activeLists) {
        debouncedWrite(activeLists);
    },

    loadActiveLists() {
        try {
            return JSON.parse(localStorage.getItem('activeLists')) || [];
        } catch (e) {
            console.error('activeLists corrupto en localStorage, se reinicia:', e);
            return [];
        }
    },

    saveSuggestions(predefinedLists) {
        localStorage.setItem('suggestions', JSON.stringify(predefinedLists));
    },

    loadSuggestions() {
        try {
            const saved = localStorage.getItem('suggestions');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('suggestions corrupto en localStorage, se reinicia:', e);
        }
        this.saveSuggestions(predefinedListsInit);
        return predefinedListsInit.slice();
    },

    deleteSuggestion(index) {
        const predefinedLists = this.loadSuggestions();
        predefinedLists.splice(index, 1);
        this.saveSuggestions(predefinedLists);
        return predefinedLists;
    },

    saveListAsSuggestion(listData) {
        const predefinedLists = this.loadSuggestions();
        const existingIndex = predefinedLists.findIndex(l => l.name === listData.name);
        if (existingIndex > -1) {
            predefinedLists[existingIndex] = listData;
        } else {
            predefinedLists.push(listData);
        }
        this.saveSuggestions(predefinedLists);
    }
};
