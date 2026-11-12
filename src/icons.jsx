import React from 'react';
import { KINDS } from './data.js';

// One icon family (Remix Icon, Line style), three sizes: 14 / 16 / 20.
export const STROKE = 1.75;

export function Ico({ as: C, size = 16, className }) {
  return <C size={size} strokeWidth={STROKE} className={className} aria-hidden="true" />;
}

// Node-type tile. The AI signal lives on the Generate action, not on every tile.
export function KindTile({ kind, size = 'md' }) {
  const k = KINDS[kind];
  const C = k.Icon;
  return (
    <span className={`ktile ${size}`}>
      <C size={size === 'sm' ? 14 : 16} strokeWidth={STROKE} aria-hidden="true" />
    </span>
  );
}
