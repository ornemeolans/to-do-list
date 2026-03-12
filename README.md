# Aesthetic To-Do List ✅

Una aplicación de gestión de tareas diseñada con una estética **Glassmorphism**, enfocada en la limpieza visual y una experiencia de usuario fluida. Este proyecto combina funcionalidades avanzadas de organización con un diseño moderno y minimalista.

## 📸 Vista Previa
La interfaz utiliza transparencias, desenfoques de fondo (backdrop-filter) y una paleta de colores pastel para lograr un look "aesthetic" tanto en modo claro como oscuro.

## ✨ Funcionalidades Principales
- **Gestión de Listas Dinámicas**: Crea, renombra (directamente en el título) y elimina múltiples listas de tareas.
- **Sistema de Tareas y Subtareas**: Organiza tus pendientes con un segundo nivel de detalle para un control total.
- **Sugerencias Personalizadas**: Guarda tus estructuras de listas favoritas como plantillas en la barra lateral para reutilizarlas con un solo clic.
- **Modo Oscuro**: Cambia entre temas visuales para proteger tu vista y adaptar la app a tu estilo.
- **Persistencia de Datos**: Gracias al uso de `localStorage`, tus tareas y preferencias se mantienen guardadas incluso después de cerrar el navegador.
- **Interfaz Reactiva**: Notificaciones visuales (Toasts) y renderizado dinámico de iconos mediante Lucide Icons.

## 🛠️ Tecnologías Utilizadas
- **HTML5**: Estructura semántica clara.
- **CSS3 (Glassmorphism)**: Uso de variables CSS, Flexbox, Grid y efectos de desenfoque avanzados.
- **JavaScript (Vanilla)**: Lógica pura para manipulación del DOM, manejo de estados y almacenamiento local.
- **Lucide Icons**: Iconografía vectorial nítida y escalable.

## 📂 Estructura del Proyecto
```text
├── index.html          # Estructura principal de la aplicación
├── css/
│   └── style.css       # Estilos detallados y variables de diseño
├── js/
│   ├── script.js       # Lógica principal de listas y tareas
│   └── utils.js        # Helpers para iconos y notificaciones
└── assets/             # Recursos adicionales (opcional)
