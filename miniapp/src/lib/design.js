// GeoEarn Design System v5 — Americana Exploration

export const C = {
  // Backgrounds — dark navy
  bg:     '#081018',
  surf:   '#101A24',
  card:   '#16212D',
  cardHi: '#1C2A38',

  // Borders — neutral
  b0: 'rgba(255,255,255,0.04)',
  b1: 'rgba(255,255,255,0.07)',
  b2: 'rgba(255,255,255,0.12)',

  // Primary accent — burnt orange
  geo:    '#C97B47',
  geoDim: 'rgba(201,123,71,0.12)',
  geoGl:  'rgba(201,123,71,0.25)',

  // Secondary — dusty teal
  teal:    '#6D8B74',
  tealDim: 'rgba(109,139,116,0.12)',
  tealGl:  'rgba(109,139,116,0.25)',

  // Success / muted green
  green:   '#8FAE7B',
  greenFt: 'rgba(143,174,123,0.12)',
  greenGl: 'rgba(143,174,123,0.25)',

  // Gold / achievements
  gold:   '#E8C068',
  goldFt: 'rgba(232,192,104,0.12)',
  goldGl: 'rgba(232,192,104,0.25)',

  // Errors
  red:   '#C0544C',
  redFt: 'rgba(192,84,76,0.12)',
  redGl: 'rgba(192,84,76,0.25)',

  // Warm orange (warnings)
  orange: '#D4874F',

  // Text — warm cream hierarchy
  t1: '#F4EBDD',
  t2: '#A8B0B8',
  t3: '#4A5560',
  t4: 'rgba(244,235,221,0.06)',

  // Legacy aliases — kept for pages not yet fully migrated
  purple:   '#C97B47',
  purpleL:  '#C97B47',
  purpleD:  '#A86035',
  purpleFt: 'rgba(201,123,71,0.12)',
  purpleGl: 'rgba(201,123,71,0.25)',
  indigo:   '#6D8B74',
  indigoFt: 'rgba(109,139,116,0.12)',
  indigoGl: 'rgba(109,139,116,0.25)',
  emerald:   '#8FAE7B',
  emeraldD:  '#6D8B5F',
  emeraldFt: 'rgba(143,174,123,0.12)',
  emeraldGl: 'rgba(143,174,123,0.25)',
  goldD:     '#C9A042',
  blue:      '#6D8B74',
  blueGl:    'rgba(109,139,116,0.25)',
  blueFt:    'rgba(109,139,116,0.12)',
};

export const G = {
  page:       C.bg,
  hero:       C.bg,
  accent:     C.geo,
  accentDeep: C.geo,
  emerald:    C.green,
  gold:       C.gold,
  dark:       C.surf,
  blue:       C.teal,
  geo:        C.geo,
};

export const FF = {
  display: "'Ethnocentric', 'Rajdhani', sans-serif",
  body:    "'Rajdhani', system-ui, sans-serif",
};

export const E = {
  spring: 'cubic-bezier(0.32,0.72,0,1)',
  bounce: 'cubic-bezier(0.175,0.885,0.32,1.275)',
  smooth: 'cubic-bezier(0.4,0,0.2,1)',
};

export function sk(h, w = '100%', r = 10) {
  return {
    height: h, width: w, borderRadius: r, flexShrink: 0,
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255,255,255,0.06)',
    animation: 'shimmer 1.6s ease-in-out infinite',
  };
}

export const cardBase = {
  background: '#16212D',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20,
};

export const glassCard = {
  background: 'rgba(16,26,36,0.97)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
};

export function inputStyle(focused = false, error = false) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '14px 16px', borderRadius: 12,
    border: `1px solid ${error ? C.red : focused ? 'rgba(201,123,71,0.5)' : 'rgba(255,255,255,0.10)'}`,
    background: 'rgba(255,255,255,0.04)',
    color: '#F4EBDD', fontSize: 16, outline: 'none',
    transition: 'border-color 0.2s',
    WebkitAppearance: 'none',
    fontFamily: "'Rajdhani', system-ui, sans-serif",
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