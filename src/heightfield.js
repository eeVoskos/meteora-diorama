// Pure heights lookup over the decimetre grid (no three.js, so Node can test it).
export function makeHeightfield(header, uint16) {
  const { nx, ny, step, x0, y0, min, max } = header;
  const unit = header.unit ?? 0.1;
  const clamp = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
  const h = (i, j) => uint16[j * nx + i] * unit;

  // Bilinear in metres; points outside the grid take the nearest edge value.
  function at(x, y) {
    const fx = clamp((x - x0) / step, nx - 1);
    const fy = clamp((y - y0) / step, ny - 1);
    const i = Math.min(Math.floor(fx), nx - 2);
    const j = Math.min(Math.floor(fy), ny - 2);
    const tx = fx - i, ty = fy - j;
    const s = h(i, j) * (1 - tx) + h(i + 1, j) * tx;
    const n = h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx;
    return s * (1 - ty) + n * ty;
  }

  return { nx, ny, step, x0, y0, min, max, at };
}
