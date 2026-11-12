import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { DockCtx } from './ctx.js';
import { Search, ChevronDown, ChevronRight, Sparkles, Star, X, Coins, Check, ArrowLeftRight, LayoutTemplate, Palette as PaletteIcon, CornerDownLeft, Play, Inbox, Clock, Ellipsis, LayoutPanelTop, Archive } from './ri.js';
import { KINDS, KIND_ORDER, MODELS, MODEL_GROUPS, TEMPLATES, costOf, secsOf, fmtSecs, fmtCr, findModel, SHORTCUTS } from './data.js';
import { ASSETS, waveBars } from './art.js';
import { Ico, KindTile } from './icons.jsx';
import { BrandPicker } from './create.jsx';

/* ---------------- Left panel ---------------- */
export function LeftPanel({ tab, setTab, actions, selectedNode }) {
  const [q, setQ] = useState('');
  const selOut = selectedNode ? KINDS[selectedNode.data.kind].output : null;
  const selHasImage = selectedNode && selOut === 'image' && (selectedNode.data.kind === 'upload' || (selectedNode.data.takes || []).length > 0);
  const match = (k) => !q || (KINDS[k].label + KINDS[k].desc).toLowerCase().includes(q.toLowerCase());
  const drag = (e, payload) => { e.dataTransfer.setData('application/lp', JSON.stringify(payload)); e.dataTransfer.effectAllowed = 'move'; };
  const groups = [['Generate', 'AI generators'], ['Inputs', 'Inputs'], ['Edit', 'Edit a result']];

  return (
    <aside className="panel left">
      <Tabs value={tab} onChange={setTab} items={[['create', 'Create'], ['templates', 'Templates'], ['library', 'Library']]} />

      {tab === 'create' && (
        <div className="pbody">
          <label className="search">
            <Ico as={Search} size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search nodes" aria-label="Search nodes" />
            <kbd>/</kbd>
          </label>
          {selectedNode && <p className="note-inline">New nodes connect after <b>{selectedNode.data.title}</b> when the types match.</p>}
          {groups.map(([g, title]) => {
            const ks = KIND_ORDER.filter((k) => KINDS[k].group === g && match(k));
            if (!ks.length) return null;
            return (
              <section className="grp" key={g}>
                <h3 className="label">
                  {title}
                  {g === 'Edit' && !selHasImage && <span className="label-aside">Select an image first</span>}
                </h3>
                {ks.map((k) => {
                  const off = KINDS[k].needsImage && !selHasImage;
                  return (
                    <button key={k} className={`item ${off ? 'off' : ''}`} draggable={!off} onDragStart={(e) => drag(e, { kind: k })}
                      onClick={() => (off ? actions.toast('Select an image result first, then add this edit.') : actions.addFromPanel(k))}
                      data-tip={off ? 'Select an image result first' : `Add ${KINDS[k].label}. Click, or drag onto the canvas`}>
                      <KindTile kind={k} />
                      <span className="item-t"><b>{KINDS[k].label}</b><span>{KINDS[k].desc}</span></span>
                    </button>
                  );
                })}
              </section>
            );
          })}
          <p className="hint">Click to add, or drag onto the canvas.</p>
        </div>
      )}

      {tab === 'templates' && (
        <div className="pbody">
          <p className="hint">Ready-made flows. They open as a simple form, and you can edit the nodes any time.</p>
          {TEMPLATES.map((t) => (
            <article className="tcard" key={t.id}>
              <TemplateThumb t={t} />
              <div className="tcard-b">
                <h4>{t.name}</h4>
                <p>{t.desc}</p>
                <div className="tcard-f">
                  <span className="meta">{t.nodes.filter((n) => n.data.expose).length} inputs · <span className="num">{fmtCr(templateCost(t))}</span> cr</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => actions.useTemplate(t)}>Use template</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'library' && (
        <div className="pbody">
          {['Products', 'Characters'].map((g) => (
            <section className="grp" key={g}>
              <h3 className="label">{g}</h3>
              <div className="assets">
                {ASSETS.filter((a) => a.group === g).map((a) => (
                  <button key={a.id} className="asset" draggable onDragStart={(e) => drag(e, { kind: 'upload', asset: a.id })} onClick={() => actions.addFromPanel('upload', { asset: a.id, title: a.name })} data-tip={a.name}>
                    <img src={a.url} alt="" /><span>{a.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <section className="grp">
            <h3 className="label">Brand kit</h3>
            <div className="brandrow">
              <span className="ktile"><Ico as={PaletteIcon} size={16} /></span>
              <span className="item-t"><b>Lemonpeel brand</b><span>Yellow #FAD406 · friendly, upbeat tone</span></span>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

export function templateCost(t) {
  return t.nodes.reduce((s, n) => (KINDS[n.kind].runnable ? s + costOf({ kind: n.kind, model: n.data.model, duration: 5 }) : s), 0);
}

export function TemplateThumb({ t, compact }) {
  return (
    <div className={`tthumb th-${t.id} ${compact ? 'compact' : ''}`}>
      <span className="tflow">
        {t.nodes.slice(0, 5).map((n, i) => {
          const C = KINDS[n.kind].Icon;
          return <span key={n.key} className="tflow-i"><C size={12} strokeWidth={1.75} aria-hidden="true" /></span>;
        })}
      </span>
      <span className="tout">{t.out}</span>
    </div>
  );
}

/* ---------------- Model picker ---------------- */
export function ModelPicker({ kind, value, duration, onChange, open, setOpen }) {
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const models = MODELS[kind] || [];
  const cur = findModel(kind, value);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);
  // Floats over everything (like the other menus), so opening it never moves the panel underneath.
  // Placed below the field when there's room, otherwise above; scrolls inside itself if long.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const r = ref.current.querySelector('.select').getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 280 && above > below;
    setPos({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 6, maxHeight: above - 6 } : { top: r.bottom + 6, maxHeight: below - 6 }) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const inside = (t) => (ref.current && ref.current.contains(t)) || (popRef.current && popRef.current.contains(t));
    const down = (e) => { if (!inside(e.target)) setOpen(false); };
    const wheel = (e) => { if (!inside(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', down, true);
    window.addEventListener('wheel', wheel, true);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down, true); window.removeEventListener('wheel', wheel, true); window.removeEventListener('keydown', key, true); };
  }, [open]);
  const c = (m) => costOf({ kind, model: m.name, duration });
  return (
    <div className="picker" ref={ref}>
      <button className={`select ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="select-v">{cur?.name}</span>
        <span className="select-m">{cur?.group}</span>
        <Ico as={ChevronDown} size={14} />
      </button>
      {open && pos && createPortal(
        <div className="popover picker-pop floating" ref={popRef} style={pos} role="listbox">
          {models.length > 4 && (
            <label className="search inpop">
              <Ico as={Search} size={14} />
              <input autoFocus placeholder={`Search ${models.length} models`} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
          {MODEL_GROUPS.map((g) => {
            const ms = models.filter((m) => m.group === g && (!q || m.name.toLowerCase().includes(q.toLowerCase())));
            if (!ms.length) return null;
            return (
              <div key={g} className="pgroup">
                <h5 className="label">{g}</h5>
                {ms.map((m) => (
                  <button key={m.name} className={`opt ${m.name === value ? 'on' : ''}`} onClick={() => { onChange(m.name); setOpen(false); }}>
                    <span className="opt-t"><b>{m.name}</b><span>{m.note}</span></span>
                    <span className="opt-m"><span className="num">{fmtCr(c(m))}</span><span>{fmtSecs(m.secs)}</span></span>
                    {m.name === value && <Ico as={Check} size={14} className="opt-c" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ---------------- Dock: the one place to add things ---------------- */
export function Dock({ actions, selectedNode, onTemplates, onAssets, onBrand }) {
  const [more, setMore] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!more) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMore(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [more]);
  const selHasImage = selectedNode && KINDS[selectedNode.data.kind].output === 'image' && (selectedNode.data.kind === 'upload' || (selectedNode.data.takes || []).length > 0);
  const drag = (e, kind) => { e.dataTransfer.setData('application/lp', JSON.stringify({ kind })); e.dataTransfer.effectAllowed = 'move'; };
  const add = (k) => { setMore(false); actions.addFromPanel(k); };
  return (
    <div className="dock" ref={ref} role="toolbar" aria-label="Add to canvas">
      {['video', 'image', 'audio', 'writer'].map((k) => {
        const C = KINDS[k].Icon;
        return (
          <button key={k} className="dock-b" draggable onDragStart={(e) => drag(e, k)} onClick={() => add(k)} data-tip={KINDS[k].label}>
            <C size={18} strokeWidth={1.75} aria-hidden="true" /><span>{k === 'writer' ? 'Writer' : KINDS[k].label}</span>
          </button>
        );
      })}
      <span className="dock-sep" />
      <button className={`dock-b ${more ? 'on' : ''}`} onClick={() => setMore(!more)} aria-expanded={more}>
        <Ico as={Ellipsis} size={18} /><span>More</span>
      </button>
      <button className="dock-b" onClick={onTemplates}>
        <Ico as={LayoutPanelTop} size={18} /><span>Templates</span>
      </button>
      {more && (
        <div className="popover dock-pop">
          <h5 className="label">Inputs</h5>
          {['note', 'upload', 'list', 'comment'].map((k) => (
            <button key={k} className="mitem tall" draggable onDragStart={(e) => drag(e, k)} onClick={() => add(k)}>
              <KindTile kind={k} size="sm" />
              <span className="grow"><b>{KINDS[k].label}</b><span>{KINDS[k].desc}</span></span>
            </button>
          ))}
          <h5 className="label">Edit an image</h5>
          {['edit', 'upscale', 'layers'].map((k) => {
            const off = KINDS[k].needsImage && !selHasImage;
            return (
              <button key={k} className={`mitem tall ${off ? 'off' : ''}`} draggable={!off} onDragStart={(e) => drag(e, k)} onClick={() => (off ? actions.toast('Select an image result first') : add(k))}>
                <KindTile kind={k} size="sm" />
                <span className="grow"><b>{KINDS[k].label}</b><span>{off ? 'Select an image result first' : KINDS[k].desc}</span></span>
              </button>
            );
          })}
          <h5 className="label">Library</h5>
          <button className="mitem tall" onClick={() => { setMore(false); onAssets(); }}>
            <span className="ktile sm"><Ico as={Archive} size={14} /></span>
            <span className="grow"><b>Assets</b><span>Your images, characters and saved results</span></span>
          </button>
          <button className="mitem tall" onClick={() => { setMore(false); onBrand(); }}>
            <span className="ktile sm"><Ico as={PaletteIcon} size={14} /></span>
            <span className="grow"><b>Brand kit</b><span>Apply your colours and tone to generations</span></span>
          </button>
        </div>
      )}
    </div>
  );
}

export function TemplatesModal({ onClose, onUse }) {
  const docked = useContext(DockCtx);
  const cards = TEMPLATES.map((t) => (
    <button key={t.id} className="tcard tcard-btn" onClick={() => { onClose(); onUse(t); }}>
      <TemplateThumb t={t} compact />
      <div className="tcard-b"><h4>{t.name}</h4><p>{t.desc}</p></div>
    </button>
  ));
  if (docked) {
    return (
      <div className="cp dock-modal" role="dialog" aria-label="Templates">
        <header className="cp-h">
          <h2>Templates</h2>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close" data-tip="Close (Esc)"><Ico as={X} size={16} /></button>
        </header>
        <p className="cp-sub">Opens as a simple form. You can edit the steps any time.</p>
        <div className="cp-b dock-tlist">{cards}</div>
      </div>
    );
  }
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-label="Templates" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-h">
          <div><h2>Start from a template</h2><p>Opens as a simple form. You can edit the steps any time.</p></div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><Ico as={X} size={16} /></button>
        </header>
        <div className="trio">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="tcard tcard-btn" onClick={() => { onClose(); onUse(t); }}>
              <TemplateThumb t={t} compact />
              <div className="tcard-b"><h4>{t.name}</h4><p>{t.desc}</p></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inspector: only when something is selected ---------------- */
export function Inspector({ selected, actions, balance, pickerOpen, setPickerOpen, onClose, compact }) {
  const [brandOpen, setBrandOpen] = useState(false);
  const [adv, setAdv] = useState(false);

  if (selected.length > 1) {
    const runnable = selected.filter((n) => KINDS[n.data.kind].runnable);
    const withAspect = selected.filter((n) => KINDS[n.data.kind].aspect);
    const total = runnable.reduce((s, n) => s + costOf(n.data), 0);
    const aspects = [...new Set(withAspect.map((n) => n.data.aspect))];
    return (
      <>
        <div className="pbody">
          {!compact && <div className="phead row"><h2 className="grow">{selected.length} selected</h2><CloseBtn onClose={onClose} /></div>}
          {withAspect.length > 0 && (
            <Field label="Aspect ratio" aside={aspects.length > 1 ? 'Mixed' : null}>
              <Seg options={['16:9', '9:16', '1:1', '4:5']} value={aspects.length === 1 ? aspects[0] : null} onChange={(v) => withAspect.forEach((n) => actions.update(n.id, { aspect: v }))} />
            </Field>
          )}
        </div>
        {runnable.length > 0 && !compact && (
          <div className="pfoot">
            <button className="btn btn-primary btn-lg wide" onClick={() => actions.runSelected()}>
              Generate {runnable.length}<span className="cost">{fmtCr(total)}</span>
            </button>
          </div>
        )}
      </>
    );
  }

  const n = selected[0];
  const d = n.data;
  const k = KINDS[d.kind];
  const cost = costOf(d, k.runnable ? actions.runsFor(n.id) : 1);
  const after = balance - cost;
  const reason = k.runnable ? actions.reasonFor(n.id) : null;
  const hasTake = (d.takes || []).length > 0;
  const lastTake = (d.takes || [])[(d.takeIdx ?? (d.takes || []).length - 1)] || (d.takes || []).slice(-1)[0];
  const stale = !!lastTake && lastTake.src !== undefined && (d.prompt || '') !== lastTake.src;

  return (
    <>
      <div className="pbody">
        {!compact && (
          <div className="phead row">
            <KindTile kind={d.kind} size="sm" />
            <h2 className="grow">{d.title || k.label}</h2>
            <CloseBtn onClose={onClose} />
          </div>
        )}
        {k.runnable && (
          <Field label="Model">
            <ModelPicker kind={d.kind} value={d.model} duration={d.duration} onChange={(m) => actions.update(n.id, { model: m, alert: null })} open={pickerOpen} setOpen={setPickerOpen} />
          </Field>
        )}
        {k.aspect && <Field label="Aspect ratio"><Seg options={['16:9', '9:16', '1:1', '4:5']} value={d.aspect} onChange={(v) => actions.update(n.id, { aspect: v })} /></Field>}
        {k.duration && <Field label="Length"><Seg options={[3, 5, 10]} fmt={(v) => `${v}s`} value={d.duration} onChange={(v) => actions.update(n.id, { duration: v })} /></Field>}
        {k.runnable && d.kind !== 'upscale' && d.kind !== 'layers' && (
          <Field label="Brand">
            <BrandPicker value={d.brand || actions.projectBrand()?.id || 'none'} brands={actions.brands()} defaultId={actions.projectBrand()?.id} onManage={actions.openBrands} open={brandOpen} setOpen={setBrandOpen}
              onChange={(id) => actions.update(n.id, { brand: id === (actions.projectBrand()?.id || 'none') ? undefined : id })} />
          </Field>
        )}
        {d.kind === 'image' && <Field label="Number of images"><Seg options={[1, 2, 3, 4]} value={d.count || 1} onChange={(v) => actions.update(n.id, { count: v })} /></Field>}
        {d.kind === 'upload' && (
          <Field label="Image">
            <div className="assets">
              {actions.allAssets().map((a) => (
                <button key={a.id} className={`asset ${d.asset === a.id ? 'on' : ''}`} onClick={() => actions.update(n.id, { asset: a.id, title: a.name })}>
                  <img src={a.url} alt="" /><span>{a.name}</span>
                </button>
              ))}
            </div>
          </Field>
        )}
        {(k.runnable || d.kind === 'note' || d.kind === 'upload' || d.kind === 'list') && (
          <button className="disclosure" onClick={() => setAdv(!adv)} aria-expanded={adv}>
            <Ico as={adv ? ChevronDown : ChevronRight} size={14} /> More options
          </button>
        )}
        {adv && (
          <div className="advbody">
            {k.duration && <Toggle label="Generate sound" checked={d.audio !== false} onChange={(v) => actions.update(n.id, { audio: v })} />}
            {d.kind === 'video' && <Field label="Camera movement"><Seg options={['None', 'Push-in', 'Orbit', 'Handheld']} value={d.camera || 'None'} onChange={(v) => actions.update(n.id, { camera: v })} /></Field>}
            {d.kind === 'video' && <Field label="Frame rate"><Seg options={[24, 30, 60]} fmt={(v) => `${v} fps`} value={d.fps || 24} onChange={(v) => actions.update(n.id, { fps: v })} /></Field>}
            {d.kind === 'video' && <Field label="Number of frames" aside={`${(d.fps || 24) * (d.duration || 5)}`}><input className="input" readOnly value={`${(d.fps || 24) * (d.duration || 5)} frames (length × frame rate)`} /></Field>}
            {d.kind === 'image' && <Field label="Output format"><Seg options={['PNG', 'JPG', 'WebP']} value={d.format || 'PNG'} onChange={(v) => actions.update(n.id, { format: v })} /></Field>}
            {(d.kind === 'image' || d.kind === 'video') && <Field label="Quality"><Seg options={['Draft', 'Standard', 'High']} value={d.quality || 'Standard'} onChange={(v) => actions.update(n.id, { quality: v })} /></Field>}
            {k.runnable && <Field label="Seed"><input className="input" value={d.seed ?? ''} placeholder="Random" onChange={(e) => actions.update(n.id, { seed: e.target.value })} /></Field>}
            {(d.kind === 'note' || d.kind === 'upload' || d.kind === 'list') && (
              <Toggle label="Show in Form view" checked={!!d.expose} onChange={(v) => actions.update(n.id, { expose: v ? { label: d.title, type: d.kind === 'note' ? 'text' : 'asset' } : null })} />
            )}
          </div>
        )}
      </div>
      {k.runnable && !compact && (
        <div className="pfoot">
          {after < 0 ? (
            <button className="btn btn-warn btn-lg wide" onClick={() => actions.openCredits(cost - balance)}>Add credits</button>
          ) : (
            <button className={`btn ${hasTake && !stale ? 'btn-secondary' : 'btn-primary'} btn-lg wide`} disabled={!!reason || d.status === 'running'} onClick={() => actions.runNode(n.id)}>
              {reason ? reason : d.status === 'running' ? 'Generating…' : <>{hasTake ? 'Regenerate' : 'Generate'}<span className="cost">{fmtCr(cost)}</span></>}
            </button>
          )}
          <p className="foot-note">{fmtSecs(secsOf(d))} · {after < 0 ? `${fmtCr(cost - balance)} credits short` : `${fmtCr(after)} credits left after`}</p>
        </div>
      )}
    </>
  );
}

function CloseBtn({ onClose }) {
  return <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close" data-tip="Close (Esc)"><Ico as={X} size={16} /></button>;
}

export function Field({ label, aside, children }) {
  return (
    <div className="field">
      <div className="field-l"><span>{label}</span>{aside && <span className="dim">{aside}</span>}</div>
      {children}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="toggle">
      <span className="toggle-t"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

export function Seg({ options, value, onChange, fmt = (v) => v }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={o === value} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>{fmt(o)}</button>
      ))}
    </div>
  );
}

/* ---------------- Outputs ---------------- */
export function Outputs({ nodes, actions, onClose }) {
  // Recent replaces "All": you open Outputs to see what just came back. Every view is newest first.
  const [filter, setFilter] = useState('recent');
  const ago = (ts) => { if (!ts) return ''; const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
  const items = nodes
    .filter((n) => (n.data.takes || []).length)
    .flatMap((n) => n.data.takes.map((t, i) => ({ n, t, i, type: KINDS[n.data.kind].output })))
    .filter(({ t, type }) => filter === 'recent' || (filter === 'fav' ? t.fav : type === filter))
    .sort((a, b) => (b.t.ts || 0) - (a.t.ts || 0));
  return (
    <div className="pbody">
      <div className="filters">
        {[['recent', 'Recent'], ['video', 'Video'], ['image', 'Image'], ['audio', 'Audio'], ['text', 'Text'], ['fav', 'Starred']].map(([k, l]) => (
          <button key={k} className={`fchip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{k === 'fav' && <Ico as={Star} size={12} />}{l}</button>
        ))}
      </div>
      {!items.length && (
        <div className="emptybox"><Ico as={Inbox} size={20} /><p>{filter === 'fav' ? 'Nothing starred yet' : 'No results yet'}</p><span>{filter === 'fav' ? 'Star a take to keep it here.' : 'Generate a node and every take collects here.'}</span></div>
      )}
      <div className="ogrid">
        {items.map(({ n, t, i, type }) => {
          const on = i === (n.data.takeIdx ?? n.data.takes.length - 1);
          return (
            <div key={n.id + i} className={`ocard ${on ? 'on' : ''}`}>
              <button className="ocard-m" onClick={() => actions.focusTake(n.id, i)} data-tip="Show on canvas">
                {t.url ? <img src={t.url} alt="" /> : t.text ? <span className="otext">{t.text.slice(0, 70)}…</span> : <span className="owave">{waveBars(t.seed, 18).map((v, j) => <i key={j} style={{ height: `${v * 100}%` }} />)}</span>}
                {type === 'video' && <span className="oplay"><Ico as={Play} size={12} /></span>}
              </button>
              <div className="ocard-f">
                <span className="ocard-t"><b>{n.data.title}{n.data.takes.length > 1 ? ` · ${i + 1}` : ''}</b><em>{ago(t.ts)}</em></span>
                <button className={`star ${t.fav ? 'on' : ''}`} onClick={() => actions.toggleFav(n.id, i)} aria-label={t.fav ? 'Unstar' : 'Star'}><Ico as={Star} size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Form view ---------------- */
export function FormView({ nodes, edges, actions, balance, projectName, toCanvas }) {
  const exposed = nodes.filter((n) => n.data.expose);
  const gens = nodes.filter((n) => KINDS[n.data.kind].runnable);
  const aspectNodes = gens.filter((n) => KINDS[n.data.kind].aspect);
  const videos = gens.filter((n) => n.data.kind === 'video');
  const total = gens.reduce((s, n) => s + costOf(n.data), 0);
  const terminals = gens.filter((n) => !edges.some((e) => e.source === n.id));
  const mainOut = terminals.find((n) => n.data.kind === 'video') || terminals.find((n) => n.data.kind === 'image') || terminals[0];
  const anyRunning = gens.some((n) => n.data.status === 'running' || n.data.status === 'queued');
  const allDone = gens.length && gens.every((n) => n.data.status === 'done');
  const aspect = aspectNodes[0]?.data.aspect || '16:9';
  const dur = videos[0]?.data.duration || 5;

  if (!exposed.length && !gens.length) {
    return (
      <div className="formview fv-blank">
        <div className="fv-empty">
          <span className="ktile lg"><Ico as={LayoutTemplate} size={20} /></span>
          <h2>No form yet</h2>
          <p>Form view turns a canvas into a simple form. Start from a template, or turn on <b>Show in Form view</b> for a Text note or Upload.</p>
          <div className="row">
            <button className="btn btn-invert" onClick={() => actions.setLeftTab('templates', true)}>Browse templates</button>
            <button className="btn btn-secondary" onClick={toCanvas}>Back to canvas</button>
          </div>
        </div>
      </div>
    );
  }

  const out = mainOut && (mainOut.data.takes || [])[mainOut.data.takeIdx ?? mainOut.data.takes.length - 1];
  const after = balance - total;

  return (
    <div className="formview">
      <section className="fv-main">
        <header className="fv-head"><div><h1>{projectName}</h1><p>Fill in the details and generate.</p></div><button className="btn btn-ghost btn-sm" onClick={toCanvas}><Ico as={ArrowLeftRight} size={14} /> Edit steps</button></header>
        {exposed.map((n) => {
          const ex = n.data.expose;
          if (n.data.kind === 'upload') {
            return (
              <Field key={n.id} label={ex.label}>
                {ex.help && <p className="hint">{ex.help}</p>}
                <div className="assets four">
                  {ASSETS.map((a) => (
                    <button key={a.id} className={`asset ${n.data.asset === a.id ? 'on' : ''}`} onClick={() => actions.update(n.id, { asset: a.id })}>
                      <img src={a.url} alt="" /><span>{a.name}</span>
                    </button>
                  ))}
                </div>
              </Field>
            );
          }
          if (ex.type === 'choice') {
            return <Field key={n.id} label={ex.label}><Seg options={ex.options} value={n.data.prompt} onChange={(v) => actions.update(n.id, { prompt: v })} /></Field>;
          }
          return <Field key={n.id} label={ex.label}><textarea className="input ta" rows={3} value={n.data.prompt} onChange={(e) => actions.update(n.id, { prompt: e.target.value })} /></Field>;
        })}
        {aspectNodes.length > 0 && (
          <div className="two">
            <Field label="Aspect ratio"><Seg options={['16:9', '9:16', '1:1', '4:5']} value={aspect} onChange={(v) => aspectNodes.forEach((n) => actions.update(n.id, { aspect: v }))} /></Field>
            {videos.length > 0 && (
              <Field label="Video length" aside={`${dur}s`}>
                <input type="range" min="3" max="10" step="1" value={dur} onChange={(e) => videos.forEach((n) => actions.update(n.id, { duration: Number(e.target.value) }))} aria-label="Video length" />
                <div className="range-l"><span>3s</span><span>10s</span></div>
              </Field>
            )}
          </div>
        )}
      </section>

      <aside className="fv-side right">
                <div className="fv-out">
          {out?.url ? (
            <div className={`media ${mainOut.data.kind === 'video' ? 'vid playing' : ''}`}><img src={out.url} alt="" /></div>
          ) : out?.text ? (
            <pre className="textout">{out.text}</pre>
          ) : (
            <div className="fv-out-e">{anyRunning ? <><span className="pdot" />Generating…</> : <><Ico as={Sparkles} size={18} />Your result appears here</>}</div>
          )}
        </div>
        <dl className="summary">
          <div><dt>Total</dt><dd><span className="num">{fmtCr(total)}</span> cr</dd></div>
          <div className="total"><dt>Balance after</dt><dd className={after < 0 ? 'neg' : ''}><span className="num">{fmtCr(after)}</span> cr</dd></div>
        </dl>
        {after < 0 ? (
          <button className="btn btn-warn btn-lg wide" onClick={() => actions.openCredits(total - balance)}>Add credits to generate</button>
        ) : (
          <button className="btn btn-primary btn-lg wide" disabled={anyRunning} onClick={() => actions.runAll(true)}>
            {anyRunning ? 'Generating…' : <>{allDone ? 'Generate again' : 'Generate'}<span className="cost">{fmtCr(total)}</span></>}
          </button>
        )}
      </aside>
    </div>
  );
}

/* ---------------- Credits modal ---------------- */
export function CreditsModal({ need, balance, spent, onClose, onBuy }) {
  const packs = [[100, 500], [500, 2750], [2000, 12000]];
  const best = packs.find(([, c]) => c >= (need || 0)) || packs[2];
  const [sel, setSel] = useState(best[0]);
  const chosen = packs.find((p) => p[0] === sel);
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Add credits" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-h">
          <span className="ktile"><Ico as={Coins} size={16} /></span>
          <div><h2>Add credits</h2><p>Credits never expire.</p></div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><Ico as={X} size={16} /></button>
        </header>
        <div className="cr-stats">
          <span><small>Balance</small><b className="num">{fmtCr(balance || 0)}</b></span>
          <span><small>Spent this session</small><b className="num">{fmtCr(spent || 0)}</b></span>
        </div>
        {need > 0 && <p className="callout">You need <b className="num">{fmtCr(need)}</b> more credits for this.</p>}
        <div className="packs" role="radiogroup">
          {packs.map(([inr, cr]) => (
            <button key={inr} role="radio" aria-checked={sel === inr} className={`pack ${sel === inr ? 'on' : ''}`} onClick={() => setSel(inr)}>
              <span className="pack-cr"><span className="num">{fmtCr(cr)}</span> cr</span>
              <span className="pack-p">₹{fmtCr(inr)}</span>
              <span className="pack-h">{cr >= 2750 ? `About ${Math.floor(cr / 560)} Kling 3 videos` : `About ${Math.floor(cr / 150)} images`}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-invert btn-lg wide" onClick={() => onBuy(chosen[1])}>Add {fmtCr(chosen[1])} credits · ₹{fmtCr(sel)}</button>
        <p className="hint center">Prototype: no payment is taken.</p>
      </div>
    </div>
  );
}

/* ---------------- Command palette ---------------- */
export function Palette({ onClose, onPick, commands, title }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const items = useMemo(() => commands.filter((c) => !q || (c.label + ' ' + (c.hint || '')).toLowerCase().includes(q.toLowerCase())), [q, commands]);
  useEffect(() => setI(0), [q]);
  return (
    <div className="scrim top" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command menu">
        <label className="palette-in">
          <Ico as={Search} size={16} />
          <input autoFocus value={q} placeholder={title || 'Add a node or run a command'} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter' && items[i]) onPick(items[i]);
              if (e.key === 'Escape') onClose();
            }} />
          <kbd>Esc</kbd>
        </label>
        <div className="plist">
          {items.map((c, j) => (
            <button key={c.id} className={`pitem ${j === i ? 'on' : ''}`} onMouseEnter={() => setI(j)} onClick={() => onPick(c)}>
              {c.kind ? <KindTile kind={c.kind} size="sm" /> : <span className="ktile sm"><Ico as={c.icon} size={14} /></span>}
              <span className="grow"><b>{c.label}</b>{c.hint && <span>{c.hint}</span>}</span>
              {c.kbd ? <kbd>{c.kbd}</kbd> : j === i ? <Ico as={CornerDownLeft} size={14} className="dim" /> : null}
            </button>
          ))}
          {!items.length && <p className="hint pad">Nothing matches “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}

export function ShortcutsModal({ onClose }) {
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <header className="modal-h">
          <div><h2>Keyboard shortcuts</h2><p>Single keys only work when you're not typing in a field.</p></div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><Ico as={X} size={16} /></button>
        </header>
        <dl className="keys">
          {SHORTCUTS.map(([a, k]) => <div key={a}><dt>{a}</dt><dd><kbd>{k}</kbd></dd></div>)}
        </dl>
      </div>
    </div>
  );
}
