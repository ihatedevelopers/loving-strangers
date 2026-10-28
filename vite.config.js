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
        // small originals were saved under the -800 name at their true width
        const set = m.lowRes
          ? `media/img/${name}-800.webp ${m.widths[0]}w`
          : m.widths.map((w) => `media/img/${name}-${w}.webp ${w}w`).join(', ');
        const w = 800, h = Math.round(800 / m.aspect);
        return `<img src="media/img/${name}-800.webp" srcset="${set}"${sizes} width="${w}" height="${h}" decoding="async"${eager}${rest}>`;
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [pictures()],
  server: { port: 5180 },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
