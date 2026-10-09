// icons.js — set de íconos SVG propio (trazo 1.75, 24×24).
// Reemplaza a Lucide por CDN: cero requests externos, sin necesidad de SRI
// y sin el paso extra de `createIcons()` después de cada render.
const SVG_NS = 'http://www.w3.org/2000/svg';

// Cada ícono es una lista de [tag, atributos].
const ICONS = {
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    check: [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
    trash: [['path', { d: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3' }]],
    pencil: [['path', { d: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4' }]],
    bookmark: [['path', { d: 'M7 4h10v16l-5-3.5L7 20z' }]],
    target: [
        ['circle', { cx: 12, cy: 12, r: 8 }],
        ['circle', { cx: 12, cy: 12, r: 3 }]
    ],
    image: [
        ['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }],
        ['circle', { cx: 8.5, cy: 9.5, r: 1.5 }],
        ['path', { d: 'M21 16l-5-5-9 9' }]
    ],
    sun: [
        ['circle', { cx: 12, cy: 12, r: 4 }],
        ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]
    ],
    moon: [['path', { d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' }]],
    spark: [['path', { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 1.6 1.6.7-1.6.7L19 21.6l-.7-1.6-1.6-.7 1.6-.7z' }]],
    play: [['path', { d: 'M8 5.5v13l10.5-6.5z' }]],
    pause: [['path', { d: 'M9 5v14M15 5v14' }]],
    reset: [['path', { d: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4' }]],
    cloud: [['path', { d: 'M7 18h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.3 9.2 4.5 4.5 0 0 0 7 18z' }]],
    logout: [['path', { d: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10' }]],
    grip: [['path', { d: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01' }]]
};

export function icon(name, { size = 18, className = '' } = {}) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', name === 'grip' ? '2.6' : '1.75');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', `icon ${className}`.trim());

    (ICONS[name] || []).forEach(([tag, attrs]) => {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
    });
    return svg;
}

// Fábrica de botones de ícono: siempre con aria-label (accesible) y tooltip.
export function iconButton(name, label, className = '', size = 18) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `icon-btn ${className}`.trim();
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.appendChild(icon(name, { size }));
    return btn;
}
