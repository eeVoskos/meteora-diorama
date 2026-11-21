// Pure: greedy label overlap hiding (no three.js, so Node can test it).
// items: [{ x0, y0, x1, y1, pri, alt? }] in pixels; lower pri wins; alt = optional second rect { x0, y0, x1, y1 }.
// Returns per item: true = keep in its first rect, 'alt' = keep in its second rect, false = hide.
// Equal priorities: the anchor higher on screen (smaller y1) goes first, so a lower neighbour can drop below
// its own anchor out of the way; then the earlier item. An item that overlaps (with `pad` px of air) a kept item moves to its alt rect
// if that one is clear, else it is dropped.
export function pickVisible(items, pad = 3) {
  const keep = items.map(() => false);
  const kept = [];
  const clear = (r) => !kept.some((k) => r.x0 < k.x1 + pad && r.x1 > k.x0 - pad && r.y0 < k.y1 + pad && r.y1 > k.y0 - pad);
  const order = items.map((_, i) => i).sort((a, b) => items[a].pri - items[b].pri || items[a].y1 - items[b].y1 || a - b);
  for (const i of order) {
    const r = items[i];
    if (clear(r)) { keep[i] = true; kept.push(r); } else if (r.alt && clear(r.alt)) { keep[i] = 'alt'; kept.push(r.alt); }
  }
  return keep;
}
