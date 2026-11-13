import React from 'react';
import { Ico } from './icons.jsx';

/* One empty-state pattern for the whole app: a small drawing of what will live here, a title, one line, optional actions.
   Drawings use fills only (white at three strengths + one accent), on a 120×80 grid. */
const L1 = 'ea-1', L2 = 'ea-2', L3 = 'ea-3', A = 'ea-a', AT = 'ea-at', OK = 'ea-ok';

const media = (
  <>
    <rect x="18" y="20" width="40" height="50" rx="6" className={L1} transform="rotate(-9 38 45)" />
    <rect x="62" y="20" width="40" height="50" rx="6" className={L1} transform="rotate(9 82 45)" />
    <rect x="34" y="10" width="52" height="62" rx="6" className={L2} />
    <rect x="40" y="16" width="40" height="32" rx="4" className={L1} />
    <path d="M40 48 L52 33 L60 42 L66 36 L80 48 Z" className={L3} />
    <rect x="40" y="55" width="26" height="4" rx="2" className={L2} />
    <rect x="40" y="62" width="16" height="4" rx="2" className={L1} />
  </>
);
const tiles = (dim) => [0, 1, 2].flatMap((c) => [0, 1].map((r) => (
  <rect key={`${c}${r}`} x={24 + c * 26} y={12 + r * 30} width="20" height="24" rx="5" className={dim || (c + r) % 2 ? L1 : L2} />
)));

const ART = {
  outputs: <>{media}<circle cx="72" cy="24" r="4" className={A} /></>,
  starred: (
    <>{media}
      <circle cx="86" cy="14" r="9" className={A} />
      <polygon points="86,9 87.3,12.2 90.8,12.5 88.1,14.7 88.9,18 86,16.2 83.1,18 83.9,14.7 81.2,12.5 84.7,12.2" className="ea-ink" />
    </>
  ),
  runs: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i} opacity={[1, 0.6, 0.32][i]}>
          <rect x="16" y={10 + i * 22} width="88" height="16" rx="6" className={L1} />
          <rect x="20" y={13 + i * 22} width="10" height="10" rx="3" className={L2} />
          <rect x="36" y={16 + i * 22} width="48" height="4" rx="2" className={L2} />
          {i === 0 && <rect x="36" y="16" width="28" height="4" rx="2" className={A} />}
          <rect x="90" y={16 + i * 22} width="10" height="4" rx="2" className={L2} />
        </g>
      ))}
    </>
  ),
  comments: (
    <>
      <path d="M22 12 h52 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 h-38 l-8 7 v-7 h-6 a6 6 0 0 1 -6 -6 v-20 a6 6 0 0 1 6 -6 Z" className={L2} />
      <rect x="26" y="20" width="40" height="4" rx="2" className={L3} />
      <rect x="26" y="29" width="26" height="4" rx="2" className={L2} />
      <path d="M52 40 h46 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 h-4 v6 l-7 -6 h-35 a6 6 0 0 1 -6 -6 v-14 a6 6 0 0 1 6 -6 Z" className={L1} />
      <rect x="56" y="48" width="34" height="4" rx="2" className={L2} />
      <rect x="56" y="56" width="20" height="4" rx="2" className={L1} />
      <circle cx="98" cy="16" r="6" className={A} />
    </>
  ),
  resolved: (
    <>
      <path d="M22 12 h52 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 h-38 l-8 7 v-7 h-6 a6 6 0 0 1 -6 -6 v-20 a6 6 0 0 1 6 -6 Z" className={L1} />
      <rect x="26" y="20" width="40" height="4" rx="2" className={L2} />
      <rect x="26" y="29" width="26" height="4" rx="2" className={L1} />
      <circle cx="80" cy="52" r="15" className="ea-okt" />
      <path d="M72.5 52.5 l5 5 l10 -11 l-2.6 -2.4 l-7.4 8.1 l-2.4 -2.3 Z" className={OK} />
    </>
  ),
  assets: (
    <>
      {tiles()}
      <rect x="76" y="42" width="20" height="24" rx="5" className={AT} />
      <path d="M86 47 l5 5.5 h-3.4 v6.5 h-3.2 v-6.5 h-3.4 Z" className={A} />
    </>
  ),
  search: (
    <>
      <g opacity="0.55">{tiles(L1)}</g>
      <path fillRule="evenodd" d="M58 38 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 Z M58 38 m-9.5 0 a9.5 9.5 0 1 0 19 0 a9.5 9.5 0 1 0 -19 0 Z" className={L3} />
      <rect x="69" y="47" width="6" height="16" rx="3" transform="rotate(-45 72 55)" className={A} />
    </>
  ),
  form: (
    <>
      <rect x="24" y="6" width="72" height="68" rx="8" className={L1} />
      <rect x="32" y="14" width="22" height="3" rx="1.5" className={L2} />
      <rect x="32" y="20" width="56" height="10" rx="3" className={L2} />
      <rect x="32" y="36" width="16" height="3" rx="1.5" className={L2} />
      <rect x="32" y="42" width="16" height="8" rx="3" className={AT} />
      <rect x="51" y="42" width="16" height="8" rx="3" className={L2} />
      <rect x="70" y="42" width="16" height="8" rx="3" className={L2} />
      <rect x="32" y="58" width="56" height="9" rx="3" className={A} />
    </>
  ),
  agent: (
    <>
      <rect x="14" y="16" width="34" height="12" rx="6" className={L1} />
      <rect x="72" y="52" width="34" height="12" rx="6" className={L1} />
      <circle cx="60" cy="40" r="22" className={AT} />
      <path d="M60 25 C61.2 35 62.5 37.2 73 40 C62.5 42.8 61.2 45 60 55 C58.8 45 57.5 42.8 47 40 C57.5 37.2 58.8 35 60 25 Z" className={A} />
      <path d="M78 14 C78.4 17.5 79 18 82 18.5 C79 19 78.4 19.5 78 23 C77.6 19.5 77 19 74 18.5 C77 18 77.6 17.5 78 14 Z" className={A} />
    </>
  ),
};

export function Empty({ art, icon, title, text, size = 'md', children, className = '' }) {
  return (
    <div className={`es es-${size} ${className}`}>
      {art && ART[art] && <svg className="ea" viewBox="0 0 120 80" aria-hidden="true">{ART[art]}</svg>}
      {!art && icon && <span className="es-i"><Ico as={icon} size={16} /></span>}
      {title && <b className="es-t">{title}</b>}
      {text && <p className="es-p">{text}</p>}
      {children && <div className="es-acts">{children}</div>}
    </div>
  );
}
