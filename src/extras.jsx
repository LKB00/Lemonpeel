import React, { useContext, useEffect, useLayoutEffect, useRef, useState, memo } from 'react';
import { DockCtx, StudioCtx } from './ctx.js';
import { NodeResizer, useReactFlow } from '@xyflow/react';
import { X, Upload, Link2, Check, ChevronLeft, ChevronRight, Download, Palette, Sparkles, UserPlus, Copy, Plus, Search, Settings2, Play, Pause, Ellipsis, Pencil, Trash2, ChevronDown, Crosshair } from './ri.js';
import { Ico } from './icons.jsx';
import { Seg } from './panels.jsx';
import { hash, waveBars, ASSET_TYPES } from './art.js';

/* ---------------- Group frame ---------------- */
function FrameNode({ id, data, selected }) {
  const rf = useReactFlow();
  const ctx = useContext(StudioCtx);
  const [editing, setEditing] = useState(false);
  return (
    <div className={`frame ${selected ? 'is-sel' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={240} minHeight={160} lineClassName="frame-line" handleClassName="frame-handle" />
      {editing ? (
        <input className="frame-title nodrag" autoFocus defaultValue={data.title}
          onBlur={(e) => { rf.updateNodeData(id, { title: e.target.value.trim() || 'Group' }); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }} />
      ) : (
        <span className="frame-title" onDoubleClick={() => setEditing(true)}>{data.title}</span>
      )}
      {ctx && <button className="frame-run nodrag" onClick={() => ctx.actions.runGroup(id)} data-tip="Generate what's in this group"><Ico as={Play} size={11} />Generate group</button>}
    </div>
  );
}
export const Frame = memo(FrameNode);

/* ---------------- Modal shell ---------------- */
function Modal({ title, sub, onClose, wide, children, icon }) {
  const docked = useContext(DockCtx);
  if (docked) {
    return (
      <div className="cp dock-modal" role="dialog" aria-label={title}>
        <header className="cp-h">
          <h2>{title}</h2>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close" data-tip="Close (Esc)"><Ico as={X} size={16} /></button>
        </header>
        {sub && <p className="cp-sub">{sub}</p>}
        <div className="cp-b">{children}</div>
      </div>
    );
  }
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-h">
          {icon && <span className="ktile"><Ico as={icon} size={16} /></span>}
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><Ico as={X} size={16} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Assets library ---------------- */
function fmtDur(secs = 0) { return `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`; }

// Read an uploaded file into an asset: images as data URLs; video gets a poster frame and duration; audio gets duration.
export function readMedia(f, done) {
  const name = f.name.replace(/\.[^.]+$/, '');
  if (f.type.startsWith('image/')) {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => done({ type: 'image', name, url: r.result, aspect: aspectOf(img.width, img.height) }); img.src = r.result; };
    r.readAsDataURL(f);
  } else if (f.type.startsWith('video/')) {
    const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.src = URL.createObjectURL(f);
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 1) / 2); };
    v.onseeked = () => {
      const c = document.createElement('canvas'); c.width = 320; c.height = Math.round(320 * (v.videoHeight / v.videoWidth || 0.5625));
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      done({ type: 'video', name, url: c.toDataURL('image/jpeg', 0.8), secs: Math.round(v.duration || 5), aspect: aspectOf(v.videoWidth, v.videoHeight) });
    };
  } else if (f.type.startsWith('audio/')) {
    const a = document.createElement('audio'); a.preload = 'metadata'; a.src = URL.createObjectURL(f);
    a.onloadedmetadata = () => done({ type: 'audio', name, secs: Math.round(a.duration || 5), seed: hash(name) % 997 });
  }
}
function aspectOf(w, h) {
  if (!w || !h) return '1:1';
  const r = w / h;
  return [['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:5', 0.8]].reduce((b, x) => (Math.abs(x[1] - r) < Math.abs(b[1] - r) ? x : b))[0];
}

function NameEdit({ a, editing, onDone, className }) {
  const [v, setV] = useState(a.name);
  const done = useRef(false);
  useEffect(() => { if (editing) { done.current = false; setV(a.name); } }, [editing]);
  if (!editing) return <b className={className}>{a.name}</b>;
  const finish = (name) => { if (done.current) return; done.current = true; onDone(name); };
  return <input className={`${className} name-in`} autoFocus value={v} onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()}
    onClick={(e) => e.stopPropagation()} onBlur={() => finish(v.trim() || a.name)}
    onKeyDown={(e) => { if (e.key === 'Enter') finish(v.trim() || a.name); if (e.key === 'Escape') { e.stopPropagation(); finish(a.name); } }} aria-label="Asset name" />;
}
const MoreBtn = ({ a, onMore }) => (
  <button className="as-more" onClick={(e) => { e.stopPropagation(); onMore(e, a); }} aria-label={`More for ${a.name}`} data-tip="More"><Ico as={Ellipsis} size={14} /></button>
);

function AudioRow({ a, onAdd, playing, onPlay, onMore, renaming, onRenamed }) {
  return (
    <div className={`arow ${playing ? 'playing' : ''}`} draggable onDragStart={(e) => { e.dataTransfer.setData('application/lp', JSON.stringify({ kind: 'sound', asset: a.id })); e.dataTransfer.effectAllowed = 'move'; }}>
      <button className="arow-play" onClick={onPlay} aria-label={playing ? `Pause ${a.name}` : `Play ${a.name}`}><Ico as={playing ? Pause : Play} size={12} /></button>
      <button className="arow-main" onClick={() => !renaming && onAdd(a)} data-tip={renaming ? undefined : 'Add to canvas'}>
        <span className="arow-t"><NameEdit a={a} editing={renaming} onDone={onRenamed} /><span>{a.cat || 'Audio'} · {fmtDur(a.secs)}</span></span>
        <span className="arow-wave" aria-hidden="true">{waveBars(a.seed || 1, 22).map((v, i) => <i key={i} style={{ height: `${v * 100}%`, animationDelay: `${i * 50}ms` }} />)}</span>
      </button>
      <MoreBtn a={a} onMore={onMore} />
    </div>
  );
}
function MediaTile({ a, onAdd, onMore, renaming, onRenamed }) {
  const kind = a.type === 'video' ? 'clip' : 'upload';
  return (
    <div className="mtile-wrap">
    <button className={`mtile ${a.type}`} onClick={() => !renaming && onAdd(a)} data-tip={renaming ? undefined : `Add ${a.name}`} draggable
      onDragStart={(e) => { e.dataTransfer.setData('application/lp', JSON.stringify({ kind, asset: a.id })); e.dataTransfer.effectAllowed = 'move'; }}>
      <span className="mtile-img"><img src={a.url} alt="" draggable={false} />
        {a.type === 'video' && <><span className="mtile-play"><Ico as={Play} size={12} /></span><span className="mtile-dur">{fmtDur(a.secs)}</span></>}
        {a.aspect && a.aspect !== '1:1' && <span className="mtile-ar">{a.aspect}</span>}
      </span>
      <NameEdit a={a} editing={renaming} onDone={onRenamed} className="mtile-n" />
    </button>
    <MoreBtn a={a} onMore={onMore} />
    </div>
  );
}

/* ---------------- Assets library ----------------
   Type first (it decides which input an asset can feed), then category, then refinements. */
export function AssetsModal({ assets, onClose, onAdd, onUpload, onRemove, onRename }) {
  const [menu, setMenu] = useState(null); // { a, x, y }
  const [renaming, setRenaming] = useState(null);
  useEffect(() => { if (!menu) return; const h = (e) => { if (!e.target.closest?.('.as-menu, [data-menu-anchor]')) setMenu(null); }; window.addEventListener('pointerdown', h, true); window.addEventListener('wheel', h, true); return () => { window.removeEventListener('pointerdown', h, true); window.removeEventListener('wheel', h, true); }; }, [menu]);
  const openMore = (e, a) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ a, x: Math.min(r.right - 168, window.innerWidth - 176), y: r.bottom + 6 }); };
  const renamed = (a) => (name) => { if (name !== a.name) onRename?.(a, name); setRenaming(null); };
  // No 'All': people come for a kind of media. Open on the last type used; search still spans every type.
  const [type, setTypeRaw] = useState(() => { try { const t = localStorage.getItem('lp-asset-type'); return ['image', 'video', 'audio'].includes(t) ? t : 'image'; } catch { return 'image'; } });
  const setType = (t) => { setTypeRaw(t); try { localStorage.setItem('lp-asset-type', t); } catch { /* private mode */ } };
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(null); // { x, y } of the floating filter menu
  const [aspect, setAspect] = useState('Any');
  const [source, setSource] = useState('Any');
  const [over, setOver] = useState(false);
  const [playing, setPlaying] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => { if (!showFilters) return; const h = (e) => { if (!e.target.closest?.('.as-menu, [data-menu-anchor]')) setShowFilters(null); }; window.addEventListener('pointerdown', h, true); window.addEventListener('wheel', h, true); return () => { window.removeEventListener('pointerdown', h, true); window.removeEventListener('wheel', h, true); }; }, [showFilters]);
  useEffect(() => { if (!playing) return; const a = assets.find((x) => x.id === playing); const t = setTimeout(() => setPlaying(null), Math.min(8, a?.secs || 3) * 1000); return () => clearTimeout(t); }, [playing]);

  const SRC = { Any: null, Uploaded: 'upload', Generated: 'generated', Library: 'library' };
  const match = (a) => (!q || a.name.toLowerCase().includes(q.toLowerCase()) || (a.cat || '').toLowerCase().includes(q.toLowerCase()))
    && (aspect === 'Any' || a.type === 'audio' || a.aspect === aspect)
    && (source === 'Any' || a.source === SRC[source]);
  const ofType = (t) => assets.filter((a) => a.type === t && match(a));
  const activeFilters = (aspect !== 'Any') + (source !== 'Any');
  const pick = (t) => { setType(t); setCat('All'); };
  const searching = !!q.trim();
  const upload = (files) => [...files].forEach((f) => readMedia(f, (m) => { onUpload(m); if (type !== m.type) pick(m.type); }));

  const section = (t, limit) => {
    const list = ofType(t).filter((a) => searching || cat === 'All' || a.cat === cat);
    if (!list.length) return null;
    const shown = limit ? list.slice(0, limit) : list;
    return (
      <section key={t} className="as-sec">
        {searching && (
          <header className="as-sh"><b>{ASSET_TYPES[t].label}</b><span>{list.length}</span></header>
        )}
        {t === 'audio'
          ? <div className="as-list">{shown.map((a) => <AudioRow key={a.id} a={a} onAdd={onAdd} playing={playing === a.id} onPlay={() => setPlaying(playing === a.id ? null : a.id)} onMore={openMore} renaming={renaming === a.id} onRenamed={renamed(a)} />)}</div>
          : <div className="as-grid">{shown.map((a) => <MediaTile key={a.id} a={a} onAdd={onAdd} onMore={openMore} renaming={renaming === a.id} onRenamed={renamed(a)} />)}</div>}
      </section>
    );
  };
  // Searching shows matches from every type, the current one first.
  const sections = searching ? [type, ...['image', 'video', 'audio'].filter((t) => t !== type)].map((t) => section(t)) : [section(type)];
  const empty = sections.every((x) => !x);
  const counts = { image: ofType('image').length, video: ofType('video').length, audio: ofType('audio').length };

  return (
    <Modal title="Assets" onClose={onClose} wide>
      <div className={`assets2 ${over ? 'over' : ''}`}
        onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setOver(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>

        <div className="as-top">
          <label className="as-search"><Ico as={Search} size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets" aria-label="Search assets" /></label>
          <button className={`btn btn-icon btn-ghost as-fbtn ${showFilters || activeFilters ? 'on' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            data-menu-anchor onClick={(e) => { if (showFilters) return setShowFilters(null); const r = e.currentTarget.getBoundingClientRect(); setShowFilters({ x: Math.min(r.right - 200, window.innerWidth - 208), y: r.bottom + 6 }); }}
            aria-expanded={!!showFilters} aria-haspopup="menu" aria-label="Filters" data-tip="Filters">
            <Ico as={Settings2} size={16} />{activeFilters > 0 && <i>{activeFilters}</i>}
          </button>
        </div>


        <div className="seg as-types" role="tablist">
          {[['image', 'Images'], ['video', 'Video'], ['audio', 'Audio']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={type === k} className={type === k ? 'on' : ''} onClick={() => pick(k)}>{l}<span className="as-n">{counts[k]}</span></button>
          ))}
        </div>
        {!searching && (
          <div className="as-cats" role="tablist" aria-label="Category">
            {['All', ...ASSET_TYPES[type].cats].map((c) => <button key={c} role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}

        <button className="as-up" onClick={() => fileRef.current?.click()}>
          <span className="as-up-i"><Ico as={Upload} size={16} /></span>
          <span className="as-up-t"><b>Upload</b><span>{type === 'image' ? 'Images' : type === 'video' ? 'Video clips' : 'Audio files'}, or drop any file here</span></span>
        </button>
        <input ref={fileRef} type="file" multiple hidden accept={`${type}/*`} onChange={(e) => { upload(e.target.files || []); e.target.value = ''; }} />

        {sections}
        {empty && (
          <div className="as-empty">
            <b>{q || activeFilters ? 'No matches' : 'Nothing here yet'}</b>
            {(q || activeFilters > 0) ? <button className="linkbtn" onClick={() => { setQ(''); setAspect('Any'); setSource('Any'); setCat('All'); }}>Clear search and filters</button> : <span>Upload, or save a result from the canvas.</span>}
          </div>
        )}
        {over && <div className="assets-over"><Ico as={Upload} size={20} /><span>Drop to upload</span></div>}
        {showFilters && (
          <div className="as-menu as-fmenu" style={{ left: showFilters.x, top: showFilters.y }} role="menu" aria-label="Filters" onPointerDown={(e) => e.stopPropagation()}>
            <h6>Aspect ratio</h6>
            {['Any', '16:9', '9:16', '1:1', '4:5'].map((o) => (
              <button key={o} role="menuitemradio" aria-checked={aspect === o} onClick={() => setAspect(o)}>
                <span className="grow">{o === 'Any' ? 'Any shape' : o}</span>{aspect === o && <Ico as={Check} size={14} />}
              </button>
            ))}
            <h6>Source</h6>
            {['Any', 'Uploaded', 'Generated', 'Library'].map((o) => (
              <button key={o} role="menuitemradio" aria-checked={source === o} onClick={() => setSource(o)}>
                <span className="grow">{o === 'Any' ? 'Anywhere' : o}</span>{source === o && <Ico as={Check} size={14} />}
              </button>
            ))}
            {activeFilters > 0 && <button className="as-fclear" onClick={() => { setAspect('Any'); setSource('Any'); }}>Clear filters</button>}
          </div>
        )}
        {menu && (
          <div className="as-menu" style={{ left: menu.x, top: menu.y }} role="menu" onPointerDown={(e) => e.stopPropagation()}>
            <button role="menuitem" onClick={() => { onAdd(menu.a); setMenu(null); }}><Ico as={Plus} size={14} />Add to canvas</button>
            <button role="menuitem" onClick={() => { setRenaming(menu.a.id); setMenu(null); }}><Ico as={Pencil} size={14} />Rename</button>
            <button role="menuitem" className="danger" onClick={() => { onRemove?.(menu.a); setMenu(null); }}><Ico as={Trash2} size={14} />Remove</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Brand kit (Brand DNA) ---------------- */
const BRAND_FONTS = [['Inter', 'sans-serif'], ['Playfair Display', 'serif'], ['Space Grotesk', 'sans-serif'], ['DM Sans', 'sans-serif']];
const fontOf = (b) => b.font || BRAND_FONTS[0];
const fontCss = (b) => `"${fontOf(b)[0]}", ${fontOf(b)[1]}`;
const initials = (name) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// A simple stand-in for a fetched logo: a mark in the brand's main colour (prototype only).
function makeLogo(h, color) {
  const shapes = [
    `<circle cx="32" cy="32" r="20" fill="${color}"/>`,
    `<rect x="14" y="14" width="36" height="36" rx="8" fill="${color}"/>`,
    `<path d="M32 10 54 50H10Z" fill="${color}"/>`,
    `<path d="M14 32a18 18 0 0 1 36 0v18H14Z" fill="${color}"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${shapes[h % shapes.length]}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Logo if we have one; otherwise the brand's initials in its own typeface. Always monochrome tile.
export function BrandMark({ b, size = 'md' }) {
  return (
    <span className={`bmark ${size}`} aria-hidden="true">
      {b.logo ? <img src={b.logo} alt="" /> : <b style={{ fontFamily: fontCss(b) }}>{initials(b.name)}</b>}
    </span>
  );
}
function Palette4({ colors, labels }) {
  return (
    <span className={`pal ${labels ? 'big' : ''}`}>
      {colors.map((c, i) => <i key={i} style={{ background: c }} data-tip={labels ? undefined : c}>{labels && <em>{toHex(c)}</em>}</i>)}
    </span>
  );
}
function toHex(c) {
  if (c.startsWith('#')) return c.toUpperCase();
  const el = document.createElement('i'); el.style.color = c; document.body.appendChild(el);
  const m = getComputedStyle(el).color.match(/\d+/g); el.remove();
  return m ? '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('').toUpperCase() : c;
}

function BrandDetails({ b, onLogo }) {
  const fileRef = useRef(null);
  return (
    <div className="bd">
      <div className="bd-row">
        <span className="bd-l">Logo</span>
        <div className="bd-logo">
          {onLogo ? (
            <button className={`bd-slot ${b.logo ? 'has' : ''}`} onClick={() => fileRef.current?.click()} aria-label={b.logo ? 'Replace logo' : 'Upload logo'} data-tip={b.logo ? 'Replace logo' : 'Upload logo'}>
              <BrandMark b={b} size="lg" />
              <span className="bd-slot-o"><Ico as={Upload} size={16} /></span>
            </button>
          ) : <BrandMark b={b} size="lg" />}
          {onLogo && !b.logo && <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Ico as={Upload} size={14} />Upload logo</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => onLogo(r.result); r.readAsDataURL(f); e.target.value = ''; }} />
        </div>
      </div>
      <div className="bd-row"><span className="bd-l">Wordmark</span><span className="bd-word" style={{ fontFamily: fontCss(b) }}>{b.name}</span></div>
      <div className="bd-row"><span className="bd-l">Typeface</span><span className="bd-font"><b style={{ fontFamily: fontCss(b) }}>Aa</b>{fontOf(b)[0]}</span></div>
      <div className="bd-row col"><span className="bd-l">Colours</span><Palette4 colors={b.colors} labels /></div>
      <div className="bd-row"><span className="bd-l">Tone</span><div className="bc-tones">{b.tone.map((t) => <span key={t}>{t}</span>)}</div></div>
    </div>
  );
}

// Brand kits: a library (one kit per business), one default per project, and any node can pick another.
export function BrandModal({ brands, defaultId, onAdd, onUpdate, onRemove, onSetDefault, onClose }) {
  const [view, setView] = useState(brands.length ? 'list' : 'add'); // 'list' | 'add' | brand id
  const [url, setUrl] = useState('');
  const [step, setStep] = useState(-1);
  const [draft, setDraft] = useState(null);
  const STEPS = ['Reading the site', 'Finding the logo and type', 'Picking colours and tone'];
  const busy = step >= 0;
  const detail = brands.find((b) => b.id === view);

  const analyze = () => {
    const clean = url.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean) return;
    setStep(0);
    setTimeout(() => setStep(1), 450);
    setTimeout(() => setStep(2), 900);
    setTimeout(() => {
      const h = hash(clean);
      const hues = [h % 360, (h >> 3) % 360, (h >> 6) % 360];
      const colors = [...hues.map((x, i) => `hsl(${x} ${46 + i * 8}% ${42 + i * 8}%)`), '#f2f1eb'];
      const tones = [['Friendly', 'Upbeat', 'Clear'], ['Premium', 'Calm', 'Precise'], ['Bold', 'Playful', 'Direct'], ['Warm', 'Honest', 'Simple']][h % 4];
      const base = clean.split('.')[0].replace(/[-_]/g, ' ');
      const name = base.replace(/\b\w/g, (c) => c.toUpperCase());
      setDraft({ id: 'b' + Date.now().toString(36), url: clean, name, colors, font: BRAND_FONTS[h % BRAND_FONTS.length], tone: tones, logo: h % 3 === 0 ? null : makeLogo(h, colors[0]) });
      setStep(-1);
    }, 1350);
  };
  const resetAdd = () => { setUrl(''); setDraft(null); setStep(-1); };

  const header = (title, back) => (
    <header className="cp-h">
      {back && <button className="btn btn-icon btn-ghost btn-sm" onClick={back} aria-label="Back" data-tip="Back"><Ico as={ChevronLeft} size={16} /></button>}
      <h2>{title}</h2>
      <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close" data-tip="Close (Esc)"><Ico as={X} size={16} /></button>
    </header>
  );
  const urlForm = (onSubmit, placeholder, autoFocus) => (
    <form className={`brand-url ${busy ? 'busy' : ''}`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Ico as={Link2} size={14} />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} aria-label="Brand website" disabled={busy} autoFocus={autoFocus} />
      <button type="submit" className="btn btn-invert btn-sm" disabled={!url.trim() || busy}>{busy ? 'Analyzing' : 'Analyze'}</button>
    </form>
  );

  /* ---- add a kit: analyzing, then review ---- */
  if (view === 'add') {
    const back = brands.length ? () => { resetAdd(); setView('list'); } : null;
    return (
      <div className="cp" role="dialog" aria-label="New brand kit">
        {header(draft ? 'Review brand kit' : 'New brand kit', back)}
        <div className="cp-b">
          {!draft && urlForm(analyze, 'yourbrand.com', true)}
          {!draft && (busy ? (
            <ol className="brand-steps" aria-live="polite">
              {STEPS.map((t, i) => <li key={t} className={i < step ? 'done' : i === step ? 'now' : ''}><span className="bs-dot">{i < step ? <Ico as={Check} size={12} /> : null}</span>{t}</li>)}
            </ol>
          ) : (
            <div className="brand-ghost" aria-hidden="true">
              <p className="cp-sec">What you'll get</p>
              <div className="bg-row"><span>Logo</span><i className="bg-box" /></div>
              <div className="bg-row"><span>Type</span><b>Aa</b></div>
              <div className="bg-row"><span>Colours</span><i className="bg-bar" /></div>
              <div className="bg-row"><span>Tone</span><div className="bg-pills"><i /><i /><i /></div></div>
            </div>
          ))}
          {draft && (
            <>
              <label className="bk-rename"><span className="bd-l">Name</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Brand name" /></label>
              <BrandDetails b={draft} onLogo={(logo) => setDraft({ ...draft, logo })} />
              <div className="cp-f brand-f">
                <div className="cp-acts">
                  <button className="btn btn-secondary" onClick={resetAdd}>Discard</button>
                  <button className="btn btn-invert" disabled={!draft.name.trim()} onClick={() => { onAdd(draft); resetAdd(); setView('list'); }}>Save brand kit</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---- one kit ---- */
  if (detail) {
    const isDefault = detail.id === defaultId;
    return (
      <div className="cp" role="dialog" aria-label={detail.name}>
        {header(detail.name, () => setView('list'))}
        <div className="cp-b">
          <BrandDetails b={detail} onLogo={(logo) => onUpdate(detail.id, { logo })} />
          <label className="toggle bc-toggle">
            <span className="toggle-t"><span>Default for this project</span></span>
            <input type="checkbox" checked={isDefault} onChange={(e) => onSetDefault(e.target.checked ? detail.id : null)} /><i aria-hidden="true" />
          </label>
          <div className="cp-f brand-f">
            <button className="btn btn-ghost brand-remove" onClick={() => { onRemove(detail.id); setView(brands.length > 1 ? 'list' : 'add'); }}>Delete brand kit</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- library ---- */
  return (
    <div className="cp" role="dialog" aria-label="Brand kits">
      {header('Brand kits')}
      <div className="cp-b">
        {urlForm(() => { setView('add'); analyze(); }, 'Add a brand from its website', false)}
        <div className="bk-list" role="radiogroup" aria-label="Default brand kit for this project">
          {brands.map((b) => {
            const on = b.id === defaultId;
            return (
              <div key={b.id} className={`bk-item ${on ? 'on' : ''}`}>
                <button className="bk-open" onClick={() => setView(b.id)} aria-label={`Open ${b.name}`}>
                  <BrandMark b={b} />
                  <span className="bk-t">
                    <b style={{ fontFamily: fontCss(b) }}>{b.name}</b>
                    <span className="bk-meta"><Palette4 colors={b.colors} /><span>{fontOf(b)[0]}</span></span>
                  </span>
                </button>
                {on ? <span className="bk-def">Default</span> : <button className="btn btn-ghost btn-xs bk-set" onClick={() => onSetDefault(b.id)}>Set default</button>}
              </div>
            );
          })}
          <div className={`bk-item ${defaultId ? '' : 'on'}`}>
            <span className="bk-open static"><span className="bmark md none" aria-hidden="true" /><span className="bk-t"><b>No brand</b><span className="bk-sub">Generate without brand styling</span></span></span>
            {!defaultId ? <span className="bk-def">Default</span> : <button className="btn btn-ghost btn-xs bk-set" onClick={() => onSetDefault(null)}>Set default</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Project settings ---------------- */
export function ProjectSettings({ defaults, setDefaults, onClose, style }) {
  const set = (k, v) => setDefaults({ ...defaults, [k]: v });
  return (
    <div className="popover menu settings-pop" style={style} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Project settings">
      <h5 className="label">Project settings · applies to new nodes</h5>
      <div className="settings-body">
        <div className="field"><div className="field-l"><span>Quality</span></div><Seg options={['Draft', 'Standard', 'High']} value={defaults.quality || 'Standard'} onChange={(v) => set('quality', v)} /></div>
        <div className="field"><div className="field-l"><span>Aspect ratio</span></div><Seg options={['16:9', '9:16', '1:1', '4:5']} value={defaults.aspect} onChange={(v) => set('aspect', v)} /></div>
        <div className="field"><div className="field-l"><span>Video length</span></div><Seg options={[3, 5, 10]} fmt={(v) => `${v}s`} value={defaults.duration} onChange={(v) => set('duration', v)} /></div>
        <div className="field"><div className="field-l"><span>Resolution</span></div><Seg options={['720p', '1080p', '4K']} value={defaults.resolution || '1080p'} onChange={(v) => set('resolution', v)} /></div>
      </div>
    </div>
  );
}

/* ---------------- Share & invite ---------------- */
/* one field: email · role · Invite, all at one height */
function InviteField({ toast, people, setPeople }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Can edit');
  const [roleOpen, setRoleOpen] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const invite = () => { if (!valid) return; setPeople([...people, { email: email.trim(), role }]); toast(`Invited ${email.trim()} (prototype: no email is sent)`); setEmail(''); };
  return (
    <form className="invite2" onMouseDown={() => setRoleOpen(false)} onSubmit={(e) => { e.preventDefault(); invite(); }}>
      <input placeholder="Invite by email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" autoFocus />
      <span className="invite2-role">
        <button type="button" className="invite2-rb" onMouseDown={(e) => e.stopPropagation()} onClick={() => setRoleOpen(!roleOpen)} aria-haspopup="menu" aria-expanded={roleOpen}>{role}<Ico as={ChevronDown} size={12} /></button>
        {roleOpen && (
          <span className="invite2-menu" role="menu" onMouseDown={(e) => e.stopPropagation()}>
            {[['Can edit', 'Change nodes and generate'], ['Can view', 'See the canvas and results']].map(([r, d]) => (
              <button type="button" key={r} role="menuitemradio" aria-checked={role === r} onClick={() => { setRole(r); setRoleOpen(false); }}>
                <span><b>{r}</b><small>{d}</small></span>{role === r && <Ico as={Check} size={14} />}
              </button>
            ))}
          </span>
        )}
      </span>
      <button type="submit" className="btn btn-invert btn-sm" disabled={!valid}>Invite</button>
    </form>
  );
}

/* ---------------- Share: invite, who has access (and who is here now), copy link ---------------- */
export function PeoplePop({ style, onClose, people, setPeople, here, onGoTo, toast }) {
  const [menu, setMenu] = useState(null);
  const setRole = (email, role) => { setPeople(people.map((p) => (p.email === email ? { ...p, role } : p))); setMenu(null); };
  const remove = (email) => { setPeople(people.filter((p) => p.email !== email)); setMenu(null); toast(`Removed ${email}`); };
  const sorted = [...people].sort((a, b) => (here[b.email] ? 1 : 0) - (here[a.email] ? 1 : 0));
  return (
    <div className="popover menu people-pop" style={style} onMouseDown={(e) => { e.stopPropagation(); setMenu(null); }} role="dialog" aria-label="Share">
      <InviteField toast={toast} people={people} setPeople={setPeople} />
      <div className="pp-row">
        <span className="avatar sm">B<i className="online" /></span>
        <span className="pp-who"><b>You</b><small>Here now</small></span>
        <span className="pp-role">Owner</span>
      </div>
      {sorted.map((p) => {
        const h = here[p.email];
        return (
          <div className="pp-row" key={p.email}>
            <span className="avatar sm alt">{(p.name || p.email)[0].toUpperCase()}{h && <i className="online" />}</span>
            <span className="pp-who"><b>{p.name || p.email}</b><small>{h ? `On ${h.title}` : p.joined ? `${p.email}` : `Invited · ${p.email}`}</small></span>
            {h && <button className="pp-go" onClick={() => { onGoTo(h.id); onClose(); }} data-tip="Go to" aria-label={`Go to ${p.name || p.email}`}><Ico as={Crosshair} size={14} /></button>}
            <span className="invite2-role">
              <button type="button" className="invite2-rb pp-rb" onMouseDown={(e) => e.stopPropagation()} onClick={() => setMenu(menu === p.email ? null : p.email)} aria-haspopup="menu" aria-expanded={menu === p.email}>{p.role}<Ico as={ChevronDown} size={12} /></button>
              {menu === p.email && (
                <span className="invite2-menu" role="menu" onMouseDown={(e) => e.stopPropagation()}>
                  {['Can edit', 'Can view'].map((r) => (
                    <button type="button" key={r} role="menuitemradio" aria-checked={p.role === r} onClick={() => setRole(p.email, r)}><span><b>{r}</b></span>{p.role === r && <Ico as={Check} size={14} />}</button>
                  ))}
                  <button type="button" className="danger" onClick={() => remove(p.email)}><span><b>Remove</b></span></button>
                </span>
              )}
            </span>
          </div>
        );
      })}
      <div className="msep" />
      <button className="mitem" onClick={() => { try { navigator.clipboard.writeText(location.href).catch(() => {}); } catch (e) { /* ignore */ } toast('Link copied'); onClose(); }}>
        <span className="mitem-i"><Ico as={Copy} size={16} /></span><span className="grow">Copy link</span>
      </button>
    </div>
  );
}

/* ---------------- Preview (lightbox) ---------------- */
export function PreviewModal({ node, onClose, onTake, toast }) {
  const takes = node.data.takes || [];
  const i = Math.min(node.data.takeIdx ?? takes.length - 1, takes.length - 1);
  const t = takes[i];
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowLeft' && i > 0) onTake(i - 1);
      if (e.key === 'ArrowRight' && i < takes.length - 1) onTake(i + 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [i, takes.length]);
  if (!t) return null;
  return (
    <div className="scrim lightbox" onMouseDown={onClose}>
      <div className="lb" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Preview">
        <header className="lb-h">
          <b>{node.data.title}</b><span className="dim">Take {i + 1} of {takes.length}{t.model ? ` · ${t.model}` : ''}</span>
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => toast(`Downloaded ${node.data.title}, take ${i + 1}`)}><Ico as={Download} size={14} /> Download</button>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><Ico as={X} size={16} /></button>
        </header>
        <div className="lb-body">
          <button className="lb-nav" disabled={i === 0} onClick={() => onTake(i - 1)} aria-label="Previous take"><Ico as={ChevronLeft} size={20} /></button>
          {t.layers ? (
            <div className="layers big">{t.layers.map((l, k) => <figure key={k} className="layer"><img src={l.url} alt="" style={{ filter: l.filter }} /><figcaption>{l.name}</figcaption></figure>)}</div>
          ) : t.url ? <img className={`lb-img ${node.data.kind === 'video' ? 'vid-anim' : ''}`} src={t.url} alt="" /> : t.text ? <pre className="textout lb-text">{t.text}</pre> : <p className="dim">Audio preview</p>}
          <button className="lb-nav" disabled={i === takes.length - 1} onClick={() => onTake(i + 1)} aria-label="Next take"><Ico as={ChevronRight} size={20} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Canvas tour ---------------- */
const STEPS = [
  { sel: '.dock', title: 'Add things here', body: 'Video, image, audio and writer nodes. More holds inputs, edits, assets and your brand kit.', side: 'top' },
  { sel: '.react-flow__node', title: 'Each card is one step', body: 'Write a prompt, press Generate. Results appear at the top of the card.', side: 'right' },
  { sel: '.inplus', title: 'Feed it inputs', body: 'Hover the + on the left to add a starting image, reference video, audio and more. Or drop a wire anywhere on the card.', side: 'right', needsHover: true },
  { sel: '.zoombar', title: 'Canvas tools', body: 'Zoom, pan, lock, tidy up, undo and shortcuts live here.', side: 'top' },
];
export function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = STEPS[i];
  useLayoutEffect(() => {
    let raf;
    const tick = () => {
      const el = document.querySelector(step.sel);
      setRect(el ? el.getBoundingClientRect() : null);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);
  const pos = !rect ? { left: '50%', top: '40%', transform: 'translate(-50%,-50%)' }
    : step.side === 'top' ? { left: Math.max(16, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 316)), top: Math.max(16, rect.top - 150) }
    : { left: Math.min(rect.right + 16, window.innerWidth - 316), top: Math.max(16, rect.top) };
  return (
    <div className="tour-scrim">
      {rect && <div className="tour-ring" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className="tour-card" style={pos} role="dialog" aria-label="Tour">
        <span className="dim sm">{i + 1} of {STEPS.length}</span>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Skip</button>
          <span className="spacer" />
          {i > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn btn-invert btn-sm" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : onClose())}>{i < STEPS.length - 1 ? 'Next' : 'Done'}</button>
        </div>
      </div>
    </div>
  );
}

export const BrandIcon = Palette;
export const SparkIcon = Sparkles;
export const CheckIcon = Check;
