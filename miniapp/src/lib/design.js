// GeoEarn Premium Design System v2
// Revolut × Telegram Premium × Linear × Stripe

export const C = {
  // Backgrounds
  bg:        '#070B14',
  surf:      '#0D1117',
  card:      '#0D1520',
  cardHi:    '#111827',

  // Borders
  b0: 'rgba(255,255,255,0.04)',
  b1: 'rgba(255,255,255,0.07)',
  b2: 'rgba(255,255,255,0.13)',

  // Purple — primary accent
  purple:   '#7C3AED',
  purpleL:  '#8B5CF6',
  purpleD:  '#6D28D9',
  purpleFt: 'rgba(124,58,237,0.12)',
  purpleGl: 'rgba(124,58,237,0.35)',

  // Indigo — secondary accent
  indigo:   '#6366F1',
  indigoFt: 'rgba(99,102,241,0.10)',
  indigoGl: 'rgba(99,102,241,0.28)',

  // Emerald — reward color (premium, not neon)
  emerald:   '#10B981',
  emeraldD:  '#059669',
  emeraldFt: 'rgba(16,185,129,0.10)',
  emeraldGl: 'rgba(16,185,129,0.25)',

  // Amber — premium moments
  gold:   '#F59E0B',
  goldD:  '#D97706',
  goldFt: 'rgba(245,158,11,0.10)',
  goldGl: 'rgba(245,158,11,0.28)',

  // Alerts
  orange: '#F97316',
  red:    '#EF4444',
  redFt:  'rgba(239,68,68,0.10)',
  redGl:  'rgba(239,68,68,0.25)',

  // Text
  t1: '#F8FAFC',
  t2: 'rgba(248,250,252,0.55)',
  t3: 'rgba(248,250,252,0.32)',
  t4: 'rgba(248,250,252,0.12)',
};

export const G = {
  page:       'linear-gradient(180deg, #070B14 0%, #0A0F1A 100%)',
  hero:       'linear-gradient(160deg, #070B14 0%, #0C1020 50%, #070B14 100%)',
  accent:     'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
  accentDeep: 'linear-gradient(135deg, #6D28D9 0%, #4F46E5 100%)',
  emerald:    'linear-gradient(135deg, #059669 0%, #10B981 100%)',
  gold:       'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
  dark:       'linear-gradient(160deg, #070B14 0%, #0B111E 60%, #070B14 100%)',
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

// Premium dark card
export const cardBase = {
  background: '#0D1520',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 20,
};

// Glass surface — for modals and floating elements
export const glassCard = {
  background: 'rgba(13,21,32,0.94)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
};

export function inputStyle(focused = false, error = false) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '14px 16px', borderRadius: 14,
    border: `1.5px solid ${error ? '#EF4444' : focused ? '#7C3AED' : 'rgba(255,255,255,0.08)'}`,
    background: 'rgba(255,255,255,0.04)',
    color: '#F8FAFC', fontSize: 16, outline: 'none',
    transition: 'border-color 0.2s',
    WebkitAppearance: 'none',
    fontFamily: 'Inter, -apple-system, sans-serif',
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
