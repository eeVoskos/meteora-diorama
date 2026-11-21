// HTML name labels and pins over the canvas, plus their controls: a Labels toggle with per-kind filter chips, and EN / ΕΛ.
// A pin opens the place's info card.
import * as THREE from 'three';
import { pickVisible } from './overlap.js';
import { say, setCaptionLang, toggle, segmented } from './controls.js';

const TITLE = { en: 'Kalampaka & Meteora', el: 'Καλαμπάκα & Μετέωρα' };
// monasteries > settlements > town landmarks > peaks
const PRI = { monastery: 0, town: 1, landmark: 2, peak: 3 };
const LIFT = { town: 14, peak: 6 }; // metres above terrain for non-landmark anchors
const EN_NAME = { 130250606: 'Kalampaka' }; // OSM name:en says "Kalambaka"; match the page title
// Filter chips, in bar order. The pin radius (px, matches the CSS sizes) sets how far the label sits from its anchor.
const KINDS = [
  { k: 'town', text: { en: 'Places', el: 'Οικισμοί' }, r: 8 },
  { k: 'monastery', text: { en: 'Monasteries', el: 'Μονές' }, r: 8 },
  { k: 'landmark', text: { en: 'POIs', el: 'Αξιοθέατα' }, r: 7 },
  { k: 'peak', text: { en: 'Rocks', el: 'Βράχοι' }, r: 6 },
];
const GLYPH = {
  town: 'M8 3.6l4.4 3.9v4.9H3.6V7.5z', // house
  monastery: 'M7 3.5h2V6h2.5v2H9v4.5H7V8H4.5V6H7z', // cross
  landmark: 'M8 4l4 4-4 4-4-4z', // diamond
  peak: 'M8 4.2l4.2 7.4H3.8z', // rock
};
export function glyph(k) {
  const s = document.createElement('span');
  s.className = `glyph ${k}`;
  s.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.2"/><path d="${GLYPH[k] ?? GLYPH.peak}"/></svg>`;
  return s;
}

// places: the map's named places joined with the points of interest (pois.js).
// landmarks: [{ id, en, el, top? }] where top = highest point of the built model (m a.s.l.).
// needles: [{ x, y, top }] from heights.json; a place within 20 m of one is labelled at its top.
// card: { open(place, lead, opener), close() } from card.js.
export function createLabels({ places, landmarks, needles = [], hf, camera, canvas, ui, card }) {
  const byId = new Map(landmarks.map((l) => [l.id, l]));
  const layer = document.createElement('div');
  layer.id = 'labels';
  layer.hidden = true;
  document.body.append(layer); // after the bar, so Tab reaches the controls before the pins
  const pins = document.createElement('div'), chips = document.createElement('div');
  layer.append(pins, chips); // chips draw over pins

  const kinds = Object.fromEntries(KINDS.map((c) => [c.k, true]));
  const gap = Object.fromEntries(KINDS.map((c) => [c.k, c.r + 2]));
  const items = [];
  let lang = 'en', visible = false;
  for (const p of places) {
    const lm = byId.get(p.id); // landmarks use the registry's names
    const names = lm ?? (EN_NAME[p.id] ? { ...p, en: EN_NAME[p.id] } : p);
    const needle = needles.find((n) => Math.hypot(n.x - p.x, n.y - p.y) <= 20);
    const ground = needle?.top ?? hf.at(p.x, p.y);
    const top = lm?.top ?? needle?.top ?? ground + (p.lift != null ? p.lift + 4 : LIFT[p.k] ?? 14);
    const el = document.createElement('div');
    el.className = `lbl ${p.k}`;
    el.setAttribute('aria-hidden', 'true'); // the pin carries the name for screen readers
    chips.append(el);
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'pin';
    pin.setAttribute('aria-haspopup', 'dialog');
    pin.append(glyph(p.k));
    pins.append(pin);
    const it = { k: p.k, names, el, pin, pri: PRI[p.k] ?? 3, pos: new THREE.Vector3(p.x, top + (lm ? 6 : 0), -p.y), w: 0, h: 0, shown: null, pinShown: null, hover: false, focus: false, tap: false };
    // A pin whose label lost the overlap contest shows its name while hovered, focused or tapped.
    const peek = (key, on) => { it[key] = on; update(); };
    pin.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') peek('hover', true); });
    pin.addEventListener('pointerleave', () => peek('hover', false));
    pin.addEventListener('focus', () => peek('focus', true));
    pin.addEventListener('blur', () => peek('focus', false));
    pin.addEventListener('click', () => {
      for (const o of items) o.tap = o === it;
      update();
      card.open({ ...p, names, height: ground }, glyph(p.k), pin);
    });
    items.push(it);
  }
  canvas.addEventListener('pointerdown', () => { for (const it of items) it.tap = false; update(); });

  const kindRow = document.createElement('div');
  kindRow.id = 'label-kinds';
  kindRow.hidden = true;
  say(kindRow, { en: 'Label kinds', el: 'Είδη ονομάτων' }, 'aria-label');
  kindRow.setAttribute('role', 'group');
  const kindChips = KINDS.map(({ k, text }) => {
    const c = toggle(text, (on) => { kinds[k] = on; update(); }, { lead: glyph(k), on: true });
    c.classList.add('kind');
    c.dataset.k = k;
    return c;
  });
  kindRow.append(...kindChips);
  const main = toggle({ en: 'Labels', el: 'Ονόματα' }, (on) => setVisible(on), { id: 'labels-toggle' });
  main.setAttribute('aria-controls', 'label-kinds');
  main.setAttribute('aria-expanded', 'false');
  const langSeg = segmented({ en: 'Language', el: 'Γλώσσα' }, [
    { value: 'en', text: { en: 'EN', el: 'EN' }, label: { en: 'English', el: 'English' } },
    { value: 'el', text: { en: 'ΕΛ', el: 'ΕΛ' }, label: { en: 'Ελληνικά', el: 'Ελληνικά' } },
  ], 'en', (l) => setLang(l));
  langSeg.el.id = 'lang-switch';
  ui.append(main, kindRow, langSeg.el);

  const v = new THREE.Vector3();
  function measure() { for (const it of items) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; } }
  const show = (node, key, it, s) => { if (s !== it[key]) { node.style.visibility = s ? 'visible' : 'hidden'; it[key] = s; } };

  function update() {
    if (!visible) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const rects = [], idx = [];
    items.forEach((it, i) => {
      v.copy(it.pos).project(camera());
      it.sx = Math.round((v.x + 1) / 2 * W); it.sy = Math.round((1 - v.y) / 2 * H);
      it.in = kinds[it.k] !== false && Math.abs(v.z) <= 1 && it.sx >= 0 && it.sx <= W && it.sy >= 0 && it.sy <= H;
      if (it.in) {
        const x0 = it.sx - it.w / 2, x1 = it.sx + it.w / 2, g = gap[it.k] ?? 8;
        rects.push({ x0, x1, y0: it.sy - it.h - g, y1: it.sy, pri: it.pri, alt: { x0, x1, y0: it.sy, y1: it.sy + it.h + g } });
        idx.push(i);
      }
    });
    const keep = pickVisible(rects);
    const at = new Map(idx.map((i, k) => [i, keep[k]]));
    for (const [i, it] of items.entries()) {
      const pos = at.get(i) ?? false;
      const peek = !pos && it.in && (it.hover || it.focus || it.tap);
      show(it.pin, 'pinShown', it, it.in);
      show(it.el, 'shown', it, !!pos || peek);
      it.el.classList.toggle('peek', peek);
      if (it.in) it.pin.style.transform = `translate(${it.sx}px, ${it.sy}px) translate(-50%, -50%)`;
      // first choice above the pin, second below it
      const g = gap[it.k] ?? 8;
      if (pos || peek) it.el.style.transform = `translate(${it.sx}px, ${it.sy}px) translate(-50%, ${pos === 'alt' ? `${g}px` : `calc(-100% - ${g}px)`})`;
    }
  }

  function setLang(l) {
    lang = l === 'el' ? 'el' : 'en';
    document.documentElement.lang = lang;
    document.title = TITLE[lang];
    setCaptionLang(lang);
    langSeg.set(lang);
    for (const it of items) { it.el.textContent = it.names[lang]; it.pin.setAttribute('aria-label', it.names[lang]); }
    if (visible) measure();
    update();
  }

  function setVisible(b) {
    visible = !!b;
    layer.hidden = kindRow.hidden = !visible;
    main.setAttribute('aria-pressed', String(visible));
    main.setAttribute('aria-expanded', String(visible));
    if (visible && KINDS.every((c) => !kinds[c.k])) { // nothing to show: start again with every kind on
      for (const c of kindChips) { kinds[c.dataset.k] = true; c.setAttribute('aria-pressed', 'true'); }
    }
    if (visible) { measure(); for (const it of items) it.shown = it.pinShown = null; } else card.close();
    update();
  }

  setLang('en');
  return { update, setLang, setVisible };
}
