import React, { useState, useRef, useEffect, useMemo } from 'react';
import lemonpeelMark from './assets/lemonpeel-mark.png';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, useReactFlow, useNodes, useEdges, useViewport } from '@xyflow/react';
import StudioNode, { PORT_ICONS } from './StudioNode.jsx';
import { StudioCtx, DockCtx } from './ctx.js';
import { CreatePanel } from './create.jsx';
import { CommentsLayer, CommentsPanel, threadPoint } from './comments.jsx';
import { Dock, TemplatesModal, Inspector, Outputs, FormView, CreditsModal, Palette, ShortcutsModal } from './panels.jsx';
import { Frame, AssetsModal, BrandModal, BrandMark, readMedia, ProjectSettings, PeoplePop, PreviewModal, Tour } from './extras.jsx';
import { LeftRail, AskBar, RunStatus, RightTabs, AgentPanel, RunsPanel, Composer, ViewAs } from './zones.jsx';
import { Ico, KindTile } from './icons.jsx';
import { Sparkles, Play, Generate, Upload, MessageSquare, Activity, ChevronLeft, ChevronRight, ChevronDown, Coins, Plus, Minus, Maximize, Map as MapIcon, LayoutGrid, Undo2, Redo2, Keyboard, RotateCcw, Copy, BookmarkPlus, Download, Trash2, Search, ListChecks, Workflow, ImagePlus, ArrowRight, Loader2, Ellipsis, GalleryHorizontalEnd, Gallery, History, ChatNew, ArrowUp, Hand, MousePointer2, Lock, Unlock, Group as GroupIcon, Ungroup, Pencil, Scissors, ClipboardPaste, Maximize2, Paintbrush, Layers, Expand, Archive, Settings2, HelpCircle, Compass, Palette as PaletteIcon } from './ri.js';
import { KINDS, KIND_ORDER, MODELS, TEMPLATES, NEXT_STEPS, PORT_COLORS, costOf, secsOf, fmtCr, findModel, writeScript, listItems } from './data.js';
import { scene, assetById, hash, ASSETS } from './art.js';

const nodeTypes = { studio: StudioNode, frame: Frame };
const uid = () => Math.random().toString(36).slice(2, 9);
const W = 320;
const STORE = 'lp-canvas-proto-v1';

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.nodes)) {
      s.nodes = s.nodes.map((n) => ({
        ...n,
        selected: false,
        data: {
          ...n.data,
          status: n.data.status === 'running' || n.data.status === 'queued' ? (n.data.takes?.length ? 'done' : 'draft') : n.data.status,
          progress: 0, alert: null, focus: false,
        },
      }));
      // older saves could hand out the same auto-name twice ("Video 8" ×2): renumber the later copy
      const used = new Set();
      const bump = (t) => {
        const m = /^(.*?)(?: (\d+))?$/.exec(t);
        let i = m[2] ? +m[2] + 1 : 2;
        while (used.has(`${m[1]} ${i}`) || s.nodes.some((x) => x.data.title === `${m[1]} ${i}`)) i += 1;
        return `${m[1]} ${i}`;
      };
      s.nodes = s.nodes.map((n) => {
        const t = n.data.title;
        if (!t || n.data.kind === 'note' || n.data.kind === 'list') return n;
        if (!used.has(t)) { used.add(t); return n; }
        const nt = bump(t); used.add(nt);
        return { ...n, data: { ...n.data, title: nt } };
      });
      s.edges = (s.edges || []).map((e) => ({ ...e, animated: false, selected: false }));
      return s;
    }
  } catch (e) { /* storage unavailable */ }
  return null;
}

export default function App() {
  const saved = useMemo(loadSaved, []);
  return (
    <ReactFlowProvider>
      <Studio saved={saved} />
    </ReactFlowProvider>
  );
}

function Studio({ saved }) {
  const rf = useReactFlow();
  const nodes = useNodes();
  const edges = useEdges();
  const { zoom } = useViewport();
  const wrapRef = useRef(null);

  const [balance, setBalance] = useState(saved?.balance ?? 2000);
  const balRef = useRef(balance);
  const [view, setView] = useState('canvas');
  const [rightTab, setRightTab] = useState(null);       // 'agent' | 'settings' | 'outputs' | 'runs' | null
  const outputsOpen = rightTab === 'outputs';
  const setOutputsOpen = (v) => setRightTab((t) => (v ? 'outputs' : t === 'outputs' ? null : t));
  const [messages, setMessages] = useState(saved?.messages ?? []);
  const [auto, setAuto] = useState(saved?.auto ?? false);
  const [chats, setChats] = useState(saved?.chats ?? []);   // past agent conversations on this project
  const [histOpen, setHistOpen] = useState(false);
  const [runs, setRuns] = useState(() => (saved?.runs || []).map((r) => (r.status === 'running' || r.status === 'queued' ? { ...r, status: 'cancelled' } : r)));
  const cancelled = useRef(new Set());
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [viewMenu, setViewMenu] = useState(false);
  const [zoomMenu, setZoomMenu] = useState(false);
  // rail menus close on any click outside them
  useEffect(() => {
    if (!viewMenu && !zoomMenu) return;
    const down = (e) => { if (!e.target.closest?.('.rail-pw')) { setViewMenu(false); setZoomMenu(false); } };
    const key = (e) => { if (e.key === 'Escape') { setViewMenu(false); setZoomMenu(false); } };
    document.addEventListener('mousedown', down, true); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down, true); window.removeEventListener('keydown', key); };
  }, [viewMenu, zoomMenu]);
  const [runsOpen, setRunsOpen] = useState(false);
  useEffect(() => { setCommentMode(rightTab === 'comments'); }, [rightTab]);
  // New chat keeps the old one in History; opening a past chat parks the current one there too
  const chatTitle = (ms) => { const u = ms.find((m) => m.role === 'user'); const t = (u?.text || 'Chat').trim(); return t.length > 40 ? `${t.slice(0, 38).replace(/\s+\S*$/, '')}…` : t; };
  const park = (ms) => (ms.length ? [{ id: 'c' + uid(), title: chatTitle(ms), messages: ms, ts: Date.now() }] : []);
  const newChat = () => { setChats((cs) => [...cs, ...park(messages)].slice(-30)); setMessages([]); setHistOpen(false); };
  const openChat = (id) => { const c = chats.find((x) => x.id === id); if (!c) return; setChats((cs) => [...cs.filter((x) => x.id !== id), ...park(messages)]); setMessages(c.messages); setHistOpen(false); };
  const agoShort = (ts) => { const s = (Date.now() - ts) / 1000; return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
  useEffect(() => {
    if (!histOpen) return;
    const down = (e) => { if (!e.target.closest?.('.hist-pop')) setHistOpen(false); };
    document.addEventListener('mousedown', down, true);
    return () => document.removeEventListener('mousedown', down, true);
  }, [histOpen]);
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setView('canvas'); setRightTab('agent'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (!runsOpen) return;
    const down = (e) => { if (!e.target.closest?.('.runs-pop, .zrun')) setRunsOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setRunsOpen(false); };
    document.addEventListener('mousedown', down, true);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down, true); window.removeEventListener('keydown', key); };
  }, [runsOpen]);
  // Input menu: hover the left + to list inputs, pick one to choose its source.
  const [attach, setAttach] = useState(null);          // { nodeId, step: 'list' | 'pick', portId }
  const [attachPos, setAttachPos] = useState(null);
  const closeTimer = useRef(null);
  const attachRef = useRef(null);
  attachRef.current = attach;
  useEffect(() => {
    if (!attach) { setAttachPos(null); return; }
    let raf;
    const sel = `.react-flow__node[data-id="${attach.nodeId}"] .inplus`;
    const tick = () => {
      const el = document.querySelector(sel);
      if (!el) { setAttach(null); return; }
      const r = el.getBoundingClientRect();
      const nr = el.closest('.react-flow__node')?.getBoundingClientRect() || r;
      setAttachPos((p) => (p && p.l === r.left && p.t === r.top && p.nl === nr.left ? p : { l: r.left, t: r.top, r: r.right, nl: nr.left, nr: nr.right }));
      raf = requestAnimationFrame(tick);
    };
    tick();
    const away = (e) => { if (!e.target.closest('.inmenu') && !e.target.closest('.inplus')) setAttach(null); };
    document.addEventListener('mousedown', away, true);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('mousedown', away, true); };
  }, [attach?.nodeId]);
  const holdInputs = () => clearTimeout(closeTimer.current);
  const releaseInputs = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { if (attachRef.current?.step === 'list') setAttach(null); }, 220);
  };
  const [menu, setMenu] = useState(null);
  const [nextMenu, setNextMenu] = useState(null);
  const [palette, setPalette] = useState(null);
  const [credits, setCredits] = useState(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [connecting, setConnecting] = useState(null);
  const [minimap, setMinimap] = useState(false);
  const [defaults, setDefaults] = useState(saved?.defaults ?? { aspect: '16:9', duration: 5 });
  const [projectName, setProjectName] = useState(saved?.projectName ?? 'Untitled project');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dock, setDock] = useState(null); // panel next to the rail: { type: 'create', kind } | { type: 'templates' | 'assets' | 'brand' }
  const dockRef = useRef(null); dockRef.current = dock; // read by the keyboard handler, which is set up once
  const toggleDock = (d) => (setCommentMode(false), setDock((cur) => (cur && cur.type === d.type && cur.kind === d.kind && cur.from === d.from ? null : d)));
  const [savedAssets, setSavedAssets] = useState(saved?.savedAssets ?? []);
  const [assetEdits, setAssetEdits] = useState(saved?.assetEdits ?? {}); // id -> { name?, removed? }
  // Brand kits: a library, one default per project; a node can override with data.brand (id or 'none').
  const [brands, setBrands] = useState(() => saved?.brands ?? (saved?.brand ? [{ ...saved.brand, id: 'b-legacy' }] : []));
  const [projectBrandId, setProjectBrandId] = useState(() => saved?.projectBrandId !== undefined ? saved.projectBrandId : (saved?.brand?.on ? 'b-legacy' : null));
  const brandFor = (d) => (d?.brand === 'none' ? null : brands.find((b) => b.id === (d?.brand || projectBrandId)) || null);
  const projectBrand = brands.find((b) => b.id === projectBrandId) || null;
  const [people, setPeople] = useState(() => (saved?.people ?? []).map((p) => (p.email === 'sam@studio.com' ? { name: 'Sam Lee', joined: true, ...p } : p)));
  // Comment threads (pins on the canvas). Seeded with one from a teammate so the other side of permissions is visible.
  const [comments, setComments] = useState(() => {
    if (saved?.comments) return saved.comments;
    const first = (saved?.nodes || []).find((n) => n.type !== 'frame' && n.data?.kind !== 'comment');
    const t0 = Date.now() - 1000 * 60 * 42;
    return [{
      id: 'c-seed', resolved: false,
      ...(first ? { nodeId: first.id, dx: (first.measured?.width || 300) - 8, dy: 8 } : { x: 200, y: 120 }),
      messages: [
        { id: 'm1', author: 'sam', text: 'Can we try this with the lemon soda instead? Feels more summer.', ts: t0, reactions: { '👍': [] } },
      ],
    }];
  });
  const [commentMode, setCommentMode] = useState(false);
  const [openComment, setOpenComment] = useState(null);
  const [commentAt, setCommentAt] = useState(null);
  const pnameRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pop, setPop] = useState(null);
  useEffect(() => {
    if (!pop) return;
    const h = (e) => { if (!e.target.closest?.('.popwrap')) setPop(null); };
    const k = (e) => { if (e.key === 'Escape') setPop(null); };
    document.addEventListener('mousedown', h, true); window.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h, true); window.removeEventListener('keydown', k); };
  }, [pop]);                 // 'project' | 'share'
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [tour, setTour] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [locked, setLocked] = useState(false);
  const [mention, setMention] = useState(null);         // { nodeId, q, x, y }
  const [nodeMenu, setNodeMenu] = useState(null);       // { nodeId, x, y }
  const clip = useRef(null);
  // Older saved assets were images only; give them a type and a source.
  const everyAsset = () => [...ASSETS, ...savedAssets.map((a) => ({ type: 'image', source: a.group === 'Saved' ? 'generated' : 'upload', ...a }))].map((a) => (assetEdits[a.id] ? { ...a, ...assetEdits[a.id] } : a));
  const allAssets = () => everyAsset().filter((a) => !a.removed);
  // Upload saves into Assets and returns the new asset, so callers can attach it straight away.
  const addAsset = (m) => { const na = { id: 'u' + uid(), source: 'upload', ...m }; setSavedAssets((x) => [...x, na]); toast(`Saved “${na.name}” to Assets`); return na; };
  const editAsset = (id, patch) => setAssetEdits((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));
  const removeAsset = (a) => {
    editAsset(a.id, { removed: true });
    const uses = rf.getNodes().filter((n) => n.data.asset === a.id).length;
    toast(`Removed “${a.name}”${uses ? ` · ${uses} node${uses > 1 ? 's' : ''} still use it` : ''}`, { label: 'Undo', run: () => editAsset(a.id, { removed: false }) });
  };
  const assetOf = (id) => everyAsset().find((a) => a.id === id) || ASSETS[0];
  const past = useRef([]);
  const future = useRef([]);

  const selected = nodes.filter((n) => n.selected);
  const selKey = selected.filter((n) => n.type !== 'frame').map((n) => n.id).join(',');
  // Settings live in a card next to the selection (see node-pop below), not in the right panel.
  const [inspOpen, setInspOpenRaw] = useState(() => { try { return localStorage.getItem('lp-insp') !== '0'; } catch { return true; } });
  const setInspOpen = (v) => { setInspOpenRaw(v); try { localStorage.setItem('lp-insp', v ? '1' : '0'); } catch { /* private mode */ } };
  useEffect(() => { setRightTab((t) => (t === 'settings' ? null : t)); }, [selKey]);
  // Avoid flashing the empty state while saved nodes load.
  const [ready, setReady] = useState(!saved?.nodes?.length);
  useEffect(() => { if (nodes.length) setReady(true); }, [nodes.length]);

  /* ---------- persistence ---------- */
  const [saveState, setSaveState] = useState('saved');
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) firstSave.current = false; else setSaveState('saving');
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify({
          nodes: nodes.map(({ id, type, position, data, parentId, style, width, height }) => ({ id, type, position, data, parentId, style, width, height })),
          edges: edges.map(({ id, source, target, sourceHandle, targetHandle, style, data }) => ({ id, source, target, sourceHandle, targetHandle, style, data })),
          balance, projectName, defaults, savedAssets, assetEdits, comments, brands, projectBrandId, people, messages, chats, auto, runs: runs.slice(-50),
        }));
      } catch (e) { /* ignore */ }
      setSaveState('saved');
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, balance, projectName, defaults, savedAssets, assetEdits, comments, brands, projectBrandId, people, messages, chats, auto, runs]);

  /* ---------- helpers ---------- */
  const toast = (msg, action) => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, msg, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 2800);
  };
  const snap = () => ({ nodes: rf.getNodes().map((n) => ({ ...n, data: { ...n.data } })), edges: rf.getEdges().map((e) => ({ ...e })) });
  const checkpoint = () => {
    past.current.push(snap());
    if (past.current.length > 60) past.current.shift();
    future.current = [];
  };
  const undo = () => {
    if (!past.current.length) return toast('Nothing to undo');
    future.current.push(snap());
    const s = past.current.pop();
    rf.setNodes(s.nodes); rf.setEdges(s.edges);
  };
  const redo = () => {
    if (!future.current.length) return toast('Nothing to redo');
    past.current.push(snap());
    const s = future.current.pop();
    rf.setNodes(s.nodes); rf.setEdges(s.edges);
  };

  const size = (n) => ({ w: n.measured?.width ?? W, h: n.measured?.height ?? 230 });
  const freeSpot = (x, y, h, list0) => {
    const list = list0.filter((o) => o.type !== 'frame' && !o.parentId);
    let pos = { x, y };
    for (let i = 0; i < 60; i++) {
      const hit = list.find((o) => {
        const s = size(o);
        return pos.x < o.position.x + s.w + 40 && pos.x + W + 40 > o.position.x && pos.y < o.position.y + s.h + 40 && pos.y + h + 40 > o.position.y;
      });
      if (!hit) return pos;
      pos = { x: pos.x, y: hit.position.y + size(hit).h + 48 };
    }
    return pos;
  };
  const viewCenter = () => {
    const r = wrapRef.current.getBoundingClientRect();
    const p = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    return { x: p.x - W / 2, y: p.y - 140 };
  };
  const ensureVisible = (pos) => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const tl = rf.screenToFlowPosition({ x: r.left, y: r.top });
    const br = rf.screenToFlowPosition({ x: r.right, y: r.bottom });
    if (pos.x < tl.x || pos.x + W > br.x || pos.y < tl.y || pos.y + 220 > br.y) {
      rf.setCenter(pos.x + W / 2, pos.y + 150, { zoom: rf.getZoom(), duration: 350 });
    }
  };
  // Push nodes down so nothing overlaps (runs after outputs grow nodes)
  const resolveOverlaps = () => {
    const ns = [...rf.getNodes()].filter((n) => n.type !== 'frame' && !n.parentId).sort((a, b) => a.position.y - b.position.y);
    const moved = {};
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      const ay = moved[a.id] ?? a.position.y;
      const sa = size(a);
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        const by = moved[b.id] ?? b.position.y;
        const sb = size(b);
        const xOverlap = a.position.x < b.position.x + sb.w && a.position.x + sa.w > b.position.x;
        if (xOverlap && by < ay + sa.h + 32 && by + sb.h > ay) moved[b.id] = ay + sa.h + 40;
      }
    }
    if (Object.keys(moved).length) rf.setNodes((x) => x.map((n) => (moved[n.id] != null ? { ...n, position: { ...n.position, y: moved[n.id] } } : n)));
  };

  // "Video", "Video 2", … always the next number after the highest in use, so a name is never handed out twice
  const nextTitle = (label) => {
    let max = 0;
    for (const n of rf.getNodes()) {
      const t = n.data.title || '';
      if (t === label) max = Math.max(max, 1);
      else if (t.startsWith(label + ' ')) { const num = Number(t.slice(label.length + 1)); if (Number.isInteger(num) && num > 0) max = Math.max(max, num); }
    }
    return max ? `${label} ${max + 1}` : label;
  };
  const makeData = (kind, extra = {}) => {
    const label = KINDS[kind].label;
    return {
      kind,
      title: kind === 'note' || kind === 'list' ? 'Text' : nextTitle(label), // Text names itself from its first line
      prompt: '',
      model: MODELS[kind]?.[0]?.name,
      aspect: defaults.aspect,
      duration: defaults.duration,
      audio: true,
      count: 1, format: 'PNG', fps: 24, quality: defaults.quality || 'Standard', resolution: defaults.resolution || '1080p', created: Date.now(),
      status: 'draft', progress: 0, takes: [], takeIdx: 0,
      asset: kind === 'upload' ? 'tee' : undefined,
      ...extra,
    };
  };

  // A wire dropped on a node's single input goes to the first free input of the matching type.
  const routeInput = (targetId, tgtKind, srcType) => {
    const ins = (KINDS[tgtKind]?.inputs || []).filter((p) => p.type === srcType);
    if (!ins.length) return null;
    const count = (pid) => rf.getEdges().filter((e) => e.target === targetId && e.targetHandle === pid).length;
    const room = (p) => (p.multi ? count(p.id) < (p.max || Infinity) : count(p.id) === 0);
    return (ins.find(room) || ins[0]).id;
  };
  const connect = (conn, opts = {}) => {
    if (opts.checkpoint !== false) checkpoint();
    const srcType = opts.srcType || KINDS[rf.getNode(conn.source)?.data.kind]?.output;
    const tgtKind = opts.tgtKind || rf.getNode(conn.target)?.data.kind;
    if (conn.targetHandle === 'in') conn = { ...conn, targetHandle: routeInput(conn.target, tgtKind, srcType) };
    const port = KINDS[tgtKind]?.inputs.find((p) => p.id === conn.targetHandle);
    if (!port || !srcType) return;
    if (port.multi && port.max) {
      const es = rf.getEdges();
      const dup = es.some((e) => e.source === conn.source && e.target === conn.target && e.targetHandle === conn.targetHandle);
      if (!dup && es.filter((e) => e.target === conn.target && e.targetHandle === conn.targetHandle).length >= port.max) {
        toast(`${port.label}: up to ${port.max}. Remove one to add another.`);
        return;
      }
    }
    rf.setEdges((es) => {
      let list = es;
      if (!port.multi) list = es.filter((e) => !(e.target === conn.target && e.targetHandle === conn.targetHandle));
      if (list.some((e) => e.source === conn.source && e.target === conn.target && e.targetHandle === conn.targetHandle)) return list;
      return [...list, { id: 'e' + uid(), source: conn.source, sourceHandle: 'out', target: conn.target, targetHandle: conn.targetHandle, style: { stroke: PORT_COLORS[srcType], strokeWidth: 2 }, data: { type: srcType } }];
    });
  };

  const addNode = (kind, opts = {}) => {
    checkpoint();
    const all = rf.getNodes();
    let pos = opts.position;
    let srcType;
    if (opts.from) {
      const src = rf.getNode(opts.from.nodeId);
      srcType = opts.from.type || KINDS[src?.data.kind]?.output;
      if (!pos && src) pos = { x: src.position.x + size(src).w + 110, y: src.position.y };
    }
    if (!pos) pos = viewCenter();
    if (!opts.exact) pos = freeSpot(pos.x, pos.y, 260, all);
    const id = opts.id || uid();
    const data = makeData(kind, { ...(opts.data || {}), focus: opts.focus !== false && !!KINDS[kind].placeholder });
    if (opts.select === false) rf.setNodes((ns) => [...ns, { id, type: 'studio', position: pos, data }]);
    else rf.setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), { id, type: 'studio', position: pos, data, selected: true }]);
    if (opts.from) connect({ source: opts.from.nodeId, target: id, targetHandle: opts.from.port }, { checkpoint: false, srcType, tgtKind: kind });
    setTimeout(() => ensureVisible(pos), 40);
    return id;
  };

  const selectOnly = (id) => rf.setNodes((ns) => ns.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })));

  /* ---------- inputs & outputs ---------- */
  const incoming = (id) => rf.getEdges().filter((e) => e.target === id);
  const outputOf = (n) => {
    if (!n) return null;
    const d = n.data;
    if (d.kind === 'note' || d.kind === 'list') return (d.prompt || '').trim() ? { type: 'text', text: d.prompt } : null;
    if (d.kind === 'upload') return { type: 'image', url: assetOf(d.asset).url, aspect: assetOf(d.asset).aspect || '1:1' };
    if (d.kind === 'clip') { const a = assetOf(d.asset); return { type: 'video', url: a.url, aspect: a.aspect || '16:9', secs: a.secs || 5 }; }
    if (d.kind === 'sound') { const a = assetOf(d.asset); return { type: 'audio', seed: a.seed || 1, secs: a.secs || 5 }; }
    if (!KINDS[d.kind] || KINDS[d.kind].noOutput) return null;
    const tk = d.takes || [];
    const t = tk[d.takeIdx ?? tk.length - 1];
    return t ? { type: KINDS[d.kind].output, ...t } : null;
  };
  const textInputs = (id) => incoming(id).map((e) => outputOf(rf.getNode(e.source))).filter((o) => o && o.type === 'text').map((o) => o.text);
  const inputsList = (id) => {
    const tgt = rf.getNode(id);
    if (!tgt) return [];
    return incoming(id).map((e) => {
      const s = rf.getNode(e.source);
      if (!s) return null;
      return { key: e.id, title: s.data.title, type: KINDS[s.data.kind].output, port: KINDS[tgt.data.kind].inputs.find((p) => p.id === e.targetHandle)?.label };
    }).filter(Boolean);
  };

  // A connected List node makes its consumer run once per line.
  const listFor = (id) => {
    const l = incoming(id).map((e) => rf.getNode(e.source)).find((s) => s && s.data.kind === 'list');
    return l ? listItems(l.data.prompt) : null;
  };
  const runsFor = (id) => Math.max(1, (listFor(id) || []).length);

  const reasonFor = (id) => {
    const n = rf.getNode(id);
    if (!n) return null;
    const d = n.data;
    const ins = incoming(id);
    const hasPort = (p) => ins.some((e) => e.targetHandle === p);
    const srcFor = (p) => { const e = ins.find((x) => x.targetHandle === p); return e && rf.getNode(e.source); };
    const avail = (s) => s && (outputOf(s) || KINDS[s.data.kind].runnable);
    const txt = (d.prompt || '').trim() || ins.some((e) => { const s = rf.getNode(e.source); return s && KINDS[s.data.kind].output === 'text' && avail(s); });
    switch (d.kind) {
      case 'image': return txt || hasPort('ref') ? null : 'Add a prompt';
      case 'video': return txt || hasPort('start') ? null : 'Add a prompt';
      case 'audio': return txt || hasPort('video') ? null : 'Add a script';
      case 'writer': return txt || hasPort('ref') ? null : 'Add a prompt';
      case 'upscale':
      case 'layers': return avail(srcFor('source')) ? null : 'Connect an image';
      case 'edit': return !avail(srcFor('source')) ? 'Connect an image' : txt ? null : 'Describe the edit';
      default: return null;
    }
  };

  const topo = (ids) => {
    const set = new Set(ids);
    const es = rf.getEdges().filter((e) => set.has(e.source) && set.has(e.target));
    const indeg = {}; ids.forEach((i) => (indeg[i] = 0));
    es.forEach((e) => indeg[e.target]++);
    const q = ids.filter((i) => !indeg[i]);
    const out = [];
    while (q.length) {
      const i = q.shift(); out.push(i);
      es.filter((e) => e.source === i).forEach((e) => { if (--indeg[e.target] === 0) q.push(e.target); });
    }
    ids.forEach((i) => { if (!out.includes(i)) out.push(i); });
    return out;
  };
  const upstreamPending = (id, seen = new Set(), order = []) => {
    incoming(id).forEach((e) => {
      const s = rf.getNode(e.source);
      if (s && KINDS[s.data.kind].runnable && !(s.data.takes || []).length && !seen.has(s.id)) {
        seen.add(s.id);
        upstreamPending(s.id, seen, order);
        order.push(s.id);
      }
    });
    return order;
  };

  /* ---------- run engine (simulated) ---------- */
  const makeTake = (n, item, k = 0) => {
    const d0 = n.data;
    const nb = brandFor(d0);
    const brandBit = nb ? ` · in ${nb.name}'s style` : '';
    const d = { ...d0, prompt: (item ? `${d0.prompt ? `${d0.prompt} · ` : ''}${item}` : d0.prompt) + (KINDS[d0.kind].output !== 'text' ? brandBit : '') };
    const ins = incoming(n.id);
    const src = (p) => { const e = ins.find((x) => x.targetHandle === p); return e ? outputOf(rf.getNode(e.source)) : null; };
    const texts = textInputs(n.id).filter((t) => !item || !listFor(n.id)?.length || !listItems(t).length || listItems(t).length < 2);
    const prompt = [d.prompt, ...texts].filter(Boolean).join(' · ');
    const seed = (d.takes || []).length + 1 + (hash(n.id) % 97) + k * 13 + (item ? hash(item) % 50 : 0);
    const model = findModel(d.kind, d.model)?.name;
    const ts = Date.now();
    switch (d.kind) {
      case 'writer': return { text: writeScript([...texts, d.prompt].filter(Boolean)[0] || d.prompt), model, ts };
      case 'image': return { url: scene({ prompt: d.prompt || texts[0] || '', aspect: d.aspect, seed, tint: src('ref') ? 1 : 0 }), aspect: d.aspect, model, ts };
      case 'video': {
        const st = src('start');
        return { url: st?.url || scene({ prompt: d.prompt || texts[0] || '', aspect: d.aspect, seed: seed + 7 }), aspect: d.aspect, secs: d.duration, model, ts };
      }
      case 'audio': return { seed: seed + 3, secs: src('video')?.secs || 8, model, ts };
      case 'upscale': { const s = src('source'); return { url: s?.url, aspect: s?.aspect || '1:1', badge: '4K', model, ts }; }
      case 'edit': { const s = src('source'); return { url: scene({ prompt: prompt || 'edit', aspect: s?.aspect || '16:9', seed: seed + 31, tint: 2 }), aspect: s?.aspect || '16:9', badge: 'Edited', model, ts }; }
      case 'layers': {
        const s = src('source');
        return { layers: [
          { name: 'Background', url: s?.url, filter: 'saturate(0.4) brightness(0.8)' },
          { name: 'Subject', url: s?.url, filter: 'contrast(1.3) saturate(1.3)' },
          { name: 'Details', url: s?.url, filter: 'grayscale(1) contrast(1.6)' },
        ], aspect: s?.aspect || '1:1', model, ts };
      }
      default: return { model, ts, prompt };
    }
  };

  const runCore = async (id) => {
    const n = rf.getNode(id);
    if (!n) return false;
    const runs = runsFor(id);
    const cost = costOf(n.data, runs);
    balRef.current -= cost;
    setBalance(balRef.current);
    const runId = 'r' + uid();
    setRuns((r) => [...r, { id: runId, nodeId: id, kind: n.data.kind, title: n.data.title || KINDS[n.data.kind].label, model: findModel(n.data.kind, n.data.model)?.name, cost, status: 'running', progress: 1, ts: Date.now() }]);
    const setRun = (patch) => setRuns((r) => r.map((x) => (x.id === runId ? { ...x, ...patch } : x)));
    rf.updateNodeData(id, { status: 'running', progress: 1, alert: null });
    rf.setEdges((es) => es.map((e) => (e.target === id ? { ...e, animated: true } : e)));
    const ms = Math.max(1800, Math.min(6000, secsOf(n.data) * 28));
    await new Promise((res) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const el = Date.now() - t0;
        if (!rf.getNode(id) || cancelled.current.has(runId)) { clearInterval(iv); res(); return; }
        const pct = Math.min(99, Math.round((el / ms) * 100));
        rf.updateNodeData(id, { progress: pct });
        setRun({ progress: pct });
        if (el >= ms) { clearInterval(iv); res(); }
      }, 140);
    });
    const fresh = rf.getNode(id);
    if (!fresh || cancelled.current.has(runId)) {
      balRef.current += cost; setBalance(balRef.current);
      setRun({ status: 'cancelled' });
      if (fresh) rf.updateNodeData(id, { status: (fresh.data.takes || []).length ? 'done' : 'draft', progress: 0 });
      rf.setEdges((es) => es.map((e) => (e.target === id ? { ...e, animated: false } : e)));
      toast(`Cancelled ${fresh?.data.title || 'run'}. ${fmtCr(cost)} credits refunded`);
      return false;
    }
    setRun({ status: 'done', progress: 100 });
    const items = listFor(id);
    const per = fresh.data.kind === 'image' ? Math.max(1, fresh.data.count || 1) : 1;
    const made = [];
    (items && items.length ? items : [null]).forEach((it) => { for (let k = 0; k < per; k++) made.push({ ...makeTake(fresh, it, k), src: fresh.data.prompt || '' }); });
    if (made.length > 1) made.forEach((t) => { t.batch = made.length; });
    const takes = [...(fresh.data.takes || []), ...made];
    rf.updateNodeData(id, { status: 'done', progress: 100, takes, takeIdx: takes.length - made.length });
    rf.setEdges((es) => es.map((e) => (e.target === id ? { ...e, animated: false } : e)));
    setTimeout(resolveOverlaps, 120);
    return true;
  };

  const busy = useRef(false);
  const runSequence = async (ids, single) => {
    const list = topo(ids).map((i) => rf.getNode(i)).filter((n) => n && KINDS[n.data.kind].runnable);
    if (!list.length) return toast('Nothing to generate');
    for (const n of list) {
      const r = reasonFor(n.id);
      if (r) { toast(`${n.data.title}: ${r}`); selectOnly(n.id); return; }
    }
    const total = list.reduce((s, n) => s + costOf(n.data, runsFor(n.id)), 0);
    if (total > balRef.current) {
      if (single && list.length === 1) rf.updateNodeData(single, { alert: 'credits' });
      else setCredits({ need: total - balRef.current });
      return;
    }
    list.forEach((n) => rf.updateNodeData(n.id, { status: 'queued', alert: null }));
    if (list.length > 1) toast(`Generating ${list.length} nodes · ${fmtCr(total)} credits`);
    busy.current = true;
    for (const n of list) {
      const ok = await runCore(n.id);
      if (!ok) break;
    }
    busy.current = false;
  };
  const runnableIds = () => rf.getNodes().filter((n) => KINDS[n.data.kind].runnable).map((n) => n.id);
  const pendingIds = () => rf.getNodes().filter((n) => KINDS[n.data.kind].runnable && n.data.status !== 'done').map((n) => n.id);
  const runNode = (id) => runSequence([...upstreamPending(id), id], id);
  const runSelected = () => {
    const sel = rf.getNodes().filter((n) => n.selected && KINDS[n.data.kind].runnable);
    if (!sel.length) return toast('Select an AI node to generate');
    const ids = new Set();
    sel.forEach((n) => { upstreamPending(n.id).forEach((u) => ids.add(u)); ids.add(n.id); });
    runSequence([...ids], sel.length === 1 ? sel[0].id : null);
  };
  const runAll = (force) => {
    const p = pendingIds();
    runSequence(force || !p.length ? runnableIds() : p);
  };
  // Running the whole board is rare and expensive (and may include other people's drafts): always confirm first.
  const [confirmRun, setConfirmRun] = useState(null);
  const askRunAll = () => {
    const p = pendingIds();
    const ids = p.length ? p : runnableIds();
    if (!ids.length) return toast('Nothing to generate');
    setConfirmRun({ ids, cost: ids.reduce((s, id) => s + costOf(rf.getNode(id)?.data || {}), 0), pendingOnly: !!p.length });
  };
  // A group (frame) is how people mark one flow on a shared board: generate just what's inside it.
  const runGroup = (frameId) => {
    const kids = rf.getNodes().filter((n) => n.parentId === frameId && KINDS[n.data.kind]?.runnable);
    if (!kids.length) return toast('Nothing to generate in this group');
    const pending = kids.filter((n) => !(n.data.takes || []).length);
    runSequence((pending.length ? pending : kids).map((n) => n.id));
  };

  /* ---------- organise ---------- */
  const tidy = (onlySelected, quiet) => {
    const all = rf.getNodes();
    const sub = (onlySelected ? all.filter((n) => n.selected) : all).filter((n) => n.type !== 'frame' && !n.parentId);
    if (sub.length < 2) return;
    checkpoint();
    const set = new Set(sub.map((n) => n.id));
    const es = rf.getEdges().filter((e) => set.has(e.source) && set.has(e.target));
    const order = topo([...set]);
    const rank = {};
    order.forEach((id) => {
      const ins = es.filter((e) => e.target === id);
      rank[id] = ins.length ? Math.max(...ins.map((e) => (rank[e.source] ?? 0) + 1)) : 0;
    });
    [...order].reverse().forEach((id) => {
      const outs = es.filter((e) => e.source === id);
      if (outs.length) rank[id] = Math.max(rank[id], Math.min(...outs.map((e) => rank[e.target])) - 1);
    });
    const minX = Math.min(...sub.map((n) => n.position.x));
    const minY = Math.min(...sub.map((n) => n.position.y));
    const cols = {};
    sub.forEach((n) => { (cols[rank[n.id]] = cols[rank[n.id]] || []).push(n); });
    const pos = {};
    Object.keys(cols).forEach((r) => {
      let y = minY;
      cols[r].sort((a, b) => a.position.y - b.position.y).forEach((n) => {
        pos[n.id] = { x: minX + Number(r) * (W + 130), y };
        y += size(n).h + 48;
      });
    });
    rf.setNodes((ns) => ns.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)));
    setTimeout(() => rf.fitView({ duration: 400, padding: 0.18, maxZoom: 1, nodes: onlySelected ? sub.map((n) => ({ id: n.id })) : undefined }), 60);
    if (!quiet) toast(onlySelected ? 'Tidied selection, left to right' : 'Tidied canvas, left to right');
  };
  const duplicate = () => {
    const sel = rf.getNodes().filter((n) => n.selected);
    if (!sel.length) return;
    checkpoint();
    const map = {};
    const copies = sel.map((n) => {
      const id = uid(); map[n.id] = id;
      const { measured, ...rest } = n;
      return { ...rest, id, selected: true, position: { x: n.position.x + 48, y: n.position.y + 64 }, data: { ...n.data, title: `${n.data.title} copy`, focus: false, alert: null } };
    });
    const es = rf.getEdges().filter((e) => map[e.source] && map[e.target]).map((e) => ({ ...e, id: 'e' + uid(), source: map[e.source], target: map[e.target], selected: false }));
    rf.setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...copies]);
    rf.setEdges((x) => [...x, ...es]);
    setTimeout(resolveOverlaps, 80);
    toast(`Duplicated ${sel.length} node${sel.length > 1 ? 's' : ''}`);
  };
  const deleteSelected = () => {
    const sel = rf.getNodes().filter((n) => n.selected);
    if (sel.length) rf.deleteElements({ nodes: sel.map((n) => ({ id: n.id })) });
  };

  const useTemplate = (t, opts = {}) => {
    checkpoint();
    const all = rf.getNodes();
    const baseX = all.length ? Math.max(...all.map((n) => n.position.x + size(n).w)) + 180 : 0;
    const baseY = all.length ? Math.min(...all.map((n) => n.position.y)) : 0;
    const ids = {};
    const ns = t.nodes.map((tn) => {
      ids[tn.key] = uid();
      return { id: ids[tn.key], type: 'studio', position: { x: baseX + tn.col * (W + 130), y: baseY + tn.row * 290 }, data: { ...makeData(tn.kind), ...tn.data, kind: tn.kind, model: tn.data.model || MODELS[tn.kind]?.[0]?.name } };
    });
    const es = t.edges.map(([s, tg, port]) => {
      const st = KINDS[t.nodes.find((n) => n.key === s).kind].output;
      return { id: 'e' + uid(), source: ids[s], sourceHandle: 'out', target: ids[tg], targetHandle: port, style: { stroke: PORT_COLORS[st], strokeWidth: 2 }, data: { type: st } };
    });
    rf.setNodes((x) => [...x.map((n) => (n.selected ? { ...n, selected: false } : n)), ...ns]);
    rf.setEdges((x) => [...x, ...es]);
    if (!all.length) setProjectName(t.project);
    setView(opts.quiet ? 'canvas' : 'form');
    setTimeout(() => { resolveOverlaps(); rf.fitView({ duration: 400, padding: 0.15, maxZoom: 1 }); }, 120);
    if (!opts.quiet) toast(`${t.name} added`);
  };

  const addFromPanel = (kind, data) => {
    const sel = rf.getNodes().filter((n) => n.selected);
    let from;
    if (sel.length === 1) {
      const out = KINDS[sel[0].data.kind].output;
      const port = KINDS[kind].inputs.find((p) => p.type === out);
      if (port) from = { nodeId: sel[0].id, port: port.id, type: out };
    }
    addNode(kind, { from, data });
    if (from) toast(`Connected after “${sel[0].data.title}”`);
  };
  const addNext = (id, label) => {
    const n = rf.getNode(id);
    if (!n) return;
    const out = KINDS[n.data.kind].output;
    const opt = (NEXT_STEPS[out] || []).find((o) => o.label === label);
    if (!opt) return;
    setNextMenu(null);
    return addNode(opt.kind, { from: { nodeId: id, port: opt.port, type: out }, data: { prompt: opt.prompt || '', ...(opt.model ? { model: opt.model } : {}) } });
  };

  const openCredits = (need) => setCredits({ need: Math.max(0, need || 0) });
  const buyCredits = (cr) => {
    balRef.current += cr;
    setBalance(balRef.current);
    setCredits(null);
    rf.setNodes((ns) => ns.map((n) => (n.data.alert ? { ...n, data: { ...n.data, alert: null } } : n)));
    toast(`Added ${fmtCr(cr)} credits`);
  };

  const setLeftTab = () => { setView('canvas'); setTemplatesOpen(true); };

  /* ---------- attachments: inputs added from inside the node ---------- */
  const portLinks = (id) => {
    const out = {};
    rf.getEdges().filter((e) => e.target === id).forEach((e) => {
      const s = rf.getNode(e.source);
      if (!s) return;
      const o = outputOf(s);
      (out[e.targetHandle] = out[e.targetHandle] || []).push({ edgeId: e.id, title: s.data.title || KINDS[s.data.kind].label, thumb: o && o.url });
    });
    return out;
  };
  const detach = (edgeId) => { checkpoint(); rf.setEdges((es) => es.filter((e) => e.id !== edgeId)); };
  const leftOf = (nodeId, portId) => {
    const t = rf.getNode(nodeId);
    const i = Math.max(0, KINDS[t.data.kind].inputs.findIndex((p) => p.id === portId));
    return { x: t.position.x - W - 120, y: t.position.y + i * 40 };
  };
  const attachExisting = (nodeId, portId, srcId) => {
    const s = rf.getNode(srcId); const t = rf.getNode(nodeId);
    connect({ source: srcId, target: nodeId, targetHandle: portId }, { srcType: KINDS[s.data.kind].output, tgtKind: t.data.kind });
    setAttach(null);
  };
  const attachAsset = (nodeId, portId, assetId, fresh) => {
    const t = rf.getNode(nodeId);
    const a = fresh || assetOf(assetId);
    const kind = a.type === 'video' ? 'clip' : a.type === 'audio' ? 'sound' : 'upload';
    const upId = addNode(kind, { position: leftOf(nodeId, portId), data: { asset: assetId, title: a.name }, focus: false, select: false });
    connect({ source: upId, target: nodeId, targetHandle: portId }, { checkpoint: false, srcType: a.type || 'image', tgtKind: t.data.kind });
    setAttach(null);
  };
  const attachNew = (nodeId, portId, kind) => {
    const t = rf.getNode(nodeId);
    const nid = addNode(kind, { position: leftOf(nodeId, portId) });
    connect({ source: nid, target: nodeId, targetHandle: portId }, { checkpoint: false, srcType: KINDS[kind].output, tgtKind: t.data.kind });
    setAttach(null);
  };

  /* ---------- clipboard, groups, size ---------- */
  const copySel = (cut) => {
    const sel = rf.getNodes().filter((n) => n.selected && n.type !== 'frame');
    if (!sel.length) return;
    const ids = new Set(sel.map((n) => n.id));
    clip.current = { nodes: sel.map((n) => ({ ...n, data: { ...n.data } })), edges: rf.getEdges().filter((e) => ids.has(e.source) && ids.has(e.target)) };
    if (cut) { rf.deleteElements({ nodes: sel.map((n) => ({ id: n.id })) }); toast(`Cut ${sel.length} node${sel.length > 1 ? 's' : ''}`); }
    else toast(`Copied ${sel.length} node${sel.length > 1 ? 's' : ''}`);
  };
  const paste = (withLinks = true) => {
    if (!clip.current) return toast('Nothing to paste');
    checkpoint();
    const c = viewCenter();
    const minX = Math.min(...clip.current.nodes.map((n) => n.position.x));
    const minY = Math.min(...clip.current.nodes.map((n) => n.position.y));
    const map = {};
    const ns = clip.current.nodes.map((n) => {
      const id = uid(); map[n.id] = id;
      const { measured, parentId, ...rest } = n;
      return { ...rest, id, selected: true, position: { x: c.x + (n.position.x - minX), y: c.y + (n.position.y - minY) }, data: { ...n.data, focus: false } };
    });
    const es = withLinks ? clip.current.edges.map((e) => ({ ...e, id: 'e' + uid(), source: map[e.source], target: map[e.target], selected: false })) : [];
    rf.setNodes((x) => [...x.map((n) => (n.selected ? { ...n, selected: false } : n)), ...ns]);
    rf.setEdges((x) => [...x, ...es]);
    setTimeout(resolveOverlaps, 80);
  };
  const duplicateBare = () => { copySel(false); paste(false); };
  const groupSel = () => {
    const sel = rf.getNodes().filter((n) => n.selected && n.type !== 'frame' && !n.parentId);
    if (sel.length < 2) return toast('Select two or more nodes to group');
    checkpoint();
    const x0 = Math.min(...sel.map((n) => n.position.x)) - 24;
    const y0 = Math.min(...sel.map((n) => n.position.y)) - 52;
    const x1 = Math.max(...sel.map((n) => n.position.x + size(n).w)) + 24;
    const y1 = Math.max(...sel.map((n) => n.position.y + size(n).h)) + 24;
    const fid = uid();
    const ids = new Set(sel.map((n) => n.id));
    const frame = { id: fid, type: 'frame', position: { x: x0, y: y0 }, style: { width: x1 - x0, height: y1 - y0 }, width: x1 - x0, height: y1 - y0, zIndex: -1, data: { kind: 'frame', title: nextTitle('Group') }, selected: true };
    rf.setNodes((ns) => [frame, ...ns.map((n) => (ids.has(n.id) ? { ...n, parentId: fid, selected: false, position: { x: n.position.x - x0, y: n.position.y - y0 } } : n))]);
    toast('Grouped. Drag the group label to move them together');
  };
  const ungroup = (fid) => {
    const f = rf.getNode(fid);
    if (!f) return;
    checkpoint();
    rf.setNodes((ns) => ns.filter((n) => n.id !== fid).map((n) => (n.parentId === fid ? { ...n, parentId: undefined, position: { x: n.position.x + f.position.x, y: n.position.y + f.position.y } } : n)));
  };
  const resizeSel = (d) => {
    const sel = rf.getNodes().filter((n) => n.selected && n.type !== 'frame');
    sel.forEach((n) => rf.updateNodeData(n.id, { w: Math.max(280, Math.min(560, (n.data.w || 320) + d)) }));
  };
  const saveToAssets = (id) => {
    const n = rf.getNode(id);
    const o = outputOf(n);
    if (!o || (!o.url && o.type !== 'audio')) return toast('Nothing to save yet');
    const a = { id: 's' + uid(), type: o.type === 'text' ? 'image' : o.type, name: n.data.title || 'Saved', source: 'generated', url: o.url, aspect: o.aspect, secs: o.secs, seed: o.seed };
    setSavedAssets((x) => [...x, a]);
    toast(`Saved “${a.name}” to Assets`);
  };
  const addAssetNode = (a) => addNode(a.type === 'video' ? 'clip' : a.type === 'audio' ? 'sound' : 'upload', { data: { asset: a.id, title: a.name }, focus: false });

  // Create panel: make the node with its settings and inputs in one step, optionally generate right away.
  const createFromDock = (kind, cfg, run) => {
    const k = KINDS[kind];
    const data = { prompt: cfg.prompt };
    if (k.runnable && cfg.model) data.model = cfg.model;
    if (k.aspect) data.aspect = cfg.aspect;
    if (k.duration) data.duration = cfg.duration;
    if (kind === 'image') data.count = cfg.count;
    // brand: store only when it differs from the project default
    if (cfg.brand && cfg.brand !== (projectBrandId || 'none')) data.brand = cfg.brand;
    const id = addNode(kind, { data, focus: !cfg.prompt && !!k.placeholder });
    // Remember the shape for next time (replaces the old project-settings defaults).
    if (k.aspect || k.duration) setDefaults((d) => ({ ...d, ...(k.aspect ? { aspect: cfg.aspect } : {}), ...(k.duration ? { duration: cfg.duration } : {}) }));
    setDock(null);
    const n = Object.values(cfg.inputs || {}).reduce((a, l) => a + l.length, 0);
    // React Flow applies setNodes on the next tick: wire inputs once the node exists.
    setTimeout(() => {
      Object.entries(cfg.inputs || {}).forEach(([port, list]) => list.forEach((it) => {
        if (it.src === 'asset') attachAsset(id, port, it.id);
        else { const s = rf.getNode(it.id); if (s) connect({ source: it.id, target: id, targetHandle: port }, { checkpoint: false, srcType: KINDS[s.data.kind].output, tgtKind: kind }); }
      }));
      rf.setNodes((ns) => ns.map((x) => ({ ...x, selected: x.id === id })));
      if (run) setTimeout(() => runNode(id), 60);
      else toast(`${rf.getNode(id)?.data.title || k.label} created${n ? ` with ${n} input${n > 1 ? 's' : ''}` : ''}`);
    }, 30);
  };
  const pickMention = (srcId) => {
    const m = mention;
    if (!m) return;
    const t = rf.getNode(m.nodeId); const s2 = rf.getNode(srcId);
    if (!t || !s2) return;
    const title = s2.data.title || KINDS[s2.data.kind].label;
    const v = t.data.prompt || '';
    rf.updateNodeData(t.id, { prompt: v.replace(new RegExp(`@${m.q}$`), `@${title.replace(/\s+/g, '')} `) });
    connect({ source: srcId, target: t.id, targetHandle: 'in' });
    setMention(null);
  };

  /* ---------- agent: plan workflows, edit the selection, approve before spending ---------- */
  // Splits a build into a cheap draft (script, stills) and the expensive final (video, audio), so people check the look before paying for it.
  const phased = (p) => {
    const fin = new Set(p.steps.filter((st) => KINDS[st.kind].runnable && ['video', 'audio'].includes(st.kind)).map((st) => st.key));
    let grew = true;
    while (grew) { grew = false; p.links.forEach(([a, b]) => { if (fin.has(a) && !fin.has(b)) { fin.add(b); grew = true; } }); }
    const hasDraft = p.steps.some((st) => !fin.has(st.key) && KINDS[st.kind].runnable);
    p.phased = hasDraft && fin.size > 0;
    p.steps.forEach((st) => { st.phase = p.phased ? (fin.has(st.key) ? 'final' : 'draft') : undefined; });
    if (p.phased) p.steps = [...p.steps.filter((st) => st.phase === 'draft'), ...p.steps.filter((st) => st.phase === 'final')];
    return p;
  };
  const templatePlan = (t, v = {}) => {
    const steps = t.nodes.map((tn) => {
      let data = { ...tn.data };
      if (tn.data.expose && v[tn.key] != null) data = tn.kind === 'upload' ? { ...data, asset: v[tn.key] } : { ...data, prompt: v[tn.key] };
      if (v.aspect && KINDS[tn.kind].aspect) data.aspect = v.aspect;
      if (v.dur && tn.kind === 'video') data.duration = v.dur;
      const run = KINDS[tn.kind].runnable;
      const d = makeData(tn.kind, data);
      const note = tn.kind === 'upload' ? assetOf(data.asset).name : (data.prompt || KINDS[tn.kind].desc);
      return { key: tn.key, kind: tn.kind, title: data.title, data, note, cost: run ? costOf(d) : 0, secs: run ? secsOf(d) : 0 };
    });
    return phased({ kind: 'build', text: t.name, project: t.project, steps, links: t.edges.map((e) => [...e]), ext: [], cost: steps.reduce((a, x) => a + x.cost, 0), secs: steps.reduce((a, x) => a + x.secs, 0), status: 'pending' });
  };
  const FORMAT_OPTS = ['16:9', '9:16', '1:1', '4:5'].map((x) => ({ id: x, label: x }));
  const LENGTH_OPTS = [5, 10, 15].map((x) => ({ id: x, label: `${x}s` }));
  const assetOpts = (pred) => allAssets().filter((a) => a.type === 'image' && pred(a)).map((a) => ({ id: a.id, label: a.name, thumb: a.url }));
  const briefForPrompt = (p, opt) => {
    const f = []; const w = p.want;
    if (w.image || w.video) f.push({ key: 'asset', label: 'Feature', type: 'asset', options: [...assetOpts((a) => ['Products', 'Characters'].includes(a.cat)), { id: 'none', label: 'Nothing' }], value: p.asset });
    if (p.steps.some((st) => KINDS[st.kind].aspect)) f.push({ key: 'aspect', label: 'Format', type: 'chips', options: FORMAT_OPTS, value: opt.aspect || defaults.aspect || '16:9' });
    if (w.video) f.push({ key: 'dur', label: 'Length', type: 'chips', options: LENGTH_OPTS, value: p.dur });
    f.push({ key: 'tone', label: 'Tone', type: 'chips', options: ['Playful', 'Premium', 'Bold', 'Calm'].map((x) => ({ id: x, label: x })), value: 'Playful' });
    if (w.voice) f.push({ key: 'voice', label: 'Voice', type: 'chips', options: ['Warm', 'Calm', 'Energetic'].map((x) => ({ id: x, label: x })), value: 'Warm' });
    return f;
  };
  const briefForTemplate = (t) => {
    const f = [];
    t.nodes.forEach((tn) => {
      const ex = tn.data.expose; if (!ex) return;
      if (tn.kind === 'upload') { const cat = assetOf(tn.data.asset).cat; f.push({ key: tn.key, label: ex.label, type: 'asset', options: assetOpts((a) => a.cat === cat), value: tn.data.asset }); }
      else if (ex.type === 'choice') f.push({ key: tn.key, label: ex.label, type: 'chips', options: ex.options.map((x) => ({ id: x, label: x })), value: tn.data.prompt });
      else f.push({ key: tn.key, label: ex.label, type: 'text', value: tn.data.prompt });
    });
    if (t.nodes.some((tn) => KINDS[tn.kind].aspect)) f.push({ key: 'aspect', label: 'Format', type: 'chips', options: FORMAT_OPTS, value: defaults.aspect || '16:9' });
    if (t.nodes.some((tn) => tn.kind === 'video')) f.push({ key: 'dur', label: 'Length', type: 'chips', options: LENGTH_OPTS, value: 5 });
    return f;
  };
  const setMsg = (mid, next) => setMessages((m) => m.map((x) => (x.id === mid ? next(x) : x)));
  const startTemplate = (t) => {
    setView('canvas'); setRightTab('agent'); setTemplatesOpen(false);
    const u = { id: 'm' + uid(), role: 'user', text: t.name };
    const mid = 'm' + uid();
    if (auto) {
      const p = templatePlan(t);
      setMessages((m) => [...m, u, { id: mid, role: 'agent', text: 'Here\'s the plan.', proposal: p }]);
      setTimeout(() => approve(mid, true, p), 60);
      return;
    }
    setMessages((m) => [...m, u, { id: mid, role: 'agent', thinking: true, trace: ['Opening the template', `${t.nodes.length} steps, ${t.out.toLowerCase()} at the end`, 'Finding what you need to fill in'] }]);
    setTimeout(() => setMsg(mid, () => ({ id: mid, role: 'agent', text: 'Fill these in and I\'ll lay it out.', brief: { src: 'template', tid: t.id, fields: briefForTemplate(t), status: 'pending', preview: templatePlan(t) } })), 1300);
  };
  const answerBrief = (mid, values) => {
    const b = messages.find((x) => x.id === mid)?.brief;
    if (!b || b.status !== 'pending') return;
    const p = b.src === 'template' ? templatePlan(TEMPLATES.find((t) => t.id === b.tid), values) : planBuild(b.text, { ...b.opt, ...values });
    setMsg(mid, (x) => ({ ...x, brief: { ...b, status: 'done', values, preview: p } }));
    const pid = 'm' + uid();
    const intro = p.phased ? 'Here\'s the plan. I\'ll make a quick draft first, so you can check the look before the expensive part.' : 'Here\'s the plan. Untick anything you don\'t need.';
    setMessages((m) => [...m, { id: pid, role: 'agent', thinking: true, trace: ['Applying your answers', 'Picking the best models', 'Pricing each step'] }]);
    setTimeout(() => setMsg(pid, () => ({ id: pid, role: 'agent', text: intro, proposal: p })), 1100);
  };
  const runFinal = (mid) => {
    const p = messages.find((x) => x.id === mid)?.proposal;
    if (!p?.tracked) return;
    const ids = p.tracked.filter((t) => p.steps[t.step]?.phase === 'final' && rf.getNode(t.nodeId)).map((t) => t.nodeId);
    const cost = ids.reduce((a, id) => a + costOf(rf.getNode(id).data, runsFor(id)), 0);
    if (cost > balRef.current) { openCredits(cost - balRef.current); return; }
    setProposal(mid, { phase: 'final' });
    runSequence(ids);
  };
  const retakeDraft = (mid) => {
    const p = messages.find((x) => x.id === mid)?.proposal;
    if (!p?.tracked) return;
    const ids = p.tracked.filter((t) => p.steps[t.step]?.phase === 'draft' && p.steps[t.step].kind === 'image' && rf.getNode(t.nodeId)).map((t) => t.nodeId);
    if (ids.length) runSequence(ids);
  };
  const planBuild = (text, opt = {}) => {
    const t = text.toLowerCase();
    // attachments from the composer: assets (image / video / audio) and nodes already on the canvas
    const att = opt.attach || [];
    const attAssets = att.filter((x) => x.src === 'asset').map((x) => assetOf(x.id));
    const attNodes = att.filter((x) => x.src === 'node').map((x) => rf.getNode(x.id)).filter(Boolean);
    const firstImg = attAssets.find((x) => x.type !== 'video' && x.type !== 'audio');
    const asset = opt.asset === 'none' ? null : opt.asset ? assetOf(opt.asset) : firstImg || allAssets().find((a) => { const nm = a.name.toLowerCase(); return t.includes(nm) || nm.split(' ').some((w) => w.length > 3 && t.includes(w)) || (a.id === 'tee' && /\b(t-?shirt|shirt|tee)\b/.test(t)); });
    const want = {
      video: /video|clip|\bads?\b|reel|commercial|anim|footage|tiktok|motion|\b\d+ ?s\b|second/.test(t),
      image: /image|photo|poster|picture|still|shots?\b|thumbnail|banner|storyboard|frame/.test(t),
      voice: /voice|narrat|\bvo\b|dub|speak/.test(t),
      music: /music|soundtrack|song|score|jingle/.test(t),
      script: /script|caption|copy\b|hook|tagline|storyboard/.test(t),
    };
    if (opt.kind) want[{ writer: 'script', audio: 'voice' }[opt.kind] || opt.kind] = true;
    if (attAssets.some((x) => x.type === 'video' || x.type === 'audio') || attNodes.some((x) => ['video', 'audio'].includes(KINDS[x.data.kind]?.output))) want.video = true;
    if (!Object.values(want).some(Boolean)) want.image = true;
    const nWord = (t.match(/\b(two|three|four|2|3|4)\b/) || [])[1];
    const n = { two: 2, three: 3, four: 4 }[nWord] || Number(nWord) || 1;
    const dur = opt.dur || (/10 ?s|10-second|ten second|10 second/.test(t) ? 10 : /\b3 ?s\b|3-second/.test(t) ? 3 : 5);
    const tone = opt.tone ? `, ${opt.tone.toLowerCase()} tone` : '';
    const steps = []; const links = [];
    const add = (key, kind, title, data, note) => steps.push({ key, kind, title, data, note });
    if (asset) add('src', 'upload', asset.name, { asset: asset.id }, 'Your image, used as the reference');
    if (want.script || want.voice) add('script', 'writer', 'Script', { prompt: `Write a short script for: ${text}` }, 'Hook, lines and a call to action');
    const needImg = want.image || (want.video && asset);
    if (needImg) {
      add('img', 'image', want.video ? 'Key frame' : n > 1 ? `${n} images` : 'Image', { prompt: text + tone, count: want.video ? 1 : Math.min(4, n), model: asset ? 'Nano Banana Pro' : 'Auto' }, want.video ? 'Sets the look of the video' : asset ? 'Keeps your product consistent' : 'Your image');
      if (asset) links.push(['src', 'img', 'ref']);
    }
    if (want.video) {
      add('vid', 'video', 'Video', { prompt: text + tone, duration: dur }, `${dur}s clip`);
      if (needImg) links.push(['img', 'vid', 'start']); else if (asset) links.push(['src', 'vid', 'start']);
      if (want.script) links.push(['script', 'vid', 'prompt']);
    }
    if (want.voice) { add('vo', 'audio', 'Voice-over', { prompt: `${opt.voice || 'Warm'}, upbeat narrator` }, 'Reads the script'); links.push(['script', 'vo', 'script']); }
    if (want.music) { add('mus', 'audio', 'Music', { prompt: 'Light, upbeat track', model: 'Score Gen' }, 'Background track'); if (want.video) links.push(['vid', 'mus', 'video']); }
    const has = (k) => steps.some((x) => x.key === k);
    attAssets.filter((x) => x !== asset).forEach((x, i) => {
      const key = 'att' + i;
      const kind = x.type === 'video' ? 'clip' : x.type === 'audio' ? 'sound' : 'upload';
      const port = kind === 'upload' ? (has('img') ? ['img', 'ref'] : has('vid') ? ['vid', 'refimg'] : null) : kind === 'clip' ? (has('vid') ? ['vid', 'refvideo'] : null) : (has('vid') ? ['vid', 'audio'] : null);
      if (!port) return;
      add(key, kind, x.name, { asset: x.id }, kind === 'sound' ? 'Your audio' : 'Your reference');
      links.push([key, port[0], port[1]]);
    });
    const ext = [];
    attNodes.forEach((nd) => {
      const ty = KINDS[nd.data.kind]?.output;
      const port = ty === 'image' ? (has('img') ? ['img', 'ref'] : has('vid') ? ['vid', 'refimg'] : null) : ty === 'video' ? (has('vid') ? ['vid', 'refvideo'] : null) : ty === 'audio' ? (has('vid') ? ['vid', 'audio'] : null) : ty === 'text' ? (has('vid') ? ['vid', 'prompt'] : has('img') ? ['img', 'prompt'] : null) : null;
      if (port) ext.push([nd.id, port[0], port[1], ty]);
    });
    // format and brand from the composer pills
    steps.forEach((st) => {
      if (opt.aspect && KINDS[st.kind].aspect) st.data = { ...st.data, aspect: opt.aspect };
      if (opt.brand && opt.brand !== (projectBrandId || 'none') && KINDS[st.kind].runnable) st.data = { ...st.data, brand: opt.brand };
    });
    steps.forEach((st) => { const d = makeData(st.kind, st.data); st.cost = KINDS[st.kind].runnable ? costOf(d) : 0; st.secs = KINDS[st.kind].runnable ? secsOf(d) : 0; });
    return phased({ kind: 'build', text, steps, links, ext, want, asset: asset?.id || 'none', dur, cost: steps.reduce((s2, x) => s2 + x.cost, 0), secs: steps.reduce((s2, x) => s2 + x.secs, 0), status: 'pending' });
  };
  const EDIT_MAP = [
    [/animat|turn (it )?into (a )?video|make (it )?(a )?video/, 'Animate into video'],
    [/upscal|4k|sharper|higher res/, 'Upscale to 4K'],
    [/voice|narrat/, ['Add voice-over', 'Turn into voice-over']],
    [/music|soundtrack/, 'Add music'],
    [/layer|separate|split/, 'layers'],
    [/edit (the )?(region|area)|inpaint|remove|erase|replace the/, 'Edit a region'],
  ];
  const planEdit = (text, sel, opt = {}) => {
    const t = text.toLowerCase();
    const steps = []; const ops = [];
    sel.forEach((n) => {
      const k = KINDS[n.data.kind];
      const title = n.data.title || k.label;
      const o = outputOf(n);
      const labelFor = (lab) => (Array.isArray(lab) ? lab.find((x) => (NEXT_STEPS[k.output] || []).some((y) => y.label === x)) : lab);
      const hit = EDIT_MAP.map(([re, lab]) => [re, labelFor(lab)]).find(([re, label]) => label && re.test(t) && o && (label === 'layers' ? k.output === 'image' : (NEXT_STEPS[k.output] || []).some((x) => x.label === label)));
      // the composer's Format chip counts as an instruction when it differs from the node
      const aspect = (/9:16|vertical|portrait|story|stories|\breel/.test(t) ? '9:16' : /1:1|square/.test(t) ? '1:1' : /16:9|landscape|widescreen/.test(t) ? '16:9' : /4:5/.test(t) ? '4:5' : null)
        || (opt.aspect && k.aspect && opt.aspect !== n.data.aspect ? opt.aspect : null);
      const curBrand = n.data.brand || projectBrandId || 'none';
      const brandTo = opt.brand && k.runnable && opt.brand !== curBrand ? opt.brand : null;
      const cheap = /cheaper|budget|save credits|less credits|lower cost/.test(t) && k.runnable ? [...(MODELS[n.data.kind] || [])].sort((a, b) => a.cost - b.cost)[0] : null;
      const vm = t.match(/\b(\d|two|three|four)\b (more )?(variations|versions|takes|options|images)/);
      const vn = vm ? ({ two: 2, three: 3, four: 4 }[vm[1]] || Number(vm[1])) : 0;
      if (aspect && k.runnable && k.aspect) {
        steps.push({ kind: n.data.kind, title: `${aspect} version of ${title}`, note: 'Same settings and inputs, new shape', cost: costOf({ ...n.data, aspect }, runsFor(n.id)), secs: secsOf(n.data) });
        ops.push({ type: 'variant', nodeId: n.id, aspect });
      } else if (cheap && cheap.name !== n.data.model) {
        steps.push({ kind: n.data.kind, title: `Regenerate ${title} with ${cheap.name}`, note: `${cheap.note}`, cost: costOf({ ...n.data, model: cheap.name }, runsFor(n.id)), secs: secsOf({ ...n.data, model: cheap.name }) });
        ops.push({ type: 'model', nodeId: n.id, model: cheap.name });
      } else if (vn && k.runnable) {
        const extra = n.data.kind === 'image' ? { count: Math.min(4, vn) } : {};
        steps.push({ kind: n.data.kind, title: `${vn} more ${n.data.kind === 'image' ? 'variations' : 'takes'} of ${title}`, note: 'Added as new takes', cost: costOf({ ...n.data, ...extra }, runsFor(n.id)) * (n.data.kind === 'image' ? 1 : vn), secs: secsOf(n.data) });
        ops.push({ type: 'more', nodeId: n.id, n: vn, extra });
      } else if (hit) {
        const nx = hit[1] === 'layers' ? { kind: 'layers' } : (NEXT_STEPS[k.output] || []).find((x) => x.label === hit[1]);
        const c = costOf(makeData(nx.kind, nx.model ? { model: nx.model } : {}));
        steps.push({ kind: nx.kind, title: hit[1] === 'layers' ? 'Split into layers' : hit[1], note: `from ${title}`, cost: c, secs: secsOf(makeData(nx.kind)) });
        ops.push({ type: 'next', nodeId: n.id, label: hit[1] });
      } else if (k.runnable) {
        const c = costOf(n.data, runsFor(n.id));
        steps.push({ kind: n.data.kind, title: `New take of ${title}`, note: `“${text}”`, cost: c, secs: secsOf(n.data) });
        ops.push({ type: 'refine', nodeId: n.id });
      } else if (n.data.kind === 'note' || n.data.kind === 'list') {
        steps.push({ kind: n.data.kind, title: `Update ${title}`, note: `“${text}”`, cost: 0, secs: 0 });
        ops.push({ type: 'rewrite', nodeId: n.id });
      }
      if (brandTo && ops.length && ops[ops.length - 1].nodeId === n.id) {
        ops[ops.length - 1].brand = brandTo;
        const bn = brandTo === 'none' ? 'no brand' : brands.find((b) => b.id === brandTo)?.name;
        if (bn) steps[steps.length - 1].note = `${steps[steps.length - 1].note} · ${bn}`;
      }
    });
    return { kind: 'edit', text, steps, ops, cost: steps.reduce((a, x) => a + x.cost, 0), secs: steps.reduce((a, x) => a + x.secs, 0), status: 'pending' };
  };
  // Writes a text note from the instruction and what's around it (prototype stand-in for the writer model).
  const writeNote = (n, instr) => {
    const t = instr.toLowerCase().trim();
    const cur = (n.data.prompt || '').trim();
    const sentences = (s) => s.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    if (cur && /\b(short|shorter|shorten|tighten|trim|concise)\b/.test(t)) return sentences(cur).slice(0, 2).join(' ');
    if (cur && /\b(bullet|bullets|list|points)\b/.test(t)) return sentences(cur).map((x) => `• ${x.replace(/[.]$/, '')}`).join('\n');
    if (cur && /\b(punchier|catchier|bolder|stronger)\b/.test(t)) return sentences(cur).map((x) => x.replace(/\b(very|really|quite|just)\s+/gi, '')).join(' ');
    const fed = rf.getEdges().filter((e) => e.source === n.id).map((e) => rf.getNode(e.target)).filter(Boolean);
    const products = rf.getNodes().filter((x) => x.data.kind === 'upload').map((x) => (x.data.title || '').toLowerCase()).filter(Boolean);
    const prod = [...new Set(products)].slice(0, 2).join(' and ') || 'the product';
    const focus = /^(fill( it| this)?|write( it| this)?|complete( it)?|draft( it)?|do it)\.?$/.test(t) ? '' : ` Focus: ${instr.trim().replace(/[.]$/, '')}.`;
    if (fed.length) {
      const goal = (fed[0].data.prompt || '').trim().replace(/[.]$/, '') || `a ${KINDS[fed[0].data.kind].label.toLowerCase()} for ${prod}`;
      return `Brief for ${fed[0].data.title || KINDS[fed[0].data.kind].label}: ${goal}. Bright summer light, warm and playful. Show ${prod} clearly in the first two seconds and end on the logo.${focus}`;
    }
    return `${cur ? cur + '\n' : ''}Summer campaign for ${prod}. Bright, warm and playful; one clear idea per shot. Hook in the first two seconds, product always in frame, end on the logo.${focus}`;
  };
  const revertNote = (mid) => {
    const m = messages.find((x) => x.id === mid);
    if (!m?.applied || m.applied.reverted) return;
    rf.updateNodeData(m.applied.nodeId, { prompt: m.applied.before });
    setMessages((ms) => ms.map((x) => (x.id === mid ? { ...x, applied: { ...x.applied, reverted: true } } : x)));
  };
  const ask = (text, optOrTargets = {}) => {
    const opt = Array.isArray(optOrTargets) ? { targets: optOrTargets } : (optOrTargets || {});
    if (opt.targets?.length) rf.setNodes((ns) => ns.map((n) => ({ ...n, selected: opt.targets.includes(n.id) })));
    const sel = opt.whole ? [] : opt.targets?.length ? opt.targets.map((id) => rf.getNode(id)).filter(Boolean) : rf.getNodes().filter((n) => n.selected && n.type !== 'frame');
    const target = sel.length === 0 ? 'Whole canvas' : sel.length === 1 ? (sel[0].data.title || KINDS[sel[0].data.kind].label) : `${sel.length} nodes`;
    const u = { id: 'm' + uid(), role: 'user', text, target };
    setRightTab('agent');
    if (/^(how|what|why|where|can i|help)\b/i.test(text.trim()) || text.trim().endsWith('?')) {
      setMessages((m) => [...m, u, { id: 'm' + uid(), role: 'agent', text: 'Tell me the result you want and I\'ll lay out the steps. Select a node first to change just that one. Use the rail on the left to add steps by hand, and the + on a node to give it inputs.' }]);
      return;
    }
    const p = sel.length ? planEdit(text, sel, opt) : planBuild(text, opt);
    if (!p.steps.length) {
      setMessages((m) => [...m, u, { id: 'm' + uid(), role: 'agent', text: 'I can\'t change that selection with an instruction. Try selecting an AI step or a text note.' }]);
      return;
    }
    // text notes are free and instant: just write them, with an undo
    if (p.kind === 'edit' && p.ops.length && p.ops.every((o) => o.type === 'rewrite')) {
      const mid = 'm' + uid();
      setMessages((m) => [...m, u, { id: mid, role: 'agent', thinking: true }]);
      setTimeout(() => {
        checkpoint();
        const done = p.ops.map((o) => {
          const n = rf.getNode(o.nodeId); if (!n) return null;
          const before = n.data.prompt || ''; const after = writeNote(n, text);
          rf.updateNodeData(n.id, { prompt: after });
          return { nodeId: n.id, before, after };
        }).filter(Boolean);
        const first = done[0];
        setMessages((m) => m.map((x) => (x.id === mid ? { id: mid, role: 'agent', applied: first && { ...first, title: rf.getNode(first.nodeId)?.data.title || 'Text' } } : x)));
      }, 650);
      return;
    }
    // a new build gets a few quick questions first; Auto skips them
    if (p.kind === 'build' && !auto) {
      const mid = 'm' + uid();
      const trace = ['Reading your brief', p.asset !== 'none' ? `Found ${assetOf(p.asset).name} in your Library` : 'Checking your Library', `Sketching ${p.steps.length} step${p.steps.length === 1 ? '' : 's'}`];
      setMessages((m) => [...m, u, { id: mid, role: 'agent', thinking: true, trace }]);
      setTimeout(() => setMsg(mid, () => ({ id: mid, role: 'agent', text: 'A few details first.', brief: { src: 'prompt', text, opt, fields: briefForPrompt(p, opt), status: 'pending', preview: p } })), 1300);
      return;
    }
    const intro = p.kind === 'build'
      ? `Here's how I'd make it. Untick anything you don't need.`
      : `Here's the change for ${target}. Nothing gets overwritten.`;
    const mid = 'm' + uid();
    setMessages((m) => [...m, u, { id: mid, role: 'agent', thinking: true }]);
    setTimeout(() => {
      setMessages((m) => m.map((x) => (x.id === mid ? { id: mid, role: 'agent', text: intro, proposal: p } : x)));
      if (auto) setTimeout(() => approve(mid, true, p), 60);
    }, 650);
  };
  const setProposal = (mid, patch) => setMessages((m) => m.map((x) => (x.id === mid ? { ...x, proposal: { ...x.proposal, ...patch } } : x)));
  const approve = (mid, generate, given, mode) => {
    const p0 = given || messages.find((x) => x.id === mid)?.proposal;
    if (!p0 || p0.status !== 'pending') return;
    const off = p0.off || [];
    const keep = p0.steps.map((st, i) => ({ st, i })).filter(({ i }) => !off.includes(i));
    const p = { ...p0, steps: keep.map((x) => x.st), ops: p0.ops ? keep.map((x) => p0.ops[x.i]) : undefined, cost: keep.reduce((a, x) => a + x.st.cost, 0) };
    if (p.kind === 'build') { const keys = new Set(p.steps.map((x) => x.key)); p.links = p0.links.filter(([a, b]) => keys.has(a) && keys.has(b)); }
    const draftOnly = mode === 'draft' && p0.phased;
    const runCost = draftOnly ? p.steps.filter((st) => st.phase !== 'final').reduce((a, x) => a + x.cost, 0) : p.cost;
    if (generate && runCost > balRef.current) { openCredits(runCost - balRef.current); return; }
    checkpoint();
    const tracked = [];
    if (p.kind === 'build') {
      const c = viewCenter();
      const all = rf.getNodes().filter((n) => n.type !== 'frame' && !n.parentId);
      const baseX = all.length ? Math.max(...all.map((n) => n.position.x + size(n).w)) + 160 : c.x - 300;
      const baseY = all.length ? Math.min(...all.map((n) => n.position.y)) : c.y - 60;
      if (p.project && !all.length) setProjectName(p.project);
      const rank = {};
      p.steps.forEach((st) => { const ins = p.links.filter((l) => l[1] === st.key); rank[st.key] = ins.length ? Math.max(...ins.map((l) => (rank[l[0]] ?? 0) + 1)) : 0; });
      const rows = {}; const ids = {};
      const ns = p.steps.map((st) => {
        const r = rank[st.key]; rows[r] = (rows[r] || 0) + 1;
        ids[st.key] = uid();
        return { id: ids[st.key], type: 'studio', position: { x: baseX + r * (W + 130), y: baseY + (rows[r] - 1) * 300 }, data: makeData(st.kind, { ...st.data, title: st.title }) };
      });
      const es = p.links.map(([a, b, port]) => {
        const st = KINDS[p.steps.find((x) => x.key === a).kind].output;
        return { id: 'e' + uid(), source: ids[a], sourceHandle: 'out', target: ids[b], targetHandle: port, style: { stroke: PORT_COLORS[st], strokeWidth: 2 }, data: { type: st } };
      });
      const ex = (p.ext || []).filter(([, key]) => ids[key]).map(([src, key, port, ty]) => ({ id: 'e' + uid(), source: src, sourceHandle: 'out', target: ids[key], targetHandle: port, style: { stroke: PORT_COLORS[ty], strokeWidth: 2 }, data: { type: ty } }));
      rf.setNodes((x) => [...x.map((n) => (n.selected ? { ...n, selected: false } : n)), ...ns]);
      rf.setEdges((x) => [...x, ...es, ...ex]);
      setTimeout(() => { resolveOverlaps(); rf.fitView({ duration: 450, padding: 0.18, maxZoom: 1 }); }, 120);
      if (generate) {
        keep.forEach(({ st, i }) => { if (KINDS[st.kind].runnable) tracked.push({ step: i, nodeId: ids[st.key], base: 0 }); });
        const toRun = keep.filter(({ st }) => KINDS[st.kind].runnable && !(draftOnly && st.phase === 'final')).map(({ st }) => ids[st.key]);
        setTimeout(() => runSequence(toRun), 260);
      }
    } else {
      const runIds = [];
      p.ops.forEach((op, j) => {
        const n = rf.getNode(op.nodeId);
        if (!n) return;
        const stepIdx = keep[j].i;
        const base = (n.data.takes || []).length;
        if (op.brand) { const v = op.brand === (projectBrandId || 'none') ? undefined : op.brand; if (op.type !== 'variant') rf.updateNodeData(n.id, { brand: v }); else n.data = { ...n.data, brand: v }; }
        if (op.type === 'variant') {
          const nid = uid();
          const { measured, ...rest } = n;
          rf.setNodes((ns) => [...ns.map((x) => (x.selected ? { ...x, selected: false } : x)), { ...rest, id: nid, selected: true, position: { x: n.position.x, y: n.position.y + size(n).h + 60 }, data: { ...n.data, title: `${n.data.title || KINDS[n.data.kind].label} · ${op.aspect}`, aspect: op.aspect, takes: [], takeIdx: 0, status: 'draft' } }]);
          rf.setEdges((es) => [...es, ...es.filter((e) => e.target === n.id).map((e) => ({ ...e, id: 'e' + uid(), target: nid, selected: false }))]);
          runIds.push(nid); tracked.push({ step: stepIdx, nodeId: nid, base: 0 });
          setTimeout(resolveOverlaps, 150);
        }
        if (op.type === 'model') { rf.updateNodeData(n.id, { model: op.model }); runIds.push(n.id); tracked.push({ step: stepIdx, nodeId: n.id, base }); }
        if (op.type === 'more') { rf.updateNodeData(n.id, op.extra); for (let r = 0; r < (n.data.kind === 'image' ? 1 : op.n); r++) runIds.push(n.id); tracked.push({ step: stepIdx, nodeId: n.id, base }); }
        if (op.type === 'refine') { const v = (n.data.prompt || '').trim(); rf.updateNodeData(n.id, { prompt: v ? `${v.replace(/[.\s]+$/, '')}. ${p.text}` : p.text }); runIds.push(n.id); tracked.push({ step: stepIdx, nodeId: n.id, base }); }
        if (op.type === 'rewrite') rf.updateNodeData(n.id, { prompt: writeNote(n, p.text) });
        if (op.type === 'next') { const nid = op.label === 'layers' ? addNode('layers', { from: { nodeId: n.id, port: 'source', type: 'image' } }) : addNext(n.id, op.label); if (nid) { runIds.push(nid); tracked.push({ step: stepIdx, nodeId: nid, base: 0 }); } }
      });
      if (generate && runIds.length) {
        const uniq = [...new Set(runIds)];
        const repeat = runIds.length - uniq.length;
        setTimeout(async () => { await runSequence(uniq); for (let r = 0; r < repeat; r++) await runSequence([runIds[0]]); }, 220);
      }
    }
    setProposal(mid, { status: 'approved', ran: generate && p.cost > 0, tracked: generate ? tracked : [], phase: generate ? (draftOnly ? 'draft' : 'all') : undefined });
  };
  const discard = (mid) => setProposal(mid, { status: 'discarded' });
  const toggleStep = (mid, i) => setMessages((m) => m.map((x) => (x.id === mid ? { ...x, proposal: { ...x.proposal, off: (x.proposal.off || []).includes(i) ? x.proposal.off.filter((k) => k !== i) : [...(x.proposal.off || []), i] } } : x)));
  const nodeInfo = (id, base = 0) => {
    const n = rf.getNode(id);
    if (!n) return null;
    const k = KINDS[n.data.kind];
    const o = outputOf(n);
    const done = !k.runnable || (n.data.status === 'done' && (n.data.takes || []).length > base);
    return { title: n.data.title || k.label, kind: n.data.kind, status: n.data.status, progress: n.data.progress, done, thumb: o?.url, text: o?.text };
  };
  const agentSuggestions = () => {
    const ns = rf.getNodes().filter((n) => n.type !== 'frame');
    if (!ns.length) return [
      { text: 'A 10s summer ad for the striped tee, with a voice-over' },
      { text: 'Three product shots of the lemon soda' },
      { text: 'Storyboard a lemon escaping the kitchen' },
    ];
    const out = [];
    const vid = [...ns].reverse().find((n) => n.data.kind === 'video' && (n.data.takes || []).length);
    const img = [...ns].reverse().find((n) => n.data.kind === 'image' && (n.data.takes || []).length);
    if (vid) out.push({ text: `Make a 9:16 version of ${vid.data.title}`, targets: [vid.id] }, { text: `Add music to ${vid.data.title}`, targets: [vid.id] });
    if (img) out.push({ text: `Animate ${img.data.title}`, targets: [img.id] }, { text: `3 more variations of ${img.data.title}`, targets: [img.id] });
    if (!vid) out.push({ text: 'Turn this into a 10s video ad' });
    return out.slice(0, 4);
  };
  const cancelRun = (runId) => cancelled.current.add(runId);

  const actions = {
    ask,
    runsFor, assetUrl: (id) => assetOf(id).url, assetName: (id) => assetOf(id).name, asset: (id) => assetOf(id), allAssets,
    preview: (id) => { const n = rf.getNode(id); if ((n?.data.takes || []).length) setPreviewId(id); },
    openNodeMenu: (nodeId, x, y) => { selectOnly(nodeId); setNodeMenu({ nodeId, x, y }); },
    openMention: (nodeId, q, x, y) => setMention({ nodeId, q, x, y }),
    closeMention: (nodeId) => setMention((m) => (m && m.nodeId === nodeId ? null : m)),
    portLinks, detach, hasOut: (id) => rf.getEdges().some((e) => e.source === id),
    openAttach: (nodeId, portId) => setAttach({ nodeId, step: 'pick', portId }),
    openInputs: (nodeId) => { holdInputs(); setAttach((a) => (a && a.nodeId === nodeId && a.step === 'pick' ? a : { nodeId, step: 'list' })); },
    leaveInputs: () => releaseInputs(),
    toast, reasonFor, inputsList, runNode, runSelected, runAll, askRunAll, runGroup, pendingIds, addNext, openCredits, setLeftTab,
    useTemplate, startTemplate, addFromPanel,
    openCreate: (kind) => toggleDock({ type: 'create', kind }),
    addAsset,
    brands: () => brands, projectBrand: () => projectBrand, openBrands: () => setDock({ type: 'brand' }),
    update: (id, patch) => rf.updateNodeData(id, patch),
    openNext: (id, x, y) => setNextMenu({ id, x, y }),
    openInspector: (id, picker) => { selectOnly(id); setInspOpen(true); setPickerOpen(!!picker); },
    focusTake: (id, i) => {
      rf.updateNodeData(id, { takeIdx: i });
      selectOnly(id);
      const n = rf.getNode(id);
      if (n) rf.setCenter(n.position.x + W / 2, n.position.y + 200, { zoom: Math.max(rf.getZoom(), 0.85), duration: 400 });
    },
    toggleFav: (id, i) => {
      const n = rf.getNode(id);
      rf.updateNodeData(id, { takes: n.data.takes.map((t, j) => (j === i ? { ...t, fav: !t.fav } : t)) });
    },
  };

  /* ---------- keyboard: shortcuts never fire while typing ---------- */
  const keyRef = useRef(null);
  keyRef.current = { toggleComments: () => setRightTab((t) => (t === 'comments' ? null : 'comments')), runNode, runSelected, runAll, askRunAll, undo, redo, duplicate, tidy, copySel, paste, duplicateBare, groupSel, resizeSel, setPanMode, preview: actions.preview, addNode, blocked: !!(palette || credits || shortcuts || previewId || assetsOpen || brandOpen || tour) };
  useEffect(() => {
    const h = (e) => {
      const k = keyRef.current;
      const t = e.target;
      const typing = t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (typing) { t.blur(); return; }
        if (dockRef.current) { setDock(null); return; }
        setMenu(null); setNextMenu(null); setPalette(null); setAttach(null); setPickerOpen(false); setShortcuts(false); setCredits(null); setNodeMenu(null); setMention(null); setPop(null); setPreviewId(null);
        rf.setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
        return;
      }
      if (typing) {
        if (meta && e.key === 'Enter') {
          const el = t.closest('.react-flow__node');
          if (el) { e.preventDefault(); k.runNode(el.dataset.id); }
        }
        return;
      }
      if (k.blocked) return;
      if (meta && e.key === 'Enter') { e.preventDefault(); e.shiftKey ? k.askRunAll() : k.runSelected(); return; }
      if (meta && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? k.redo() : k.undo(); return; }
      if (meta && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); e.shiftKey ? k.duplicateBare() : k.duplicate(); return; }
      if (meta && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); rf.setNodes((ns) => ns.map((n) => (n.parentId || n.selected ? n : { ...n, selected: true }))); return; }
      if (meta && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); k.copySel(false); return; }
      if (meta && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); k.copySel(true); return; }
      if (meta && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); k.paste(!e.shiftKey); return; }
      if (meta && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); k.groupSel(); return; }
      if (meta && (e.key === '=' || e.key === '+')) { e.preventDefault(); k.resizeSel(40); return; }
      if (meta && (e.key === '-' || e.key === '_')) { e.preventDefault(); k.resizeSel(-40); return; }
      if (meta) return;
      if (e.key === 'h' || e.key === 'H') { k.setPanMode(true); return; }
      if (e.key === 'v' || e.key === 'V') { k.setPanMode(false); return; }
      if (e.key === 'c' || e.key === 'C') { k.toggleComments(); return; }
      if (e.key === 'a' || e.key === 'A') { const s1 = rf.getNodes().find((n) => n.selected); if (s1) k.preview(s1.id); return; }
      if (e.key === '/' || e.key === 'n' || e.key === 'N') { e.preventDefault(); setPalette({}); return; }
      if (e.key === 'f' || e.key === 'F') { rf.fitView({ duration: 300, padding: 0.2, maxZoom: 1 }); return; }
      if (e.key === 'T' && e.shiftKey) { k.tidy(rf.getNodes().filter((n) => n.selected).length > 1); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* ---------- connections ---------- */
  const isValidConnection = (c) => {
    if (c.source === c.target) return false;
    const s = rf.getNode(c.source);
    const t = rf.getNode(c.target);
    if (!s || !t) return false;
    const out = KINDS[s.data.kind].output;
    if (c.targetHandle === 'in') return KINDS[t.data.kind].inputs.some((p) => p.type === out);
    const port = KINDS[t.data.kind].inputs.find((p) => p.id === c.targetHandle);
    return !!port && port.type === out;
  };
  const onConnectStart = (_, { nodeId, handleId, handleType }) => {
    const n = rf.getNode(nodeId);
    if (!n) return;
    const k = KINDS[n.data.kind];
    if (handleType === 'source') setConnecting({ type: k.output, from: 'source', nodeId });
    else setConnecting({ types: [...new Set(k.inputs.map((p) => p.type))], from: 'target', nodeId });
  };
  const onConnectEnd = (event, state) => {
    setConnecting(null);
    if (state && !state.isValid && state.fromNode && state.fromHandle?.type === 'source') {
      const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
      // Dropped anywhere on a card: connect it to the right input.
      const hit = document.elementFromPoint(pt.clientX, pt.clientY);
      const card = hit && hit.closest && hit.closest('.react-flow__node');
      if (card && card.dataset.id && card.dataset.id !== state.fromNode.id) {
        const c = { source: state.fromNode.id, target: card.dataset.id, targetHandle: 'in' };
        if (isValidConnection(c)) connect(c);
        else toast(`${rf.getNode(card.dataset.id)?.data.title || 'That node'} can't take ${KINDS[state.fromNode.data.kind].output}`);
        return;
      }
      const target = event.target;
      if (target && target.classList && target.classList.contains('react-flow__pane')) {
        setPalette({ from: state.fromNode.id, at: rf.screenToFlowPosition({ x: pt.clientX - W / 2, y: pt.clientY - 60 }) });
      }
    }
  };

  /* ---------- drag & drop from panels ---------- */
  const onDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/lp');
    if (!raw) return;
    const p = JSON.parse(raw);
    const pos = rf.screenToFlowPosition({ x: e.clientX - W / 2, y: e.clientY - 40 });
    addNode(p.kind, { position: pos, data: p.asset ? { asset: p.asset, title: assetOf(p.asset).name } : {} });
  };

  /* ---------- palette commands ---------- */
  const paletteCommands = useMemo(() => {
    if (!palette) return [];
    if (palette.from) {
      const src = rf.getNode(palette.from);
      const out = src && KINDS[src.data.kind].output;
      return KIND_ORDER.filter((k) => KINDS[k].inputs.some((p) => p.type === out)).map((k) => {
        const port = KINDS[k].inputs.find((p) => p.type === out);
        return { id: k, kind: k, label: KINDS[k].label, hint: `Connects to ${port.label}`, run: () => addNode(k, { from: { nodeId: palette.from, port: port.id, type: out }, position: palette.at }) };
      });
    }
    const add = KIND_ORDER.map((k) => ({ id: 'add-' + k, kind: k, label: KINDS[k].label, hint: KINDS[k].desc, run: () => addFromPanel(k) }));
    const cmds = [
      { id: 'runall', icon: Generate, label: 'Generate everything waiting…', kbd: '⌘⇧↵', run: () => askRunAll() },
      { id: 'tidy', icon: LayoutGrid, label: 'Tidy up canvas', hint: 'Lay out left to right', kbd: '⇧T', run: () => tidy(false) },
      { id: 'fit', icon: Maximize, label: 'Fit view', kbd: 'F', run: () => rf.fitView({ duration: 300, padding: 0.2, maxZoom: 1 }) },
      { id: 'form', icon: ListChecks, label: 'Switch to Form view', run: () => setView('form') },
      ...TEMPLATES.map((t) => ({ id: 'tpl-' + t.id, icon: Workflow, label: `Use template: ${t.name}`, hint: t.desc, run: () => startTemplate(t) })),
      { id: 'keys', icon: Keyboard, label: 'Keyboard shortcuts', run: () => setShortcuts(true) },
    ];
    return [...add, ...cmds];
  }, [palette]);

  /* ---------- derived ---------- */
  const pending = pendingIds();
  const runAllIds = pending.length ? pending : runnableIds();
  const runAllCost = runAllIds.reduce((s, id) => s + costOf(rf.getNode(id)?.data || {}), 0);
  const runningCount = nodes.filter((n) => n.data.status === 'running' || n.data.status === 'queued').length;
  const doneCount = nodes.filter((n) => n.data.status === 'done').length;
  const singleSel = selected.length === 1 ? selected[0] : null;
  const ctxValue = { balance, connecting, actions };

  const nextOpts = nextMenu ? (NEXT_STEPS[KINDS[rf.getNode(nextMenu.id)?.data.kind]?.output] || []) : [];

  // presence (simulated): a teammate who has joined is on the canvas, looking at the latest result
  const here = {};
  const seen = nodes.filter((n) => n.type !== 'frame' && (n.data.takes || []).length);
  for (const p of people) if (p.email === 'sam@studio.com') { const n = seen[seen.length - 1] || nodes[0]; if (n) here[p.email] = { id: n.id, title: n.data.title || KINDS[n.data.kind]?.label || 'the canvas' }; }
  const goToNode = (id) => { const n = rf.getNode(id); if (!n) return; selectOnly(id); rf.setCenter(n.position.x + (n.measured?.width || 280) / 2, n.position.y + (n.measured?.height || 200) / 2, { zoom: Math.max(rf.getZoom(), 0.85), duration: 400 }); };
  const composerCtx = { assets: allAssets(), brands, defaultBrand: projectBrandId, defaultAspect: defaults.aspect || '16:9', addAsset, onManageBrands: () => setDock({ type: 'brand' }),
                nodes: nodes.filter((n) => n.type !== 'frame' && outputOf(n)).map((n) => ({ id: n.id, title: n.data.title || KINDS[n.data.kind].label, kind: n.data.kind, thumb: outputOf(n)?.url })) };
  const totalTakes = nodes.reduce((s, n) => s + (n.data.takes || []).length, 0);
  const selRunnable = selected.filter((n) => KINDS[n.data.kind].runnable);
  const hasForm = nodes.some((n) => n.data.expose);
  const [flow, setFlow] = useState(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const showRight = view === 'canvas' && !!rightTab && rightTab !== 'settings';
  const deselect = () => rf.setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
  const resetAll = (quiet) => {
    try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    rf.setNodes([]); rf.setEdges([]);
    balRef.current = 2000; setBalance(2000);
    setProjectName('Untitled project'); setView('canvas'); setRightTab(null); setMessages([]); setRuns([]);
    setComments([]); setChats([]); setPeople([]); setOpenComment(null); setCommentMode(false); setDock(null);
    past.current = []; future.current = [];
    if (quiet !== true) toast('New project');
  };
  // Prototype: a project that has been worked on (results, chat, comments, a collaborator, runs)
  const loadSample = () => {
    setFlowLoading(true);
    resetAll(true);
    const ago = (m) => Date.now() - m * 60000;
    setPeople([{ email: 'sam@studio.com', role: 'Can edit', name: 'Sam Lee', joined: true }]);
    const t = TEMPLATES.find((x) => x.id === 'ad') || TEMPLATES[0];
    setTimeout(() => {
      useTemplate(t, { quiet: true });
      setTimeout(() => {
        const order = topo(rf.getNodes().map((n) => n.id));
        const made = []; let i = 0;
        const step = () => {
          while (i < order.length) {
          const n = rf.getNode(order[i]); const mins = 190 - i * 14; i += 1;
          if (n && KINDS[n.data.kind].runnable) {
            const tk = { ...makeTake(n, null, 0), src: n.data.prompt || '', ts: ago(mins) };
            rf.updateNodeData(n.id, { status: 'done', progress: 100, takes: [tk], takeIdx: 0 });
            made.push({ id: 'r' + uid(), nodeId: n.id, kind: n.data.kind, title: n.data.title || KINDS[n.data.kind].label, model: findModel(n.data.kind, n.data.model)?.name, cost: costOf(n.data), status: 'done', progress: 100, ts: ago(mins) });
          }
          }
          finish();
        };
        const finish = () => {
          const ns = rf.getNodes();
          const byKind = (k) => ns.find((n) => n.data.kind === k);
          const vid = byKind('video'); const wr = byKind('writer'); const up = byKind('upload');
          const at = (n) => (n ? { nodeId: n.id, dx: (n.measured?.width || 320) - 10, dy: 10 } : { x: 300, y: 200 });
          setComments([
            { id: 'c' + uid(), resolved: false, ...at(vid), messages: [
              { id: 'm' + uid(), author: 'sam', text: 'Love the light in this. Can the logo come in a beat earlier?', ts: ago(150), reactions: { '👍': [] } },
              { id: 'm' + uid(), author: 'me', text: 'Yes, I’ll tighten the end card on the next take.', ts: ago(132), reactions: { '👍': ['sam'] } },
            ] },
            { id: 'c' + uid(), resolved: false, ...at(up), messages: [
              { id: 'm' + uid(), author: 'sam', text: 'Is this the final product shot, or the one from the June shoot?', ts: ago(64), reactions: {} },
            ] },
            { id: 'c' + uid(), resolved: true, ...at(wr), messages: [
              { id: 'm' + uid(), author: 'me', text: 'Hook runs long. Trimming it to two seconds.', ts: ago(170), reactions: { '🎉': ['sam'] } },
            ] },
          ]);
          setRuns(made);
          const spent = made.reduce((a, r) => a + r.cost, 0);
          balRef.current = Math.max(0, 6000 - spent); setBalance(balRef.current);
          const ask = 'A 10s summer ad for the striped tee with a voice-over';
          const plan = planBuild(ask);
          setMessages([
            { id: 'm' + uid(), role: 'user', text: ask, target: 'Whole canvas' },
            { id: 'm' + uid(), role: 'agent', text: 'Here’s how I’d make it. Untick anything you don’t need.', proposal: { ...plan, status: 'approved', ran: true, tracked: [] } },
            { id: 'm' + uid(), role: 'user', text: 'Make the voice-over warmer', target: 'Voice-over' },
            { id: 'm' + uid(), role: 'agent', text: 'Done. I switched the narrator to a warmer read and regenerated it. Next you could make a 9:16 version for Reels.' },
          ]);
          setChats([{ id: 'c' + uid(), title: 'Storyboard ideas for the soda launch', ts: ago(60 * 26), messages: [
            { id: 'm' + uid(), role: 'user', text: 'Storyboard ideas for the soda launch', target: 'Whole canvas' },
            { id: 'm' + uid(), role: 'agent', text: 'Three directions: a pool-side pour, a picnic hand-off, and a slow-mo can crack at golden hour.' },
          ] }]);
          past.current = []; future.current = [];
          // results make nodes taller: re-space, then frame the whole board
          // laid out while hidden, then shown in one go
          setTimeout(() => tidy(false, true), 120);
          setTimeout(() => { tidy(false, true); setTimeout(() => setFlowLoading(false), 500); }, 420);
        };
        step();
      }, 40);
    }, 0);
  };
  // Prototype links: #new opens an empty project, #sample opens one in progress
  useEffect(() => {
    const go = () => {
      const h = location.hash.replace('#', '');
      if (h === 'new') { setFlow('new'); resetAll(true); } else if (h === 'sample') { setFlow('sample'); loadSample(); }
    };
    const t = setTimeout(go, 300);
    window.addEventListener('hashchange', go);
    return () => { clearTimeout(t); window.removeEventListener('hashchange', go); };
  }, []);
  const switchFlow = (h) => { setFlow(h); if (location.hash === '#' + h) { if (h === 'new') resetAll(true); else loadSample(); } else location.hash = h; };
  const MenuItem = ({ icon, kind, label, kbd, meta, onClick, danger, on, tip }) => (
    <button className={`mitem ${danger ? 'danger' : ''}`} onClick={onClick} data-tip={tip}>
      {kind ? <KindTile kind={kind} size="sm" /> : <span className="mitem-i"><Ico as={icon} size={16} /></span>}
      <span className="grow">{label}</span>
      {on && <span className="mitem-on" />}
      {meta != null && <span className="mitem-meta">{meta}</span>}
      {kbd && <kbd>{kbd}</kbd>}
    </button>
  );

  return (
    <StudioCtx.Provider value={ctxValue}>
      <div className="app">
        {/* ---------- top bar: where am I, what does it cost, run it ---------- */}
        <header className="topbar">
          <div className="tb-l">
            <button className="lemark" onClick={() => toast('The projects page is outside this prototype')} aria-label="Lemonpeel: back to projects" data-tip="All projects"><img className="lemark-img" src={lemonpeelMark} alt="" /></button>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span className="popwrap pmenu-wrap">
              <span className="pname-wrap" data-value={projectName || 'Untitled project'}><input ref={pnameRef} className="pname" value={projectName} size={1} maxLength={60} title={projectName} onChange={(e) => setProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} placeholder="Untitled project" aria-label="Project name" /></span>
              <button className={`pmenu-btn ${pop === 'pmenu' ? 'on' : ''}`} onClick={() => setPop(pop === 'pmenu' ? null : 'pmenu')} aria-label="Project menu" aria-expanded={pop === 'pmenu'} data-tip="Project"><Ico as={ChevronDown} size={14} /></button>
              {pop === 'pmenu' && (
                <div className="popover menu nmenu pmenu" onMouseDown={(e) => e.stopPropagation()} role="menu">
                  <MenuItem icon={Pencil} label="Rename" onClick={() => { setPop(null); setTimeout(() => { pnameRef.current?.focus(); pnameRef.current?.select(); }, 0); }} />
                  <MenuItem icon={Ungroup} label="Duplicate project" onClick={() => { setPop(null); toast(`Duplicated as “${(projectName || 'Untitled project')} copy” (prototype)`); }} />
                  <MenuItem icon={History} label="Version history" onClick={() => { setPop(null); toast('Version history is outside this prototype'); }} />
                  <div className="msep" />
                  <MenuItem icon={PaletteIcon} label="Default brand kit" meta={projectBrand ? projectBrand.name : 'None'} onClick={() => { setPop(null); setDock({ type: 'brand' }); }} />
                  <MenuItem icon={Download} label="Export" onClick={() => { setPop(null); toast('Export is outside this prototype'); }} />
                  <div className="msep" />
                  <MenuItem icon={Trash2} label="Delete project" danger onClick={() => { setPop(null); setConfirmDelete(true); }} />
                </div>
              )}
            </span>
            <span className={`savestate ${saveState}`} aria-live="polite">{saveState === 'saving' ? 'Saving…' : 'Saved'}</span>
            {hasForm && (
              <div className="seg seg-view" role="tablist" aria-label="View">
              <button role="tab" aria-selected={view === 'canvas'} className={view === 'canvas' ? 'on' : ''} onClick={() => setView('canvas')}>Canvas</button>
              <button role="tab" aria-selected={view === 'form'} className={view === 'form' ? 'on' : ''} onClick={() => setView('form')}>Form</button>
            </div>
            )}
          </div>
          <div className="tb-r">
            {/* who is here: leftmost in the strip, opens the people list */}
            <span className="popwrap static">
            <button className={`sharebtn ${pop === 'people' ? 'active' : ''}`} onClick={() => setPop(pop === 'people' ? null : 'people')} aria-expanded={pop === 'people'} data-tip="Share" aria-label={`Share · ${1 + people.length} ${people.length ? 'people' : 'person'} in this project`}>
              <span className="avatars">
              <span className="avatar sm">B</span>
              {people.slice(0, 2).map((p) => <span key={p.email} className="avatar sm alt">{(p.name || p.email)[0].toUpperCase()}</span>)}
              {people.length > 2 && <span className="avatar sm more">+{people.length - 2}</span>}
              </span>
              <Ico as={ChevronDown} size={14} />
            </button>
            {pop === 'people' && <PeoplePop toast={toast} people={people} setPeople={setPeople} here={here} onGoTo={goToNode} onClose={() => setPop(null)} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360 }} />}
            </span>
            {totalTakes > 0 && (
              <button className={`btn btn-ghost btn-sm btn-icon obtn ${outputsOpen ? 'active' : ''}`} onClick={() => { setRightTab(outputsOpen ? null : 'outputs'); setView('canvas'); }} data-tip={`Outputs · ${totalTakes}`} aria-label={`Outputs, ${totalTakes}`} aria-pressed={outputsOpen}>
                <Ico as={Gallery} size={16} />
              </button>
            )}
            <button className={`credits ${balance < 300 ? 'low' : ''}`} onClick={() => openCredits(0)} data-tip="Add credits">
              <Ico as={Coins} size={14} /><span className="num">{fmtCr(balance)}</span>
            </button>
            {nodes.length > 0 && (() => { const n = comments.filter((t) => !t.resolved).length; return (
              <button className={`btn btn-ghost btn-sm btn-icon cbtn ${rightTab === 'comments' ? 'active' : ''}`} onClick={() => { setRightTab(rightTab === 'comments' ? null : 'comments'); setView('canvas'); }} aria-pressed={rightTab === 'comments'} data-tip={n > 0 ? `Comments · ${n} open` : 'Comments'} aria-label={n > 0 ? `Comments, ${n} open` : 'Comments'}>
                <Ico as={MessageSquare} size={16} />{n > 0 && <i className="cdot" />}
              </button>
            ); })()}
            {/* the AI agent: opens its panel (the composer there takes the place of the old bottom ask bar) */}
            {(nodes.length > 0 || messages.length > 0) && <button className={`askbtn ${rightTab === 'agent' ? 'active' : ''}`} onClick={() => { setRightTab(rightTab === 'agent' ? null : 'agent'); setView('canvas'); }} aria-pressed={rightTab === 'agent'} data-tip="Ask Lemonpeel (⌘K)">
              <Ico as={Sparkles} size={16} />Ask
            </button>}
          </div>
        </header>

        {/* ---------- canvas + contextual panel ---------- */}
        <div className={`mid ${showRight ? 'has-right' : ''}`}>
          <main className={`canvas ${flowLoading ? 'flow-loading' : ''}`} ref={wrapRef} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
            <ReactFlow
              connectOnClick={false}
              defaultNodes={saved?.nodes || []}
              defaultEdges={saved?.edges || []}
              nodeTypes={nodeTypes}
              onConnect={(c) => connect(c)}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              isValidConnection={isValidConnection}
              onBeforeDelete={async () => { checkpoint(); return true; }}
              onNodeDragStart={() => checkpoint()}
              onNodeContextMenu={(e, n) => { e.preventDefault(); if (rf.getNodes().filter((x) => x.selected).length > 1 && n.selected) { setMenu({ x: e.clientX, y: e.clientY, multi: true }); return; } selectOnly(n.id); setNodeMenu({ nodeId: n.id, x: e.clientX, y: e.clientY }); }}
              onSelectionContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, multi: true }); }}
              onPaneContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, pane: true, at: rf.screenToFlowPosition({ x: e.clientX - W / 2, y: e.clientY - 40 }) }); }}
              onPaneClick={() => { setMenu(null); setNextMenu(null); setPickerOpen(false); setViewMenu(false); setRunsOpen(false); setPop(null); setNodeMenu(null); }}
              deleteKeyCode={['Backspace', 'Delete']}
              selectionOnDrag={!panMode && nodes.length > 0}
              nodesDraggable={!locked}
              nodesConnectable={!locked}
              elementsSelectable={!locked}
              connectionRadius={36}
              zoomOnDoubleClick={false}
              // an empty canvas stays still: nothing to move around yet
              panOnDrag={nodes.length === 0 ? false : panMode ? true : [1]}
              panOnScroll={nodes.length > 0}
              zoomOnScroll={nodes.length > 0}
              zoomOnPinch={nodes.length > 0}
              zoomActivationKeyCode={['Meta', 'Control']}
              minZoom={0.2}
              maxZoom={1.6}
              defaultViewport={{ x: 80, y: 60, zoom: 0.85 }}
              proOptions={{ hideAttribution: true }}
              fitView={!!saved?.nodes?.length}
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#212429" />
              {minimap && <MiniMap position="bottom-left" pannable zoomable nodeColor={() => '#3a3e44'} maskColor="#1a1d21" bgColor="#24272c" style={{ background: '#24272c' }} />}
            </ReactFlow>

            {ready && nodes.length === 0 && view === 'canvas' && <EmptyState composerCtx={composerCtx} auto={auto} setAuto={setAuto} actions={actions} addNode={addNode} viewCenter={viewCenter} onTemplates={() => setTemplatesOpen(true)} planPending={messages.some((m) => m.thinking || m.proposal?.status === 'pending' || m.brief?.status === 'pending')} plan={(() => { const m = [...messages].reverse().find((x) => (x.proposal?.status === 'pending' && x.proposal.kind === 'build') || x.brief); return m ? m.proposal || m.brief.preview : undefined; })()} />}

            {selected.length > 1 && (() => {
              // Toolbar sits on the selection: centred above it, or below when there's no room; follows pan/zoom/drag.
              const cEl = wrapRef.current; if (!cEl) return null;
              const cr = cEl.getBoundingClientRect();
              let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
              selected.forEach((n) => {
                const p = rf.getInternalNode(n.id)?.internals.positionAbsolute || n.position;
                const w = n.measured?.width || n.width || W; const h = n.measured?.height || n.height || 160;
                x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x + w); y2 = Math.max(y2, p.y + h);
              });
              const tl = rf.flowToScreenPosition({ x: x1, y: y1 });
              const br = rf.flowToScreenPosition({ x: x2, y: y2 });
              const cx = Math.min(Math.max((tl.x + br.x) / 2 - cr.left, 150), cr.width - 150);
              const above = tl.y - cr.top - 48;
              const top = above >= 64 ? above : Math.min(br.y - cr.top + 10, cr.height - 100); // not under the top strips
              return (
              <div className="seltool anchored" role="toolbar" aria-label="Selection" style={{ left: cx, top }}>
                <span className="seltool-c">{selected.length} selected</span>
                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => tidy(true)} data-tip="Tidy up (⇧T)" aria-label="Tidy up"><Ico as={LayoutGrid} size={16} /></button>
                <button className="btn btn-icon btn-ghost btn-sm" onClick={duplicate} data-tip="Duplicate (⌘D)" aria-label="Duplicate"><Ico as={Copy} size={16} /></button>
                <button className="btn btn-icon btn-ghost btn-sm" onClick={groupSel} data-tip="Group (⌘G)" aria-label="Group"><Ico as={GroupIcon} size={16} /></button>
                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => toast(`Saved ${selected.length} nodes as a template`)} data-tip="Save as template" aria-label="Save as template"><Ico as={BookmarkPlus} size={16} /></button>
                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => toast(`Downloading ${selected.filter((n) => (n.data.takes || []).length).length} results…`)} data-tip="Download results" aria-label="Download results"><Ico as={Download} size={16} /></button>
                <button className="btn btn-icon btn-ghost btn-sm danger" onClick={deleteSelected} data-tip="Delete (⌫)" aria-label="Delete"><Ico as={Trash2} size={16} /></button>
                {selRunnable.length > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={runSelected}>
                    Generate {selRunnable.length}<span className="cost">{fmtCr(selRunnable.reduce((s, n) => s + costOf(n.data), 0))}</span>
                  </button>
                )}
              </div>
              );
            })()}

            {view === 'canvas' && <LeftRail empty={nodes.length === 0} actions={actions} selectedNode={singleSel} dock={dock} panMode={panMode && !commentMode} setPanMode={(v) => { setPanMode(v); setCommentMode(false); }} commentMode={commentMode} onUndo={undo} onRedo={redo} canUndo={past.current.length > 0} canRedo={future.current.length > 0} onUpload={() => toggleDock({ type: 'assets', from: 'upload' })} onTemplates={() => toggleDock({ type: 'templates' })} onAssets={() => toggleDock({ type: 'assets' })} onBrand={() => toggleDock({ type: 'brand' })}
              view={nodes.length > 0 && (<>
                <span className="rail-pw">
                  <button className={`rail-b rail-zoom num ${zoomMenu ? 'on-soft' : ''}`} onClick={() => { setZoomMenu(!zoomMenu); setViewMenu(false); setRunsOpen(false); }} aria-label={`Zoom, ${Math.round(zoom * 100)}%`} aria-expanded={zoomMenu} data-tip="Zoom">{Math.round(zoom * 100)}%</button>
                  {zoomMenu && (
                    <div className="popover menu nmenu rail-pop" onMouseDown={(e) => e.stopPropagation()} role="menu">
                      <MenuItem icon={Plus} label="Zoom in" kbd="⌘+" onClick={() => rf.zoomIn({ duration: 150 })} />
                      <MenuItem icon={Minus} label="Zoom out" kbd="⌘−" onClick={() => rf.zoomOut({ duration: 150 })} />
                      <div className="msep" />
                      <MenuItem icon={Maximize} label="Fit to screen" kbd="F" onClick={() => { setZoomMenu(false); rf.fitView({ duration: 300, padding: 0.2, maxZoom: 1 }); }} />
                      <MenuItem icon={Expand} label="Zoom to 100%" onClick={() => { setZoomMenu(false); rf.zoomTo(1, { duration: 200 }); }} />
                    </div>
                  )}
                </span>
                <button className={`rail-b ${minimap ? 'toggled' : ''}`} onClick={() => setMinimap(!minimap)} aria-label="Minimap" aria-pressed={minimap} data-tip="Minimap"><Ico as={MapIcon} size={16} /></button>
                <button className={`rail-b ${locked ? 'toggled' : ''}`} onClick={() => { setLocked(!locked); toast(locked ? 'Canvas unlocked' : 'Canvas locked: nothing can be moved or edited by mistake'); }} aria-label={locked ? 'Unlock canvas' : 'Lock canvas'} aria-pressed={locked} data-tip={locked ? 'Unlock canvas' : 'Lock canvas'}><Ico as={locked ? Lock : Unlock} size={16} /></button>
              </>)}
              activity={nodes.length > 0 && (() => { const live = runs.filter((r) => r.status === 'running' || r.status === 'queued').length; return (<>
                <span className="rail-pw">
                  <button className={`rail-b zrun ${live ? 'live' : ''} ${runsOpen ? 'on-soft' : ''}`} onClick={() => { setRunsOpen(!runsOpen); setViewMenu(false); setZoomMenu(false); }} aria-label="Runs" aria-expanded={runsOpen} data-tip={live ? `${live} running` : `${runs.length} run${runs.length === 1 ? '' : 's'} this session`}>
                    {live ? <span className="pdot" /> : <Ico as={Activity} size={16} />}
                    {(live || runs.length) > 0 && <span className="rail-n">{live || runs.length}</span>}
                  </button>
                  {runsOpen && (
                    <div className="popover runs-pop rail-pop" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Runs">
                      <RunsPanel runs={runs} onCancel={cancelRun} onFocus={(id) => { setRunsOpen(false); actions.focusTake(id, (rf.getNode(id)?.data.takes || []).length - 1); }} />
                    </div>
                  )}
                </span>
                <span className="rail-pw">
                  <button className={`rail-b ${viewMenu ? 'on-soft' : ''}`} onClick={() => { setViewMenu(!viewMenu); setRunsOpen(false); setZoomMenu(false); }} aria-label="More" aria-expanded={viewMenu} data-tip="More"><Ico as={Ellipsis} size={16} /></button>
                  {viewMenu && (
                    <div className="popover menu nmenu rail-pop" onMouseDown={(e) => e.stopPropagation()} role="menu">
                      <MenuItem icon={LayoutGrid} label="Tidy up" kbd="⇧T" onClick={() => { setViewMenu(false); tidy(false); }} />
                      <div className="msep" />
                      <MenuItem icon={Compass} label="Take the tour" onClick={() => { setViewMenu(false); setTour(true); }} />
                      <MenuItem icon={Keyboard} label="Keyboard shortcuts" onClick={() => { setViewMenu(false); setShortcuts(true); }} />
                      <MenuItem icon={RotateCcw} label="Reset prototype" onClick={() => { setViewMenu(false); resetAll(); }} />
                    </div>
                  )}
                </span>
              </>); })()} />}
            {view === 'canvas' && dock && (
              <aside className="dockpanel" onMouseDown={(e) => e.stopPropagation()}>
                <DockCtx.Provider value>
                  {dock.type === 'create' && (
                    <CreatePanel key={dock.kind} kind={dock.kind} actions={actions} assets={allAssets()} nodes={nodes} outputOf={outputOf}
                      selection={selected.filter((n) => n.type !== 'frame')} defaults={defaults} balance={balance}
                      onCreate={createFromDock} onClose={() => setDock(null)} />
                  )}
                  {dock.type === 'templates' && <TemplatesModal onClose={() => setDock(null)} onUse={(t) => { setDock(null); startTemplate(t); }} />}
                  {dock.type === 'assets' && <AssetsModal assets={allAssets()} onRemove={removeAsset} onRename={(a, name) => editAsset(a.id, { name })} onClose={() => setDock(null)} onAdd={(a) => { addAssetNode(a); toast(`Added ${a.name}`); }} onUpload={(a) => { const na = { id: 'u' + uid(), source: 'upload', ...a }; setSavedAssets((x) => [...x, na]); toast(`Uploaded ${a.name}`); }} />}
                  {dock.type === 'brand' && <BrandModal brands={brands} defaultId={projectBrandId} onUpdate={(id, patch) => setBrands((x) => x.map((b) => (b.id === id ? { ...b, ...patch } : b)))} onAdd={(b) => { setBrands((x) => [...x, b]); if (!projectBrandId) setProjectBrandId(b.id); toast(`${b.name} saved${projectBrandId ? '' : ' · default for this project'}`); }} onRemove={(id) => { setBrands((x) => x.filter((b) => b.id !== id)); if (projectBrandId === id) setProjectBrandId(null); toast('Brand kit deleted'); }} onSetDefault={(id) => { setProjectBrandId(id); toast(id ? `${brands.find((b) => b.id === id)?.name} is the default` : 'No default brand'); }} onClose={() => setDock(null)} />}
                </DockCtx.Provider>
              </aside>
            )}


            {view === 'canvas' && <ViewAs value={flow || (nodes.length ? 'sample' : 'new')} onPick={switchFlow} />}
          </main>

          {showRight && (
            <aside className="panel right">
              <RightTabs tab={rightTab} setTab={(t) => { setRightTab(t); setHistOpen(false); }} hasSel={false} counts={{ outputs: totalTakes, comments: comments.filter((t) => !t.resolved).length }} onClose={() => { setRightTab(null); setHistOpen(false); }}
                actions={rightTab === 'agent' && (<>
                  <span className="popwrap">
                    <button className={`btn btn-icon btn-ghost btn-sm ${histOpen ? 'active' : ''}`} onClick={() => setHistOpen(!histOpen)} disabled={!chats.length} aria-label="Chat history" aria-expanded={histOpen} data-tip="History"><Ico as={History} size={16} /></button>
                    {histOpen && (
                      <div className="popover menu hist-pop" onMouseDown={(e) => e.stopPropagation()} role="menu">
                        {[...chats].reverse().map((c) => (
                          <button key={c.id} className="hist-row" role="menuitem" onClick={() => openChat(c.id)}>
                            <span className="grow">{c.title}</span><small>{agoShort(c.ts)}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </span>
                  <button className="btn btn-icon btn-ghost btn-sm" onClick={newChat} disabled={!messages.length} aria-label="New chat" data-tip="New chat"><Ico as={ChatNew} size={16} /></button>
                </>)} />
              {rightTab === 'comments' && <CommentsPanel comments={comments} rf={rf} openId={openComment} nodeTitle={(id) => { const n = rf.getNode(id); return n ? (n.data.title || KINDS[n.data.kind]?.label) : null; }}
                onOpen={(t) => { const p = threadPoint(rf, t); rf.setCenter(p.x, p.y, { zoom: Math.max(rf.getZoom(), 0.8), duration: 400 }); setTimeout(() => setOpenComment(t.id), 420); }} />}
              {rightTab === 'agent' && <AgentPanel onRevert={revertNote} composer={composerCtx} messages={messages} auto={auto} setAuto={setAuto} onApprove={approve} onDiscard={discard} onAnswer={answerBrief} onFinal={runFinal} onRetake={retakeDraft} onAsk={ask} onClear={newChat} onToggleStep={toggleStep} balance={balance} nodeInfo={nodeInfo} onFocusNode={(id) => actions.focusTake(id, Math.max(0, (rf.getNode(id)?.data.takes || []).length - 1))} selection={selected.filter((n) => n.type !== 'frame')} suggestions={agentSuggestions()} />}
              {rightTab === 'outputs' && <Outputs nodes={nodes} actions={actions} onClose={() => setRightTab(null)} />}
            </aside>
          )}

          {(() => {
            // Settings card: sits beside the selected node(s), follows pan, zoom and drag, flips left when there's no room.
            const sel = selected.filter((n) => n.type !== 'frame');
            if (view !== 'canvas' || !sel.length || connecting || nodeMenu || menu || nextMenu || pop || attach) return null; // a menu is open on this node: don't stack
            // Only when there is something to set: generating nodes, or several nodes that share a setting.
            if (sel.length === 1 && !KINDS[sel[0].data.kind]?.runnable) return null;
            if (sel.length > 1 && !sel.some((n) => KINDS[n.data.kind]?.aspect)) return null;
            const canvasEl = document.querySelector('.canvas');
            if (!canvasEl) return null;
            const cr = canvasEl.getBoundingClientRect();
            let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
            sel.forEach((n) => {
              const p = rf.getInternalNode(n.id)?.internals.positionAbsolute || n.position;
              const w = n.measured?.width || n.data.w || W; const h = n.measured?.height || 160;
              x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x + w); y2 = Math.max(y2, p.y + h);
            });
            const tl = rf.flowToScreenPosition({ x: x1, y: y1 });
            const br = rf.flowToScreenPosition({ x: x2, y: y2 });
            if (br.y < cr.top + 68 || tl.y > cr.bottom - 60 || br.x < cr.left || tl.x > cr.right) return null; // node is off-screen
            const PW = 264; const GAP = 28;
            let left = br.x + GAP;
            if (left + PW > cr.right - 8) left = tl.x - GAP - PW;
            if (left < cr.left + 76 || left + PW > cr.right - 8) return null; // no room either side: the node's own chip still opens it
            const top = Math.min(Math.max(tl.y, cr.top + 68), cr.bottom - 120); // stay below the top strips
            return (
              <div className={`node-pop ${inspOpen ? '' : 'shut'}`} style={{ left, top, maxHeight: cr.bottom - top - 84 }}
                ref={(el) => {
                  // measure, then lift the card so it ends above the bottom bar instead of being cut off
                  if (!el) return;
                  const limit = cr.bottom - 84; const h = el.scrollHeight;
                  const t = top + h > limit ? Math.max(cr.top + 12, limit - h) : top;
                  el.style.top = `${t}px`; el.style.maxHeight = `${limit - t}px`;
                }} onMouseDown={(e) => e.stopPropagation()} role="region" aria-label="Settings">
                {/* Like Clueso's inspector: the header collapses it to one bar and the choice is remembered */}
                <button className="np-h" onClick={() => setInspOpen(!inspOpen)} aria-expanded={inspOpen} data-tip={inspOpen ? 'Collapse' : 'Show settings'}>
                  <span className="np-t">{sel.length > 1 ? `${sel.length} selected` : sel[0].data.title || KINDS[sel[0].data.kind].label}</span>
                  <Ico as={inspOpen ? ChevronDown : ChevronRight} size={14} />
                </button>
                {inspOpen && <Inspector compact selected={sel} actions={actions} balance={balance} pickerOpen={pickerOpen} setPickerOpen={setPickerOpen} onClose={() => setInspOpen(false)} />}
              </div>
            );
          })()}

          {view === 'canvas' && (
            <CommentsLayer rf={rf} comments={comments} setComments={setComments} mode={commentMode} setMode={setCommentMode}
              openId={openComment} setOpenId={setOpenComment} canvasEl={wrapRef.current} toast={toast} pending={commentAt} clearPending={() => setCommentAt(null)} showAll={rightTab === 'comments'} onExit={() => setRightTab((x) => (x === 'comments' ? null : x))} />
          )}

          {view === 'form' && <FormView nodes={nodes} edges={edges} actions={actions} balance={balance} projectName={projectName} toCanvas={() => setView('canvas')} />}
        </div>

        {/* ---------- floating menus ---------- */}
        {nextMenu && (
          <div className="scrim clear" onMouseDown={() => setNextMenu(null)}>
            <div className="popover menu" style={{ left: Math.min(nextMenu.x, window.innerWidth - 270), top: Math.min(nextMenu.y, window.innerHeight - 300) }} onMouseDown={(e) => e.stopPropagation()}>
              <h5 className="label">Next step</h5>
              {nextOpts.map((o) => (
                <MenuItem key={o.label} kind={o.kind} label={o.label} onClick={() => addNext(nextMenu.id, o.label)} />
              ))}
              <div className="msep" />
              <MenuItem icon={Search} label="Something else…" kbd="/" onClick={() => { const id = nextMenu.id; setNextMenu(null); setPalette({ from: id }); }} />
            </div>
          </div>
        )}

        {menu && (
          <div className="scrim clear" onMouseDown={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
            <div className="popover menu" style={{ left: Math.min(menu.x, window.innerWidth - 260), top: Math.min(menu.y, window.innerHeight - 360) }} onMouseDown={(e) => e.stopPropagation()}>
              {menu.pane ? (
                <>
                  <MenuItem icon={MessageSquare} label="Add comment here" kbd="C" onClick={() => { const f = rf.screenToFlowPosition({ x: menu.x, y: menu.y }); setMenu(null); setCommentAt({ x: f.x, y: f.y }); }} />
                  <div className="msep" />
                  {['video', 'image', 'audio', 'writer', 'note'].map((k) => (
                    <MenuItem key={k} kind={k} label={KINDS[k].label} onClick={() => { setMenu(null); addNode(k, { position: menu.at }); }} />
                  ))}
                  <div className="msep" />
                  {clip.current && <MenuItem icon={ClipboardPaste} label="Paste" kbd="⌘V" onClick={() => { setMenu(null); paste(true); }} />}
                  <MenuItem icon={LayoutGrid} label="Tidy up" kbd="⇧T" onClick={() => { setMenu(null); tidy(false); }} />
                  {runnableIds().length > 0 && <MenuItem icon={Generate} label="Generate everything waiting…" kbd="⌘⇧↵" onClick={() => { setMenu(null); askRunAll(); }} />}
                </>
              ) : (() => {
                const sel = rf.getNodes().filter((n) => n.selected);
                const runnable = sel.filter((n) => KINDS[n.data.kind].runnable);
                const one = sel.length === 1 ? sel[0] : null;
                return (
                  <>
                    {runnable.length > 0 && <MenuItem icon={Generate} label={runnable.length > 1 ? `Generate ${runnable.length}` : 'Generate'} kbd="⌘↵" onClick={() => { setMenu(null); runSelected(); }} />}
                    {one && <MenuItem icon={ArrowRight} label="Add next step…" onClick={() => { setMenu(null); setPalette({ from: one.id }); }} />}
                    <MenuItem icon={Copy} label="Duplicate" kbd="⌘D" onClick={() => { setMenu(null); duplicate(); }} />
                    <MenuItem icon={Copy} label="Copy" kbd="⌘C" onClick={() => { setMenu(null); copySel(false); }} />
                    <MenuItem icon={Scissors} label="Cut" kbd="⌘X" onClick={() => { setMenu(null); copySel(true); }} />
                    {sel.length > 1 && <MenuItem icon={GroupIcon} label="Group" kbd="⌘G" onClick={() => { setMenu(null); groupSel(); }} />}
                    {sel.length > 1 && <MenuItem icon={LayoutGrid} label="Tidy up" kbd="⇧T" onClick={() => { setMenu(null); tidy(true); }} />}
                    <div className="msep" />
                    <MenuItem icon={Trash2} label="Delete" kbd="⌫" danger onClick={() => { setMenu(null); deleteSelected(); }} />
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {palette && <Palette commands={paletteCommands} title={palette.from ? 'Add a connected step' : undefined} onClose={() => setPalette(null)} onPick={(c) => { setPalette(null); c.run(); }} />}
        {credits && <CreditsModal need={credits.need} balance={balance} spent={runs.filter((r) => r.status === 'done').reduce((s, r) => s + r.cost, 0)} onClose={() => setCredits(null)} onBuy={buyCredits} />}
        {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}
        {templatesOpen && <TemplatesModal onClose={() => setTemplatesOpen(false)} onUse={startTemplate} />}

        {nodeMenu && (() => {
          const n = rf.getNode(nodeMenu.nodeId);
          if (!n) return null;
          const k = KINDS[n.data.kind];
          const close = () => setNodeMenu(null);
          const o = outputOf(n);
          const hasImg = o && o.url && k.output === 'image';
          const panelL = document.querySelector('aside.panel')?.getBoundingClientRect().left ?? window.innerWidth;
          const style = { left: Math.max(70, Math.min(nodeMenu.x, panelL - 248)), top: Math.max(68, Math.min(nodeMenu.y, window.innerHeight - 420)) };
          if (n.type === 'frame') {
            return (
              <div className="scrim clear" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }}>
                <div className="popover menu" style={style} onMouseDown={(e) => e.stopPropagation()} role="menu">
                  <h5 className="label">{n.data.title}</h5>
                  <MenuItem icon={Ungroup} label="Ungroup" onClick={() => { close(); ungroup(n.id); }} />
                </div>
              </div>
            );
          }
          const taken = (n.data.takes || []).length > 0;
          const tools = [
            hasImg && <MenuItem key="ed" icon={Paintbrush} label="Edit a region" onClick={() => { close(); addNext(n.id, 'Edit a region'); }} />,
            hasImg && <MenuItem key="ly" icon={Layers} label="Split into layers" onClick={() => { close(); addNode('layers', { from: { nodeId: n.id, port: 'source', type: 'image' } }); }} />,
            hasImg && <MenuItem key="up" icon={Expand} label="Upscale" onClick={() => { close(); addNext(n.id, 'Upscale to 4K'); }} />,
            o && o.url && <MenuItem key="sv" icon={Archive} label="Save to Assets" onClick={() => { close(); saveToAssets(n.id); }} />,
            (n.data.kind === 'note' || n.data.kind === 'upload' || n.data.kind === 'list') && <MenuItem key="fv" icon={ListChecks} label={n.data.expose ? 'Remove from Form view' : 'Show in Form view'} onClick={() => { close(); rf.updateNodeData(n.id, { expose: n.data.expose ? null : { label: n.data.title, type: n.data.kind === 'upload' ? 'asset' : 'text' } }); }} />,
          ].filter(Boolean);
          return (
            <div className="scrim clear" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }}>
              <div className="popover menu nmenu" style={style} onMouseDown={(e) => e.stopPropagation()} role="menu" aria-label={n.data.title || k.label}>
                {/* make */}
                {k.runnable && <MenuItem icon={Generate} label={taken ? 'Regenerate' : 'Generate'} meta={fmtCr(costOf(n.data, runsFor(n.id)))} tip="⌘↵" onClick={() => { close(); runNode(n.id); }} />}
                {taken && <MenuItem icon={Maximize2} label="Preview" kbd="A" onClick={() => { close(); setPreviewId(n.id); }} />}
                {(k.runnable || taken) && <div className="msep" />}
                {/* talk about it */}
                <MenuItem icon={Sparkles} label="Ask Lemonpeel" kbd="⌘K" onClick={() => { close(); selectOnly(n.id); setView('canvas'); setRightTab('agent'); }} />
                <MenuItem icon={MessageSquare} label="Comment" kbd="C" onClick={() => { close(); setCommentAt({ nodeId: n.id, dx: (n.measured?.width || 300) - 8, dy: 8 }); }} />
                {tools.length > 0 && <><div className="msep" />{tools}</>}
                <div className="msep" />
                {/* edit */}
                <MenuItem icon={Pencil} label="Rename" onClick={() => { close(); rf.updateNodeData(n.id, { renameReq: true }); }} />
                <MenuItem icon={Ungroup} label="Duplicate" kbd="⌘D" onClick={() => { close(); duplicate(); }} />
                <MenuItem icon={Copy} label="Copy" kbd="⌘C" onClick={() => { close(); copySel(false); }} />
                <MenuItem icon={Scissors} label="Cut" kbd="⌘X" onClick={() => { close(); copySel(true); }} />
                <div className="msep" />
                <MenuItem icon={Trash2} label="Delete" kbd="⌫" danger onClick={() => { close(); deleteSelected(); }} />
              </div>
            </div>
          );
        })()}

        {mention && (() => {
          const t = rf.getNode(mention.nodeId);
          if (!t) return null;
          const types = new Set(KINDS[t.data.kind].inputs.map((p) => p.type));
          const opts = rf.getNodes().filter((n) => n.id !== t.id && n.type !== 'frame' && types.has(KINDS[n.data.kind].output) && (n.data.title || '').toLowerCase().replace(/\s+/g, '').includes(mention.q.toLowerCase()));
          return (
            <div className="popover menu mention-pop" style={{ left: mention.x, top: Math.min(mention.y, window.innerHeight - 260) }} onMouseDown={(e) => e.preventDefault()}>
              <h5 className="label">Use another node</h5>
              {opts.length ? opts.slice(0, 8).map((n) => {
                const o = outputOf(n);
                return (
                  <button key={n.id} className="mitem" onClick={() => pickMention(n.id)}>
                    {o && o.url ? <img className="mitem-thumb" src={o.url} alt="" /> : <KindTile kind={n.data.kind} size="sm" />}
                    <span className="grow">{n.data.title || KINDS[n.data.kind].label}</span>
                    <span className="dim">{KINDS[n.data.kind].output}</span>
                  </button>
                );
              }) : <p className="hint pad">No matching nodes on this canvas yet.</p>}
            </div>
          );
        })()}

        {assetsOpen && <AssetsModal assets={allAssets()} onRemove={removeAsset} onRename={(a, name) => editAsset(a.id, { name })} onClose={() => setAssetsOpen(false)} onAdd={addAssetNode} onUpload={(a) => { const na = { id: 'u' + uid(), source: 'upload', ...a }; setSavedAssets((x) => [...x, na]); toast(`Uploaded ${a.name}`); }} />}
        {brandOpen && <BrandModal brands={brands} defaultId={projectBrandId} onUpdate={(id, patch) => setBrands((x) => x.map((b) => (b.id === id ? { ...b, ...patch } : b)))} onAdd={(b) => { setBrands((x) => [...x, b]); if (!projectBrandId) setProjectBrandId(b.id); toast(`${b.name} saved${projectBrandId ? '' : ' · default for this project'}`); }} onRemove={(id) => { setBrands((x) => x.filter((b) => b.id !== id)); if (projectBrandId === id) setProjectBrandId(null); toast('Brand kit deleted'); }} onSetDefault={(id) => { setProjectBrandId(id); toast(id ? `${brands.find((b) => b.id === id)?.name} is the default` : 'No default brand'); }} onClose={() => setBrandOpen(false)} />}
        {previewId && rf.getNode(previewId) && <PreviewModal node={rf.getNode(previewId)} onClose={() => setPreviewId(null)} onTake={(i) => rf.updateNodeData(previewId, { takeIdx: i })} toast={toast} />}
        {tour && <Tour onClose={() => setTour(false)} />}

        {attach && attachPos && (() => {
          const t = rf.getNode(attach.nodeId);
          if (!t) return null;
          const k = KINDS[t.data.kind];
          const links = portLinks(t.id);
          const W_POP = 280;
          // beside the node (right if it fits, else left), lined up with the + inside it; never on top of the node
          const railR = (document.querySelector('.rail')?.getBoundingClientRect().right || 0) + 8;
          const left = attachPos.nr + 10 + W_POP <= window.innerWidth - 8 ? attachPos.nr + 10
            : Math.max(railR, attachPos.nl - 10 - W_POP);
          const top = Math.max(8, Math.min(attachPos.t - 8, window.innerHeight - 340));
          const pop = { left, top, width: W_POP };
          if (attach.step === 'list') {
            return (
              <div className="popover menu inmenu" style={pop} role="menu" onMouseEnter={holdInputs} onMouseLeave={releaseInputs}>
                <h5 className="label">Add input</h5>
                {k.inputs.map((p) => {
                  const C = PORT_ICONS[p.type];
                  const ls = links[p.id] || [];
                  const full = p.multi && p.max && ls.length >= p.max;
                  return (
                    <button key={p.id} role="menuitem" className="mitem" disabled={full} data-tip={full ? `Up to ${p.max}. Remove one on the node to add another.` : p.multi && p.max ? `Add up to ${p.max}` : !p.multi && ls.length ? 'Replace' : undefined} onClick={() => setAttach({ nodeId: t.id, step: 'pick', portId: p.id })}>
                      <span className="inmenu-i" style={{ '--pc': PORT_COLORS[p.type] }}><C size={14} aria-hidden="true" /></span>
                      <span className="grow">{p.label}</span>
                      {ls.length > 0 && (
                        <span className="inmenu-have">
                          {ls.some((l) => l.thumb) && <span className="inmenu-thumbs">{ls.filter((l) => l.thumb).slice(0, 3).map((l) => <img key={l.edgeId} src={l.thumb} alt="" />)}</span>}
                          {p.multi ? <span className="inmenu-count">{p.max ? `${ls.length}/${p.max}` : ls.length}</span> : !ls.some((l) => l.thumb) && <span className="inmenu-added">Added</span>}
                        </span>
                      )}
                      {!full && <Ico as={p.multi && ls.length ? Plus : ChevronRight} size={14} className="dim" />}
                    </button>
                  );
                })}
              </div>
            );
          }
          const port = k.inputs.find((p) => p.id === attach.portId);
          const linkedHere = new Set(rf.getEdges().filter((e) => e.target === t.id && e.targetHandle === port.id).map((e) => e.source));
          const fromCanvas = rf.getNodes().filter((n) => n.id !== t.id && !linkedHere.has(n.id) && KINDS[n.data.kind].output === port.type);
          const genKind = { image: 'image', video: 'video', audio: 'audio', text: 'writer' }[port.type];
          return (
            <div className="popover menu inmenu" style={pop} role="dialog" aria-label={`Add ${port.label}`}>
              <div className="inmenu-h">
                <button className="btn btn-icon btn-ghost btn-xs" onClick={() => setAttach({ nodeId: t.id, step: 'list' })} aria-label="Back"><Ico as={ChevronLeft} size={14} /></button>
                <span>{port.label}</span>
                {port.multi && port.max && <span className="inmenu-count">{(links[port.id] || []).length}/{port.max}</span>}
              </div>
              {port.type !== 'text' && (
                <>
                  <MenuItem icon={Upload} label="Upload from computer" onClick={() => document.getElementById('attach-upload')?.click()} />
                  <input id="attach-upload" type="file" hidden accept={`${port.type}/*`} multiple={!!port.multi} onChange={(e) => {
                    [...(e.target.files || [])].filter((f) => f.type.startsWith(`${port.type}/`)).forEach((f) => readMedia(f, (m) => { const a = addAsset(m); attachAsset(t.id, port.id, a.id, a); }));
                    e.target.value = ''; setAttach(null);
                  }} />
                </>
              )}
              {port.type !== 'text' && allAssets().some((a) => a.type === port.type) && (
                <>
                  <h5 className="label">From your library</h5>
                  {port.type === 'audio' ? (
                    allAssets().filter((a) => a.type === 'audio').map((a) => (
                      <button key={a.id} className="mitem" onClick={() => { attachAsset(t.id, port.id, a.id); setAttach(null); }}>
                        <span className="mitem-i"><Ico as={Play} size={12} /></span><span className="grow">{a.name}</span><span className="dim">{a.cat || ''}</span>
                      </button>
                    ))
                  ) : (
                    <div className="attach-lib">
                      {allAssets().filter((a) => a.type === port.type).map((a) => (
                        <button key={a.id} className="attach-asset" onClick={() => { attachAsset(t.id, port.id, a.id); setAttach(null); }} data-tip={a.name}><img src={a.url} alt={a.name} /></button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {fromCanvas.length > 0 && (
                <>
                  <h5 className="label">From this canvas</h5>
                  {fromCanvas.map((n) => {
                    const o = outputOf(n);
                    return (
                      <button key={n.id} className="mitem" onClick={() => { attachExisting(t.id, port.id, n.id); setAttach(null); }}>
                        {o && o.url ? <img className="mitem-thumb" src={o.url} alt="" /> : <KindTile kind={n.data.kind} size="sm" />}
                        <span className="grow">{n.data.title || KINDS[n.data.kind].label}</span>
                      </button>
                    );
                  })}
                </>
              )}
              <div className="msep" />
              {port.type === 'text' && <MenuItem icon={Plus} label="Write it in a text note" onClick={() => { attachNew(t.id, port.id, 'note'); setAttach(null); }} />}
              <MenuItem icon={Sparkles} label={port.type === 'text' ? 'Write it with AI Writer' : `Generate a new ${KINDS[genKind].label.toLowerCase()}`} onClick={() => { attachNew(t.id, port.id, genKind); setAttach(null); }} />
            </div>
          );
        })()}

        {confirmDelete && (
          <div className="scrim" onMouseDown={() => setConfirmDelete(false)}>
            <div className="confirm" role="alertdialog" aria-label="Delete project" onMouseDown={(e) => e.stopPropagation()}>
              <h2>Delete “{projectName || 'Untitled project'}”?</h2>
              <p>Every node, result and comment in it goes for everyone with access. This can’t be undone. In this prototype it starts a fresh project.</p>
              <div className="confirm-acts">
                <button className="btn btn-secondary" autoFocus onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => { setConfirmDelete(false); resetAll(); }}>Delete project</button>
              </div>
            </div>
          </div>
        )}
        {confirmRun && (
          <div className="scrim" onMouseDown={() => setConfirmRun(null)}>
            <div className="confirm" role="alertdialog" aria-label="Generate everything" onMouseDown={(e) => e.stopPropagation()}>
              <h2>Generate {confirmRun.ids.length} node{confirmRun.ids.length > 1 ? 's' : ''}?</h2>
              <p>{confirmRun.pendingOnly ? 'Everything on this canvas that hasn’t been generated yet' : 'Every generating node on this canvas'}, including anything collaborators are still drafting.</p>
              <div className="confirm-cost"><span>Cost</span><b>{fmtCr(confirmRun.cost)} credits</b></div>
              <div className="confirm-acts">
                <button className="btn btn-secondary" onClick={() => setConfirmRun(null)}>Cancel</button>
                {confirmRun.cost > balance
                  ? <button className="btn btn-warn" onClick={() => { setConfirmRun(null); openCredits(confirmRun.cost - balance); }}>Add credits</button>
                  : <button className="btn btn-primary" autoFocus onClick={() => { const ids = confirmRun.ids; setConfirmRun(null); runSequence(ids); }}>Generate<span className="cost">{fmtCr(confirmRun.cost)}</span></button>}
              </div>
            </div>
          </div>
        )}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.action ? 'has-act' : ''}`}>
              <span>{t.msg}</span>
              {t.action && <button className="toast-act" onClick={() => { t.action.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
            </div>
          ))}
        </div>
      </div>
    </StudioCtx.Provider>
  );
}

/* ---------- empty state: one question, one box ---------- */
function EmptyState({ actions, onTemplates, planPending, plan, composerCtx, auto, setAuto }) {
  const [kind, setKind] = useState('video');
  if (planPending) {
    // A skeleton of what the plan will build: one ghost node per step, in the plan's own columns.
    const off = plan?.off || [];
    const steps = plan ? plan.steps.map((st, i) => ({ ...st, i })).filter((st) => !off.includes(st.i)) : [{ kind: 'image', key: 'a' }, { kind: 'video', key: 'b' }];
    const links = plan ? plan.links.filter(([a, b]) => steps.some((x) => x.key === a) && steps.some((x) => x.key === b)) : [['a', 'b']];
    const rank = {};
    const rankOf = (k, seen = new Set()) => { if (rank[k] != null) return rank[k]; if (seen.has(k)) return 0; seen.add(k); const ins = links.filter((l) => l[1] === k); rank[k] = ins.length ? Math.max(...ins.map((l) => rankOf(l[0], seen) + 1)) : 0; return rank[k]; };
    steps.forEach((st) => rankOf(st.key));
    const cols = [];
    steps.forEach((st) => { (cols[rank[st.key]] = cols[rank[st.key]] || []).push(st); });
    return (
      <div className="empty skel-wrap" aria-busy="true" aria-label="Building your plan">
        <div className="skel-cols">
          {cols.filter(Boolean).map((col, ci) => (
            <div key={ci} className="skel-col">
              {col.map((st) => {
                const out = KINDS[st.kind]?.output;
                return (
                  <div key={st.key || st.i} className={`skel-node k-${st.kind}`}>
                    <div className="skel-h"><KindTile kind={st.kind} size="sm" /><span>{st.title || ''}</span></div>
                    {(out === 'image' || out === 'video') && !['upload', 'clip'].includes(st.kind) && <div className="skel-media sh" />}
                    {['upload', 'clip'].includes(st.kind) && <div className="skel-media sh short" />}
                    {out === 'audio' && <div className="skel-wave sh" />}
                    {out === 'text' && <><div className="skel-line sh" /><div className="skel-line sh w70" /></>}
                    <div className="skel-f"><span className="skel-pill sh" /><span className="skel-pill sh w40" /></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="empty">
      <div className="empty-in">
        <h1>What do you want to make?</h1>
        {/* the same composer as the agent: one component, one look */}
        <div className="empty-composer agent">
          <Composer selection={[]} ctx={composerCtx} auto={auto} setAuto={setAuto} kinds={['video', 'image', 'audio', 'writer']} kind={kind} setKind={setKind}
            onAsk={(v, o) => actions.ask(v, { ...o, kind })} />
        </div>
        <div className="starts">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="startchip" onClick={() => actions.startTemplate(t)}>{t.name}</button>
          ))}
          <button className="startchip ghost" onClick={onTemplates}>All templates<Ico as={ArrowRight} size={14} /></button>
        </div>
      </div>
    </div>
  );
}
