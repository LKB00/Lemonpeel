import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, ArrowRight, Upload, ChevronDown, Palette } from './ri.js';
import { KINDS, MODELS, PORT_COLORS, costOf, secsOf, fmtCr, fmtSecs } from './data.js';
import { Ico, KindTile } from './icons.jsx';
import { Field, Seg, ModelPicker } from './panels.jsx';
import { PORT_ICONS } from './StudioNode.jsx';
import { readMedia, BrandMark } from './extras.jsx';

/* =====================================================================
   Create panel · docked next to the left rail (after Clueso's rail panels)
   Pick everything first (prompt, model, shape, inputs), then make the node,
   or make it and generate in one go.
   ===================================================================== */
export function CreatePanel({ kind, actions, assets, nodes, outputOf, selection, defaults, balance, onCreate, onClose }) {
  const k = KINDS[kind];
  // Inputs offered here: every port except the plain prompt (that's the text box above).
  const ports = k.inputs.filter((p) => !(p.type === 'text' && (p.id === 'prompt')));

  // Start from the selection when it fits, e.g. a selected image becomes the starting image.
  const initial = useMemo(() => {
    const m = {};
    if (selection && selection.length === 1) {
      const s = selection[0];
      const out = KINDS[s.data.kind].output;
      const p = ports.find((x) => x.type === out);
      if (p && outputOf(s)) m[p.id] = [{ src: 'node', id: s.id }];
    }
    return m;
  }, []);

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(MODELS[kind]?.[0]?.name);
  const [aspect, setAspect] = useState(defaults.aspect || '16:9');
  const [duration, setDuration] = useState(defaults.duration || 5);
  const [brand, setBrand] = useState(() => actions.projectBrand()?.id || 'none');
  const [brandOpen, setBrandOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [inputs, setInputs] = useState(initial);
  const [picking, setPicking] = useState(null); // { key: port id | 'refs', type, rect } for the floating chooser
  const [pickerOpen, setPickerOpen] = useState(false);

  const cfg = { kind, model, aspect, duration, count };
  const cost = k.runnable ? costOf(cfg) : 0;
  const short = cost > balance;

  const sourcesFor = (p) => {
    const canvas = nodes
      .filter((n) => n.type !== 'frame' && !['upload', 'clip', 'sound'].includes(n.data.kind) && KINDS[n.data.kind]?.output === p.type && outputOf(n))
      .map((n) => ({ src: 'node', id: n.id, name: n.data.title || KINDS[n.data.kind].label, thumb: outputOf(n)?.url, kind: n.data.kind }));
    const lib = p.type === 'text' ? [] : assets.filter((a) => (a.type || 'image') === p.type).map((a) => ({ src: 'asset', id: a.id, name: a.name, thumb: a.url, cat: a.cat }));
    return { canvas, lib };
  };
  const label = (it) => {
    if (it.src === 'asset') return assets.find((a) => a.id === it.id)?.name || 'Image';
    const n = nodes.find((x) => x.id === it.id);
    return n ? n.data.title || KINDS[n.data.kind].label : 'Node';
  };
  const thumb = (it) => {
    if (it.src === 'asset') return assets.find((a) => a.id === it.id)?.url;
    const n = nodes.find((x) => x.id === it.id);
    return n ? outputOf(n)?.url : null;
  };
  const has = (p, it) => (inputs[p.id] || []).some((x) => x.src === it.src && x.id === it.id);
  const toggle = (p, it) => {
    setInputs((m) => {
      const cur = m[p.id] || [];
      if (cur.some((x) => x.src === it.src && x.id === it.id)) return { ...m, [p.id]: cur.filter((x) => !(x.src === it.src && x.id === it.id)) };
      if (!p.multi) return { ...m, [p.id]: [{ src: it.src, id: it.id }] };
      if (p.max && cur.length >= p.max) { actions.toast(`${p.label}: up to ${p.max}`); return m; }
      return { ...m, [p.id]: [...cur, { src: it.src, id: it.id }] };
    });
    if (!p.multi) setPicking(null);
  };
  const remove = (p, it) => setInputs((m) => ({ ...m, [p.id]: (m[p.id] || []).filter((x) => !(x.src === it.src && x.id === it.id)) }));

  // Upload straight into an input: saved to Assets, then attached.
  const uploadTo = (p, files) => {
    [...(files || [])].filter((f) => f.type.startsWith(`${p.type}/`)).slice(0, p.multi ? (p.max || 99) - (inputs[p.id] || []).length : 1).forEach((f) => {
      readMedia(f, (m) => { const a = actions.addAsset(m); toggle(p, { src: 'asset', id: a.id }); });
    });
  };
  const fileRef = useRef(null);

  const submit = (run) => onCreate(kind, { prompt: prompt.trim(), model, aspect, duration, count, inputs, brand }, run);

  return (
    <div className="cp" role="dialog" aria-label={`New ${k.label.toLowerCase()}`}>
      <header className="cp-h">
        <KindTile kind={kind} size="sm" />
        <h2>New {/^AI /.test(k.label) ? `AI ${k.label.slice(3).toLowerCase()}` : k.label.toLowerCase()}</h2>
        <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close" data-tip="Close (Esc)"><Ico as={X} size={16} /></button>
      </header>

      <div className="cp-b">
        {k.placeholder && (
          <textarea className="cp-prompt" autoFocus rows={3} value={prompt} placeholder={k.placeholder} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(e.shiftKey); } }} aria-label="Prompt" />
        )}

        {ports.length > 0 && (() => {
          const singles = ports.filter((p) => !p.multi);
          const ORDER = { image: 0, video: 1, audio: 2, text: 3 };
          const multis = ports.filter((p) => p.multi).sort((x, y) => ORDER[x.type] - ORDER[y.type]);
          const isFrames = singles.some((p) => p.id === 'start') && singles.some((p) => p.id === 'end');
          const refItems = multis.flatMap((p) => (inputs[p.id] || []).map((it) => ({ p, it })));
          const refRoom = multis.filter((p) => (inputs[p.id] || []).length < (p.max || 99));
          const openChooser = (e, key, type) => setPicking({ key, type, rect: e.currentTarget.getBoundingClientRect() });
          // Pills, like the input chips on nodes: empty = icon with "+" and what it's for; filled = thumbnail, name and ×.
          const Tile = ({ p, it, onClick }) => {
            const C = PORT_ICONS[p.type];
            const t = thumb(it);
            return (
              <span className={`ipill filled t-${p.type}`}>
                <button className="ipill-main" onClick={onClick} disabled={!onClick} data-tip={onClick ? 'Replace' : p.label} aria-label={`${p.label}: ${label(it)}`}>
                  {t ? <img src={t} alt="" /> : <span className="ipill-ic" style={{ '--pc': PORT_COLORS[p.type] }}><C size={12} aria-hidden="true" /></span>}
                  <span className="ipill-t">{label(it)}</span>
                </button>
                <button className="ipill-x" onClick={() => remove(p, it)} aria-label={`Remove ${label(it)}`} data-tip="Remove"><Ico as={X} size={12} /></button>
              </span>
            );
          };
          const Empty = ({ p, onClick, text }) => {
            const C = PORT_ICONS[p.type];
            return (
              <button className="ipill is-empty" onClick={onClick} aria-label={`Add ${text || p.label}`}
                onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.currentTarget.classList.add('drop'); } }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drop'); uploadTo(p, e.dataTransfer.files); }}
                data-tip={p.type === 'text' ? undefined : 'Click to choose, or drop a file'}>
                <span className="ipill-ic" style={{ '--pc': PORT_COLORS[p.type] }}><C size={12} aria-hidden="true" /></span>
                <span className="ipill-t">{text || p.label}</span>
                <span className="ipill-end" aria-hidden="true"><Ico as={Plus} size={12} /></span>
              </button>
            );
          };
          const single = (p) => {
            const it = (inputs[p.id] || [])[0];
            const name = isFrames ? (p.id === 'start' ? 'First frame' : 'Last frame') : p.label;
            return it
              ? <Tile key={p.id} p={p} it={it} onClick={(e) => openChooser(e, p.id, p.type)} />
              : <Empty key={p.id} p={p} text={name} onClick={(e) => openChooser(e, p.id, p.type)} />;
          };
          return (
            <section className="cp-ins2">
              {singles.length > 0 && (
                <div className="ci-group">
                  <h5 className="cp-sec">{isFrames ? 'Frames' : 'Input'} <span>optional</span></h5>
                  <div className={`slot-row ${isFrames ? 'frames' : ''}`}>
                    {isFrames ? (
                      <>
                        {single(singles.find((p) => p.id === 'start'))}
                        <span className="frames-arrow" aria-hidden="true"><Ico as={ArrowRight} size={12} /></span>
                        {single(singles.find((p) => p.id === 'end'))}
                        {singles.filter((p) => p.id !== 'start' && p.id !== 'end').map(single)}
                      </>
                    ) : singles.map(single)}
                  </div>
                </div>
              )}
              {multis.length > 0 && (
                <div className="ci-group">
                  <h5 className="cp-sec">References <span>optional</span></h5>
                  {multis.map((p) => {
                    const list = inputs[p.id] || [];
                    const full = p.max && list.length >= p.max;
                    return (
                      <div key={p.id} className="ref-strip">
                        {list.map((it) => <Tile key={it.src + it.id} p={p} it={it} />)}
                        {!full && <Empty p={p} text={list.length ? `${p.label} · ${list.length}/${p.max}` : p.label} onClick={(e) => openChooser(e, p.id, p.type)} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {picking && (() => {
                const refs = picking.key === 'refs';
                const p = refs ? multis.find((x) => x.type === picking.type) || multis[0] : ports.find((x) => x.id === picking.key);
                if (!p) return null;
                const { canvas, lib } = sourcesFor(p);
                // A side sheet beside the panel: same top and height, so it never covers the panel's buttons
                // and never depends on where the pill sits. Falls back to covering the panel on narrow screens.
                const dock = document.querySelector('.dockpanel')?.getBoundingClientRect();
                const W = 300;
                const roomRight = dock && dock.right + 8 + W <= window.innerWidth - 8;
                const style = dock ? { left: roomRight ? dock.right + 8 : dock.left, top: dock.top, height: dock.height, width: roomRight ? W : dock.width } : { left: 96, top: 80, height: 480, width: W };
                const title = isFrames && (p.id === 'start' || p.id === 'end') ? (p.id === 'start' ? 'First frame' : 'Last frame') : p.label;
                const n = (inputs[p.id] || []).length;
                const C = PORT_ICONS[p.type];
                return createPortal(
                  <>
                    <div className="chooser-scrim" onMouseDown={() => setPicking(null)} />
                    <div className="chooser side" style={style} role="dialog" aria-label={`Choose ${title}`}>
                      <header className="cs-h">
                        <h2>{title}</h2>
                        {p.multi && <span className="cs-n">{n}/{p.max}</span>}
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setPicking(null)} aria-label="Close" data-tip="Close"><Ico as={X} size={16} /></button>
                      </header>
                      <div className="cs-b">
                      {p.type !== 'text' && (
                        <>
                          <button className="chooser-up" onClick={() => { fileRef.current.dataset.port = p.id; fileRef.current.accept = `${p.type}/*`; fileRef.current.multiple = !!p.multi; fileRef.current.click(); }}>
                            <span className="as-up-i"><Ico as={Upload} size={14} /></span>
                            <span className="as-up-t"><b>Upload from computer</b><span>{p.type === 'image' ? 'An image' : p.type === 'video' ? 'A video clip' : 'An audio file'}, saved to your Assets</span></span>
                          </button>
                          <input ref={fileRef} type="file" hidden onChange={(e) => { const port = ports.find((x) => x.id === e.target.dataset.port); if (port) uploadTo(port, e.target.files); e.target.value = ''; if (!port?.multi) setPicking(null); }} />
                        </>
                      )}
                      {lib.length > 0 && (p.type === 'audio' ? (
                        <>
                          <h6>Library</h6>
                          {lib.map((it) => (
                            <button key={it.id} className={`cp-row ${has(p, it) ? 'on' : ''}`} onClick={() => toggle(p, it)} aria-pressed={has(p, it)}>
                              <span className="cp-in-i" style={{ '--pc': PORT_COLORS.audio }}><C size={12} aria-hidden="true" /></span>
                              <span>{it.name}</span>
                              {has(p, it) ? <Ico as={Check} size={14} /> : <em className="cp-row-m">{it.cat}</em>}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          <h6>Library</h6>
                          <div className="cp-grid">
                            {lib.map((it) => (
                              <button key={it.id} className={`cp-tile ${has(p, it) ? 'on' : ''}`} onClick={() => toggle(p, it)} data-tip={it.name} aria-pressed={has(p, it)}>
                                <img src={it.thumb} alt={it.name} />{has(p, it) && <i><Ico as={Check} size={12} /></i>}
                              </button>
                            ))}
                          </div>
                        </>
                      ))}
                      {canvas.length > 0 && (
                        <>
                          <h6>On this canvas</h6>
                          {canvas.map((it) => (
                            <button key={it.id} className={`cp-row ${has(p, it) ? 'on' : ''}`} onClick={() => toggle(p, it)} aria-pressed={has(p, it)}>
                              {it.thumb ? <img src={it.thumb} alt="" /> : <KindTile kind={it.kind} size="sm" />}
                              <span>{it.name}</span>
                              {has(p, it) && <Ico as={Check} size={14} />}
                            </button>
                          ))}
                        </>
                      )}
                      {!lib.length && !canvas.length && <p className="cp-empty">Nothing to use yet.</p>}
                      </div>
                      <footer className="cs-f">
                        <button className="btn btn-invert" onClick={() => setPicking(null)}>{p.multi ? (n ? `Done · ${n} added` : 'Done') : 'Close'}</button>
                      </footer>
                    </div>
                  </>,
                  document.body,
                );
              })()}

        {k.aspect && <Field label="Aspect ratio"><Seg options={['16:9', '9:16', '1:1', '4:5']} value={aspect} onChange={setAspect} /></Field>}
        {k.duration && <Field label="Length"><Seg options={[3, 5, 10]} fmt={(v) => `${v}s`} value={duration} onChange={setDuration} /></Field>}
        {kind === 'image' && <Field label="Number of images"><Seg options={[1, 2, 3, 4]} value={count} onChange={setCount} /></Field>}
        {k.runnable && kind !== 'upscale' && kind !== 'layers' && (
          <Field label="Brand"><BrandPicker value={brand} onChange={setBrand} brands={actions.brands()} defaultId={actions.projectBrand()?.id} onManage={actions.openBrands} open={brandOpen} setOpen={setBrandOpen} /></Field>
        )}
        {k.runnable && MODELS[kind]?.length > 0 && (
          <Field label="Model">
            <ModelPicker kind={kind} value={model} duration={duration} onChange={setModel} open={pickerOpen} setOpen={setPickerOpen} />
          </Field>
        )}
            </section>
          );
        })()}
      </div>

      <footer className="cp-f">
        {k.runnable && <p className="cp-meta">About {fmtSecs(secsOf(cfg))} · {short ? `${fmtCr(cost - balance)} credits short` : `${fmtCr(cost)} credits`}</p>}
        <div className="cp-acts">
          <button className="btn btn-secondary" onClick={() => submit(false)} data-tip="Add to the canvas without generating">Create node</button>
          {k.runnable && (
            short
              ? <button className="btn btn-warn" onClick={() => actions.openCredits(cost - balance)}>Add credits</button>
              : <button className="btn btn-primary" onClick={() => submit(true)} data-tip="Create and generate (⌘⇧↵)">Create &amp; generate<span className="cost">{fmtCr(cost)}</span></button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* Brand for this generation: starts on the project default, change it per node. Floats like the model list. */
export function BrandPicker({ value, onChange, brands, defaultId, onManage, open, setOpen }) {
  const ref = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);
  const cur = brands.find((b) => b.id === value) || null;
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const up = below < 220 && r.top > below;
    setPos({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 6, maxHeight: r.top - 18 } : { top: r.bottom + 6, maxHeight: below - 6 }) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const inside = (t) => (ref.current && ref.current.contains(t)) || (popRef.current && popRef.current.contains(t));
    const down = (e) => { if (!inside(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', down, true);
    window.addEventListener('wheel', down, true);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down, true); window.removeEventListener('wheel', down, true); window.removeEventListener('keydown', key, true); };
  }, [open]);
  const pick = (id) => { onChange(id); setOpen(false); };
  return (
    <div className="picker" ref={ref}>
      <button className={`select bpick ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
        {cur ? <BrandMark b={cur} size="xs" /> : <span className="bpick-none"><Ico as={Palette} size={12} /></span>}
        <span className="select-v">{cur ? cur.name : 'No brand'}</span>
        <span className="select-m">{cur && cur.id === defaultId ? 'Default' : ''}</span>
        <Ico as={ChevronDown} size={14} />
      </button>
      {open && pos && createPortal(
        <div className="popover picker-pop floating bpick-pop" ref={popRef} style={pos} role="listbox">
          {brands.map((b) => (
            <button key={b.id} className={`bopt ${b.id === value ? 'on' : ''}`} onClick={() => pick(b.id)} role="option" aria-selected={b.id === value}>
              <BrandMark b={b} size="xs" /><span className="grow">{b.name}</span>{b.id === defaultId && <small>Default</small>}{b.id === value && <Ico as={Check} size={14} />}
            </button>
          ))}
          <button className={`bopt ${value === 'none' ? 'on' : ''}`} onClick={() => pick('none')} role="option" aria-selected={value === 'none'}>
            <span className="bpick-none"><Ico as={Palette} size={12} /></span><span className="grow">No brand</span>{value === 'none' && <Ico as={Check} size={14} />}
          </button>
          <div className="msep" />
          <button className="bopt dim" onClick={() => { setOpen(false); onManage(); }}>
            <span className="bpick-none"><Ico as={Plus} size={12} /></span><span className="grow">{brands.length ? 'Manage brand kits' : 'Add a brand kit'}</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
