import { useRef } from 'react';

export default function RippleButton({ children, onClick, style, disabled, type = 'button', ...props }) {
  const ref = useRef(null);

  function handlePointerDown(e) {
    if (disabled) return;
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2.2;
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position:absolute;
      left:${x - size / 2}px;
      top:${y - size / 2}px;
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:rgba(9,11,16,0.22);
      transform:scale(0);
      animation:rippleOut 0.42s ease-out forwards;
      pointer-events:none;
    `;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 450);
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
