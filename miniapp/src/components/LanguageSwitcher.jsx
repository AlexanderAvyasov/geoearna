import { useState } from 'react';
import { Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGS } from '../lib/i18n';
import { C, E } from '../lib/design';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGS[lang];

  function choose(code) {
    setLang(code);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'transparent',
          border: `0.5px solid ${C.b2}`,
          borderRadius: 20, padding: '5px 10px',
          fontSize: 12, color: C.t2, fontWeight: 700,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          letterSpacing: 0.4,
        }}
        onTouchStart={e => { e.currentTarget.style.opacity = '0.7'; }}
        onTouchEnd={e => { e.currentTarget.style.opacity = '1'; }}
      >
        <span>{current.flag}</span>
        <span>{current.short}</span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 300,
              animation: 'backdropIn 0.2s ease',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: C.surf,
            borderRadius: '20px 20px 0 0',
            border: `0.5px solid rgba(255,255,255,0.08)`,
            borderBottom: 'none',
            padding: '0 16px 40px',
            zIndex: 301,
            maxWidth: 480, margin: '0 auto',
            animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
          }}>
            <div style={{ width: 32, height: 3, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />

            <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14, textAlign: 'center' }}>
              {t('lang.title')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(LANGS).map(([code, info]) => {
                const isActive = lang === code;
                return (
                  <button
                    key={code}
                    onClick={() => choose(code)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: isActive ? C.geoDim : 'rgba(255,255,255,0.02)',
                      border: `0.5px solid ${isActive ? C.geoGl : C.b1}`,
                      borderRadius: 14, padding: '14px 16px',
                      cursor: 'pointer', textAlign: 'left',
                      transition: `all 0.15s ${E.smooth}`,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 26 }}>{info.flag}</span>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: isActive ? C.t1 : C.t2 }}>
                      {info.label}
                    </span>
                    {isActive && (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: C.geo,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Check size={12} color={C.bg} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
