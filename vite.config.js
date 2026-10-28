import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// <img data-pic="name" alt="..."> becomes a responsive, lazy, size-reserved WebP image.
function pictures() {
  const manifest = JSON.parse(readFileSync(new URL('./public/media/manifest.json', import.meta.url)));
  const byName = Object.fromEntries(manifest.map((m) => [m.file, m]));
  return {
    name: 'pictures',
    transformIndexHtml(html) {
      return html.replace(/<img data-pic="([^"]+)"([^>]*)>/g, (_, name, rest) => {
        const m = byName[name];
        if (!m) throw new Error(`unknown picture: ${name}`);
        const sizes = /sizes=/.test(rest) ? '' : ' sizes="(max-width: 760px) 92vw, 50vw"';
        const eager = /loading=/.test(rest) ? '' : ' loading="lazy"';
        // files are named by size slot (-800, -1600); widths holds each file's true pixel width
        const set = m.widths.map((w, i) => `media/img/${name}-${[800, 1600][i]}.webp ${w}w`).join(', ');
        const w = 800, h = Math.round(800 / m.aspect);
        return `<img src="media/img/${name}-800.webp" srcset="${set}"${sizes} width="${w}" height="${h}" decoding="async"${eager}${rest}>`;
      });
    },
  };
}

// <i data-icon="bed"></i> becomes an inline Phosphor icon (MIT licence), so icons cost no requests
function icons() {
  return {
    name: 'icons',
    transformIndexHtml(html) {
      return html.replace(/<i data-icon="([a-z-]+)"><\/i>/g, (_, name) => {
        const svg = readFileSync(new URL(`./node_modules/@phosphor-icons/core/assets/regular/${name}.svg`, import.meta.url), 'utf8');
        return svg.replace('<svg ', '<svg class="ico" aria-hidden="true" focusable="false" ');
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [pictures(), icons()],
  server: { port: 5180 },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
