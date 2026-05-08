import { useState } from 'react';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes slideIn { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
`;

const SLIDES = [
  {
    icon: '📍',
    bg: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
    title: 'Добро пожаловать\nв GeoEarn!',
    text: 'Зарабатывайте реальные деньги, просто посещая любимые заведения.',
  },
  {
    icon: '📱',
    bg: 'linear-gradient(135deg, #34C759, #25a244)',
    title: 'Как это работает',
    text: 'Получите QR-код в заведении → отсканируйте через бот → получите бонус на баланс.',
  },
  {
    icon: '💳',
    bg: 'linear-gradient(135deg, #FF9500, #e08000)',
    title: 'Выводите заработок',
    text: 'Накопленные средства можно вывести на Payme в любой момент.',
  },
];

export default function Onboarding({ onDone }) {
  const [slide, setSlide] = useState(0);
  const [key, setKey] = useState(0);

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide(s => s + 1);
      setKey(k => k + 1);
    } else {
      localStorage.setItem('geo_onboarded', '1');
      onDone();
    }
  }

  const s = SLIDES[slide];

  return (
    <div style={{
      minHeight: '100vh',
      background: s.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 28px',
      textAlign: 'center',
      transition: 'background 0.5s ease',
    }}>
      <style>{ANIM}</style>

      <div key={`icon-${key}`} style={{
        fontSize: 96,
        marginBottom: 36,
        animation: 'fadeUp 0.5s ease both',
      }}>
        {s.icon}
      </div>

      <div key={`title-${key}`} style={{
        fontSize: 28,
        fontWeight: 900,
        color: '#fff',
        marginBottom: 16,
        lineHeight: 1.25,
        whiteSpace: 'pre-line',
        animation: 'fadeUp 0.5s 0.1s ease both',
      }}>
        {s.title}
      </div>

      <div key={`text-${key}`} style={{
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 1.6,
        marginBottom: 56,
        maxWidth: 300,
        animation: 'fadeUp 0.5s 0.2s ease both',
      }}>
        {s.text}
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: i === slide ? '#fff' : 'rgba(255,255,255,0.4)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      <button
        onClick={next}
        style={{
          background: '#fff',
          color: slide === 0 ? '#2AABEE' : slide === 1 ? '#34C759' : '#FF9500',
          border: 'none',
          borderRadius: 16,
          padding: '16px 48px',
          fontSize: 17,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          transition: 'transform 0.1s',
          width: '100%',
          maxWidth: 320,
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.97)')}
        onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {slide < SLIDES.length - 1 ? 'Далее →' : 'Начать'}
      </button>

      {slide < SLIDES.length - 1 && (
        <button
          onClick={() => { localStorage.setItem('geo_onboarded', '1'); onDone(); }}
          style={{
            marginTop: 20, background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.65)', fontSize: 14,
            cursor: 'pointer', padding: '8px 16px',
          }}
        >
          Пропустить
        </button>
      )}
    </div>
  );
}
