import { Clapperboard, Image, AudioLines, PenLine, Type, Upload, Expand, Paintbrush, MessageSquare, List, Layers, Group } from './ri.js';
// Node types, models, templates. Model names and prices are sample data for the prototype.

export const PORT_COLORS = { text: '#7fb2ff', image: '#c99bff', video: '#ffa463', audio: '#ff7db5' };
export const PORT_LABEL = { text: 'Text', image: 'Image', video: 'Video', audio: 'Audio' };

export const KINDS = {
  video: {
    label: 'Video', Icon: Clapperboard, group: 'Generate', desc: 'Clips from text or an image', output: 'video', runnable: true, aspect: true, duration: true,
    inputs: [
      { id: 'prompt', label: 'Prompt', type: 'text', multi: true },
      { id: 'start', label: 'Starting image', type: 'image' },
      { id: 'end', label: 'Ending image', type: 'image' },
      { id: 'refvideo', label: 'Reference video', type: 'video', multi: true, max: 3 },
      { id: 'audio', label: 'Audio', type: 'audio', multi: true, max: 3 },
      { id: 'refimg', label: 'Reference image', type: 'image', multi: true, max: 9 },
    ],
    placeholder: 'Describe the shot',
  },
  image: {
    label: 'Image', Icon: Image, group: 'Generate', desc: 'Stills, product shots, scenes', output: 'image', runnable: true, aspect: true,
    inputs: [
      { id: 'prompt', label: 'Prompt', type: 'text', multi: true },
      { id: 'ref', label: 'Reference image', type: 'image', multi: true, max: 8 },
    ],
    placeholder: 'Describe the image',
  },
  audio: {
    label: 'Audio', Icon: AudioLines, group: 'Generate', desc: 'Voice-over, music, sound FX', output: 'audio', runnable: true,
    inputs: [
      { id: 'script', label: 'Script', type: 'text', multi: true },
      { id: 'video', label: 'Video to score', type: 'video' },
    ],
    placeholder: 'Describe the voice or sound',
  },
  writer: {
    label: 'AI Writer', Icon: PenLine, group: 'Generate', desc: 'Scripts, hooks, captions', output: 'text', runnable: true,
    inputs: [
      { id: 'context', label: 'Context', type: 'text', multi: true },
      { id: 'ref', label: 'Image to describe', type: 'image' },
    ],
    placeholder: 'What should it write?',
  },
  note: {
    label: 'Text', Icon: Type, group: 'Inputs', desc: 'A brief or script to reuse in other nodes', output: 'text', runnable: false, inputs: [],
    placeholder: 'A brief to reuse in other nodes',
  },
  upload: {
    label: 'Upload', Icon: Upload, group: 'Inputs', desc: 'Your image, from file or Library', output: 'image', runnable: false, inputs: [],
  },
  list: {
    label: 'Text', Icon: Type, group: 'Hidden', desc: 'Text that runs connected nodes once per line', output: 'text', runnable: false, inputs: [],
    placeholder: 'One item per line…\nRed sneakers\nBlue sneakers\nGreen sneakers',
  },
  comment: {
    label: 'Comment', Icon: MessageSquare, group: 'Inputs', desc: 'A note for you or your team', output: null, runnable: false, inputs: [], noOutput: true,
    placeholder: 'Leave a comment…',
  },
  // Library media placed on the canvas (from Assets). Not in the rail: you add them from the Assets panel.
  clip: { label: 'Video clip', Icon: Clapperboard, group: 'Hidden', desc: 'A video from your assets', output: 'video', runnable: false, inputs: [] },
  sound: { label: 'Audio clip', Icon: AudioLines, group: 'Hidden', desc: 'Audio from your assets', output: 'audio', runnable: false, inputs: [] },
  frame: { label: 'Group', Icon: Group, group: 'Hidden', desc: 'A labelled frame around nodes', output: null, runnable: false, inputs: [], noOutput: true },
  layers: {
    label: 'Split into layers', Icon: Layers, group: 'Edit', desc: 'Separate an image into editable layers', output: 'image', runnable: true, needsImage: true,
    inputs: [{ id: 'source', label: 'Image', type: 'image' }],
  },
  upscale: {
    label: 'Upscale', Icon: Expand, group: 'Edit', desc: 'Sharper, larger image', output: 'image', runnable: true, needsImage: true,
    inputs: [{ id: 'source', label: 'Image', type: 'image' }],
  },
  edit: {
    label: 'Edit region', Icon: Paintbrush, group: 'Edit', desc: 'Repaint part of an image', output: 'image', runnable: true, needsImage: true,
    inputs: [
      { id: 'source', label: 'Image', type: 'image' },
      { id: 'prompt', label: 'Instruction', type: 'text', multi: true },
    ],
    placeholder: 'What should change?',
  },
};

export const KIND_ORDER = ['video', 'image', 'audio', 'writer', 'note', 'upload', 'edit', 'upscale', 'layers']; // comments are threads, not nodes

// group: Recommended | Fast & cheap | Best quality | With references
export const MODELS = {
  video: [
    { name: 'Auto', group: 'Recommended', cost: 560, secs: 180, note: 'Picks the best model for your prompt' },
    { name: 'Veo 3.1 Lite', group: 'Fast & cheap', cost: 180, secs: 60, note: 'Quick drafts, 720p' },
    { name: 'MiniMax H3 Max Turbo', group: 'Fast & cheap', cost: 200, secs: 90, note: 'Good motion for the price' },
    { name: 'Kling 3', group: 'Best quality', cost: 560, secs: 180, note: 'Cinematic, 1080p' },
    { name: 'Kling 4', group: 'Best quality', cost: 785, secs: 210, note: 'Create and edit up to 30s' },
    { name: 'Veo 3.1', group: 'Best quality', cost: 1200, secs: 240, note: 'Top realism, native audio' },
    { name: 'Seedance 2 Ingredients', group: 'With references', cost: 1210, secs: 240, note: 'Keeps characters and products consistent' },
  ],
  image: [
    { name: 'Auto', group: 'Recommended', cost: 150, secs: 25, note: 'Picks the best model for your prompt' },
    { name: 'Nano Banana 2.1', group: 'Fast & cheap', cost: 40, secs: 8, note: '4K visuals at Flash speed' },
    { name: 'GPT Image 2.6', group: 'Best quality', cost: 120, secs: 30, note: 'Precise text and frame-level edits' },
    { name: 'Flux 3', group: 'Best quality', cost: 150, secs: 20, note: 'Photoreal product shots' },
    { name: 'Nano Banana Pro', group: 'With references', cost: 200, secs: 30, note: 'Keeps faces and products consistent' },
  ],
  audio: [
    { name: 'Seed Audio 1', group: 'Recommended', cost: 60, secs: 68, note: 'Voice, narration and dubbing in 16 languages' },
    { name: 'Score Gen', group: 'Best quality', cost: 90, secs: 40, note: 'Background music' },
    { name: 'Foley 1', group: 'Fast & cheap', cost: 30, secs: 20, note: 'Sound effects' },
  ],
  writer: [
    { name: 'Auto', group: 'Recommended', cost: 5, secs: 12, note: 'Best model for the task' },
    { name: 'Lite Writer', group: 'Fast & cheap', cost: 2, secs: 5, note: 'Short captions and hooks' },
    { name: 'Pro Writer', group: 'Best quality', cost: 12, secs: 20, note: 'Long scripts and shot lists' },
  ],
  upscale: [{ name: 'Upscale 4K', group: 'Recommended', cost: 60, secs: 30, note: 'Sharper detail, 4× size' }],
  edit: [{ name: 'Inpaint Pro', group: 'Recommended', cost: 80, secs: 25, note: 'Repaints only what you describe' }],
  layers: [{ name: 'Layer Split', group: 'Recommended', cost: 40, secs: 20, note: 'Background, subject and details as separate layers' }],
};
export const MODEL_GROUPS = ['Recommended', 'Fast & cheap', 'Best quality', 'With references'];

export const findModel = (kind, name) => (MODELS[kind] || []).find((m) => m.name === name) || (MODELS[kind] || [])[0];

export function costOf(d, runs = 1) {
  const m = findModel(d.kind, d.model);
  if (!m) return 0;
  let c = m.cost;
  if (d.kind === 'video') c = Math.round((m.cost * (d.duration || 5)) / 5);
  if (d.kind === 'image') c = c * (d.count || 1);
  return c * Math.max(1, runs);
}
export const listItems = (text = '') => text.split('\n').map((x) => x.trim()).filter(Boolean);
export function secsOf(d) {
  const m = findModel(d.kind, d.model);
  if (!m) return 0;
  if (d.kind === 'video') return Math.round((m.secs * (d.duration || 5)) / 5);
  return m.secs;
}
export const fmtSecs = (s) => (s < 60 ? `~${s}s` : `~${Math.round(s / 60)}m`);
export const fmtCr = (n) => n.toLocaleString('en-IN');

export function writeScript(prompt) {
  const base = (prompt || 'your product').replace(/\s+/g, ' ').trim();
  const first = base.split(/[.!?\n]/)[0].slice(0, 70);
  const cap = first.charAt(0).toUpperCase() + first.slice(1);
  return [
    `HOOK: "${cap}. Wait for it…"`,
    `SHOT 1, close-up: hands, texture, the product in morning light.`,
    `SHOT 2, wide: the reveal, with movement toward camera.`,
    `VO: "${cap}. Made for days like this."`,
    `CTA: "Get yours today."`,
  ].join('\n');
}

// Next-step suggestions after a result, by output type.
export const NEXT_STEPS = {
  image: [
    { label: 'Animate into video', kind: 'video', port: 'start', prompt: 'Slow camera push-in, gentle motion' },
    { label: 'Upscale to 4K', kind: 'upscale', port: 'source' },
    { label: 'Edit a region', kind: 'edit', port: 'source' },
    { label: 'Use as reference', kind: 'image', port: 'ref' },
  ],
  video: [
    { label: 'Add voice-over', kind: 'audio', port: 'video', prompt: 'Warm, upbeat narrator' },
    { label: 'Add music', kind: 'audio', port: 'video', model: 'Score Gen', prompt: 'Light acoustic summer track' },
  ],
  text: [
    { label: 'Generate a video', kind: 'video', port: 'prompt' },
    { label: 'Generate an image', kind: 'image', port: 'prompt' },
    { label: 'Turn into voice-over', kind: 'audio', port: 'script' },
    { label: 'Refine with AI Writer', kind: 'writer', port: 'context' },
  ],
  audio: [{ label: 'Use as video soundtrack', kind: 'video', port: 'audio' }],
};

export const TEMPLATES = [
  {
    id: 'ad', name: 'Product video ad', desc: 'Product photo → hero shot → ad clip with voice-over', out: 'Video', project: 'Summer Tee Ad',
    nodes: [
      { key: 'product', kind: 'upload', col: 0, row: 0, data: { title: 'Product photo', asset: 'tee', expose: { label: 'Product photo', help: 'A clear photo on a plain background' } } },
      { key: 'brief', kind: 'note', col: 0, row: 1, data: { title: 'Brief', prompt: 'Summer drop: a breathable striped tee that keeps you cool.', expose: { label: 'What are you selling?', type: 'text' } } },
      { key: 'style', kind: 'note', col: 0, row: 2, data: { title: 'Ad style', prompt: 'Virtual try-on', expose: { label: 'Ad style', type: 'choice', options: ['UGC', 'Tutorial', 'Unboxing', 'Virtual try-on', 'Review'] } } },
      { key: 'hero', kind: 'image', col: 1, row: 0, data: { title: 'Hero shot', prompt: 'Studio hero shot of the product, soft daylight, lemon accents', model: 'Flux 3' } },
      { key: 'script', kind: 'writer', col: 1, row: 1, data: { title: 'Script', prompt: 'Write a 5-second ad script with a hook and a call to action' } },
      { key: 'clip', kind: 'video', col: 2, row: 0, data: { title: 'Ad clip', prompt: 'Model turns to camera and smooths the shirt', model: 'Kling 3' } },
      { key: 'vo', kind: 'audio', col: 2, row: 1, data: { title: 'Voice-over', prompt: 'Warm, upbeat narrator' } },
    ],
    edges: [['product', 'hero', 'ref'], ['brief', 'script', 'context'], ['style', 'script', 'context'], ['hero', 'clip', 'start'], ['script', 'clip', 'prompt'], ['script', 'vo', 'script']],
  },
  {
    id: 'ugc', name: 'UGC creator clip', desc: 'A creator talks about your product, phone-shot style', out: 'Video', project: 'UGC Clip',
    nodes: [
      { key: 'creator', kind: 'upload', col: 0, row: 0, data: { title: 'Creator', asset: 'aiko', expose: { label: 'Creator', help: 'Pick a character from your Library' } } },
      { key: 'line', kind: 'note', col: 0, row: 1, data: { title: 'What they say', prompt: 'Honestly, this lemon soda is the only thing getting me through July.', expose: { label: 'What should they say?', type: 'text' } } },
      { key: 'clip', kind: 'video', col: 1, row: 0, data: { title: 'Creator clip', prompt: 'Handheld selfie video, talking to camera, natural light', model: 'Veo 3.1 Lite' } },
      { key: 'voice', kind: 'audio', col: 1, row: 1, data: { title: 'Voice', prompt: 'Casual, friendly, young voice' } },
    ],
    edges: [['creator', 'clip', 'start'], ['line', 'clip', 'prompt'], ['line', 'voice', 'script']],
  },
  {
    id: 'board', name: 'Prompt to storyboard', desc: 'One idea → shot list → two storyboard frames', out: 'Images', project: 'Storyboard',
    nodes: [
      { key: 'idea', kind: 'note', col: 0, row: 0, data: { title: 'Idea', prompt: 'A lemon escapes the kitchen and rolls to the beach.', expose: { label: 'Your idea', type: 'text' } } },
      { key: 'shots', kind: 'writer', col: 1, row: 0, data: { title: 'Shot list', prompt: 'Turn the idea into a short shot list' } },
      { key: 'f1', kind: 'image', col: 2, row: 0, data: { title: 'Frame 1', prompt: 'Storyboard frame, opening shot', model: 'Nano Banana 2.1' } },
      { key: 'f2', kind: 'image', col: 2, row: 1, data: { title: 'Frame 2', prompt: 'Storyboard frame, final shot at the beach', model: 'Nano Banana 2.1' } },
    ],
    edges: [['idea', 'shots', 'context'], ['shots', 'f1', 'prompt'], ['shots', 'f2', 'prompt']],
  },
];

export const SHORTCUTS = [
  ['Copy / Cut / Paste', '⌘ C  /  ⌘ X  /  ⌘ V'],
  ['Paste without connections', '⌘ ⇧ V'],
  ['Duplicate without connections', '⌘ ⇧ D'],
  ['Preview result', 'A'],
  ['Make node bigger / smaller', '⌘ =  /  ⌘ −'],
  ['Move around the canvas', 'Scroll  ·  H + drag'],
  ['Zoom', '⌘ + scroll'],
  ['Pan tool / Select tool', 'H  /  V'],
  ['Add a comment', 'C'],
  ['Select all', '⌘ A'],
  ['Group selection', '⌘ G'],
  ['Add a node / search', '/  or  N'],
  ['Generate selected node', '⌘ ↵'],
  ['Generate everything waiting', '⌘ ⇧ ↵'],
  ['Duplicate', '⌘ D'],
  ['Delete', '⌫'],
  ['Tidy up', '⇧ T'],
  ['Fit view', 'F'],
  ['Undo / Redo', '⌘ Z  /  ⌘ ⇧ Z'],
  ['Leave a text field / close menus', 'Esc'],
];
