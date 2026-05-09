import { useState } from 'react';
import { MapPin, Coins, CreditCard, User, Store, Check, Sparkles } from 'lucide-react';
import { C, G, E } from '../lib/design';

const SLIDES = [
  {
    Icon: MapPin,
    bg: 'linear-gradient(160deg, #050810 0%, #0C1428 60%, #050810 100%)',
    accent: C.blue,
    glowColor: 'rgba(42,171,238,0.18)',
    title: 'Добро пожаловать\nв GeoEarn',
    text: 'Зарабатывайте GEO-монеты, просто посещая любимые заведения. Реальные деньги за каждый визит.',
  },
  {
    Icon: Coins,
    bg: 'linear-gradient(160deg, #050810 0%, #071A10 60%, #050810 100%)',
    accent: C.geo,
    glowColor: 'rgba(0,230,118,0.15)',
    title: 'Как работает\nGEO Economy',
    text: 'Сканируете QR → система проверяет геолокацию → GEO-монеты мгновенно зачисляются на ваш кошелёк.',
  },
  {
    Icon: CreditCard,
    bg: 'linear-gradient(160deg, #050810 0%, #1A1200 60%, #050810 100%)',
    accent: C.gold,
    glowColor: 'rgba(255,184,0,0.13)',
    title: 'Вывод\nна Payme',
    text: 'Конвертируйте GEO в сумы и выводите на Payme в любой момент. Без комиссии для пользователей.',
  },
];

function SlidePhase({ onDone }) {
  const [slide, setSlide] = useState(0);
  const [key,   setKey]   = useState(0);

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
      padding: '60px 28px 52px', textAlign: 'center',
      transition: 'background 0.6s ease',
    }}>
      {/* Skip */}
      <button onClick={onDone} style={{
        alignSelf: 'flex-end', background: 'none', border: 'none',
        color: C.t3, fontSize: 14, cursor: 'pointer',
        padding: '4px 0', fontWeight: 600,
        WebkitTapHighlightColor: 'transparent',
      }}>
        Пропустить
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Icon circle */}
        <div key={`icon-${key}`} style={{
          width: 128, height: 128, borderRadius: '50%',
          background: s.glowColor,
          border: `1.5px solid ${s.accent}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 40,
          animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
          boxShadow: `0 0 60px ${s.glowColor}`,
        }}>
          <s.Icon size={56} color={s.accent} strokeWidth={1.5} />
        </div>

        {/* Counter pill */}
        <div key={`pill-${key}`} style={{
          background: `${s.accent}20`, border: `1px solid ${s.accent}45`,
          borderRadius: 20, padding: '4px 14px', fontSize: 11,
          color: s.accent, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', marginBottom: 22,
          animation: 'fadeUp 0.5s 0.05s ease both',
        }}>
          GeoEarn · {slide + 1}/{SLIDES.length}
        </div>

        <div key={`title-${key}`} style={{
          fontSize: 30, fontWeight: 900, color: C.t1,
          marginBottom: 18, lineHeight: 1.2, whiteSpace: 'pre-line',
          letterSpacing: -0.5,
          animation: 'fadeUp 0.5s 0.1s ease both',
        }}>
          {s.title}
        </div>

        <div key={`text-${key}`} style={{
          fontSize: 16, color: C.t3,
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
            width: i === slide ? 30 : 8, height: 8, borderRadius: 4,
            background: i === slide ? s.accent : C.b2,
            transition: 'all 0.35s ease',
            boxShadow: i === slide ? `0 0 8px ${s.accent}` : 'none',
          }} />
        ))}
      </div>

      <button
        onClick={next}
        style={{
          width: '100%', maxWidth: 340,
          background: s.accent === C.blue ? G.blue : s.accent === C.geo ? G.geo : G.gold,
          color: s.accent === C.geo ? '#071a0c' : '#fff',
          border: 'none', borderRadius: 18,
          padding: '17px', fontSize: 17, fontWeight: 800,
          cursor: 'pointer',
          boxShadow: `0 8px 32px ${s.glowColor}`,
          transition: `transform 0.1s ${E.spring}`,
          WebkitTapHighlightColor: 'transparent',
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {slide < SLIDES.length - 1 ? 'Далее' : 'Выбрать режим'}
      </button>
    </div>
  );
}

function ModePhase({ onChoose }) {
  const [chosen, setChosen] = useState(null);

  const modes = [
    {
      id: 'user',
      Icon: User,
      label: 'Покупатель',
      desc: 'Зарабатываю GEO-монеты, посещая заведения',
      accent: C.blue,
      bg: C.blueFt,
      border: C.blueGl,
      gradient: G.blue,
    },
    {
      id: 'business',
      Icon: Store,
      label: 'Бизнес',
      desc: 'Управляю кампаниями и привлекаю клиентов',
      accent: C.geo,
      bg: C.geoFt,
      border: C.geoGl,
      gradient: G.geo,
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #050810 0%, #080D16 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ animation: 'fadeUp 0.5s ease both', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(42,171,238,0.12)',
            border: '1.5px solid rgba(42,171,238,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
          }}>
            <Sparkles size={38} color={C.blue} strokeWidth={1.75} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.t1, marginBottom: 10, lineHeight: 1.2, letterSpacing: -0.5 }}>
            Кто вы?
          </div>
          <div style={{ fontSize: 15, color: C.t3, lineHeight: 1.5 }}>
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
                background: chosen === m.id ? m.bg : 'rgba(255,255,255,0.03)',
                border: `2px solid ${chosen === m.id ? m.accent : C.b1}`,
                borderRadius: 20, padding: '20px 22px',
                cursor: 'pointer', textAlign: 'left',
                transition: `all 0.2s ${E.smooth}`,
                boxShadow: chosen === m.id ? `0 4px 24px ${m.border}` : 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: chosen === m.id ? m.bg : C.b0,
                border: `1.5px solid ${chosen === m.id ? m.border : C.b1}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `all 0.2s ${E.smooth}`,
              }}>
                <m.Icon size={26} color={chosen === m.id ? m.accent : C.t3} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{
                  fontSize: 17, fontWeight: 800,
                  color: chosen === m.id ? C.t1 : C.t2,
                  marginBottom: 4, transition: 'color 0.15s',
                }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.4 }}>
                  {m.desc}
                </div>
              </div>
              {chosen === m.id && (
                <div style={{
                  marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%',
                  background: m.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  animation: 'pop 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
                }}>
                  <Check size={13} color={m.id === 'business' ? '#071a0c' : '#fff'} strokeWidth={3} />
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
              ? (chosen === 'user' ? G.blue : G.geo)
              : C.b1,
            color: chosen ? (chosen === 'business' ? '#071a0c' : '#fff') : C.t3,
            border: 'none', borderRadius: 18,
            padding: '17px', fontSize: 17, fontWeight: 800,
            cursor: chosen ? 'pointer' : 'not-allowed',
            boxShadow: chosen ? `0 8px 32px ${chosen === 'user' ? C.blueGl : C.geoGl}` : 'none',
            transition: `all 0.25s ${E.smooth}`,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {chosen ? 'Начать' : 'Выберите режим'}
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
