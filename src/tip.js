// One tooltip for the whole app, modelled on the Clueso redesign.
// Any element with data-tip="Label" (optionally "Label (⌘K)") gets it: on hover with a mouse and on keyboard focus,
// never on touch or on disabled controls. It lives in one fixed layer, so no panel or card can clip it.
// Placement follows the zone: right of the left rail, above anything in the bottom bar or a node footer, otherwise below.
// It flips when there is no room and stays 8px inside the window. A click, Escape, scroll or zoom hides it.

const GAP = 6;
const M = 8;

export function installTooltips() {
  if (typeof document === 'undefined' || document.querySelector('.tip-layer')) return;
  const tip = document.createElement('div');
  tip.className = 'tip-layer';
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  document.body.appendChild(tip);
  let owner = null;

  const target = (n) => (n && n.closest ? n.closest('[data-tip]') : null);

  const show = (el) => {
    const raw = el.getAttribute('data-tip');
    if (!raw || el.disabled) return hide();
    owner = el;
    // "Fit view (F)" → label + quiet shortcut
    const m = /^(.*?)\s*\(([^()]{1,12})\)$/.exec(raw);
    tip.textContent = '';
    const label = document.createElement('span');
    label.textContent = m ? m[1] : raw;
    tip.appendChild(label);
    if (m) {
      const k = document.createElement('kbd');
      k.textContent = m[2];
      tip.appendChild(k);
    }
    tip.hidden = false;
    place(el);
  };

  const place = (el) => {
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let side = el.closest('.rail') ? 'right'
      : el.closest('.bottomrow, .askbar, .node-f, .agent-composer, .rfoot') ? 'top'
      : 'bottom';
    if (side === 'right' && r.right + GAP + w > innerWidth - M) side = 'bottom';
    if (side === 'bottom' && r.bottom + GAP + h > innerHeight - M) side = 'top';
    if (side === 'top' && r.top - GAP - h < M) side = 'bottom';
    let x;
    let y;
    if (side === 'right') { x = r.right + GAP + 2; y = r.top + r.height / 2 - h / 2; }
    else { x = r.left + r.width / 2 - w / 2; y = side === 'top' ? r.top - GAP - h : r.bottom + GAP; }
    x = Math.min(Math.max(M, x), innerWidth - w - M);
    y = Math.min(Math.max(M, y), innerHeight - h - M);
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
  };

  const hide = () => { owner = null; tip.hidden = true; };

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = target(e.target);
    if (t && t !== owner) show(t);
    else if (!t && owner) hide();
  });
  document.addEventListener('pointerout', (e) => {
    if (!owner || (e.relatedTarget && owner.contains(e.relatedTarget))) return;
    const t = target(e.relatedTarget);
    if (t) show(t); else hide();
  });
  document.addEventListener('focusin', (e) => {
    const t = target(e.target);
    if (t && t.matches(':focus-visible')) show(t); else hide();
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('wheel', hide, { passive: true, capture: true });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); }, true);
  // the owner can disappear (menu closed, node deleted)
  setInterval(() => { if (owner && !document.contains(owner)) hide(); }, 400);
}
