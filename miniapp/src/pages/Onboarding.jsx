import { useState } from 'react';

const ANIM = `
  @keyframes fadeUp  { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes popIn   { from{transform:scale(0.85);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes shimmer { 0%{opacity:0.5} 50%{opacity:1} 100%{opacity:0.5} }
`;

const SLIDES = [
  {
    icon: '📍',
    bg: 'linear-gradient(150deg, #0D1117 0%, #1a2744 100%)',
    accent: '#2AABEE',
    title: 'Добро пожаловать\nв GeoEarn',
    text: 'Зарабатывайте GEO-монеты, просто посещая любимые заведения. Реальные деньги за каждый визит.',
  },
  {
    icon: '💎',
    bg: 'linear-gradient(150deg, #0D1117 0%, #1a3320 100%)',
    accent: '#34C759',
    title: 'Как работает\nGEO Economy',
    text: 'Сканируете QR → система проверяет геолокацию → GEO-монеты мгновенно зачисляются на ваш кошелёк.',
  },
  {
    icon: '💳',
    bg: 'linear-gradient(150deg, #0D1117 0%, #2d1f00 100%)',
    accent: '#FF9500',
    title: 'Вывод\nна Payme',
    text: 'Конвертируйте GEO в сумы и выводите на Payme в любой момент. Без комиссии для пользователей.',
  },
];

function SlidePhase({ onDone }) {
  const [slide, setSlide] = useState(0);
  const [key, setKey] = useState(0);

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide(s => s + 1);
      setKey(k => k + 1);
    } else {
      onDone();
    }
  }

  const s = SLIDES[slide];

  return (
    <div style={{
      minHeight: '100vh', background: s.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '60px 28px 48px', textAlign: 'center',
      transition: 'background 0.6s ease',
    }}>
      <style>{ANIM}</style>

      {/* Skip */}
      <button
        onClick={() => onDone()}
        style={{
          alignSelf: 'flex-end', background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer',
          padding: '4px 0', fontWeight: 600,
        }}
      >
        Пропустить
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Icon */}
        <div key={`icon-${key}`} style={{
          width: 120, height: 120, borderRadius: '50%',
          background: `rgba(${s.accent === '#2AABEE' ? '42,171,238' : s.accent === '#34C759' ? '52,199,89' : '255,149,0'},0.15)`,
          border: `2px solid ${s.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 60, marginBottom: 40,
          animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
          boxShadow: `0 0 40px ${s.accent}30`,
        }}>
          {s.icon}
        </div>

        {/* GEO branding pill */}
        <div key={`pill-${key}`} style={{
          background: `${s.accent}25`, border: `1px solid ${s.accent}50`,
          borderRadius: 20, padding: '4px 14px', fontSize: 12,
          color: s.accent, fontWeight: 700, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 20,
          animation: 'fadeUp 0.5s 0.05s ease both',
        }}>
          GeoEarn · {slide + 1}/{SLIDES.length}
        </div>

        <div key={`title-${key}`} style={{
          fontSize: 30, fontWeight: 900, color: '#fff',
          marginBottom: 18, lineHeight: 1.2, whiteSpace: 'pre-line',
          animation: 'fadeUp 0.5s 0.1s ease both',
        }}>
          {s.title}
        </div>

        <div key={`text-${key}`} style={{
          fontSize: 16, color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.65, maxWidth: 300,
          animation: 'fadeUp 0.5s 0.18s ease both',
        }}>
          {s.text}
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 28 : 8, height: 8, borderRadius: 4,
            background: i === slide ? s.accent : 'rgba(255,255,255,0.25)',
            transition: 'all 0.35s ease',
          }} />
        ))}
      </div>

      <button
        onClick={next}
        style={{
          width: '100%', maxWidth: 340,
          background: s.accent, color: '#fff',
          border: 'none', borderRadius: 18,
          padding: '17px', fontSize: 17, fontWeight: 800,
          cursor: 'pointer',
          boxShadow: `0 6px 24px ${s.accent}55`,
          transition: 'transform 0.1s, box-shadow 0.2s',
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {slide < SLIDES.length - 1 ? 'Далее →' : 'Выбрать режим'}
      </button>
    </div>
  );
}

function ModePhase({ onChoose }) {
  const [chosen, setChosen] = useState(null);

  const modes = [
    {
      id: 'user',
      icon: '🧑',
      label: 'Покупатель',
      desc: 'Зарабатываю GEO-монеты, посещая заведения',
      accent: '#2AABEE',
      bg: 'rgba(42,171,238,0.08)',
      border: 'rgba(42,171,238,0.3)',
    },
    {
      id: 'business',
      icon: '🏪',
      label: 'Бизнес',
      desc: 'Управляю кампаниями и привлекаю клиентов',
      accent: '#34C759',
      bg: 'rgba(52,199,89,0.08)',
      border: 'rgba(52,199,89,0.3)',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(150deg, #0D1117 0%, #141A24 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <style>{ANIM}</style>

      <div style={{ animation: 'fadeUp 0.5s ease both', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 52, marginBottom: 20,
            animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
          }}>
            👋
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 10, lineHeight: 1.2 }}>
            Кто вы?
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            Выберите режим использования GeoEarn
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setChosen(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 18,
                background: chosen === m.id ? m.bg : 'rgba(255,255,255,0.04)',
                border: `2px solid ${chosen === m.id ? m.accent : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 20, padding: '20px 22px',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s ease',
                boxShadow: chosen === m.id ? `0 4px 20px ${m.accent}25` : 'none',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: chosen === m.id ? m.bg : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${chosen === m.id ? m.border : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>
                {m.icon}
              </div>
              <div>
                <div style={{
                  fontSize: 17, fontWeight: 800, color: chosen === m.id ? '#fff' : 'rgba(255,255,255,0.85)',
                  marginBottom: 4,
                }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                  {m.desc}
                </div>
              </div>
              {chosen === m.id && (
                <div style={{
                  marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%',
                  background: m.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#fff', fontWeight: 900, flexShrink: 0,
                }}>
                  ✓
                </div>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => chosen && onChoose(chosen)}
          disabled={!chosen}
          style={{
            width: '100%',
            background: chosen
              ? (chosen === 'user' ? 'linear-gradient(135deg, #2AABEE, #1a8fcc)' : 'linear-gradient(135deg, #34C759, #25a244)')
              : 'rgba(255,255,255,0.1)',
            color: chosen ? '#fff' : 'rgba(255,255,255,0.3)',
            border: 'none', borderRadius: 18,
            padding: '17px', fontSize: 17, fontWeight: 800,
            cursor: chosen ? 'pointer' : 'not-allowed',
            boxShadow: chosen ? '0 6px 24px rgba(0,0,0,0.3)' : 'none',
            transition: 'all 0.25s ease',
          }}
        >
          {chosen ? 'Начать →' : 'Выберите режим'}
        </button>
      </div>
    </div>
  );
}

export default function Onboarding({ onDone }) {
  const [phase, setPhase] = useState('slides');

  return phase === 'slides'
    ? <SlidePhase onDone={() => setPhase('mode')} />
    : <ModePhase onChoose={mode => {
        localStorage.setItem('geo_onboarded', '1');
        localStorage.setItem('geo_mode', mode);
        onDone(mode);
      }} />;
}
