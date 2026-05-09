import { useState } from 'react';
import { MapPin, Wallet, CreditCard, User, Store, Check } from 'lucide-react';
import { C, E } from '../lib/design';
import { LegalSheet } from './Legal';

const SYNE = { fontFamily: "'Syne', sans-serif" };

const SLIDES = [
  {
    Icon: MapPin,
    accent: C.geo,
    accentDim: C.geoDim,
    accentGl:  C.geoGl,
    title: 'Добро пожаловать\nв GeoEarn',
    text: 'Зарабатывайте GEO-монеты, просто посещая любимые заведения. Реальные деньги за каждый визит.',
  },
  {
    Icon: Wallet,
    accent: C.green,
    accentDim: C.greenFt,
    accentGl:  C.greenGl,
    title: 'Как работает\nGEO Economy',
    text: 'Сканируете QR — система проверяет геолокацию — GEO-монеты мгновенно зачисляются на кошелёк.',
  },
  {
    Icon: CreditCard,
    accent: C.gold,
    accentDim: C.goldFt,
    accentGl:  C.goldGl,
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
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '60px 28px 52px', textAlign: 'center',
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
          width: 112, height: 112, borderRadius: '50%',
          background: s.accentDim,
          border: `0.5px solid ${s.accentGl}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 40,
          animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
        }}>
          <s.Icon size={48} color={s.accent} strokeWidth={1.5} />
        </div>

        {/* Counter */}
        <div key={`pill-${key}`} style={{
          background: s.accentDim, border: `0.5px solid ${s.accentGl}`,
          borderRadius: 20, padding: '4px 14px', fontSize: 10,
          color: s.accent, fontWeight: 700, letterSpacing: 1.6,
          textTransform: 'uppercase', marginBottom: 20,
          animation: 'fadeUp 0.5s 0.05s ease both',
        }}>
          GeoEarn · {slide + 1}/{SLIDES.length}
        </div>

        <div key={`title-${key}`} style={{
          ...SYNE, fontSize: 28, fontWeight: 700, color: C.t1,
          marginBottom: 18, lineHeight: 1.2, whiteSpace: 'pre-line',
          letterSpacing: -0.4,
          animation: 'fadeUp 0.5s 0.1s ease both',
        }}>
          {s.title}
        </div>

        <div key={`text-${key}`} style={{
          fontSize: 15, color: C.t3,
          lineHeight: 1.65, maxWidth: 300,
          animation: 'fadeUp 0.5s 0.18s ease both',
        }}>
          {s.text}
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 24 : 7, height: 7, borderRadius: 4,
            background: i === slide ? s.accent : C.b2,
            transition: 'all 0.32s ease',
          }} />
        ))}
      </div>

      <button
        onClick={next}
        style={{
          width: '100%', maxWidth: 340,
          background: s.accent,
          color: C.bg,
          border: 'none', borderRadius: 14,
          padding: '16px', fontSize: 16, fontWeight: 700,
          cursor: 'pointer',
          transition: `transform 0.12s ${E.spring}`,
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
  const [legalTab, setLegalTab] = useState(null); // null | 'terms' | 'privacy'

  if (legalTab) {
    return <LegalSheet initialTab={legalTab} onClose={() => setLegalTab(null)} />;
  }

  const modes = [
    {
      id: 'user',
      Icon: User,
      label: 'Geo Скаут',
      desc: 'Зарабатываю GEO-монеты, посещая заведения',
      accent: C.geo,
      accentDim: C.geoDim,
      accentGl:  C.geoGl,
    },
    {
      id: 'business',
      Icon: Store,
      label: 'Бизнес',
      desc: 'Управляю кампаниями и привлекаю клиентов',
      accent: C.green,
      accentDim: C.greenFt,
      accentGl:  C.greenGl,
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ animation: 'fadeUp 0.5s ease both', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: C.geoDim,
            border: `0.5px solid ${C.geoGl}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
          }}>
            <MapPin size={32} color={C.geo} strokeWidth={1.75} />
          </div>
          <div style={{ ...SYNE, fontSize: 26, fontWeight: 700, color: C.t1, marginBottom: 8, lineHeight: 1.2, letterSpacing: -0.4 }}>
            Кто вы?
          </div>
          <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.5 }}>
            Выберите режим использования GeoEarn
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setChosen(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: chosen === m.id ? m.accentDim : 'rgba(255,255,255,0.02)',
                border: `0.5px solid ${chosen === m.id ? m.accentGl : C.b1}`,
                borderRadius: 18, padding: '18px 20px',
                cursor: 'pointer', textAlign: 'left',
                transition: `all 0.18s ${E.smooth}`,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{
                width: 50, height: 50, borderRadius: 14, flexShrink: 0,
                background: chosen === m.id ? m.accentDim : C.b0,
                border: `0.5px solid ${chosen === m.id ? m.accentGl : C.b1}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `all 0.18s ${E.smooth}`,
              }}>
                <m.Icon size={24} color={chosen === m.id ? m.accent : C.t3} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: chosen === m.id ? C.t1 : C.t2,
                  marginBottom: 3, transition: 'color 0.15s',
                }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.4 }}>
                  {m.desc}
                </div>
              </div>
              {chosen === m.id && (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: m.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  animation: 'pop 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
                }}>
                  <Check size={12} color={C.bg} strokeWidth={3} />
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
            background: chosen ? C.geo : C.card,
            color: chosen ? C.bg : C.t3,
            border: `0.5px solid ${chosen ? 'transparent' : C.b2}`,
            borderRadius: 14,
            padding: '16px', fontSize: 16, fontWeight: 700,
            cursor: chosen ? 'pointer' : 'not-allowed',
            transition: `all 0.2s ${E.smooth}`,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {chosen ? 'Начать' : 'Выберите режим'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: C.t3, lineHeight: 1.6 }}>
          Нажимая «Начать», вы принимаете{' '}
          <button
            onClick={() => setLegalTab('terms')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.geo, fontSize: 11, padding: 0, fontWeight: 600 }}
          >
            Условия пользования
          </button>
          {' '}и{' '}
          <button
            onClick={() => setLegalTab('privacy')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.geo, fontSize: 11, padding: 0, fontWeight: 600 }}
          >
            Политику конфиденциальности
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding({ onDone }) {
  const [phase, setPhase] = useState('slides');

  return phase === 'slides'
    ? <SlidePhase onDone={() => setPhase('mode')} />
    : <ModePhase onChoose={onDone} />;
}
