# Lavanda — listas con calma

Gestor de tareas **offline-first** en JavaScript puro (sin frameworks ni build step): listas múltiples, tablero Pendientes/Realizadas con drag & drop, subtareas, moodboard visual, plantillas con variables, modo enfoque y **sincronización entre dispositivos**.

**Demo:** https://ornemeolans.github.io/to-do-list/

## Funcionalidades

- **Funciona sin conexión**: un service worker guarda la app en caché; carga y se puede usar sin internet. Es instalable como PWA.
- **Sincronización entre navegadores** (opcional, con Google): el avance se ve igual en la compu y en el celular. Los cambios hechos sin conexión se suben solos al volver la red.
- **Tablero kanban por lista** con barra de progreso; **drag & drop** entre columnas, con alternativa accesible por teclado.
- **Edición inline**: Enter confirma, Esc revierte, los textos vacíos se rechazan.
- **Subtareas** con autocompletado de la tarea al terminarlas todas.
- **Moodboard**: un `#hex`, una URL o una foto local, que se comprime en el navegador (una foto de 4 MB queda en ~150 KB).
- **Plantillas con variables** (`{cliente}`, `{fecha}`), también sincronizadas.
- **Modo enfoque**: temporizador basado en timestamps (no se atrasa en segundo plano).
- **Deshacer** al borrar, panel de métricas, tema claro/oscuro y atajo `/`.

## Arquitectura offline-first

```
 UI (TaskService / main)  ←── onChange(lists, source) ───┐
          │ acciones                                     │
          ▼                                              │
   StateManager  ── única fuente de verdad ──────────────┤
     │        │                                          │
     │        └─ subscribe ─► SyncService ── Firestore (caché IndexedDB + cola offline)
     ▼                              ▲
 localStorage (siempre)        syncMerge.js (fusión pura y testeada)
```

- **Lo local nunca espera a la red.** Cada cambio se aplica en memoria, se pinta y se guarda en `localStorage` (con flush al cerrar la pestaña). La nube es una réplica.
- **Firestore con caché persistente**: las escrituras sin conexión quedan en una cola en IndexedDB y sobreviven a cerrar el navegador.
- **Resolución de conflictos**: gana el cambio más reciente *por lista* (`updatedAt`). Los borrados viajan como **marcas de borrado**, así que una lista eliminada en un dispositivo no "resucita" desde otro que estuvo desconectado. La lógica vive en `syncMerge.js`, sin red ni DOM, y está cubierta por tests.
- **Cero costo si no se usa**: el SDK de Firebase se importa dinámicamente solo si hay configuración.
- **Privacidad**: reglas de Firestore que limitan cada usuario a `users/{uid}`. Al cerrar sesión se borra la copia local del navegador.

## Otras decisiones técnicas

- **Sin `innerHTML` con datos del usuario**: el DOM se construye con un helper `el()`, lo que descarta el XSS por diseño.
- **Componentes reutilizables**: un único `openDialog()` sobre `<dialog>` nativo para todos los modales; `iconButton()` garantiza `aria-label`.
- **Accesibilidad**: HTML semántico, skip link, `aria-live` para toasts, métricas y estado de sincronización, foco visible y `prefers-reduced-motion`.
- **Design tokens** en custom properties; el tema oscuro solo redefine tokens.

## Desarrollo

```bash
npm install
npm start            # http://localhost:4280
npm test             # tests unitarios: estado + fusión de sincronización (jsdom)
npm run test:e2e     # Playwright: escritorio + móvil, incluye prueba sin conexión
```

## Activar la sincronización (Firebase, plan gratuito)

1. Crear un proyecto en [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Método de acceso → habilitar **Google**. En *Configuración → Dominios autorizados*, agregar `ornemeolans.github.io`.
3. **Firestore Database** → Crear base de datos (modo producción) → pestaña **Reglas** → pegar el contenido de [`firestore.rules`](firestore.rules) → Publicar.
4. **Configuración del proyecto** → Tus apps → **Web** → copiar el objeto de configuración en [`js/firebase-config.js`](js/firebase-config.js).

Sin este paso la app funciona igual, solo que en local.

## Deploy

Cada push a `main` ejecuta [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): corre los tests unitarios y e2e y, si pasan, publica en GitHub Pages. Solo hay que activarlo una vez en *Settings → Pages → Source: GitHub Actions*.

## Estructura

```
index.html              marcado semántico: hero, plantillas, listas, diálogos
sw.js                   service worker (offline)
manifest.webmanifest    PWA instalable
firestore.rules         reglas de seguridad de la base de datos
css/style.css           sistema de diseño (tokens → componentes → motion → responsive)
js/
  main.js               punto de entrada: hero, métricas, plantillas, tema, cuenta, SW
  StateManager.js       única fuente de verdad del estado
  StorageService.js     localStorage (debounced + flush) y marcas de borrado
  SyncService.js        Firebase Auth + Firestore offline-first
  syncMerge.js          fusión pura entre dispositivos (testeada)
  firebase-config.js    configuración del proyecto de Firebase
  TaskService.js        render de listas, tareas, subtareas y moodboard
  utils.js              helper el(), toasts, diálogos y modo enfoque
  icons.js · debounce.js
icons/                  ícono SVG + PNG para PWA
scripts/serve.mjs       servidor estático sin dependencias
test.mjs                tests unitarios (jsdom)
tests/e2e/              tests end-to-end (Playwright)
```
