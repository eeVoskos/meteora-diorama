// Pieces of the bottom control bar: on/off chips and segmented choices, with captions that follow the label language.
let lang = 'en';
const said = []; // [node, { en, el }, attribute or undefined for the text]
const put = (node, text, attr) => (attr ? node.setAttribute(attr, text[lang]) : (node.textContent = text[lang]));

export function say(node, text, attr) { // saying something new on the same node replaces what it said before
  const old = said.find((s) => s[0] === node && s[2] === attr);
  if (old) old[1] = text; else said.push([node, text, attr]);
  put(node, text, attr);
  return node;
}
export function setCaptionLang(l) { lang = l; for (const s of said) put(...s); }

function button() {
  const b = document.createElement('button');
  b.type = 'button';
  return b;
}

// On/off chip (aria-pressed). `lead` is an optional node shown before the caption.
export function toggle(text, onChange, { id, lead, on = false } = {}) {
  const b = button();
  if (id) b.id = id;
  b.className = 'chip';
  b.setAttribute('aria-pressed', String(on));
  if (lead) b.append(lead);
  b.append(say(document.createElement('span'), text));
  b.addEventListener('click', () => {
    const now = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(now));
    onChange(now);
  });
  return b;
}

// Radio group of buttons: one tab stop, arrow keys move and choose, Space/Enter choose.
// options: [{ value, text: { en, el }, label?: { en, el } }]
export function segmented(name, options, value, onChange) {
  const g = document.createElement('div');
  g.className = 'seg';
  g.setAttribute('role', 'radiogroup');
  say(g, name, 'aria-label');
  const btns = options.map((o) => {
    const b = button();
    b.setAttribute('role', 'radio');
    b.dataset.value = o.value;
    say(b, o.text);
    if (o.label) say(b, o.label, 'aria-label');
    b.addEventListener('click', () => pick(o.value, true));
    return b;
  });
  function pick(v, fire) {
    for (const b of btns) {
      const on = b.dataset.value === v;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    const changed = v !== value;
    value = v;
    if (fire && changed) onChange(v);
  }
  g.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = btns.findIndex((b) => b.dataset.value === value);
    const next = btns[(i + d + btns.length) % btns.length];
    next.focus();
    pick(next.dataset.value, true);
  });
  g.append(...btns);
  pick(value, false);
  return { el: g, set: (v) => pick(v, false) };
}
