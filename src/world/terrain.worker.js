import { heightAt } from './terrain.js';

// Heights for a terrain grid, computed off the main thread so the intro never stutters.
self.onmessage = ({ data: { id, x0, x1, z0, z1, sx, sz, edge } }) => {
  const out = new Float32Array((sx + 1) * (sz + 1));
  let i = 0;
  for (let iz = 0; iz <= sz; iz++) {
    const z = z0 + ((z1 - z0) * iz) / sz;
    for (let ix = 0; ix <= sx; ix++, i++) {
      const x = x0 + ((x1 - x0) * ix) / sx;
      let y = heightAt(x, z);
      if (edge) {
        // sink the far edges of the grid into the sea so no cut-off wall shows on the horizon
        const k = Math.max(0, Math.min(x - x0, x1 - x, z - z0, z1 - z) / edge);
        if (k < 1) y = y * k - (1 - k) * 60;
      }
      out[i] = y;
    }
  }
  self.postMessage({ id, heights: out }, [out.buffer]);
};
