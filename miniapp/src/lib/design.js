// GeoEarn Premium Design System
// Inspired by Revolut, Coinbase, Linear, StepN

export const C = {
  // Backgrounds
  bg:     '#08090E',
  surf:   '#0F1117',
  card:   '#13161F',
  cardHi: '#181D2B',

  // Borders
  b0: 'rgba(255,255,255,0.05)',
  b1: 'rgba(255,255,255,0.09)',
  b2: 'rgba(255,255,255,0.15)',

  // Blue (Telegram brand)
  blue:   '#2AABEE',
  blueD:  '#0088CC',
  blueFt: 'rgba(42,171,238,0.10)',
  blueGl: 'rgba(42,171,238,0.35)',

  // GEO Green (earnings)
  geo:    '#00E676',
  geoD:   '#00C853',
  geoFt:  'rgba(0,230,118,0.09)',
  geoGl:  'rgba(0,230,118,0.4)',

  // Gold (premium moments)
  gold:   '#FFB800',
  goldFt: 'rgba(255,184,0,0.10)',
  goldGl: 'rgba(255,184,0,0.35)',

  // Alerts
  orange: '#FF9500',
  red:    '#FF3B5C',
  redFt:  'rgba(255,59,92,0.09)',

  // Text
  t1: '#FFFFFF',
  t2: 'rgba(255,255,255,0.55)',
  t3: 'rgba(255,255,255,0.30)',
  t4: 'rgba(255,255,255,0.12)',
};

export const G = {
  page:   'linear-gradient(180deg, #08090E 0%, #0A0C14 100%)',
  hero:   'linear-gradient(160deg, #080C18 0%, #0C1222 60%, #08090E 100%)',
  geo:    'linear-gradient(135deg, #00E676 0%, #00BFA5 100%)',
  blue:   'linear-gradient(135deg, #2AABEE 0%, #006ECC 100%)',
  gold:   'linear-gradient(135deg, #FFB800 0%, #FF6500 100%)',
  orange: 'linear-gradient(135deg, #FF9500 0%, #FF6500 100%)',
  admin:  'linear-gradient(160deg, #08101E 0%, #0C1828 60%, #08090E 100%)',
};

export const E = {
  spring: 'cubic-bezier(0.32,0.72,0,1)',
  bounce: 'cubic-bezier(0.175,0.885,0.32,1.275)',
  smooth: 'cubic-bezier(0.4,0,0.2,1)',
};

// Skeleton shimmer placeholder
export function sk(h, w = '100%', r = 8) {
  return {
    height: h, width: w, borderRadius: r, flexShrink: 0,
    background: 'rgba(255,255,255,0.06)',
    animation: 'pulse 1.5s ease-in-out infinite',
  };
}

// Dark glass card base
export const cardBase = {
  background: '#13161F',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20,
};

// Input field — dark premium
export function inputStyle(focused = false, error = false) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '14px 16px', borderRadius: 14,
    border: `1.5px solid ${error ? '#FF3B5C' : focused ? '#2AABEE' : 'rgba(255,255,255,0.10)'}`,
    background: 'rgba(255,255,255,0.05)',
    color: '#fff', fontSize: 16, outline: 'none',
    transition: 'border-color 0.15s',
    WebkitAppearance: 'none',
  };
}

// Pressable card (tap scale)
export function pressable(pressed) {
  return {
    transform: pressed ? 'scale(0.975)' : 'scale(1)',
    transition: `transform 0.12s ${E.spring}`,
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };
}
