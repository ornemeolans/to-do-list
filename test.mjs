import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><div id="lists-container"></div><div id="template-modal"></div><div id="focus-overlay"></div>', {
    url: 'http://localhost/'
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.Option = dom.window.Option; // constructor global del navegador, no de Node
// Node ya trae `crypto` global (webcrypto) con randomUUID; no hace falta pisarlo.

const { StateManager } = await import('./js/StateManager.js');
const { renderAll } = await import('./js/TaskService.js');

const container = document.getElementById('lists-container');
StateManager.onChange = (activeLists) => renderAll(activeLists, container);

let failures = 0;
function assert(cond, msg) {
    if (!cond) { console.error('FALLÓ:', msg); failures++; }
    else console.log('OK:', msg);
}

// --- Test 1: plantilla con tareas no debe crear una lista vacía (bug #2) ---
StateManager.addListWithTasks({
    name: 'Compras',
    tasks: [{ text: 'Verduleria', status: 'Pendiente', subtasks: [{ text: 'Cebolla', completed: false }] }]
});
let list = StateManager.activeLists[0];
assert(list.tasks.length === 1, 'la lista creada desde plantilla conserva sus tareas');
assert(list.tasks[0].subtasks.length === 1, 'la tarea de la plantilla conserva sus subtareas');

// --- Test 2: agregar subtarea y "recargar" (simulando F5) debe persistir (bug #1) ---
const taskId = list.tasks[0].id;
StateManager.addSubtask(list.id, taskId, { text: 'Papa', isVisual: false });
StateManager.save(); // guardado inmediato, sin esperar el debounce

// Simulamos un reload real: nueva instancia de StateManager cargando desde localStorage
const raw = localStorage.getItem('activeLists');
const reloaded = JSON.parse(raw);
const reloadedTask = reloaded[0].tasks.find(t => t.id === taskId);
assert(reloadedTask.subtasks.length === 2, 'la subtarea persiste realmente en localStorage tras "recargar"');

// --- Test 3: borrar una tarea no debe hacer que "reaparezca" en el próximo render (bug #3) ---
StateManager.deleteTask(list.id, taskId);
assert(StateManager.getTask(list.id, taskId) === null, 'la tarea borrada ya no está en el estado');
// Forzamos otro render (como pasaría al agregar una tarea nueva)
StateManager.addTask(list.id, { text: 'Otra tarea', status: 'Pendiente', subtasks: [] });
assert(StateManager.getTask(list.id, taskId) === null, 'la tarea borrada NO reaparece tras un nuevo render');

// --- Test 4: el DOM realmente refleja el estado tras cada mutación ---
const renderedTaskCount = container.querySelectorAll('.task-item').length;
assert(renderedTaskCount === 1, `el DOM muestra exactamente las tareas del estado (encontradas: ${renderedTaskCount})`);

console.log(failures === 0 ? '\n✅ Todos los tests pasaron' : `\n❌ ${failures} test(s) fallaron`);
process.exit(failures === 0 ? 0 : 1);
