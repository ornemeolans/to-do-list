# ✨ Lista de Tareas Aesthetic

To-do list vanilla JS (sin frameworks) con listas múltiples, subtareas, moodboard de imágenes/colores, drag & drop entre columnas, plantillas reutilizables y modo enfoque (pomodoro).

## Demo

> _Agregá acá el link una vez que lo despliegues en GitHub Pages / Netlify / Vercel (los tres sirven gratis para un sitio 100% estático como este)._

## Stack y decisiones técnicas

- **Vanilla JS con ES Modules** (`import`/`export`) — sin build step, sin dependencias de runtime.
- **Estado centralizado**: toda la app se renderiza a partir de un único árbol de datos en memoria (`StateManager`), que es también lo único que se persiste a `localStorage`. Cualquier cambio (agregar/editar/borrar lista, tarea o subtarea) pasa por `StateManager` y dispara un re-render — un patrón simplificado de "estado como fuente de verdad", similar en espíritu a Redux/Zustand pero sin librería.
- **DOM construido con `createElement`, nunca `innerHTML` con datos del usuario** — evita XSS por diseño.
- **Drag & drop nativo** (HTML5 Drag and Drop API) para mover tareas entre columnas "Pendiente" / "Realizada".
- **Sin dependencias de build**: abrir `index.html` con un servidor estático (Live Server, `npx serve`, etc.) alcanza. Los `<script type="module">` requieren servirse por HTTP, no funcionan con `file://`.

## Cómo correrlo localmente

```bash
npx serve .
# o
python3 -m http.server 8000
```

Abrir `http://localhost:PORT` en el navegador.

## Tests

Hay un test de integración (`test.mjs`) que simula el DOM con `jsdom` y valida el flujo de estado de punta a punta (crear lista desde plantilla, agregar subtarea, "recargar" y verificar que persiste, borrar tarea y verificar que no reaparece).

```bash
npm install
npm test
```

## Seguridad

- El ícono `lucide` se carga desde `unpkg` con versión fijada (no `@latest`). Falta agregar [Subresource Integrity](https://developer.mozilla.org/es/docs/Web/Security/Subresource_Integrity) (`integrity="sha384-..."`) — se puede generar con:
  ```bash
  curl -s https://unpkg.com/lucide@1.30.0/dist/umd/lucide.min.js | openssl dgst -sha384 -binary | openssl base64 -A
  ```

## Estructura

```
index.html
css/style.css
js/
  main.js            # punto de entrada, arma la UI y conecta todo
  StateManager.js     # única fuente de verdad del estado + persistencia
  StorageService.js   # acceso a localStorage
  TaskService.js       # render de listas/tareas/subtareas + eventos
  utils.js             # toasts, modales, timer de foco
  debounce.js          # utilidad genérica de debounce
test.mjs               # test de integración (jsdom)
```

