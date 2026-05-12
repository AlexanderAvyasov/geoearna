import { useState } from 'react';
import { MapPin, Wallet, CreditCard, User, Store, Check, ChevronDown } from 'lucide-react';
import { C, E } from '../lib/design';
import { LegalSheet } from './Legal';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGS } from '../lib/i18n';

const SYNE = { fontFamily: "'Syne', sans-serif" };

const SLIDE_META = [
  { Icon: MapPin,     accent: C.geo,   accentDim: C.geoDim,  accentGl: C.geoGl,  num: 1 },
  { Icon: Wallet,     accent: C.green, accentDim: C.greenFt, accentGl: C.greenGl, num: 2 },
  { Icon: CreditCard, accent: C.gold,  accentDim: C.goldFt,  accentGl: C.goldGl,  num: 3 },
];

function LangPhase({ onDone }) {
  const { lang: currentLang, setLang, t } = useLanguage();
  const [selected, setSelected] = useState(currentLang);
  const [open, setOpen] = useState(false);

  function confirm() {
    setLang(selected);
    onDone();
  }

  const selectedInfo = LANGS[selected];

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 28px 52px',
    }}>
      {/* Logo mark */}
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'linear-gradient(145deg, #0D1520 0%, #08101A 100%)',
        border: '1px solid rgba(0,200,255,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
        animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
      }}>
        <MapPin size={32} color={C.geo} strokeWidth={1.75} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 36, animation: 'fadeUp 0.5s 0.1s ease both' }}>
        <div style={{ ...SYNE, fontSize: 24, fontWeight: 700, color: C.t1, marginBottom: 6, letterSpacing: -0.4 }}>
          {t('lang.title')}
        </div>
        <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.5 }}>
          {t('lang.subtitle')}
        </div>
      </div>

      {/* Custom dropdown */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 340, animation: 'fadeUp 0.5s 0.18s ease both' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center',
            background: C.geoDim,
            border: `0.5px solid ${open ? C.geo : C.geoGl}`,
            borderRadius: open ? '14px 14px 0 0' : 14,
            padding: '16px 18px',
            cursor: 'pointer', textAlign: 'left',
            transition: `all 0.18s ${E.smooth}`,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: C.t1 }}>
            {selectedInfo.label}
          </span>
          <ChevronDown
            size={18} color={C.geo} strokeWidth={2}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}
          />
        </button>

        {open && (
          <div style={{
            position: 'absolute', left: 0, right: 0, zIndex: 10,
            background: C.surf,
            border: `0.5px solid ${C.geo}`,
            borderTop: `0.5px solid ${C.geoGl}`,
            borderRadius: '0 0 14px 14px',
            overflow: 'hidden',
          }}>
            {Object.entries(LANGS).map(([code, info]) => {
              const isActive = selected === code;
              return (
                <button
                  key={code}
                  onClick={() => { setSelected(code); setOpen(false); }}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: isActive ? C.geoDim : 'transparent',
                    border: 'none',
                    borderTop: `0.5px solid ${C.b1}`,
                    padding: '14px 18px',
                    cursor: 'pointer', textAlign: 'left',
                    transition: `background 0.15s ${E.smooth}`,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: isActive ? C.t1 : C.t2 }}>
                    {info.label}
                  </span>
                  {isActive && (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: C.geo,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Check size={11} color={C.bg} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={confirm}
        style={{
          width: '100%', maxWidth: 340, marginTop: 20,
          background: C.geo, color: C.bg,
          border: 'none', borderRadius: 14,
          padding: '16px', fontSize: 16, fontWeight: 700,
          cursor: 'pointer',
          transition: `transform 0.12s ${E.spring}`,
          WebkitTapHighlightColor: 'transparent',
          animation: 'fadeUp 0.5s 0.26s ease both',
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {t('lang.continue')}
      </button>
    </div>
  );
}

function SlidePhase({ onDone }) {
  const { t } = useLanguage();
  const [slide, setSlide] = useState(0);
  const [key,   setKey]   = useState(0);

  function next() {
    if (slide < SLIDE_META.length - 1) {
      setSlide(s => s + 1);
      setKey(k => k + 1);
    } else {
      onDone();
    }
  }

  const s = SLIDE_META[slide];
  const title = t(`onboard.slide${s.num}.title`);
  const text  = t(`onboard.slide${s.num}.text`);

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
        {t('onboard.skip')}
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
          GeoEarn · {slide + 1}/{SLIDE_META.length}
        </div>

        <div key={`title-${key}`} style={{
          ...SYNE, fontSize: 28, fontWeight: 700, color: C.t1,
          marginBottom: 18, lineHeight: 1.2, whiteSpace: 'pre-line',
          letterSpacing: -0.4,
          animation: 'fadeUp 0.5s 0.1s ease both',
        }}>
          {title}
        </div>

        <div key={`text-${key}`} style={{
          fontSize: 15, color: C.t3,
          lineHeight: 1.65, maxWidth: 300,
          animation: 'fadeUp 0.5s 0.18s ease both',
        }}>
          {text}
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {SLIDE_META.map((_, i) => (
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
        {slide < SLIDE_META.length - 1 ? t('onboard.next') : t('onboard.select_mode')}
      </button>
    </div>
  );
}

function ModePhase({ onChoose }) {
  const { t } = useLanguage();
  const [chosen, setChosen] = useState(null);
  const [legalTab, setLegalTab] = useState(null);

  if (legalTab) {
    return <LegalSheet initialTab={legalTab} onClose={() => setLegalTab(null)} />;
  }

  const modes = [
    {
      id: 'user',
      Icon: User,
      label: t('onboard.mode.user.label'),
      desc:  t('onboard.mode.user.desc'),
      accent: C.geo,
      accentDim: C.geoDim,
      accentGl:  C.geoGl,
    },
    {
      id: 'business',
      Icon: Store,
      label: t('onboard.mode.biz.label'),
      desc:  t('onboard.mode.biz.desc'),
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
            {t('onboard.mode.title')}
          </div>
          <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.5 }}>
            {t('onboard.mode.subtitle')}
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
          {chosen ? t('onboard.mode.start') : t('onboard.mode.choose')}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: C.t3, lineHeight: 1.6 }}>
          {t('onboard.legal.prefix')}{' '}
          <button
            onClick={() => setLegalTab('terms')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.geo, fontSize: 11, padding: 0, fontWeight: 600 }}
          >
            {t('onboard.legal.terms')}
          </button>
          {' '}{t('onboard.legal.and')}{' '}
          <button
            onClick={() => setLegalTab('privacy')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.geo, fontSize: 11, padding: 0, fontWeight: 600 }}
          >
            {t('onboard.legal.privacy')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding({ onDone }) {
  const [phase, setPhase] = useState('lang');

  if (phase === 'lang')   return <LangPhase  onDone={() => setPhase('slides')} />;
  if (phase === 'slides') return <SlidePhase onDone={() => setPhase('mode')} />;
  return <ModePhase onChoose={onDone} />;
}
