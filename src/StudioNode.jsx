import React, { useContext, useEffect, useLayoutEffect, useRef, useState, memo } from 'react';
import { Handle, Position, useReactFlow, useStore } from '@xyflow/react';
import { Sparkles, RotateCcw, Loader2, ChevronDown, ChevronLeft, ChevronRight, Play, Pause, Download, Expand, Clapperboard, Plus, X, Coins, Type, Image as ImageIcon, AudioLines, Ellipsis, Maximize2, Clock } from './ri.js';
import { KINDS, PORT_COLORS, costOf, secsOf, fmtSecs, fmtCr, findModel, MODELS, listItems } from './data.js';
import { assetById, waveBars, ASSETS } from './art.js';
import { Ico } from './icons.jsx';

import { StudioCtx } from './ctx.js';
export { StudioCtx };

const PORT_TOP = 22;
const PORT_ICON = { text: Type, image: ImageIcon, video: Clapperboard, audio: AudioLines };
export const PORT_ICONS = PORT_ICON;
const PortGlyph = ({ type }) => { const C = PORT_ICON[type]; return <C size={11} strokeWidth={2} aria-hidden="true" />; };

// Connection hints: while a wire is being dragged, compatible cards light up and the rest fade.
function inState(ctx, kind, selfId) {
  const c = ctx.connecting;
  if (!c) return '';
  if (c.nodeId === selfId) return '';
  if (c.from !== 'source') return 'dim';
  return kind.inputs.some((p) => p.type === c.type) ? 'glow' : 'dim';
}
function outState(ctx, type, selfId) {
  const c = ctx.connecting;
  if (!c) return '';
  if (c.from !== 'target' || c.nodeId === selfId) return 'dim';
  return c.types.includes(type) ? 'glow' : 'dim';
}

// "Brand voice: warm, playful, short sentences…" → "Brand voice: warm, playful…" (first line, ~30 chars, cut at a word)
export function textTitle(v) {
  const line = (v || '').split('\n').map((l) => l.trim()).find(Boolean);
  if (!line) return 'Text';
  if (line.length <= 30) return line;
  const cut = line.slice(0, 30);
  const at = cut.lastIndexOf(' ');
  return `${cut.slice(0, at > 12 ? at : 30).replace(/[,.;:\s]+$/, '')}…`;
}

function StudioNode({ id, data, selected }) {
  const ctx = useContext(StudioCtx);
  const rf = useReactFlow();
  const kind = KINDS[data.kind];
  const taRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const beginRename = () => { setDraft(data.title || kind.label); setRenaming(true); };
  const startRename = (e) => { e.stopPropagation(); beginRename(); };
  const commitRename = () => { const t = draft.trim(); if (t) rf.updateNodeData(id, { title: t, titleSet: true }); setRenaming(false); };
  const set = (patch) => rf.updateNodeData(id, patch);
  // keep older Text nodes ("Text 3") in step with their content, unless renamed by hand
  useEffect(() => {
    if ((data.kind === 'note' || data.kind === 'list') && !data.titleSet && data.title !== textTitle(data.prompt)) set({ title: textTitle(data.prompt) });
  }, [data.kind, data.prompt, data.titleSet]);

  useEffect(() => {
    if (data.focus && taRef.current) {
      taRef.current.focus();
      const v = taRef.current.value;
      taRef.current.setSelectionRange(v.length, v.length);
      set({ focus: false });
    }
  }, [data.focus]);
  useEffect(() => { if (data.renameReq) { beginRename(); set({ renameReq: false }); } }, [data.renameReq]);
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.max(40, ta.scrollHeight)}px`;
  }, [data.prompt]);

  const takes = data.takes || [];
  const idx = Math.min(data.takeIdx ?? takes.length - 1, takes.length - 1);
  const take = takes[idx];
  const runs = kind.runnable ? ctx.actions.runsFor(id) : 1;
  const cost = costOf(data, runs);
  const model = findModel(data.kind, data.model);
  const reason = kind.runnable ? ctx.actions.reasonFor(id) : null;
  const short = kind.runnable && cost > ctx.balance;
  const running = data.status === 'running' || data.status === 'queued';
  // The prompt changed after this result was made: show it, and promote Regenerate.
  const stale = !!take && take.src !== undefined && (data.prompt || '') !== take.src && !running;
  const outType = kind.output;
  const hasOutput = (data.kind === 'note' || data.kind === 'list') ? !!(data.prompt || '').trim() : ['upload', 'clip', 'sound'].includes(data.kind) ? true : !!take;
  const width = data.w || 320;
  const outLinked = useStore((st) => st.edges.some((e) => e.source === id));

  const openNext = (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); ctx.actions.openNext(id, r.right + 8, r.top - 8); };
  const openMore = (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); ctx.actions.openNodeMenu(id, r.left, r.bottom + 6); };

  // @ mentions: typing "@" lists nodes you can pull in; picking one wires it up.
  const onPrompt = (e) => {
    const v = e.target.value;
    // Text nodes name themselves from their first line (like a notes app) until you rename them.
    if ((data.kind === 'note' || data.kind === 'list') && !data.titleSet) set({ prompt: v, title: textTitle(v) });
    else set({ prompt: v });
    if (!kind.inputs.length) return;
    const caret = e.target.selectionStart;
    const m = /(^|\s)@([\w-]*)$/.exec(v.slice(0, caret));
    if (m) { const r = e.target.getBoundingClientRect(); ctx.actions.openMention(id, m[2], r.left, r.bottom + 6); }
    else ctx.actions.closeMention(id);
  };

  const links = ctx.actions.portLinks(id);
  const textIn = kind.inputs.filter((p) => p.type === 'text');
  const refIn = kind.inputs.filter((p) => p.type !== 'text');
  const textLinks = textIn.flatMap((p) => (links[p.id] || []).map((l) => ({ ...l, port: p.id })));
  const KIcon = kind.Icon;
  // attached inputs only; add more with the + on the left
  const anyIn = refIn.some((p) => (links[p.id] || []).length);
  // inputs live inside the box: pills for what's attached, then + to add more
  const attachEl = (anyIn || kind.inputs.length > 0) ? (
            <div className="attachments nodrag">
              {kind.inputs.length > 0 && (
                <button className={`ipadd inplus nodrag ${anyIn ? 'sq' : ''}`} onClick={() => ctx.actions.openInputs(id)} aria-label="Add an input" aria-haspopup="menu" data-tip={anyIn ? 'Add an input' : undefined}>
                  <Ico as={Plus} size={12} />{!anyIn && <span>Add input</span>}
                </button>
              )}
              {refIn.flatMap((p) => (links[p.id] || []).map((l, i, arr) => (
                <span key={l.edgeId} className="attach on" data-tip={`${p.label}${arr.length > 1 ? ` ${i + 1}` : ''}: ${l.title}`}>
                  {l.thumb ? <img src={l.thumb} alt="" /> : <span className="attach-g" style={{ '--pc': PORT_COLORS[p.type] }}><PortGlyph type={p.type} /></span>}
                  <span className="attach-t">{p.label}{arr.length > 1 ? ` ${i + 1}` : ''}</span>
                  <button className="attach-x" onClick={() => ctx.actions.detach(l.edgeId)} aria-label={`Remove ${p.label}${arr.length > 1 ? ` ${i + 1}` : ''}`}><Ico as={X} size={12} /></button>
                </span>
              )))}
            </div>) : null;
  const dropCls = kind.inputs.length ? `drop-${inState(ctx, kind, id) || 'none'}` : (ctx.connecting && ctx.connecting.nodeId !== id ? 'drop-dim' : '');

  return (
    <div className={`node k-${data.kind} ${selected ? 'is-sel' : ''} ${running ? 'is-run' : ''} ${dropCls}`} style={{ width }}>
      {/* The whole card accepts a dropped wire; inputs are routed by type or added with the + on the left. */}
      {kind.inputs.map((p) => (
        <Handle key={p.id} type="target" position={Position.Left} id={p.id} className="port-anchor" style={{ top: PORT_TOP }} isConnectable={false} />
      ))}
      {kind.inputs.length > 0 && <Handle type="target" position={Position.Left} id="in" className="port-anchor" style={{ top: PORT_TOP }} />}
      {/* One output control: a quiet dot at rest; on hover it becomes a +. Drag it to wire this result
          into another node, click it for next steps. */}
      {!kind.noOutput && (
        <>
          <Handle
            type="source" position={Position.Right} id="out"
            className={`port out ${hasOutput ? 'has-out' : ''} ${outLinked ? 'linked' : ''} ${running ? 'busy' : ''} ${outState(ctx, outType, id)}`}
            style={{ top: PORT_TOP, '--pc': PORT_COLORS[outType] }}
            onClick={hasOutput && !running ? openNext : undefined}
            aria-label={hasOutput ? `${outType} output: drag to connect, click for next steps` : `${outType} output: drag to connect`}
          >
            <Ico as={Plus} size={13} />
          </Handle>
          <span className={`plabel out ${outState(ctx, outType, id)}`} style={{ top: PORT_TOP }}>
            <b>{outType[0].toUpperCase() + outType.slice(1)}</b>{hasOutput && !running ? ' · Drag to connect · Click for next step' : ' · Drag to connect'}
          </span>
        </>
      )}

      {/* header */}
      <header className="node-h">
        <span className="node-ic"><KIcon size={16} strokeWidth={1.75} aria-hidden="true" /></span>
        {renaming ? (
          <input className="node-rename nodrag" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { e.stopPropagation(); setRenaming(false); } }}
            onFocus={(e) => e.target.select()} aria-label="Rename node" />
        ) : (
          <h3 className="node-title" onDoubleClick={startRename}>{data.title || kind.label}</h3>
        )}
        {kind.runnable && <Status status={data.status} />}
        <button className="nmore nodrag" onClick={openMore} aria-label="Node actions" aria-haspopup="menu" data-tip="Actions"><Ico as={Ellipsis} size={16} /></button>
      </header>

      {running && <div className="prog" role="progressbar" aria-valuenow={data.progress || 0}><span style={{ width: `${data.progress || 2}%` }} /></div>}

      {/* result first */}
      {data.kind === 'upload' && (
        <div className="node-o">
          <div className="media still"><img src={ctx.actions.assetUrl(data.asset)} alt="" draggable={false} /></div>
          <div className="selectwrap nodrag">
            <select value={data.asset} onChange={(e) => set({ asset: e.target.value, title: ctx.actions.assetName(e.target.value) })} aria-label="Choose image">
              {ctx.actions.allAssets().filter((a) => a.type === 'image').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <Ico as={ChevronDown} size={14} />
          </div>
        </div>
      )}
      {data.kind === 'clip' && (() => {
        const a = ctx.actions.asset(data.asset);
        return (
          <div className="node-o">
            <div className="media vid" style={{ aspectRatio: (a.aspect || '16:9').replace(':', ' / ') }}>
              <img src={a.url} alt="" draggable={false} />
              <span className="mplay" aria-hidden="true"><Ico as={Play} size={14} /></span>
              <span className="mdur num">0:{String(a.secs || 5).padStart(2, '0')}</span>
            </div>
          </div>
        );
      })()}
      {data.kind === 'sound' && (() => {
        const a = ctx.actions.asset(data.asset);
        return (
          <div className="node-o">
            <div className="audio">
              <button className="aplay nodrag" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}><Ico as={playing ? Pause : Play} size={14} /></button>
              <div className={`wave ${playing ? 'playing' : ''}`}>
                {waveBars(a.seed || 1).map((v, i) => <i key={i} style={{ height: `${v * 100}%`, animationDelay: `${i * 40}ms` }} />)}
              </div>
              <span className="num">0:{String(Math.min(59, a.secs || 5)).padStart(2, '0')}</span>
            </div>
            {a.cat && <p className="hint">{a.cat}</p>}
          </div>
        );
      })()}
      {take && (
        <div className="node-o">
          {stale && <span className="stale-tag" data-tip="Made from an earlier prompt"><i />Prompt changed</span>}
          {take.layers ? (
            <div className="layers">
              {take.layers.map((l, i) => (
                <figure key={i} className="layer"><img src={l.url} alt="" draggable={false} style={{ filter: l.filter }} /><figcaption>{l.name}</figcaption></figure>
              ))}
            </div>
          ) : (outType === 'image' || outType === 'video') && (
            <div className={`media ${outType === 'video' ? 'vid' : ''} ${playing ? 'playing' : ''} ${stale ? 'stale' : ''}`} style={{ aspectRatio: (take.aspect || '16:9').replace(':', ' / ') }} onDoubleClick={() => ctx.actions.preview(id)}>
              <img src={take.url} alt="" draggable={false} />
              {take.badge && <span className="mbadge">{take.badge}</span>}
              {outType === 'video' && (
                <button className="mplay nodrag" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}><Ico as={playing ? Pause : Play} size={16} /></button>
              )}
              {outType === 'video' && <span className="scrub"><i /></span>}
              <div className="mbar nodrag">
                {takes.length > 1 ? (
                  <span className="mtakes">
                    <button onClick={() => set({ takeIdx: Math.max(0, idx - 1) })} disabled={idx === 0} aria-label="Previous take"><Ico as={ChevronLeft} size={14} /></button>
                    <span className="num">{idx + 1}/{takes.length}</span>
                    <button onClick={() => set({ takeIdx: Math.min(takes.length - 1, idx + 1) })} disabled={idx === takes.length - 1} aria-label="Next take"><Ico as={ChevronRight} size={14} /></button>
                  </span>
                ) : <span />}
                <span className="mtools">
                  <button onClick={() => ctx.actions.preview(id)} data-tip="Preview (A)"><Ico as={Maximize2} size={14} /></button>
                  {outType === 'image' && <button onClick={() => ctx.actions.addNext(id, 'Upscale to 4K')} data-tip="Upscale"><Ico as={Expand} size={14} /></button>}
                  <button onClick={() => ctx.actions.toast(`Downloaded ${data.title || kind.label}`)} data-tip="Download"><Ico as={Download} size={14} /></button>
                </span>
                {outType === 'video' && <span className="mdur num">0:{String(take.secs || 5).padStart(2, '0')}</span>}
              </div>
            </div>
          )}
          {outType === 'text' && <pre className={`textout nowheel nodrag ${stale ? 'stale' : ''}`}>{take.text}</pre>}
          {outType === 'audio' && (
            <div className="audio">
              <button className="aplay nodrag" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}><Ico as={playing ? Pause : Play} size={14} /></button>
              <div className={`wave ${playing ? 'playing' : ''}`}>
                {waveBars(take.seed).map((v, i) => <i key={i} style={{ height: `${v * 100}%`, animationDelay: `${i * 40}ms` }} />)}
              </div>
              <span className="num">0:{String(Math.min(59, take.secs || 5)).padStart(2, '0')}</span>
            </div>
          )}
          {take.batch > 1 && <p className="hint batchnote">{take.batch} versions from this run. Use the arrows to browse.</p>}
        </div>
      )}

      {data.alert === 'credits' && (
        <div className="nalert nodrag">
          <div className="nalert-h">
            <Ico as={Coins} size={16} />
            <p><b>This needs {fmtCr(cost)} credits.</b> You have {fmtCr(ctx.balance)}.</p>
            <button className="btn btn-icon btn-ghost btn-xs" onClick={() => set({ alert: null })} aria-label="Dismiss"><Ico as={X} size={14} /></button>
          </div>
          <button className="btn btn-invert btn-sm" onClick={() => ctx.actions.openCredits(cost - ctx.balance)}>Add credits</button>
          {(() => {
            const cheap = [...(MODELS[data.kind] || [])].sort((a, b) => a.cost - b.cost)[0];
            if (!cheap || cheap.name === data.model) return null;
            return (
              <button className="btn btn-secondary btn-sm spread" onClick={() => set({ model: cheap.name, alert: null })}>
                <span>Use {cheap.name}</span><span className="num">{fmtCr(costOf({ ...data, model: cheap.name }, runs))}</span>
              </button>
            );
          })()}
        </div>
      )}

      {/* prompt / note / list / comment text */}
      {kind.placeholder && (
        <div className="node-p">
          {textLinks.length > 0 && (
            <div className="uses">
              <span className="uses-l">Uses</span>
              {textLinks.map((l) => (
                <span key={l.edgeId} className="attach on text"><span className="attach-t">{l.title}</span>
                  <button className="attach-x nodrag" onClick={() => ctx.actions.detach(l.edgeId)} aria-label={`Remove ${l.title}`}><Ico as={X} size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <textarea ref={taRef} className="node-prompt nodrag nowheel" placeholder={kind.placeholder} data-tip={kind.inputs.length ? 'Type @ to use another node' : undefined}
            value={data.prompt || ''} rows={1} onChange={onPrompt} onBlur={() => setTimeout(() => ctx.actions.closeMention(id), 150)} />
          {attachEl}
          {data.kind === 'comment' && <p className="hint">You · {new Date(data.created || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
      )}


      {!kind.placeholder && attachEl && <div className="node-o">{attachEl}</div>}

      {/* Text: one switch turns it into a list that runs connected nodes once per line */}
      {(data.kind === 'note' || data.kind === 'list') && (() => {
        const on = data.kind === 'list';
        const n = listItems(data.prompt).length;
        return (
          <footer className="node-f text-f">
            <button className={`lineswitch nodrag ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => set({ kind: on ? 'note' : 'list' })}
              data-tip={on ? 'Connected nodes run once per line' : 'Turn each line into its own run'}>
              <span className="ls-track" aria-hidden="true"><i /></span>Run once per line
            </button>
            {on && <span className="ls-n">{n} {n === 1 ? 'item' : 'items'}</span>}
          </footer>
        );
      })()}

      {/* footer: settings summary, time, one action */}
      {kind.runnable && (
        <footer className="node-f">
          <button className="chipbtn nodrag" onClick={() => ctx.actions.openInspector(id, false)} data-tip="Settings">
            <span>{[model?.name, kind.aspect && data.aspect, kind.duration && `${data.duration}s`, data.kind === 'image' && (data.count || 1) > 1 && `×${data.count}`].filter(Boolean).join(' · ')}</span>
            <Ico as={ChevronDown} size={12} />
          </button>
          <span className="spacer" />
          {running ? (
            <span className="btn btn-sm btn-busy"><Ico as={Loader2} size={14} className="spin" /> Generating</span>
          ) : reason ? (
            <span className="btn btn-sm btn-disabled" data-tip={reason}>{reason}</span>
          ) : short ? (
            <button className="btn btn-sm btn-warn nodrag" onClick={() => ctx.actions.runNode(id)} data-tip={`Needs ${fmtCr(cost)} credits`}>Add credits</button>
          ) : (
            <button className={`btn btn-sm ${take && !stale ? 'btn-secondary' : 'btn-primary'} nodrag`} onClick={() => ctx.actions.runNode(id)} data-tip={`About ${fmtSecs(secsOf(data))}${runs > 1 ? ` · ${runs} runs` : ''} (⌘↵)`}>
              {take ? 'Regenerate' : 'Generate'}{runs > 1 ? ` ×${runs}` : ''}
              <span className="cost">{fmtCr(cost)}</span>
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

function Status({ status = 'draft' }) {
  if (status === 'failed') return <span className="status bad">Failed</span>;
  if (status === 'queued') return <span className="status run"><span className="pdot" />Queued</span>;
  return null;
}

export default memo(StudioNode);
