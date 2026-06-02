export const C = {
  bg:       '#07101C',
  surf:     '#0D1B2A',
  card:     '#0F1F30',
  cardHov:  '#132436',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  accent:   '#C9EA1A',
  accentD:  'rgba(201,234,26,0.10)',
  accentGl: 'rgba(201,234,26,0.22)',
  t1:       '#E8EFF8',
  t2:       '#7A8FA8',
  t3:       '#3D556A',
  green:    '#4ADE80',
  greenD:   'rgba(74,222,128,0.10)',
  greenGl:  'rgba(74,222,128,0.22)',
  red:      '#F87171',
  redD:     'rgba(248,113,113,0.10)',
  orange:   '#FB923C',
  orangeD:  'rgba(251,146,60,0.10)',
  blue:     '#60A5FA',
  blueD:    'rgba(96,165,250,0.10)',
  blueGl:   'rgba(96,165,250,0.22)',
  purple:   '#C084FC',
  purpleD:  'rgba(192,132,252,0.10)',
  gold:     '#FBBF24',
  goldD:    'rgba(251,191,36,0.10)',
};

export const SW  = 220;   // sidebar width
export const SWC = 60;    // sidebar collapsed
export const TH  = 56;    // topbar height

export function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('ru-RU');
}

export function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
