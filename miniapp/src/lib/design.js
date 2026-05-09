// GeoEarn Design System v3 — Restrained Luxury
// Linear × Revolut × Raycast

export const C = {
  // Backgrounds
  bg:     '#090B10',
  surf:   '#0F1318',
  card:   '#161B24',
  cardHi: '#1E2530',

  // Borders
  b0: 'rgba(255,255,255,0.04)',
  b1: 'rgba(255,255,255,0.07)',
  b2: 'rgba(255,255,255,0.12)',

  // GEO accent — yellow-green
  geo:    '#C6F135',
  geoDim: 'rgba(198,241,53,0.10)',
  geoGl:  'rgba(198,241,53,0.20)',

  // Success green
  green:   '#4ADE80',
  greenFt: 'rgba(74,222,128,0.10)',
  greenGl: 'rgba(74,222,128,0.20)',

  // Achievements / rewards
  gold:   '#F5A623',
  goldFt: 'rgba(245,166,35,0.10)',
  goldGl: 'rgba(245,166,35,0.20)',

  // Errors
  red:   '#F87171',
  redFt: 'rgba(248,113,113,0.10)',
  redGl: 'rgba(248,113,113,0.20)',

  // Streak / warnings
  orange: '#FB923C',

  // Text
  t1: '#F0F2F7',
  t2: '#8892A8',
  t3: '#4A5168',
  t4: 'rgba(240,242,247,0.06)',

  // Legacy aliases — for pages not yet migrated to new tokens
  purple:   '#C6F135',
  purpleL:  '#C6F135',
  purpleD:  '#A8D420',
  purpleFt: 'rgba(198,241,53,0.10)',
  purpleGl: 'rgba(198,241,53,0.20)',
  indigo:   '#C6F135',
  indigoFt: 'rgba(198,241,53,0.10)',
  indigoGl: 'rgba(198,241,53,0.20)',
  emerald:   '#4ADE80',
  emeraldD:  '#22C55E',
  emeraldFt: 'rgba(74,222,128,0.10)',
  emeraldGl: 'rgba(74,222,128,0.20)',
  goldD:     '#D97706',
  blue:      '#C6F135',
  blueGl:    'rgba(198,241,53,0.20)',
  blueFt:    'rgba(198,241,53,0.10)',
};

// Legacy gradient shims — flat colors for pages not yet redesigned
export const G = {
  page:       C.bg,
  hero:       C.bg,
  accent:     C.geo,
  accentDeep: C.geo,
  emerald:    C.green,
  gold:       C.gold,
  dark:       C.surf,
  blue:       C.geo,
  geo:        C.geo,
};

export const E = {
  spring: 'cubic-bezier(0.32,0.72,0,1)',
  bounce: 'cubic-bezier(0.175,0.885,0.32,1.275)',
  smooth: 'cubic-bezier(0.4,0,0.2,1)',
};

export function sk(h, w = '100%', r = 8) {
  return {
    height: h, width: w, borderRadius: r, flexShrink: 0,
    background: 'rgba(255,255,255,0.05)',
    animation: 'pulse 1.5s ease-in-out infinite',
  };
}

export const cardBase = {
  background: '#161B24',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 20,
};

export const glassCard = {
  background: 'rgba(15,19,24,0.97)',
  border: '0.5px solid rgba(255,255,255,0.08)',
  borderRadius: 24,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
};

export function inputStyle(focused = false, error = false) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '14px 16px', borderRadius: 14,
    border: `1px solid ${error ? '#F87171' : focused ? 'rgba(198,241,53,0.45)' : 'rgba(255,255,255,0.08)'}`,
    background: 'rgba(255,255,255,0.04)',
    color: '#F0F2F7', fontSize: 16, outline: 'none',
    transition: 'border-color 0.2s',
    WebkitAppearance: 'none',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  };
}

export function pressable(pressed) {
  return {
    transform: pressed ? 'scale(0.975)' : 'scale(1)',
    transition: `transform 0.12s cubic-bezier(0.32,0.72,0,1)`,
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };
}
