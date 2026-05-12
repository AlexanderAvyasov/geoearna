// GeoEarn Design System v4 — Field Operations HUD

export const C = {
  // Backgrounds
  bg:     '#06080E',
  surf:   '#0A0D16',
  card:   '#0E1222',
  cardHi: '#121830',

  // Borders — cyan-tinted
  b0: 'rgba(0,200,255,0.06)',
  b1: 'rgba(0,200,255,0.12)',
  b2: 'rgba(0,200,255,0.22)',

  // GEO accent — cyan HUD
  geo:    '#00C8FF',
  geoDim: 'rgba(0,200,255,0.10)',
  geoGl:  'rgba(0,200,255,0.20)',

  // Success green
  green:   '#00FF88',
  greenFt: 'rgba(0,255,136,0.10)',
  greenGl: 'rgba(0,255,136,0.20)',

  // Achievements / rewards
  gold:   '#FFB800',
  goldFt: 'rgba(255,184,0,0.10)',
  goldGl: 'rgba(255,184,0,0.20)',

  // Errors
  red:   '#FF3860',
  redFt: 'rgba(255,56,96,0.10)',
  redGl: 'rgba(255,56,96,0.20)',

  // Streak / warnings
  orange: '#FF7A30',

  // Text
  t1: '#E8F4FF',
  t2: '#4A7A9B',
  t3: '#1E3A52',
  t4: 'rgba(232,244,255,0.06)',

  // Legacy aliases — kept for pages not yet migrated
  purple:   '#00C8FF',
  purpleL:  '#00C8FF',
  purpleD:  '#0099CC',
  purpleFt: 'rgba(0,200,255,0.10)',
  purpleGl: 'rgba(0,200,255,0.20)',
  indigo:   '#00C8FF',
  indigoFt: 'rgba(0,200,255,0.10)',
  indigoGl: 'rgba(0,200,255,0.20)',
  emerald:   '#00FF88',
  emeraldD:  '#00CC6A',
  emeraldFt: 'rgba(0,255,136,0.10)',
  emeraldGl: 'rgba(0,255,136,0.20)',
  goldD:     '#CC9200',
  blue:      '#00C8FF',
  blueGl:    'rgba(0,200,255,0.20)',
  blueFt:    'rgba(0,200,255,0.10)',
};

// Legacy gradient shims
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

export function sk(h, w = '100%', r = 4) {
  return {
    height: h, width: w, borderRadius: r, flexShrink: 0,
    position: 'relative', overflow: 'hidden',
    background: 'rgba(0,200,255,0.05)',
    animation: 'shimmer 1.6s ease-in-out infinite',
  };
}

export const cardBase = {
  background: '#0E1222',
  border: '1px solid rgba(0,200,255,0.12)',
  borderRadius: 4,
};

export const glassCard = {
  background: 'rgba(10,13,22,0.97)',
  border: '1px solid rgba(0,200,255,0.14)',
  borderRadius: 4,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
};

export function inputStyle(focused = false, error = false) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '14px 16px', borderRadius: 4,
    border: `1px solid ${error ? '#FF3860' : focused ? 'rgba(0,200,255,0.5)' : 'rgba(0,200,255,0.14)'}`,
    background: 'rgba(0,200,255,0.04)',
    color: '#E8F4FF', fontSize: 16, outline: 'none',
    transition: 'border-color 0.2s',
    WebkitAppearance: 'none',
    fontFamily: "'Rajdhani', 'Barlow Condensed', -apple-system, sans-serif",
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
