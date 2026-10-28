// Dev only: ?drive keeps frames flowing in a hidden preview tab, where browsers pause rAF.
if (import.meta.env.DEV && location.search.includes('drive')) {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  Object.defineProperty(document, 'hidden', { get: () => false });
}

// Dev only: ?motion pretends the visitor has not asked for reduced motion (the preview pane has).
if (import.meta.env.DEV && location.search.includes('motion')) {
  const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q.includes('prefers-reduced-motion') ? { ...mm(q), matches: false, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));
}
