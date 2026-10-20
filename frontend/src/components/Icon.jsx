import React from 'react';

/**
 * One outline icon set, drawn inline.
 *
 * This replaces the Material Symbols webfont. That font rendered icons as
 * ligatures, so any name missing from our subsetted file silently displayed as
 * raw text ("send", "work_history") instead of failing loudly — which is
 * exactly what shipped to production. Inline SVG cannot do that: an unknown
 * name renders nothing and throws in development.
 *
 * House rules for app screens: 16px outline, ~1.5px stroke, one set, grey.
 * Icons appear in the nav, before a label, or as a single affordance — never
 * stacked on a card or sitting in a tinted square.
 */
const paths = {
  overview: <><path d="M3 3h7v7H3z" /><path d="M14 3h7v4h-7z" /><path d="M14 11h7v10h-7z" /><path d="M3 14h7v7H3z" /></>,
  person: <><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /><circle cx="12" cy="7" r="4" /></>,
  document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m4 12 5 5L20 7" />,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h10" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13h10l1-13" /></>,
};

export default function Icon({ name, size = 16, className = '', title }) {
  const d = paths[name];
  if (!d) {
    if (import.meta.env.DEV) throw new Error(`Icon: unknown name "${name}"`);
    return null;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {d}
    </svg>
  );
}
