import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGS } from '../lib/i18n';
import { C, E } from '../lib/design';

const MONO = { fontFamily: "'Share Tech Mono', monospace" };

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: open ? C.geoDim : 'transparent',
          border: `0.5px solid ${open ? C.geo : C.b2}`,
          borderRadius: open ? '8px 8px 0 0' : 8,
          padding: '6px 10px',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          transition: `all 0.15s ${E.smooth}`,
        }}
      >
        <span style={{ ...MONO, fontSize: 11, color: open ? C.geo : C.t2, letterSpacing: 1 }}>
          {LANGS[lang].short}
        </span>
        <ChevronDown
          size={12} color={open ? C.geo : C.t3} strokeWidth={2}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 200,
          background: C.surf,
          border: `0.5px solid ${C.geo}`,
          borderTop: `0.5px solid ${C.geoGl}`,
          borderRadius: '8px 0 8px 8px',
          overflow: 'hidden',
          minWidth: 90,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          animation: `fadeUp 0.15s ${E.smooth} both`,
        }}>
          {Object.entries(LANGS).map(([code, info], i) => {
            const isActive = lang === code;
            return (
              <button
                key={code}
                onClick={() => { setLang(code); setOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: isActive ? C.geoDim : 'transparent',
                  border: 'none',
                  borderTop: i === 0 ? 'none' : `0.5px solid ${C.b1}`,
                  padding: '10px 12px',
                  cursor: 'pointer', textAlign: 'left',
                  WebkitTapHighlightColor: 'transparent',
                  transition: `background 0.12s ${E.smooth}`,
                }}
              >
                <span style={{ ...MONO, fontSize: 11, color: isActive ? C.geo : C.t2, letterSpacing: 1, flex: 1 }}>
                  {info.short}
                </span>
                {isActive && <Check size={10} color={C.geo} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
