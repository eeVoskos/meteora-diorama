// The info card for one place: its name, kind and height, a short description, and a button that moves the camera there.
import { say } from './controls.js';

const KIND = { // for places the POI list does not describe
  town: { en: 'Settlement', el: 'Οικισμός' }, monastery: { en: 'Monastery', el: 'Μοναστήρι' },
  landmark: { en: 'Point of interest', el: 'Αξιοθέατο' }, peak: { en: 'Rock', el: 'Βράχος' },
};

// go(place) moves the camera. open(place, lead, opener): place = { k, names: { en, el }, kind?, text?, height },
// lead = a node shown before the name, opener = the button that gets the focus back when the card closes.
export function createCard({ go }) {
  const el = document.createElement('aside');
  el.id = 'card';
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'card-name');
  el.innerHTML = '<header><span id="card-lead"></span><h2 id="card-name"></h2><button type="button" id="card-close">×</button></header>'
    + '<p id="card-kind"></p><p id="card-text"></p><button type="button" id="card-go"></button>';
  const q = (id) => el.querySelector(`#${id}`);
  say(q('card-close'), { en: 'Close', el: 'Κλείσιμο' }, 'aria-label');
  say(q('card-go'), { en: 'Go there', el: 'Μετάβαση' });
  let place = null, from = null;

  function close() {
    if (el.hidden) return;
    const hadFocus = el.contains(document.activeElement);
    el.hidden = true;
    from?.classList.remove('on');
    if (hadFocus) from?.focus();
    place = from = null;
  }
  function open(p, lead, opener) {
    from?.classList.remove('on');
    place = p; from = opener;
    q('card-lead').replaceChildren(lead);
    say(q('card-name'), p.names);
    const kind = p.kind ?? KIND[p.k] ?? KIND.landmark, h = Math.round(p.height);
    say(q('card-kind'), { en: `${kind.en} · ${h} m above sea level`, el: `${kind.el} · υψόμετρο ${h} μ.` });
    say(q('card-text'), p.text ?? { en: '', el: '' });
    q('card-text').hidden = !p.text;
    el.hidden = false;
    opener.classList.add('on');
    if (opener.matches(':focus-visible')) el.focus(); // keyboard users land on the card; a tap or click stays put
  }
  q('card-close').addEventListener('click', close);
  q('card-go').addEventListener('click', () => go(place));
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { el, open, close };
}
