import { useState } from 'react';
import { MapPin, Wallet, CreditCard, Check, ChevronDown, Shield, FileText, Eye } from 'lucide-react';
import { C, E, FF } from '../lib/design';
import { LegalSheet } from './Legal';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGS } from '../lib/i18n';
import { apiFetch } from '../lib/api';

const TOS_VERSION = 'v1';

// ── Device fingerprint ────────────────────────────────────────────────────────
async function buildFingerprint() {
  const tgw = window.Telegram?.WebApp;
  const raw = [
    navigator.userAgent || '',
    navigator.language  || '',
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth || 0),
    String(navigator.hardwareConcurrency || 0),
    String(navigator.maxTouchPoints || 0),
    tgw?.platform || '',
    tgw?.version  || '',
  ].join('|');

  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return raw.slice(0, 200);
  }
}

const SLIDE_META = [
  { Icon: MapPin,     accent: C.geo,   accentDim: C.geoDim,  accentGl: C.geoGl,  num: 1 },
  { Icon: Wallet,     accent: C.green, accentDim: C.greenFt, accentGl: C.greenGl, num: 2 },
  { Icon: CreditCard, accent: C.gold,  accentDim: C.goldFt,  accentGl: C.goldGl,  num: 3 },
];

// ── Key terms for the consent screen ─────────────────────────────────────────
const KEY_POINTS = [
  { icon: MapPin,    text: 'Вы зарабатываете GEO за посещение заведений и участие в кампаниях.' },
  { icon: Shield,    text: 'Запрещено использовать ботов, подделывать GPS или создавать несколько аккаунтов.' },
  { icon: Wallet,    text: 'GEO не являются ценными бумагами. Курс конвертации может меняться.' },
  { icon: FileText,  text: 'Мы собираем данные Telegram-аккаунта для авторизации и предотвращения мошенничества.' },
];

// ── Language phase ────────────────────────────────────────────────────────────
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
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'linear-gradient(145deg, #0D1520 0%, #08101A 100%)',
        border: `0.5px solid ${C.geoGl}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
        animation: 'pop 0.5s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <MapPin size={32} color={C.geo} strokeWidth={1.75} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 36, animation: 'fadeUp 0.5s 0.1s ease both' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.t1, marginBottom: 6, fontFamily: FF.display }}>
          {t('lang.title')}
        </div>
        <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.5 }}>
          {t('lang.subtitle')}
        </div>
      </div>

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
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: isActive ? C.t1 : C.t2 }}>
                    {info.label}
                  </span>
                  {isActive && (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: C.geo,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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

// ── Slides phase ──────────────────────────────────────────────────────────────
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

  const s     = SLIDE_META[slide];
  const title = t(`onboard.slide${s.num}.title`);
  const text  = t(`onboard.slide${s.num}.text`);

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '60px 28px 52px', textAlign: 'center',
    }}>
      <button onClick={onDone} style={{
        alignSelf: 'flex-end', background: 'none', border: 'none',
        color: C.t3, fontSize: 14, cursor: 'pointer',
        padding: '4px 0', fontWeight: 600,
        WebkitTapHighlightColor: 'transparent',
      }}>
        {t('onboard.skip')}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div key={`icon-${key}`} style={{
          width: 112, height: 112, borderRadius: '50%',
          background: s.accentDim, border: `0.5px solid ${s.accentGl}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 40,
          animation: 'pop 0.5s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <s.Icon size={48} color={s.accent} strokeWidth={1.5} />
        </div>

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
          fontFamily: FF.display, fontSize: 28, fontWeight: 700, color: C.t1,
          marginBottom: 18, lineHeight: 1.2, whiteSpace: 'pre-line', letterSpacing: -0.4,
          animation: 'fadeUp 0.5s 0.1s ease both',
        }}>
          {title}
        </div>

        <div key={`text-${key}`} style={{
          fontSize: 15, color: C.t3, lineHeight: 1.65, maxWidth: 300,
          animation: 'fadeUp 0.5s 0.18s ease both',
        }}>
          {text}
        </div>
      </div>

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
          background: s.accent, color: C.bg,
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
        {slide < SLIDE_META.length - 1 ? t('onboard.next') : 'Далее'}
      </button>
    </div>
  );
}

// ── Terms phase ───────────────────────────────────────────────────────────────
function TermsPhase({ onAccepted }) {
  const [legalTab,   setLegalTab]   = useState(null);
  const [checked,    setChecked]    = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (legalTab) {
    return <LegalSheet initialTab={legalTab} onClose={() => setLegalTab(null)} />;
  }

  async function handleAccept() {
    if (!checked || submitting) return;
    setSubmitting(true);

    const tgw = window.Telegram?.WebApp;
    try {
      const fingerprint = await buildFingerprint();
      await apiFetch('/api/user/accept-tos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tos_version:        TOS_VERSION,
          device_fingerprint: fingerprint,
          user_agent:         navigator.userAgent || null,
          tg_platform:        tgw?.platform || null,
          tg_version:         tgw?.version  || null,
        }),
      });
    } catch {
      // Log failure is non-blocking — still let user in
    }

    onAccepted();
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      padding: '48px 24px 40px',
    }}>

      {/* Icon + title */}
      <div style={{ textAlign: 'center', marginBottom: 32, animation: 'fadeUp 0.5s ease both' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          animation: 'pop 0.5s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <FileText size={30} color={C.geo} strokeWidth={1.75} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, marginBottom: 6, letterSpacing: -0.4 }}>
          Пользовательское соглашение
        </div>
        <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
          Прочитайте ключевые условия перед использованием GeoEarn
        </div>
      </div>

      {/* Key points */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', gap: 10,
        marginBottom: 28,
        animation: 'fadeUp 0.5s 0.1s ease both',
      }}>
        {KEY_POINTS.map(({ icon: Icon, text }, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            background: 'rgba(255,255,255,0.03)',
            border: `0.5px solid ${C.b1}`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              <Icon size={15} color={C.geo} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55, paddingTop: 7 }}>
              {text}
            </div>
          </div>
        ))}

        {/* Read full links */}
        <div style={{
          display: 'flex', gap: 10, marginTop: 4,
        }}>
          {[
            { label: 'Условия использования', tab: 'terms' },
            { label: 'Политика конфиденциальности', tab: 'privacy' },
          ].map(({ label, tab }) => (
            <button
              key={tab}
              onClick={() => setLegalTab(tab)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${C.b2}`,
                borderRadius: 12, padding: '11px 8px',
                cursor: 'pointer', color: C.t2, fontSize: 12, fontWeight: 600,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Eye size={13} color={C.t3} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Checkbox */}
      <div style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>
        <button
          onClick={() => setChecked(v => !v)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'flex-start', gap: 14,
            background: checked ? C.geoDim : 'rgba(255,255,255,0.03)',
            border: `0.5px solid ${checked ? C.geo : C.b2}`,
            borderRadius: 14, padding: '14px 16px',
            cursor: 'pointer', textAlign: 'left',
            transition: `all 0.18s ${E.smooth}`,
            WebkitTapHighlightColor: 'transparent',
            marginBottom: 16,
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            background: checked ? C.geo : 'transparent',
            border: `2px solid ${checked ? C.geo : C.b2}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: `all 0.18s ${E.smooth}`,
            marginTop: 1,
          }}>
            {checked && <Check size={13} color={C.bg} strokeWidth={3} />}
          </div>
          <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>
            Я прочитал(а) и принимаю{' '}
            <span style={{ color: C.geo, fontWeight: 600 }}>Условия использования</span>
            {' '}и{' '}
            <span style={{ color: C.geo, fontWeight: 600 }}>Политику конфиденциальности</span>
            {' '}GeoEarn
          </span>
        </button>

        <button
          onClick={handleAccept}
          disabled={!checked || submitting}
          style={{
            width: '100%',
            background: checked ? C.geo : C.card,
            color: checked ? C.bg : C.t3,
            border: `0.5px solid ${checked ? 'transparent' : C.b2}`,
            borderRadius: 14,
            padding: '16px', fontSize: 16, fontWeight: 700,
            cursor: checked ? 'pointer' : 'not-allowed',
            transition: `all 0.2s ${E.smooth}`,
            WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: checked ? '0 6px 24px rgba(201,123,71,0.28)' : 'none',
          }}
          onTouchStart={e => { if (checked) e.currentTarget.style.transform = 'scale(0.97)'; }}
          onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseDown={e => { if (checked) e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {submitting
            ? <>Сохраняем…</>
            : <>
                <Check size={17} strokeWidth={2.5} />
                Принять и начать
              </>
          }
        </button>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: C.t3 }}>
          Версия соглашения: {TOS_VERSION} · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Onboarding({ onDone }) {
  const [phase, setPhase] = useState('lang');

  if (phase === 'lang')   return <LangPhase  onDone={() => setPhase('slides')} />;
  if (phase === 'slides') return <SlidePhase onDone={() => setPhase('terms')} />;
  return <TermsPhase onAccepted={() => onDone()} />;
}
