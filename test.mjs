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

// --- Test 5: borrar lista + "Deshacer" la restaura en la misma posición ---
StateManager.addList('Segunda');
const firstId = StateManager.activeLists[0].id;
const removed = StateManager.deleteList(firstId);
assert(removed && removed.index === 0 && StateManager.getList(firstId) === null, 'deleteList devuelve la lista y su índice');
StateManager.insertList(removed.list, removed.index);
assert(StateManager.activeLists[0].id === firstId, 'insertList (deshacer) restaura la lista en su posición original');

// --- Test 6: métricas del hero ---
const t = StateManager.activeLists[0].tasks[0];
StateManager.setTaskStatus(firstId, t.id, 'Realizada');
const stats = StateManager.getStats();
assert(stats.lists === 2 && stats.done === 1 && stats.pending === 0 && stats.progress === 1, 'getStats cuenta listas, pendientes, hechas y progreso');

// --- Test 7: estado vacío cuando no hay listas ---
StateManager.replaceAll([]);
assert(container.querySelector('.empty-state') !== null, 'sin listas se muestra el estado vacío');

// --- Tests de sincronización (lógica pura de fusión) ---
const { mergeLists, sameLists } = await import('./js/syncMerge.js');
const L = (id, updatedAt, name = id, createdAt = 1) => ({ id, name, createdAt, updatedAt, tasks: [] });

// Gana el cambio más reciente, en ambos sentidos
let m = mergeLists([L('a', 200, 'local'), L('b', 100, 'viejo')], [L('a', 100, 'nube'), L('b', 300, 'nuevo')]);
assert(m.lists.find(l => l.id === 'a').name === 'local' && m.pushLists.some(l => l.id === 'a'), 'sync: el cambio local más reciente gana y se sube');
assert(m.lists.find(l => l.id === 'b').name === 'nuevo' && !m.pushLists.some(l => l.id === 'b'), 'sync: el cambio remoto más reciente gana y no se re-sube');

// Lista creada en otro dispositivo aparece; lista nueva local se sube
m = mergeLists([L('local-nueva', 50)], [L('de-otro-dispositivo', 40)]);
assert(m.lists.length === 2 && m.pushLists.map(l => l.id).join() === 'local-nueva', 'sync: se combinan listas nuevas de ambos lados');

// Borrado en otro dispositivo después del último cambio local → desaparece aquí
m = mergeLists([L('x', 100)], [{ id: 'x', deleted: true, updatedAt: 150 }]);
assert(m.lists.length === 0, 'sync: un borrado remoto más reciente elimina la lista local');

// Borrado hecho aquí sin conexión → no "resucita" y se sube el borrado
m = mergeLists([], [L('y', 100)], { y: 200 });
assert(m.lists.length === 0 && m.pushDeletes[0]?.id === 'y', 'sync: un borrado offline no resucita y se envía a la nube');

// Pero si en otro dispositivo se editó DESPUÉS del borrado, gana la edición
m = mergeLists([], [L('z', 300)], { z: 200 });
assert(m.lists.length === 1 && m.pushDeletes.length === 0, 'sync: una edición remota posterior al borrado prevalece');

// Deshacer tras borrar: el local (más nuevo) le gana a la marca de borrado
m = mergeLists([L('u', 500)], [{ id: 'u', deleted: true, updatedAt: 400 }]);
assert(m.lists.length === 1 && m.pushLists[0]?.id === 'u', 'sync: deshacer revive la lista aunque la nube la tenga borrada');

// El "eco" de nuestra propia escritura no cambia nada (no hay re-render)
const local = [L('e', 100)];
m = mergeLists(local, [{ ...L('e', 100), deleted: false }]);
assert(m.lists[0] === local[0] && sameLists(m.lists, local), 'sync: el eco de una escritura propia no altera el estado');
assert(sameLists([{ a: 1, b: 2 }], [{ b: 2, a: 1 }]), 'sync: la comparación ignora el orden de los campos');

console.log(failures === 0 ? '\n✅ Todos los tests pasaron' : `\n❌ ${failures} test(s) fallaron`);
process.exit(failures === 0 ? 0 : 1);
