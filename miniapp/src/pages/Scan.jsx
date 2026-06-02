import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { ArrowLeft, Camera, ScanLine, Zap } from 'lucide-react';
import { C, FF } from '../lib/design';
import { tg } from '../hooks/useTelegram';
import { useLanguage } from '../contexts/LanguageContext';
import { parseScanResult } from '../lib/parseQr';

// ── Easings ───────────────────────────────────────────────────────────────────
const EASE_OUT  = 'cubic-bezier(0.22,1,0.36,1)';
const EASE_SPR  = 'cubic-bezier(0.32,0.72,0,1)';
const EASE_FAST = 'cubic-bezier(0.23,1,0.32,1)';

const FINDER = 260; // px — square viewfinder

// ── One-time CSS injection ────────────────────────────────────────────────────
let _injected = false;
function ensureCSS() {
  if (_injected) return;
  _injected = true;
  const el = document.createElement('style');
  el.dataset.src = 'scan-page';
  el.textContent = `
    @keyframes scanPageIn {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes scanLine {
      from { transform: translateY(0px); }
      to   { transform: translateY(${FINDER - 4}px); }
    }
    @keyframes scanFlash {
      0%   { opacity: 0; }
      20%  { opacity: 0.55; }
      100% { opacity: 0; }
    }
    @keyframes bracketSnap {
      0%   { transform: scale(1); }
      35%  { transform: scale(1.10); }
      100% { transform: scale(1); }
    }
    @keyframes scanFoundPulse {
      0%   { box-shadow: 0 0 0 0 rgba(143,174,123,0.7); }
      100% { box-shadow: 0 0 0 22px rgba(143,174,123,0); }
    }
  `;
  document.head.appendChild(el);
}

// ── Corner brackets ───────────────────────────────────────────────────────────
const ARM = 26;   // length of each bracket arm
const TH  = 2.5;  // stroke thickness
const S   = 34;   // SVG canvas size (ARM + padding)
const PAD = 4;    // inset from bracket tip

const BRACKETS = [
  {
    pos: { top: -(TH / 2 + 1), left: -(TH / 2 + 1) },
    d:   `M ${PAD} ${PAD + ARM} L ${PAD} ${PAD} L ${PAD + ARM} ${PAD}`,
    tf:  'none',
  },
  {
    pos: { top: -(TH / 2 + 1), right: -(TH / 2 + 1) },
    d:   `M ${S - PAD} ${PAD + ARM} L ${S - PAD} ${PAD} L ${S - PAD - ARM} ${PAD}`,
    tf:  'none',
  },
  {
    pos: { bottom: -(TH / 2 + 1), left: -(TH / 2 + 1) },
    d:   `M ${PAD} ${S - PAD - ARM} L ${PAD} ${S - PAD} L ${PAD + ARM} ${S - PAD}`,
    tf:  'none',
  },
  {
    pos: { bottom: -(TH / 2 + 1), right: -(TH / 2 + 1) },
    d:   `M ${S - PAD} ${S - PAD - ARM} L ${S - PAD} ${S - PAD} L ${S - PAD - ARM} ${S - PAD}`,
    tf:  'none',
  },
];

function CornerBrackets({ found }) {
  const stroke = found ? C.green : 'rgba(255,255,255,0.92)';
  const glow   = found ? `drop-shadow(0 0 7px ${C.green}) drop-shadow(0 0 14px ${C.green})` : 'none';
  return (
    <>
      {BRACKETS.map((b, i) => (
        <svg
          key={i}
          width={S} height={S}
          style={{
            position: 'absolute', ...b.pos,
            animation: found ? `bracketSnap 0.30s ${EASE_OUT} both` : 'none',
            filter: glow,
            transition: `filter 0.22s ease`,
          }}
        >
          <path
            d={b.d}
            stroke={stroke}
            strokeWidth={TH}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: `stroke 0.20s ease` }}
          />
        </svg>
      ))}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Scan() {
  ensureCSS();
  const navigate = useNavigate();
  const { t }    = useLanguage();

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const tickRef   = useRef(null);
  const sentRef   = useRef(false);
  const streamRef = useRef(null);

  const [phase,        setPhase]        = useState('init');
  const [torchCapable, setTorchCapable] = useState(false);
  const [torchOn,      setTorchOn]      = useState(false);
  const [trackHandle,  setTrackHandle]  = useState(null);
  const [backPressed,  setBackPressed]  = useState(false);
  const [torchPressed, setTorchPressed] = useState(false);

  // Start camera on mount, clean up on unmount
  useEffect(() => {
    startCamera();
    return stopCamera;
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('nosupport');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      setTrackHandle(track);
      try {
        const caps = track.getCapabilities?.();
        if (caps?.torch) setTorchCapable(true);
      } catch {}
      setPhase('active');
      startScanLoop();
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPhase('denied');
      } else {
        setPhase('error');
      }
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  function startScanLoop() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width  = 300;
    canvas.height = 300;

    tickRef.current = () => {
      if (sentRef.current) return;
      if (video.readyState >= video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, 300, 300);
        const imageData = ctx.getImageData(0, 0, 300, 300);
        const code = jsQR(imageData.data, 300, 300, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const result = parseScanResult(code.data);
          if (result) {
            handleFound(result);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tickRef.current);
    };
    rafRef.current = requestAnimationFrame(tickRef.current);
  }

  function handleFound(result) {
    sentRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setPhase('found');
    tg?.HapticFeedback?.notificationOccurred('success');
    stopCamera();
    const qs = new URLSearchParams({ token: result.token });
    if (result.promo)   qs.set('promo',   '1');
    if (result.geohunt) qs.set('geohunt', '1');
    setTimeout(() => navigate(`/checkin?${qs.toString()}`), 420);
  }

  async function toggleTorch() {
    if (!trackHandle) return;
    const next = !torchOn;
    try {
      await trackHandle.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  }

  function useTgScanner() {
    if (!tg?.isVersionAtLeast?.('6.4') || typeof tg.showScanQrPopup !== 'function') return;
    stopCamera();
    setPhase('init');
    tg.showScanQrPopup({ text: t('scan.aim') }, (raw) => {
      const result = parseScanResult(raw);
      if (!result) return false;
      tg.closeScanQrPopup();
      handleFound(result);
      return true;
    });
  }

  const cameraActive = phase === 'active' || phase === 'found';
  const isBlocked    = phase === 'denied' || phase === 'nosupport' || phase === 'error';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      zIndex: 150,
      animation: `scanPageIn 0.28s ${EASE_SPR} both`,
      overflow: 'hidden',
    }}>

      {/* ── CAMERA VIDEO ─────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: cameraActive ? 1 : 0,
          transition: `opacity 0.5s ${EASE_OUT}`,
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── DARK OVERLAY — 3×3 grid, transparent center ──────────────────── */}
      {cameraActive && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'grid',
            gridTemplateRows:    `calc(50% - ${FINDER / 2}px) ${FINDER}px 1fr`,
            gridTemplateColumns: `calc(50% - ${FINDER / 2}px) ${FINDER}px 1fr`,
            pointerEvents: 'none',
          }}
        >
          {/* top strip */}
          <div style={{ background: 'rgba(0,0,0,0.76)', gridColumn: '1/4' }} />
          {/* middle-left */}
          <div style={{ background: 'rgba(0,0,0,0.76)' }} />

          {/* ── CENTER CELL — scan line lives here ────────────────────── */}
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              left: 6, right: 6, top: 0,
              height: 2, borderRadius: 1,
              background: phase === 'found'
                ? `linear-gradient(90deg, transparent 0%, ${C.green}90 20%, ${C.green} 50%, ${C.green}90 80%, transparent 100%)`
                : `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 18%, ${C.geo} 50%, rgba(255,255,255,0.55) 82%, transparent 100%)`,
              boxShadow: phase === 'found'
                ? `0 0 10px 3px ${C.green}60`
                : `0 0 10px 3px ${C.geo}55`,
              animation: phase === 'active' ? `scanLine 1.7s linear infinite alternate` : 'none',
              opacity: phase === 'found' ? 0 : 1,
              transition: `opacity 0.18s ease, background 0.2s ease, box-shadow 0.2s ease`,
            }} />
          </div>

          {/* middle-right */}
          <div style={{ background: 'rgba(0,0,0,0.76)' }} />
          {/* bottom strip */}
          <div style={{ background: 'rgba(0,0,0,0.76)', gridColumn: '1/4' }} />
        </div>
      )}

      {/* ── CORNER BRACKETS — layered over grid ──────────────────────────── */}
      {cameraActive && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: FINDER, height: FINDER,
          pointerEvents: 'none',
          animation: phase === 'found' ? `scanFoundPulse 0.5s ${EASE_OUT} both` : 'none',
        }}>
          <CornerBrackets found={phase === 'found'} />
        </div>
      )}

      {/* ── SUCCESS FLASH ────────────────────────────────────────────────── */}
      {phase === 'found' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 6,
          background: 'rgba(255,255,255,0.22)',
          animation: `scanFlash 0.40s ${EASE_OUT} both`,
          pointerEvents: 'none',
        }} />
      )}

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 18px 18px',
        display: 'flex', alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)',
      }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          onTouchStart={() => setBackPressed(true)}
          onTouchEnd={() => setBackPressed(false)}
          onMouseDown={() => setBackPressed(true)}
          onMouseUp={() => setBackPressed(false)}
          onMouseLeave={() => setBackPressed(false)}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(255,255,255,0.11)',
            backdropFilter: 'blur(8px)',
            border: '0.5px solid rgba(255,255,255,0.14)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
            transform: backPressed ? 'scale(0.93)' : 'scale(1)',
            transition: backPressed
              ? `transform 100ms ${EASE_FAST}`
              : `transform 200ms ${EASE_SPR}`,
          }}
        >
          <ArrowLeft size={20} color="rgba(255,255,255,0.92)" strokeWidth={2.25} />
        </button>

        {/* Title */}
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: 16, fontWeight: 700,
          color: 'rgba(255,255,255,0.94)',
          letterSpacing: -0.3, fontFamily: FF.display,
        }}>
          Сканер QR
        </span>

        {/* Torch — only when capable */}
        {torchCapable && (
          <button
            onClick={toggleTorch}
            onTouchStart={() => setTorchPressed(true)}
            onTouchEnd={() => setTorchPressed(false)}
            onMouseDown={() => setTorchPressed(true)}
            onMouseUp={() => setTorchPressed(false)}
            onMouseLeave={() => setTorchPressed(false)}
            style={{
              marginLeft: 'auto',
              width: 40, height: 40, borderRadius: 12,
              background: torchOn
                ? 'rgba(255,215,100,0.22)'
                : 'rgba(255,255,255,0.11)',
              backdropFilter: 'blur(8px)',
              border: torchOn
                ? '0.5px solid rgba(255,215,100,0.40)'
                : '0.5px solid rgba(255,255,255,0.14)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
              transform: torchPressed ? 'scale(0.93)' : 'scale(1)',
              transition: `transform 180ms ${EASE_SPR}, background 200ms ease, border-color 200ms ease`,
            }}
          >
            <Zap
              size={18}
              color={torchOn ? '#FFD764' : 'rgba(255,255,255,0.80)'}
              strokeWidth={torchOn ? 2.5 : 1.75}
              fill={torchOn ? '#FFD764' : 'none'}
            />
          </button>
        )}
      </div>

      {/* ── BOTTOM AREA ──────────────────────────────────────────────────── */}
      {(cameraActive || isBlocked) && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
          padding: `24px 28px calc(env(safe-area-inset-bottom, 0px) + 48px)`,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.78) 0%, transparent 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          pointerEvents: phase === 'found' ? 'none' : 'auto',
        }}>
          {/* Hint text */}
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: phase === 'found' ? 'rgba(143,174,123,0.95)' : 'rgba(255,255,255,0.65)',
            textAlign: 'center', lineHeight: 1.45,
            opacity: phase === 'found' ? 1 : 0.9,
            transition: `color 0.25s ease, opacity 0.2s ease`,
            letterSpacing: -0.1,
          }}>
            {phase === 'found'
              ? '✓ QR-код найден!'
              : 'Наведите на QR-код GeoEarn'}
          </div>

          {/* Telegram fallback */}
          {phase !== 'found' && tg?.isVersionAtLeast?.('6.4') && typeof tg.showScanQrPopup === 'function' && (
            <button
              onClick={useTgScanner}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
                border: '0.5px solid rgba(255,255,255,0.16)',
                borderRadius: 12, padding: '10px 18px',
                fontSize: 12, fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                transition: `background 160ms ease, color 160ms ease`,
              }}
            >
              <ScanLine size={14} color="rgba(255,255,255,0.55)" strokeWidth={2} />
              {t('scan.use_tg') || 'Системный сканер'}
            </button>
          )}
        </div>
      )}

      {/* ── BLOCKED STATES (denied / nosupport / error) ───────────────────── */}
      {isBlocked && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 28px',
          background: C.bg,
          animation: `scanPageIn 0.32s ${EASE_OUT} both`,
        }}>
          {/* Icon */}
          <div style={{
            width: 76, height: 76, borderRadius: 22,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Camera size={34} color={C.red} strokeWidth={1.5} />
          </div>

          {/* Title */}
          <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 10, textAlign: 'center', letterSpacing: -0.4 }}>
            {phase === 'denied'    ? 'Нет доступа к камере'  :
             phase === 'nosupport' ? 'Камера недоступна'     :
                                     'Ошибка камеры'}
          </div>

          {/* Subtitle */}
          <div style={{ fontSize: 14, color: C.t3, textAlign: 'center', lineHeight: 1.6, marginBottom: 36, maxWidth: 280 }}>
            {phase === 'denied'
              ? 'Разрешите доступ к камере в настройках Telegram, затем попробуйте снова.'
              : 'Ваше устройство не поддерживает прямой доступ к камере.\nВоспользуйтесь системным сканером.'}
          </div>

          {/* Primary — use Telegram scanner */}
          {tg?.isVersionAtLeast?.('6.4') && typeof tg.showScanQrPopup === 'function' && (
            <button
              onClick={useTgScanner}
              style={{
                width: '100%', maxWidth: 300, marginBottom: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                background: `linear-gradient(135deg, #D48A52, #C97B47)`,
                border: 'none', borderRadius: 14, padding: '15px',
                fontSize: 14, fontWeight: 700, color: '#0A0E14', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 4px 20px rgba(201,123,71,0.30)',
              }}
            >
              <ScanLine size={16} strokeWidth={2.5} />
              Системный сканер
            </button>
          )}

          {/* Secondary — back */}
          <button
            onClick={() => navigate(-1)}
            style={{
              width: '100%', maxWidth: 300,
              background: 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${C.b2}`, borderRadius: 14, padding: '14px',
              fontSize: 14, fontWeight: 600, color: C.t2, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Назад
          </button>
        </div>
      )}

      {/* ── INIT LOADING ─────────────────────────────────────────────────── */}
      {phase === 'init' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 25,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: C.bg,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: C.geo,
            animation: 'pulse 1.1s ease-in-out infinite',
          }} />
        </div>
      )}

    </div>
  );
}
