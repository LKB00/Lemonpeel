import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Ellipsis, X, ArrowUp, Pencil, Trash2, RotateCcw } from './ri.js';
import { Ico } from './icons.jsx';
import { Empty } from './empty.jsx';

/* =====================================================================
   Comments, the way design and whiteboard tools do them:
   a pin on the canvas (or on a node, so it travels with it) that opens a thread.
   - Anyone: read, reply, react, resolve / reopen.
   - Only a message's author: edit or delete that message.
   - Only the thread's starter: delete the whole thread.
   ===================================================================== */
export const PEOPLE = {
  me: { id: 'me', name: 'You', initial: 'B', color: '#fad406', ink: '#0a0a0a' },
  sam: { id: 'sam', name: 'Sam Lee', initial: 'S', color: '#4a5bd6', ink: '#fff' },
};
const REACTIONS = ['👍', '❤️', '🎉', '👀'];
const ago = (ts) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};
const uid = () => Math.random().toString(36).slice(2, 9);

function Avatar({ who, size = 24 }) {
  const p = PEOPLE[who] || PEOPLE.me;
  return <span className="c-av" style={{ width: size, height: size, background: p.color, color: p.ink, fontSize: size * 0.46 }}>{p.initial}</span>;
}

function Message({ m, first, onEdit, onDelete, onReact }) {
  const mine = m.author === 'me';
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text);
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  return (
    <div className="c-msg">
      <Avatar who={m.author} />
      <div className="c-msg-b">
        <div className="c-msg-h">
          <b>{PEOPLE[m.author]?.name}</b><span>{ago(m.ts)}{m.edited ? ' · edited' : ''}</span>
          <span className="c-msg-acts">
            <button onClick={() => setPicker(!picker)} aria-label="Add reaction" data-tip="React">☺</button>
            {mine && <button onClick={() => setMenu(!menu)} aria-label="Message actions" data-tip="More"><Ico as={Ellipsis} size={14} /></button>}
          </span>
          {menu && (
            <span className="c-menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { setEditing(true); setMenu(false); }}><Ico as={Pencil} size={13} />Edit</button>
              <button className="danger" onClick={() => { setMenu(false); onDelete(); }}><Ico as={Trash2} size={13} />{first ? 'Delete thread' : 'Delete'}</button>
            </span>
          )}
          {picker && (
            <span className="c-picker" onMouseLeave={() => setPicker(false)}>
              {REACTIONS.map((r) => <button key={r} onClick={() => { onReact(r); setPicker(false); }}>{r}</button>)}
            </span>
          )}
        </div>
        {editing ? (
          <form className="c-edit" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onEdit(text.trim()); setEditing(false); }}>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } if (e.key === 'Escape') { e.stopPropagation(); setText(m.text); setEditing(false); } }} />
            <div className="c-edit-a"><button type="button" className="btn btn-ghost btn-xs" onClick={() => { setText(m.text); setEditing(false); }}>Cancel</button><button className="btn btn-invert btn-xs">Save</button></div>
          </form>
        ) : <p className="c-text">{m.text}</p>}
        {Object.keys(m.reactions || {}).filter((r) => m.reactions[r].length).length > 0 && (
          <div className="c-reacts">
            {Object.entries(m.reactions).filter(([, who]) => who.length).map(([r, who]) => (
              <button key={r} className={who.includes('me') ? 'mine' : ''} onClick={() => onReact(r)} data-tip={who.map((w) => PEOPLE[w]?.name).join(', ')}>{r}<span>{who.length}</span></button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Thread({ t, style, onClose, update, remove, toast, onText }) {
  const [reply, setReplyRaw] = useState('');
  const setReply = (v) => { setReplyRaw(v); onText?.(v); };
  const [menu, setMenu] = useState(false);
  const isNew = !t.messages.length;
  const starter = t.messages[0]?.author;
  const send = () => {
    const v = reply.trim(); if (!v) return;
    update({ ...t, resolved: false, messages: [...t.messages, { id: uid(), author: 'me', text: v, ts: Date.now(), reactions: {} }] });
    setReply('');
  };
  const patchMsg = (id, f) => update({ ...t, messages: t.messages.map((m) => (m.id === id ? f(m) : m)) });
  const react = (id, r) => patchMsg(id, (m) => { const who = m.reactions?.[r] || []; return { ...m, reactions: { ...(m.reactions || {}), [r]: who.includes('me') ? who.filter((w) => w !== 'me') : [...who, 'me'] } }; });
  return (
    <div className="c-thread" style={style} role="dialog" aria-label="Comment thread" onMouseDown={(e) => e.stopPropagation()}>
      {!isNew && (
        <header className="c-th">
          <span className="c-th-t">{t.resolved ? 'Resolved' : `${t.messages.length} ${t.messages.length === 1 ? 'comment' : 'comments'}`}</span>
          <button className={`c-ib ${t.resolved ? 'on' : ''}`} onClick={() => { update({ ...t, resolved: !t.resolved }); if (!t.resolved) { toast('Thread resolved'); onClose(); } }} aria-label={t.resolved ? 'Reopen' : 'Resolve'} data-tip={t.resolved ? 'Reopen' : 'Resolve'}><Ico as={t.resolved ? RotateCcw : Check} size={15} /></button>
          {starter === 'me' && (
            <span className="c-th-more">
              <button className="c-ib" onClick={() => setMenu(!menu)} aria-label="Thread actions" data-tip="More"><Ico as={Ellipsis} size={15} /></button>
              {menu && <span className="c-menu right" onMouseLeave={() => setMenu(false)}><button className="danger" onClick={() => { remove(); onClose(); }}><Ico as={Trash2} size={13} />Delete thread</button></span>}
            </span>
          )}
          <button className="c-ib" onClick={onClose} aria-label="Close" data-tip="Close"><Ico as={X} size={15} /></button>
        </header>
      )}
      {!isNew && (
        <div className="c-msgs">
          {t.messages.map((m, i) => (
            <Message key={m.id} m={m} first={i === 0}
              onEdit={(text) => patchMsg(m.id, (x) => ({ ...x, text, edited: true }))}
              onDelete={() => (i === 0 ? (remove(), onClose()) : update({ ...t, messages: t.messages.filter((x) => x.id !== m.id) }))}
              onReact={(r) => react(m.id, r)} />
          ))}
        </div>
      )}
      <form className="c-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Avatar who="me" size={22} />
        <textarea autoFocus rows={1} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isNew ? 'Add a comment' : 'Reply'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} aria-label={isNew ? 'Comment' : 'Reply'} />
        <button className="btn btn-invert btn-icon btn-xs" disabled={!reply.trim()} aria-label="Send"><Ico as={ArrowUp} size={14} /></button>
      </form>
    </div>
  );
}

export function CommentsLayer({ rf, comments, setComments, mode, setMode, openId, setOpenId, canvasEl, toast, pending, clearPending, showAll, onExit }) {
  const [draft, setDraft] = useState(null); // { x, y, nodeId, dx, dy } for a thread being started
  const draftText = useRef('');
  const startDraft = (d) => { draftText.current = ''; setDraft(d); };
  // An empty draft is thrown away when you leave comment mode or click elsewhere; one with text is kept.
  const dropEmptyDraft = () => setDraft((d) => (d && !draftText.current.trim() ? null : d));
  useEffect(() => { if (!mode) dropEmptyDraft(); }, [mode]);
  useEffect(() => {
    if (!draft) return;
    const h = (e) => { if (!e.target.closest?.('.c-thread, .c-capture, .c-pin')) dropEmptyDraft(); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [draft]);
  useEffect(() => { if (pending) { startDraft(pending); setOpenId(null); clearPending(); } }, [pending]);
  useEffect(() => { if (!mode) return; const k = (e) => { if (e.key === 'Escape') { setDraft(null); if (onExit) onExit(); else setMode(false); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [mode]);
  if (!canvasEl) return null;
  const cr = canvasEl.getBoundingClientRect();

  // Where a thread sits on screen: on its node (so it moves with it) or a free canvas point.
  const anchor = (t) => {
    if (t.nodeId) {
      const n = rf.getInternalNode(t.nodeId);
      if (n) { const p = n.internals.positionAbsolute; return rf.flowToScreenPosition({ x: p.x + t.dx, y: p.y + t.dy }); }
    }
    return rf.flowToScreenPosition({ x: t.x, y: t.y });
  };
  const place = (e) => {
    const flow = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('react-flow__node'));
    const id = hit?.dataset.id;
    const n = id && rf.getInternalNode(id);
    startDraft(n ? { nodeId: id, dx: flow.x - n.internals.positionAbsolute.x, dy: flow.y - n.internals.positionAbsolute.y, x: flow.x, y: flow.y } : { x: flow.x, y: flow.y });
    setOpenId(null);
  };
  const popStyle = (p) => {
    const W = 300;
    const edge = Math.min(cr.right, document.querySelector('aside.panel')?.getBoundingClientRect().left ?? Infinity);
    let left = p.x + 22; if (left + W > edge - 12) left = p.x - W - 22;
    const top = Math.min(Math.max(p.y - 14, cr.top + 68), cr.bottom - 260);
    return { left, top, width: W };
  };
  const visible = comments.filter((t) => t.id === openId || ((mode || showAll) && !t.resolved));
  const open = comments.find((t) => t.id === openId);
  const update = (t) => setComments((cs) => cs.map((x) => (x.id === t.id ? t : x)));
  const remove = (id) => { const t = comments.find((x) => x.id === id); setComments((cs) => cs.filter((x) => x.id !== id)); toast('Thread deleted', { label: 'Undo', run: () => setComments((cs) => [...cs, t]) }); };

  return createPortal(
    <>
      {mode && <div className="c-capture" style={{ left: cr.left, top: cr.top, width: cr.width, height: cr.height }} onMouseDown={(e) => { if (e.button === 0) place(e); }} />}
      {visible.map((t) => {
        const p = anchor(t);
        if (p.x < cr.left || p.x > cr.right || p.y < cr.top + 56 || p.y > cr.bottom) return null;
        const last = t.messages[t.messages.length - 1];
        return (
          <button key={t.id} className={`c-pin ${t.id === openId ? 'on' : ''} ${t.resolved ? 'resolved' : ''}`} style={{ left: p.x, top: p.y }}
            onMouseDown={(e) => e.stopPropagation()} onClick={() => { setDraft(null); setOpenId(t.id === openId ? null : t.id); }}
            aria-label={`Comment thread by ${PEOPLE[t.messages[0]?.author]?.name}, ${t.messages.length} messages`} data-tip={last ? `${PEOPLE[last.author]?.name}: ${last.text.slice(0, 40)}` : undefined}>
            <Avatar who={t.messages[0]?.author} size={22} />
            {t.messages.length > 1 && <span className="c-pin-n">{t.messages.length}</span>}
          </button>
        );
      })}
      {draft && (() => {
        const p = draft.nodeId ? anchor({ ...draft }) : rf.flowToScreenPosition({ x: draft.x, y: draft.y });
        const t = { id: 'draft', messages: [] };
        return (
          <>
            <span className="c-pin draft" style={{ left: p.x, top: p.y }}><Avatar who="me" size={22} /></span>
            <Thread t={t} style={popStyle(p)} toast={toast} onClose={() => setDraft(null)} remove={() => {}} onText={(v) => { draftText.current = v; }}
              update={(nt) => { const id = uid(); setComments((cs) => [...cs, { ...draft, id, resolved: false, messages: nt.messages }]); setDraft(null); setOpenId(id); if (!showAll) setMode(false); }} />
          </>
        );
      })()}
      {open && !draft && <Thread key={open.id} t={open} style={popStyle(anchor(open))} toast={toast} onClose={() => setOpenId(null)} update={update} remove={() => remove(open.id)} />}
    </>,
    document.body,
  );
}

/* ---------------- Comments panel: every thread on the board, open or resolved ---------------- */
// Flow-space point of a thread (on its node, or a free canvas point)
export const threadPoint = (rf, t) => {
  if (t.nodeId) { const n = rf.getInternalNode(t.nodeId); if (n) { const p = n.internals.positionAbsolute; return { x: p.x + t.dx, y: p.y + t.dy }; } }
  return { x: t.x, y: t.y };
};

export function CommentsPanel({ comments, rf, openId, onOpen, nodeTitle }) {
  const [show, setShow] = useState('open');
  const open = comments.filter((t) => !t.resolved);
  const done = comments.filter((t) => t.resolved);
  const list = [...(show === 'open' ? open : done)].sort((a, b) => (b.messages[b.messages.length - 1]?.ts || 0) - (a.messages[a.messages.length - 1]?.ts || 0));
  return (
    <div className="pbody cpanel">
      <div className="filters">
        <button className={`fchip ${show === 'open' ? 'on' : ''}`} onClick={() => setShow('open')}>Open{open.length ? <span className="n">{open.length}</span> : null}</button>
        <button className={`fchip ${show === 'resolved' ? 'on' : ''}`} onClick={() => setShow('resolved')}>Resolved{done.length ? <span className="n">{done.length}</span> : null}</button>
      </div>
      {!list.length && (show === 'open'
        ? <Empty art="comments" title="No open comments" text="Press C, then click anywhere to leave one." />
        : <Empty art="resolved" title="Nothing resolved yet" text="Resolved threads move here." />)}
      <ul className="cmt-list">
        {list.map((t) => {
          const first = t.messages[0];
          const last = t.messages[t.messages.length - 1];
          const replies = t.messages.length - 1;
          const on = t.nodeId && nodeTitle(t.nodeId);
          return (
            <li key={t.id}>
              <button className={`cmt-row ${t.id === openId ? 'on' : ''}`} onClick={() => onOpen(t)}>
                <Avatar who={first?.author} size={24} />
                <span className="cmt-main">
                  <span className="cmt-top"><b>{PEOPLE[first?.author]?.name}</b><small>{last ? ago(last.ts) : ''}</small></span>
                  <span className="cmt-text">{first?.text}</span>
                  {(on || replies > 0) && <span className="cmt-meta">{[on && `On ${on}`, replies > 0 && `${replies} repl${replies === 1 ? 'y' : 'ies'}`].filter(Boolean).join(' · ')}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
