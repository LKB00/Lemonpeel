import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles, ArrowUp, X, Check, Loader2, Bot, Settings2, GalleryHorizontalEnd, Activity, LayoutPanelTop, Archive, Palette as PaletteIcon, Map as MapIcon, CircleStop, AtSign, Zap, Ellipsis, Trash2, Crosshair, ChevronDown, Clock, Coins, Play, MousePointer2, Hand, Undo2, Redo2, Plus, Upload, ChevronLeft, ChevronRight, Archive as ArchiveIcon2, AspectRatio, ShieldCheck, RatioWide, RatioTall, RatioSquare, RatioPortrait } from './ri.js';
import { BrandMark, readMedia } from './extras.jsx';
import { KINDS, fmtCr, fmtSecs } from './data.js';
import { Ico, KindTile } from './icons.jsx';

/* =====================================================================
   LEFT · Make & bring in
   ===================================================================== */
const RAIL = [
  // Only things you make. Upload lives in Assets; "List" is a switch on Text (run once per line).
  { group: 'Generate', items: ['video', 'image', 'audio', 'writer'] },
  { group: 'Edit', items: ['edit', 'upscale', 'layers'] },
];
const SHORT = { video: 'Video', image: 'Image', audio: 'Audio', writer: 'Writer', note: 'Text', upload: 'Upload', list: 'List', comment: 'Note', edit: 'Edit', upscale: 'Upscale', layers: 'Layers' };

export function LeftRail({ actions, selectedNode, onTemplates, onAssets, onBrand, onUpload, dock, panMode, setPanMode, commentMode, onUndo, onRedo, canUndo, canRedo, view, activity, empty }) {
  // Generative and edit tools open the Create panel; plain inputs drop straight onto the canvas.
  const DIRECT = ['note', 'list', 'comment'];
  const isOn = (key) => !!dock && (key === 'upload' ? dock.type === 'assets' && dock.from === 'upload' : key === 'assets' ? dock.type === 'assets' && !dock.from : dock.type === 'create' ? dock.kind === key : dock.type === key);
  const selHasImage = selectedNode && KINDS[selectedNode.data.kind].output === 'image' && (selectedNode.data.kind === 'upload' || (selectedNode.data.takes || []).length > 0);
  const drag = (e, kind) => { e.dataTransfer.setData('application/lp', JSON.stringify({ kind })); e.dataTransfer.effectAllowed = 'move'; };
  return (
    <nav className="rail" aria-label="Tools and add to canvas">
      {/* canvas tools first, as in most canvas apps */}
      <div className="rail-g" role="group" aria-label="Tools">
        {!empty && (<>
        <button className={`rail-b tool ${!panMode && !commentMode ? 'on' : ''}`} onClick={() => setPanMode(false)} aria-pressed={!panMode} aria-label="Select" data-tip="Select (V)"><Ico as={MousePointer2} size={16} /></button>
        <button className={`rail-b tool ${panMode ? 'on' : ''}`} onClick={() => setPanMode(true)} aria-pressed={!!panMode} aria-label="Pan" data-tip="Pan (H)"><Ico as={Hand} size={16} /></button>
        </>)}
        {(() => { const C = KINDS.note.Icon; return (
          <button className="rail-b" draggable onDragStart={(e) => drag(e, 'note')} onClick={() => actions.addFromPanel('note')} aria-label="Text" data-tip="Text"><C size={18} aria-hidden="true" /></button>
        ); })()}
      </div>
      {RAIL.filter((g) => g.group !== 'Edit' || selHasImage).map((g) => (
        <div key={g.group} className="rail-g" role="group" aria-label={g.group}>
          {g.items.map((k) => {
            const off = KINDS[k].needsImage && !selHasImage;
            const C = KINDS[k].Icon;
            return (
              <button key={k} className={`rail-b ${off ? 'off' : ''} ${isOn(k) ? 'on' : ''}`} draggable={!off} onDragStart={(e) => drag(e, k)}
                aria-pressed={isOn(k)}
                onClick={() => (off ? actions.toast('Select an image result first, then use this edit') : DIRECT.includes(k) ? actions.addFromPanel(k) : k === 'upload' ? onUpload() : actions.openCreate(k))}
                aria-label={KINDS[k].label} data-tip={off ? `${KINDS[k].label} · select an image first` : KINDS[k].label}>
                <C size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ))}
      <div className="rail-g" role="group" aria-label="Library">
        <button className={`rail-b ${isOn('assets') ? 'on' : ''}`} onClick={onAssets} aria-label="Assets" data-tip="Assets"><Ico as={Archive} size={18} /></button>
        <button className={`rail-b ${isOn('brand') ? 'on' : ''}`} onClick={onBrand} aria-label="Brand kit" data-tip="Brand kit"><Ico as={PaletteIcon} size={18} /></button>
        <button className={`rail-b ${isOn('templates') ? 'on' : ''}`} onClick={onTemplates} aria-label="Templates" data-tip="Templates"><Ico as={LayoutPanelTop} size={18} /></button>
      </div>
      {/* history: always within reach */}
      {!empty && (
      <div className="rail-g" role="group" aria-label="History">
        <button className="rail-b" onClick={onUndo} disabled={!canUndo} aria-label="Undo" data-tip="Undo (⌘Z)"><Ico as={Undo2} size={16} /></button>
        <button className="rail-b" onClick={onRedo} disabled={!canRedo} aria-label="Redo" data-tip="Redo (⌘⇧Z)"><Ico as={Redo2} size={16} /></button>
      </div>
      )}
      {/* view: zoom, lock, minimap, runs, more (was the bottom bar) */}
      {view && <div className="rail-g" role="group" aria-label="View">{view}</div>}
      {activity && <div className="rail-g" role="group" aria-label="Activity">{activity}</div>}
    </nav>
  );
}

/* =====================================================================
   BOTTOM · Direct with words
   ===================================================================== */
export function AskBar({ selection, onAsk, busy, onFocusAgent }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      const t = e.target;
      const typing = t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
      if (!typing && (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const target = selection.length === 0 ? 'Whole canvas' : selection.length === 1 ? (selection[0].data.title || KINDS[selection[0].data.kind].label) : `${selection.length} nodes`;
  const placeholder = selection.length === 0
    ? 'Describe what you want to make'
    : 'What should change?';
  const send = () => { const v = text.trim(); if (!v) return; onAsk(v); setText(''); };
  return (
    <div className="askbar" role="search">
      <button className={`ask-target ${selection.length ? 'sel' : ''}`} onClick={onFocusAgent} >
        {selection.length === 1 && <KindTile kind={selection[0].data.kind} size="sm" />}
        <span>{target}</span>
      </button>
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') e.currentTarget.blur(); }}
        placeholder={placeholder}
        aria-label="Ask Lemonpeel"
      />
      <kbd className="ask-kbd">⌘K</kbd>
      <button className="btn btn-invert btn-icon send" onClick={send} disabled={!text.trim() || busy} aria-label="Send to Lemonpeel">
        {busy ? <Ico as={Loader2} size={16} className="spin" /> : <Ico as={ArrowUp} size={18} />}
      </button>
    </div>
  );
}

export function RunStatus({ runs, onOpen, minimap, setMinimap }) {
  const active = runs.filter((r) => r.status === 'running' || r.status === 'queued');
  return (
    <div className="runstatus">
      <button className={`btn btn-ghost btn-xs ${active.length ? 'live' : ''}`} onClick={onOpen} data-tip="Runs">
        {active.length ? <><span className="pdot" /> {active.length} running</> : <><Ico as={Activity} size={14} /> {runs.length ? `${runs.length} run${runs.length > 1 ? 's' : ''}` : 'No runs yet'}</>}
      </button>
      <span className="zsep" />
      <button className={`btn btn-icon btn-ghost btn-xs ${minimap ? 'active' : ''}`} onClick={() => setMinimap(!minimap)} aria-label="Minimap" data-tip="Minimap"><Ico as={MapIcon} size={14} /></button>
    </div>
  );
}

/* =====================================================================
   RIGHT · Details & results
   ===================================================================== */
// The top bar opens each panel (Ask → Agent, gallery icon → Outputs), so the panel just names itself.
export function RightTabs({ tab, counts, onClose, actions }) {
  const title = { agent: 'Agent', outputs: 'Outputs', comments: 'Comments', settings: 'Settings' }[tab] || '';
  return (
    <div className="rtabs">
      <h2 className="rtitle">{title}{counts[tab] ? <span className="count">{counts[tab]}</span> : null}</h2>
      <span className="spacer" />
      {actions}
      <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close panel" data-tip="Close"><Ico as={X} size={16} /></button>
    </div>
  );
}

export function AgentPanel({ onRevert, composer, messages, auto, setAuto, onApprove, onDiscard, onAsk, onClear, onToggleStep, balance, nodeInfo, onFocusNode, selection, suggestions, onAnswer, onFinal, onRetake }) {
  const end = useRef(null);
  const [open, setOpen] = useState({});
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length, messages[messages.length - 1]]);
  const lastPlan = [...messages].reverse().find((m) => m.proposal)?.id;
  return (
    <div className="agent">
      <div className="agent-feed">
        {!messages.length && (
          <div className="agent-empty">
            <p className="agent-hello">What should we make? Describe a result and I'll lay out the steps on the canvas. Select a node first to change just that one.</p>
            <span className="label">Try</span>
            {suggestions.map((x) => (
              <button key={x.text} className="suggest" onClick={() => onAsk(x.text, x.targets)}>
                <Ico as={x.icon || Sparkles} size={14} /><span>{x.text}</span>
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="msg user">
                {m.target && m.target !== 'Whole canvas' && <span className="msg-target"><Ico as={Crosshair} size={11} />{m.target}</span>}
                <p className="bubble">{m.text}</p>
              </div>
            );
          }
          if (m.thinking) return (
            <div key={m.id} className="msg agent">
              <span className="agent-av sm"><Ico as={Sparkles} size={12} /></span>
              {m.trace ? (
                <ol className="trace" aria-live="polite">
                  {m.trace.map((t, i) => <li key={i} style={{ '--d': `${i * 380}ms`, '--e': `${(i + 1) * 380}ms` }}><span className="trace-i"><Ico as={Loader2} size={12} className="spin" /><Ico as={Check} size={12} /></span>{t}</li>)}
                </ol>
              ) : <span className="typing"><i /><i /><i /></span>}
            </div>
          );
          const p = m.proposal;
          const collapsed = p && p.status !== 'pending' && m.id !== lastPlan && !open[m.id];
          return (
            <div key={m.id} className="msg agent">
              <span className="agent-av sm"><Ico as={Sparkles} size={12} /></span>
              <div className="agent-msg">
                {collapsed ? (
                  <button className="plan-collapsed" onClick={() => setOpen({ ...open, [m.id]: true })}>
                    <Ico as={p.status === 'discarded' ? X : Check} size={14} />
                    <span className="grow">{p.status === 'discarded' ? 'Discarded' : p.kind === 'build' ? 'Built' : 'Changed'} {p.steps.filter((s, i) => !(p.off || []).includes(i)).length} step{p.steps.length > 1 ? 's' : ''}{p.ran ? ` · ${fmtCr(activeCost(p))} credits` : ''}</span>
                    <Ico as={ChevronDown} size={14} />
                  </button>
                ) : (
                  <>
                    {m.text && <p>{m.text}</p>}
                    {m.applied && (
                      <div className={`applied ${m.applied.reverted ? 'reverted' : ''}`}>
                        <div className="applied-h"><Ico as={m.applied.reverted ? X : Check} size={14} /><span className="grow">{m.applied.reverted ? `Undone · ${m.applied.title}` : `Wrote ${m.applied.title}`}</span></div>
                        {!m.applied.reverted && <p className="applied-t">{m.applied.after}</p>}
                        <div className="applied-f">
                          <button className="btn btn-ghost btn-sm" onClick={() => onFocusNode(m.applied.nodeId)}>Show</button>
                          {!m.applied.reverted && <button className="btn btn-ghost btn-sm" onClick={() => onRevert(m.id)}>Undo</button>}
                        </div>
                      </div>
                    )}
                    {m.brief && <Brief b={m.brief} onAnswer={(v) => onAnswer(m.id, v)} />}
                    {p && <Plan p={p} id={m.id} onFinal={onFinal} onRetake={onRetake} auto={auto} setAuto={setAuto} isLast={m.id === lastPlan} onApprove={onApprove} onDiscard={onDiscard} onToggleStep={onToggleStep} balance={balance} nodeInfo={nodeInfo} onFocusNode={onFocusNode} onAsk={onAsk} />}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <Composer selection={selection} onAsk={onAsk} auto={auto} setAuto={setAuto} ctx={composer} />
    </div>
  );
}

const activeCost = (p) => p.steps.reduce((s, x, i) => s + ((p.off || []).includes(i) ? 0 : x.cost), 0);
const activeSecs = (p) => p.steps.reduce((s, x, i) => s + ((p.off || []).includes(i) ? 0 : x.secs || 0), 0);

function Plan({ p, id, auto, setAuto, isLast, onApprove, onDiscard, onToggleStep, balance, nodeInfo, onFocusNode, onAsk, onFinal, onRetake }) {
  const cost = activeCost(p);
  const short = cost > balance;
  const off = p.off || [];
  const tracking = p.status === 'approved' && (p.tracked?.length || 0) > 0;
  const infos = tracking ? p.tracked.map((t) => ({ ...t, info: nodeInfo(t.nodeId, t.base) })) : [];
  const phaseOf = (i) => p.steps[i]?.phase;
  const inDraft = tracking && p.phase === 'draft';
  const draftInfos = infos.filter((t) => phaseOf(t.step) !== 'final');
  const draftDone = inDraft && draftInfos.every((t) => !t.info || t.info.done);
  const done = tracking && !inDraft && infos.every((t) => !t.info || t.info.done);
  const shown = inDraft ? draftInfos : infos;
  const runningIdx = shown.findIndex((t) => t.info && t.info.status === 'running');
  const draftCost = p.steps.reduce((a, x, i) => a + (off.includes(i) || x.phase === 'final' ? 0 : x.cost), 0);
  const finalCost = p.steps.reduce((a, x, i) => a + (off.includes(i) || x.phase !== 'final' ? 0 : x.cost), 0);
  const firstFinal = p.phased ? p.steps.findIndex((x) => x.phase === 'final') : -1;
  const hasVideo = p.steps.some((x, i) => x.phase === 'final' && x.kind === 'video' && !off.includes(i));
  const looks = draftDone ? draftInfos.filter((t) => t.info?.thumb && p.steps[t.step].kind === 'image') : [];
  const card = useRef(null);
  useEffect(() => { if (isLast && (draftDone || done)) setTimeout(() => card.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 60); }, [draftDone, done]);
  const result = done ? [...infos].reverse().find((t) => t.info && t.info.thumb) || infos[infos.length - 1] : null;

  return (
    <div ref={card} className={`plancard s-${p.status}`}>
      <div className="plancard-h">
        <span>{p.kind === 'build' ? `Plan · ${p.steps.length - off.length} step${p.steps.length - off.length === 1 ? '' : 's'}` : 'Change'}</span>
        {tracking ? <span className={`pill ${done || draftDone ? 'ok' : 'run'}`}>{done ? <><Ico as={Check} size={12} /> Done</> : draftDone ? <><Ico as={Check} size={12} /> Draft ready</> : <><span className="pdot" /> {inDraft ? 'Draft · ' : ''}{runningIdx >= 0 ? `Step ${runningIdx + 1} of ${shown.length}` : 'Queued'}</>}</span>
          : p.status === 'approved' ? <span className="pill ok"><Ico as={Check} size={12} /> Added</span>
          : p.status === 'discarded' ? <span className="pill">Discarded</span> : null}
      </div>
      <ol className="plan">
        {p.steps.map((s, i) => {
          const t = tracking ? infos.find((x) => x.step === i) : null;
          const inf = t?.info;
          const excluded = off.includes(i);
          const waiting = inDraft && s.phase === 'final' && !(inf && (inf.status === 'running' || inf.status === 'queued'));
          return (
            <React.Fragment key={i}>
            {i === firstFinal && <li className="plan-sep">{p.status === 'pending' ? 'After you check the draft' : 'Final'}<span className="num">{fmtCr(finalCost)}</span></li>}
            <li className={`${excluded ? 'excluded' : ''} ${waiting ? 'waiting' : ''}`}>
              {p.status === 'pending' ? (
                <label className="stepcheck" data-tip={excluded ? 'Include this step' : 'Skip this step'}>
                  <input type="checkbox" checked={!excluded} onChange={() => onToggleStep(id, i)} /><i aria-hidden="true"><Ico as={Check} size={11} /></i>
                </label>
              ) : inf?.thumb ? <img className="stepthumb" src={inf.thumb} alt="" /> : <KindTile kind={s.kind} size="sm" />}
              <button className="grow steptext" onClick={() => t && onFocusNode(t.nodeId)} disabled={!t}>
                <b>{s.title}</b><span>{s.note}</span>
              </button>
              <span className="stepstate">
                {excluded && p.status !== 'pending' ? <span className="dim">Skipped</span> : waiting ? <span className="dim">After review</span> : inf ? (inf.done ? <Ico as={Check} size={14} className="okc" /> : inf.status === 'running' ? <span className="num">{inf.progress || 0}%</span> : inf.status === 'queued' ? <span className="dim">Queued</span> : <span className="dim">—</span>)
                  : s.cost ? <span className="num dim">{fmtCr(s.cost)}</span> : <span className="dim">free</span>}
              </span>
            </li>
            </React.Fragment>
          );
        })}
      </ol>
      {draftDone && (
        <div className="checkpoint">
          {looks.length > 0 && (
            <div className="cp-looks">
              {looks.map((t) => <button key={t.nodeId} className="cp-look" onClick={() => onFocusNode(t.nodeId)} aria-label={`Open ${t.info.title}`}><img src={t.info.thumb} alt="" /></button>)}
            </div>
          )}
          <p className="cp-q">Happy with the draft? {hasVideo ? 'The video uses it as its first frame.' : 'The rest builds on it.'}</p>
          <div className="cp-acts">
            {looks.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => onRetake(id)}>Try another look</button>}
            <button className={`btn btn-sm ${finalCost > balance ? 'btn-warn' : 'btn-invert'}`} onClick={() => onFinal(id)}>
              {finalCost > balance ? 'Add credits' : hasVideo ? 'Make the video' : 'Finish'}<span className="cost">{fmtCr(finalCost)}</span>
            </button>
          </div>
        </div>
      )}
      {p.status === 'pending' && (
        <div className="plan-f">
          {activeSecs(p) > 0 ? <span className="dim"><Ico as={Clock} size={12} /> {fmtSecs(activeSecs(p))}</span> : <span />}
          <span className="plan-acts">
            <button className="btn btn-ghost btn-sm" onClick={() => onDiscard(id)}>Discard</button>
            {p.kind === 'build' && <button className="btn btn-ghost btn-sm" onClick={() => onApprove(id, false)} data-tip="Add to canvas, don't generate">Add only</button>}
            {p.phased && draftCost > 0 && finalCost > 0 ? (
              <button className={`btn btn-sm ${draftCost > balance ? 'btn-warn' : 'btn-invert'}`} onClick={() => onApprove(id, true, undefined, 'draft')}>
                {draftCost > balance ? 'Add credits' : 'Make the draft'}<span className="cost">{fmtCr(draftCost)}</span>
              </button>
            ) : (
            <button className={`btn btn-sm ${short ? 'btn-warn' : 'btn-invert'}`} onClick={() => onApprove(id, true)} disabled={!p.steps.length || off.length === p.steps.length}>
              {short ? 'Add credits' : cost > 0 ? 'Generate' : 'Apply'}{cost > 0 && <span className="cost">{fmtCr(cost)}</span>}
            </button>
            )}
          </span>
        </div>
      )}
      {done && result?.info && (
        <div className="planresult">
          {result.info.thumb && <button className="resultthumb" onClick={() => onFocusNode(result.nodeId)}><img src={result.info.thumb} alt="" />{result.info.kind === 'video' && <span className="oplay"><Ico as={Play} size={12} /></span>}</button>}
          <p className="dim">Done{result.info.title ? `: ${result.info.title}` : ''}. Next you could:</p>
          <div className="followups">
            {followUps(result.info).map((f) => <button key={f} className="startchip" onClick={() => onAsk(f, [result.nodeId])}>{f}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick questions before planning: answers are pre-picked from the prompt, so Continue always works.
function Brief({ b, onAnswer }) {
  const [v, setV] = useState(() => Object.fromEntries(b.fields.map((f) => [f.key, f.value])));
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  if (b.status !== 'pending') {
    const vals = b.values || v;
    const parts = b.fields.map((f) => (f.type === 'text' ? null : f.options.find((o) => o.id === vals[f.key])?.label)).filter(Boolean);
    return <div className="brief-done"><Ico as={Check} size={12} /><span>{parts.join(' · ')}</span></div>;
  }
  return (
    <div className="brief">
      {b.fields.map((f) => (
        <div key={f.key} className="brief-q">
          <span className="brief-l">{f.label}</span>
          {f.type === 'asset' && (
            <div className="brief-assets" role="radiogroup" aria-label={f.label}>
              {f.options.map((o) => (
                <button key={o.id} role="radio" aria-checked={v[f.key] === o.id} className={`brief-asset ${v[f.key] === o.id ? 'on' : ''}`} onClick={() => set(f.key, o.id)} data-tip={o.label}>
                  {o.thumb ? <img src={o.thumb} alt="" /> : <span className="brief-none"><Ico as={X} size={14} /></span>}
                  {v[f.key] === o.id && <i className="brief-tick"><Ico as={Check} size={10} /></i>}
                </button>
              ))}
            </div>
          )}
          {f.type === 'chips' && (
            <div className="brief-chips" role="radiogroup" aria-label={f.label}>
              {f.options.map((o) => <button key={o.id} role="radio" aria-checked={v[f.key] === o.id} className={`brief-chip ${v[f.key] === o.id ? 'on' : ''}`} onClick={() => set(f.key, o.id)}>{o.label}</button>)}
            </div>
          )}
          {f.type === 'text' && <textarea className="brief-ta" rows={2} value={v[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} />}
        </div>
      ))}
      <div className="brief-f">
        <button className="btn btn-invert btn-sm" onClick={() => onAnswer(v)}>Continue</button>
      </div>
    </div>
  );
}

function followUps(info) {
  if (info.kind === 'video') return ['Make a 9:16 version', 'Add music', 'Try a cheaper model'];
  if (info.kind === 'image') return ['Animate it', '3 more variations', 'Upscale to 4K'];
  if (info.kind === 'audio') return ['Try a cheaper model'];
  if (info.kind === 'writer') return ['Turn into voice-over'];
  return [];
}

const FORMATS = ['16:9', '9:16', '1:1', '4:5'];

// One option row, shared with the brand picker in the Create panels: icon tile · label · tag · check
function Opt({ icon, raw, label, sub, tag, on, dim, more, disabled, onClick }) {
  return (
    <button type="button" className={`bopt ${on ? 'on' : ''} ${dim ? 'dim' : ''} ${sub ? 'tall' : ''}`} role={on != null ? 'menuitemradio' : 'menuitem'} aria-checked={on != null ? !!on : undefined} disabled={disabled} onClick={onClick}>
      {raw ? icon : <span className="bpick-none">{icon}</span>}
      <span className="grow">{sub ? <><b>{label}</b><small>{sub}</small></> : label}</span>
      {tag && <small>{tag}</small>}
      {more && <Ico as={ChevronRight} size={14} className="dim" />}
      {on && <Ico as={Check} size={14} />}
    </button>
  );
}

// A quiet pill that opens a small menu upward (the composer sits at the bottom of the panel)
function Pill({ label, icon, open, setOpen, name, children, tip }) {
  const wrap = useRef(null);
  const [alignRight, setAlignRight] = useState(false);
  useLayoutEffect(() => {
    if (open !== name || !wrap.current) return;
    const edge = wrap.current.closest('aside, .composer2')?.getBoundingClientRect().right ?? window.innerWidth;
    setAlignRight(wrap.current.getBoundingClientRect().left + 248 > edge - 8);
  }, [open, name]);
  return (
    <span className="cpill-wrap" ref={wrap}>
      <button type="button" className={`cpill ${label == null ? 'sq' : ''} ${open === name ? 'on' : ''}`} onClick={() => setOpen(open === name ? null : name)} aria-haspopup="menu" aria-expanded={open === name} data-tip={tip}>
        {icon}{label != null && <span className="cpill-t">{label}</span>}{label != null && <Ico as={ChevronDown} size={12} className="cpill-c" />}
      </button>
      {open === name && <div className={`popover bpick-pop cpill-menu ${alignRight ? 'right' : ''}`} role="menu" onMouseDown={(e) => e.stopPropagation()}>{children}</div>}
    </span>
  );
}

export function Composer({ selection, onAsk, auto, setAuto, ctx, kinds, kind, setKind, autoFocus = true }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  const file = useRef(null);
  const box = useRef(null);
  // the selection is context only when something is selected; × detaches it until the selection changes
  const key = selection.map((n) => n.id).join(',');
  const [detached, setDetached] = useState('');
  const sel = selection.length > 0 && detached !== key;
  const [att, setAtt] = useState([]);            // [{ src: 'asset'|'node', id, name, thumb, kind }]
  const [aspect, setAspect] = useState(ctx.defaultAspect);
  const [brand, setBrand] = useState(ctx.defaultBrand || 'none');
  const [open, setOpen] = useState(null);         // which pill menu is open
  const [addView, setAddView] = useState('root'); // + menu: root | assets | canvas
  const [listTab, setListTab] = useState(() => { try { return localStorage.getItem('lp-asset-type') || 'image'; } catch { return 'image'; } });
  const pickTab = (k) => { setListTab(k); if (k !== 'text') { try { localStorage.setItem('lp-asset-type', k); } catch { /* private mode */ } } };
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!box.current?.contains(e.target)) setOpen(null); };
    const k = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', h, true); window.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h, true); window.removeEventListener('keydown', k); };
  }, [open]);
  useEffect(() => { if (open !== 'add') setAddView('root'); }, [open]);
  useLayoutEffect(() => {
    const ta = ref.current; if (!ta) return;
    ta.style.height = '0px'; ta.style.height = `${Math.min(140, Math.max(24, ta.scrollHeight))}px`;
  }, [text]);
  const target = selection.length === 1 ? (selection[0].data.title || KINDS[selection[0].data.kind].label) : `${selection.length} nodes`;
  const attach = (it) => { setAtt((a) => (a.some((x) => x.src === it.src && x.id === it.id) ? a : [...a, it].slice(0, 6))); setOpen(null); ref.current?.focus(); };
  const upload = (files) => [...files].forEach((f) => readMedia(f, (m) => { const a = ctx.addAsset(m); attach({ src: 'asset', id: a.id, name: a.name, thumb: a.url, type: a.type }); }));
  const send = () => {
    const v = text.trim(); if (!v) return;
    onAsk(v, { ...(sel ? {} : { whole: true }), attach: att, aspect, brand });
    setText(''); setAtt([]);
  };
  // with one node in context, Format and Brand show that node's values (and hide when they don't apply)
  const node = sel && selection.length === 1 ? selection[0] : null;
  const nk = node ? KINDS[node.data.kind] : null;
  const showFormat = nk ? !!nk.aspect : kinds ? !!KINDS[kind]?.aspect : true;
  const showBrand = !nk || (nk.runnable && !['upscale', 'layers'].includes(node.data.kind));
  const free = useRef({ aspect, brand });
  useEffect(() => {
    if (node) {
      if (nk.aspect && node.data.aspect) setAspect(node.data.aspect);
      if (showBrand) setBrand(node.data.brand || ctx.defaultBrand || 'none');
    } else { setAspect(free.current.aspect); setBrand(free.current.brand); }
  }, [node?.id, node?.data.aspect, node?.data.brand]);
  const pickAspect = (v) => { setAspect(v); if (!node) free.current.aspect = v; };
  const pickBrand = (v) => { setBrand(v); if (!node) free.current.brand = v; };
  const curBrand = ctx.brands.find((b) => b.id === brand);
  return (
    <div className="composer2" ref={box}>
      <div className="composer2-box" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); ref.current?.focus(); } }}>
        {(sel || att.length > 0) && (
          <div className="ctx-row">
            {sel && (
              <span className="ctx-pill">
                {selection.length === 1 ? <KindTile kind={selection[0].data.kind} size="xs" /> : <Ico as={Crosshair} size={12} />}
                <span className="ctx-t">{target}</span>
                <button className="ctx-x" onClick={() => { setDetached(key); ref.current?.focus(); }} aria-label={`Remove ${target}`} data-tip="Remove"><Ico as={X} size={12} /></button>
              </span>
            )}
            {att.map((a) => (
              <span key={a.src + a.id} className="ctx-pill">
                {a.thumb ? <img className="ctx-th" src={a.thumb} alt="" /> : a.kind ? <KindTile kind={a.kind} size="xs" /> : <span className="ctx-th" />}
                <span className="ctx-t">{a.name}</span>
                <button className="ctx-x" onClick={() => setAtt((x) => x.filter((y) => y !== a))} aria-label={`Remove ${a.name}`} data-tip="Remove"><Ico as={X} size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="composer2-top">
          <textarea ref={ref} autoFocus={autoFocus} rows={1} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={sel ? 'What should change?' : kinds ? ({ video: 'Describe the video you want…', image: 'Describe the image you want…', audio: 'Describe the voice, music or sound…', writer: 'What should the script say?' }[kind] || 'Describe it…') : 'Describe what you want to make…'} aria-label="Message the agent" />
          <button className="btn btn-invert btn-icon send" onClick={send} disabled={!text.trim()} aria-label="Send"><Ico as={ArrowUp} size={16} /></button>
        </div>
        <div className="composer2-row">
          <Pill name="add" open={open} setOpen={setOpen} icon={<Ico as={Plus} size={14} />} tip="Attach">
            {addView === 'root' && (<>
              <Opt icon={<Ico as={Upload} size={12} />} label="Upload from computer" onClick={() => file.current?.click()} />
              <Opt icon={<Ico as={ArchiveIcon2} size={12} />} label="From Assets" onClick={() => setAddView('assets')} disabled={!ctx.assets.length} more />
              <Opt icon={<Ico as={Crosshair} size={12} />} label="From the canvas" onClick={() => setAddView('canvas')} disabled={!ctx.nodes.length} more />
            </>)}
            {addView !== 'root' && (<>
              <Opt icon={<Ico as={ChevronLeft} size={12} />} label={addView === 'assets' ? 'Assets' : 'On the canvas'} onClick={() => setAddView('root')} dim />
              <div className="msep" />
              <div className="cpill-list">
                {(() => {
                  // same type tabs as the Assets library (and it remembers the last one)
                  const items = addView === 'assets'
                    ? ctx.assets.map((a) => ({ src: 'asset', id: a.id, name: a.name, thumb: a.type === 'audio' ? null : a.url, t: a.type === 'video' ? 'video' : a.type === 'audio' ? 'audio' : 'image', kind: a.type === 'audio' ? 'audio' : a.type === 'video' ? 'video' : 'image' }))
                    : ctx.nodes.map((n) => { const o = KINDS[n.kind]?.output || 'image'; return { src: 'node', id: n.id, name: n.title, thumb: o === 'image' || o === 'video' ? n.thumb : null, t: o, kind: n.kind }; });
                  const TABS = [['image', 'Images'], ['video', 'Video'], ['audio', 'Audio'], ...(addView === 'canvas' ? [['text', 'Text']] : [])].filter(([k]) => addView === 'assets' || items.some((it) => it.t === k));
                  const cur = TABS.some(([k]) => k === listTab) ? listTab : TABS[0]?.[0];
                  const list = items.filter((it) => it.t === cur);
                  return (<>
                    <div className="seg as-types cpill-tabs" role="tablist">
                      {TABS.map(([k, l]) => (
                        <button key={k} role="tab" aria-selected={cur === k} className={cur === k ? 'on' : ''} onClick={() => pickTab(k)}>{l}<span className="as-n">{items.filter((it) => it.t === k).length}</span></button>
                      ))}
                    </div>
                    <div className="cpill-scroll">
                      {list.length ? list.map((it) => (
                        <Opt key={it.id} raw icon={it.thumb ? <img className="bopt-th" src={it.thumb} alt="" /> : <KindTile kind={it.kind} size="xs" />} label={it.name} onClick={() => attach(it)} />
                      )) : <p className="cpill-empty">Nothing here yet</p>}
                    </div>
                  </>);
                })()}
              </div>
            </>)}
          </Pill>
          <input ref={file} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
          {kinds && (
            <Pill name="kind" open={open} setOpen={setOpen} label={kind === 'writer' ? 'Script' : KINDS[kind].label} icon={<KindTile kind={kind} size="xs" />} tip="What to make">
              {kinds.map((k) => <Opt key={k} raw icon={<KindTile kind={k} size="xs" />} label={k === 'writer' ? 'Script' : KINDS[k].label} on={kind === k} onClick={() => { setKind(k); setOpen(null); ref.current?.focus(); }} />)}
            </Pill>
          )}
          {showFormat && <Pill name="format" open={open} setOpen={setOpen} label={aspect} icon={<Ico as={AspectRatio} size={14} />} tip="Format">
            {FORMATS.map((f) => <Opt key={f} icon={<Ico as={{ '16:9': RatioWide, '9:16': RatioTall, '1:1': RatioSquare, '4:5': RatioPortrait }[f]} size={12} />} label={f} on={aspect === f} onClick={() => { pickAspect(f); setOpen(null); }} />)}
          </Pill>}
          {showBrand && <Pill name="brand" open={open} setOpen={setOpen} label={curBrand ? curBrand.name : 'No brand'} icon={curBrand ? <BrandMark b={curBrand} size="xs" /> : <span className="bpick-none"><Ico as={PaletteIcon} size={12} /></span>} tip="Brand kit">
            {ctx.brands.map((b) => <Opt key={b.id} icon={<BrandMark b={b} size="xs" />} raw label={b.name} tag={b.id === ctx.defaultBrand ? 'Default' : null} on={brand === b.id} onClick={() => { pickBrand(b.id); setOpen(null); }} />)}
            <Opt icon={<Ico as={PaletteIcon} size={12} />} label="No brand" on={brand === 'none'} onClick={() => { pickBrand('none'); setOpen(null); }} />
            <div className="msep" />
            <Opt icon={<Ico as={Plus} size={12} />} label={ctx.brands.length ? 'Manage brand kits' : 'Add a brand kit'} dim onClick={() => { setOpen(null); ctx.onManageBrands(); }} />
          </Pill>}
          <Pill name="mode" open={open} setOpen={setOpen} label={auto ? 'Auto-run' : 'Ask first'} icon={<Ico as={auto ? Zap : ShieldCheck} size={14} />} tip="Before spending credits">
            <Opt icon={<Ico as={ShieldCheck} size={12} />} label="Ask first" sub="Show the plan and cost before generating" on={!auto} onClick={() => { setAuto(false); setOpen(null); }} />
            <Opt icon={<Ico as={Zap} size={12} />} label="Run automatically" sub="Generate right away" on={auto} onClick={() => { setAuto(true); setOpen(null); }} />
          </Pill>
        </div>
      </div>
    </div>
  );
}

export function RunsPanel({ runs, onCancel, onFocus }) {
  if (!runs.length) return <div className="runs-empty">Nothing generated yet</div>;
  // live work first, then newest
  const live = (r) => (r.status === 'running' || r.status === 'queued' ? 1 : 0);
  const list = [...runs].reverse().sort((a, b) => live(b) - live(a));
  return (
    <div className="runs-body">
      <ol className="runs">
        {list.map((r) => (
          <li key={r.id} className={`run s-${r.status}`}>
            <button className="run-main" onClick={() => onFocus(r.nodeId)}>
              <KindTile kind={r.kind} size="sm" />
              <span className="grow"><b>{r.title}</b><span>{r.model} · {new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
            </button>
            <span className="run-s">
              {r.status === 'running' && <><span className="num">{r.progress || 0}%</span><button className="btn btn-icon btn-ghost btn-xs" onClick={() => onCancel(r.id)} aria-label="Cancel run" data-tip="Cancel and refund"><Ico as={CircleStop} size={14} /></button></>}
              {r.status === 'queued' && <span className="dim">Queued</span>}
              {r.status === 'done' && <span className="num">{fmtCr(r.cost)}</span>}
              {r.status === 'cancelled' && <span className="dim">Cancelled · refunded</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export const AtIcon = AtSign;

// Prototype only: switch between a first visit (empty project) and a project already in progress.
const VIEWS = [{ id: 'new', label: 'New user' }, { id: 'sample', label: 'Returning user' }];
export function ViewAs({ value, onPick }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down, true); document.removeEventListener('keydown', key); };
  }, [open]);
  const cur = VIEWS.find((v) => v.id === value) || VIEWS[0];
  return (
    <div className="viewas" ref={wrap}>
      {open && (
        <div className="popover menu viewas-pop" role="menu">
          <h6 className="pmenu-label">View the prototype as</h6>
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={`bopt ${v.id === cur.id ? 'on' : ''}`} role="menuitemradio" aria-checked={v.id === cur.id} onClick={() => { setOpen(false); onPick(v.id); }}>
              <span className="grow">{v.label}</span>
              {v.id === cur.id && <Ico as={Check} size={14} />}
            </button>
          ))}
        </div>
      )}
      <button type="button" className={`viewas-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        Viewing as: {cur.label}<Ico as={ChevronDown} size={12} />
      </button>
    </div>
  );
}
