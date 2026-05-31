import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Compass, ScanLine, Wallet, Lock, ShoppingBag, Star, AlertCircle,
  Tv2, Crosshair, ExternalLink, Gift, RefreshCw, Navigation,
} from 'lucide-react';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { getGeoPos } from '../lib/geoPos';
import { C, E } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import { parseTaskDesc } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

// ── CSS injection (module-level, once) ────────────────────────────────────────
let _cssInjected = false;
function ensureHomeCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const el = document.createElement('style');
  el.dataset.src = 'home-page';
  el.textContent = `
    @keyframes heroReveal {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes staggerIn {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes particleDrift {
      0%   { transform: translate(0,0);                    opacity: 0; }
      8%   { opacity: 0.9; }
      85%  { opacity: 0.35; }
      100% { transform: translate(var(--pdx),var(--pdy));  opacity: 0; }
    }
    @keyframes ambientBreath {
      0%,100% { box-shadow: 0 6px 24px rgba(201,123,71,0.28), 0 1px 0 rgba(255,255,255,0.10) inset; }
      50%      { box-shadow: 0 6px 36px rgba(201,123,71,0.48), 0 1px 0 rgba(255,255,255,0.12) inset; }
    }
    @keyframes nodeFlicker {
      0%,100% { opacity: var(--nb); }
      50%      { opacity: var(--np); }
    }
    @keyframes scanPulse {
      0%   { box-shadow: 0 0 0 0   rgba(201,123,71,0.55); }
      65%  { box-shadow: 0 0 0 16px rgba(201,123,71,0); }
      100% { box-shadow: 0 0 0 0   rgba(201,123,71,0); }
    }
  `;
  document.head.appendChild(el);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TASK_ICONS = { visit: MapPin, purchase: ShoppingBag, review: Star };

const PROMO_RARITY = {
  common:    { label: 'COMMON',    color: '#9CA3AF' },
  rare:      { label: 'RARE',      color: '#60A5FA' },
  epic:      { label: 'EPIC',      color: '#C084FC' },
  legendary: { label: 'LEGENDARY', color: C.gold },
};

function openMaps(lat, lng) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
  else window.open(url, '_blank');
}

// ── Globe SVG ─────────────────────────────────────────────────────────────────
function GlobeVisualization() {
  return (
    <svg
      viewBox="0 0 375 220"
      style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 220, pointerEvents: 'none' }}
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <radialGradient id="hAtmo" cx="50%" cy="90%" r="65%">
          <stop offset="0%" stopColor="#C97B47" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#C97B47" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hArc1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#C97B47" stopOpacity="0" />
          <stop offset="18%"  stopColor="#C97B47" stopOpacity="0.40" />
          <stop offset="82%"  stopColor="#C97B47" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#C97B47" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hArc2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#C97B47" stopOpacity="0" />
          <stop offset="20%"  stopColor="#C97B47" stopOpacity="0.20" />
          <stop offset="80%"  stopColor="#C97B47" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#C97B47" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Atmosphere fill */}
      <ellipse cx="187" cy="310" rx="360" ry="230" fill="url(#hAtmo)" />

      {/* Latitude arcs */}
      <path d="M -18 218 C 82 190, 292 190, 393 218"
        fill="none" stroke="url(#hArc1)" strokeWidth="1.5" />
      <path d="M 18 186 C 96 163, 278 163, 358 186"
        fill="none" stroke="url(#hArc2)" strokeWidth="1" />
      <path d="M 48 155 C 108 138, 267 138, 328 155"
        fill="none" stroke="rgba(201,123,71,0.12)" strokeWidth="0.75" />
      <path d="M 74 126 C 120 113, 256 113, 302 126"
        fill="none" stroke="rgba(201,123,71,0.07)" strokeWidth="0.5" />

      {/* Meridian lines */}
      <line x1="92"  y1="230" x2="144" y2="68" stroke="rgba(201,123,71,0.06)" strokeWidth="0.5" strokeDasharray="2,6" />
      <line x1="146" y1="230" x2="168" y2="68" stroke="rgba(201,123,71,0.07)" strokeWidth="0.5" strokeDasharray="2,6" />
      <line x1="187" y1="230" x2="187" y2="68" stroke="rgba(201,123,71,0.09)" strokeWidth="0.5" strokeDasharray="2,6" />
      <line x1="228" y1="230" x2="206" y2="68" stroke="rgba(201,123,71,0.07)" strokeWidth="0.5" strokeDasharray="2,6" />
      <line x1="282" y1="230" x2="230" y2="68" stroke="rgba(201,123,71,0.06)" strokeWidth="0.5" strokeDasharray="2,6" />

      {/* Radar rings (animated) */}
      <circle cx="187" cy="153" r="7" fill="none" stroke="rgba(201,123,71,0.55)" strokeWidth="1.5">
        <animate attributeName="r"       values="7;46;7"   dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.55;0;0.55" dur="2.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="187" cy="153" r="7" fill="none" stroke="rgba(201,123,71,0.30)" strokeWidth="1">
        <animate attributeName="r"       values="7;68;7"   dur="2.8s" begin="0.65s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.30;0;0.30" dur="2.8s" begin="0.65s" repeatCount="indefinite" />
      </circle>

      {/* Center node */}
      <circle cx="187" cy="153" r="7" fill="rgba(201,123,71,0.18)" />
      <circle cx="187" cy="153" r="3.5" fill="#C97B47" opacity="0.95" />

      {/* Secondary nodes */}
      <circle cx="138" cy="167" r="2.5" fill="#C97B47"
        style={{ '--nb': 0.60, '--np': 1, animation: 'nodeFlicker 2.5s 0.3s ease-in-out infinite' }} />
      <circle cx="248" cy="162" r="2.5" fill="#C97B47"
        style={{ '--nb': 0.50, '--np': 0.9, animation: 'nodeFlicker 3.1s 1.2s ease-in-out infinite' }} />
      <circle cx="114" cy="191" r="2"   fill="#C97B47"
        style={{ '--nb': 0.35, '--np': 0.70, animation: 'nodeFlicker 3.6s 0.7s ease-in-out infinite' }} />
      <circle cx="291" cy="186" r="2"   fill="#C97B47"
        style={{ '--nb': 0.30, '--np': 0.65, animation: 'nodeFlicker 2.8s 2.1s ease-in-out infinite' }} />
      <circle cx="165" cy="139" r="1.5" fill="#C97B47"
        style={{ '--nb': 0.25, '--np': 0.55, animation: 'nodeFlicker 4.0s 1.6s ease-in-out infinite' }} />
      <circle cx="216" cy="136" r="1.5" fill="#C97B47"
        style={{ '--nb': 0.20, '--np': 0.50, animation: 'nodeFlicker 3.4s 2.6s ease-in-out infinite' }} />

      {/* Connection lines */}
      <line x1="187" y1="153" x2="138" y2="167" stroke="rgba(201,123,71,0.14)" strokeWidth="0.5" strokeDasharray="3,5" />
      <line x1="187" y1="153" x2="248" y2="162" stroke="rgba(201,123,71,0.14)" strokeWidth="0.5" strokeDasharray="3,5" />

      {/* Teal signal nodes */}
      <circle cx="74"  cy="176" r="1.5" fill="#6D8B74">
        <animate attributeName="opacity" values="0;0.45;0" dur="3.0s" begin="0.0s" repeatCount="indefinite" />
      </circle>
      <circle cx="317" cy="173" r="1.5" fill="#6D8B74">
        <animate attributeName="opacity" values="0;0.38;0" dur="2.6s" begin="1.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── Floating geo particles ────────────────────────────────────────────────────
function GeoParticles() {
  const pts = [
    { x: 14, y: 58, s: 2.5, dx:  -14, dy: -28, delay: 0,   dur: 4.2 },
    { x: 82, y: 42, s: 2.0, dx:   10, dy: -32, delay: 0.9, dur: 5.0 },
    { x: 28, y: 75, s: 1.5, dx:   -8, dy: -22, delay: 1.6, dur: 4.6 },
    { x: 68, y: 68, s: 2.0, dx:   13, dy: -25, delay: 2.1, dur: 3.8 },
    { x: 50, y: 32, s: 1.5, dx:   -6, dy: -18, delay: 3.0, dur: 5.2 },
    { x: 92, y: 52, s: 2.0, dx:    9, dy: -30, delay: 1.1, dur: 4.0 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pts.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.s, height: p.s, borderRadius: '50%',
          background: C.geo,
          boxShadow: `0 0 ${p.s * 2.5}px ${C.geo}`,
          '--pdx': `${p.dx}px`, '--pdy': `${p.dy}px`,
          animation: `particleDrift ${p.dur}s ${p.delay}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="sk" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="sk" style={{ height: 14, width: '50%', borderRadius: 7, marginBottom: 8 }} />
        <div className="sk" style={{ height: 11, width: '28%', borderRadius: 5 }} />
      </div>
      <div className="sk" style={{ height: 22, width: 60, borderRadius: 8 }} />
    </div>
  );
}

// ── Campaign detail sheet ─────────────────────────────────────────────────────
function CampaignSheet({ campaign, userPos, onClose }) {
  const { t, lang } = useLanguage();
  const dist = userPos && campaign.lat && campaign.lng
    ? haversineMeters(userPos, { lat: +campaign.lat, lng: +campaign.lng }) : null;
  const TaskIcon = TASK_ICONS[campaign.task_type] || MapPin;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        zIndex: 200, animation: 'backdropIn 0.2s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg,#141E2A 0%,#101A24 100%)',
        borderRadius: '28px 28px 0 0',
        border: '0.5px solid rgba(255,255,255,0.10)', borderBottom: 'none',
        padding: '0 0 44px', zIndex: 201, maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.32s cubic-bezier(0.175,0.885,0.32,1)',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.55)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', margin: '16px auto 24px' }} />
        <div style={{ padding: '0 20px' }}>

          <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, letterSpacing: -0.5, marginBottom: 4 }}>
            {campaign.business_name}
          </div>
          {campaign.address && (
            <div style={{ fontSize: 13, color: C.t3, marginBottom: dist !== null ? 4 : 18, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} color={C.t3} /><span>{campaign.address}</span>
            </div>
          )}
          {dist !== null && (
            <div style={{ fontSize: 13, color: C.geo, fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Navigation size={12} color={C.geo} />{formatDistance(dist)} {t('home.from_you')}
            </div>
          )}

          {/* Reward card */}
          <div style={{
            background: 'linear-gradient(135deg,rgba(201,123,71,0.12),rgba(201,123,71,0.05))',
            border: '1px solid rgba(201,123,71,0.20)',
            borderRadius: 20, padding: '20px', textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: C.t3, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('home.reward')}
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, color: C.geo, lineHeight: 1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 16, fontWeight: 600, color: C.t3, marginLeft: 8 }}>GEO</span>
            </div>
          </div>

          {/* Task */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              {t('home.task_type')}
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.t1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TaskIcon size={15} color={C.geo} strokeWidth={2} />
              {t(`task.${campaign.task_type}`) || t('task.visit')}
            </div>
            {campaign.task_description && (
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55, marginTop: 6 }}>
                {parseTaskDesc(campaign.task_description, lang)}
              </div>
            )}
          </div>

          {campaign.requires_pin && (
            <div style={{
              background: 'rgba(232,192,104,0.08)', border: '0.5px solid rgba(232,192,104,0.20)',
              borderRadius: 14, padding: '12px 14px', marginBottom: 10,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <Lock size={16} color={C.gold} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.gold, marginBottom: 2 }}>{t('home.pin_required')}</div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.4 }}>{t('home.pin_hint')}</div>
              </div>
            </div>
          )}

          {/* How it works */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              {t('home.how.title')}
            </div>
            {[[ScanLine, t('home.sheet.how.1')], [MapPin, t('home.sheet.how.2')], [Wallet, t('home.sheet.how.3')]].map(([Icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: C.geoDim, border: `0.5px solid ${C.geoGl}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} color={C.geo} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: C.t2 }}>{text}</span>
              </div>
            ))}
          </div>

          {campaign.lat && campaign.lng && (
            <button onClick={() => openMaps(campaign.lat, campaign.lng)} style={{
              width: '100%', marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
              borderRadius: 14, padding: '14px',
              fontSize: 14, fontWeight: 700, color: C.geo, cursor: 'pointer',
            }}>
              <ExternalLink size={15} color={C.geo} strokeWidth={2} />
              Открыть в Google Картах
            </button>
          )}
          <button onClick={onClose} style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px',
            fontSize: 14, fontWeight: 600, color: C.t2, cursor: 'pointer',
          }}>
            {t('home.close')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, count, accent }) {
  const col = accent || C.t3;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '22px 0 13px' }}>
      {Icon && <Icon size={13} color={col} strokeWidth={2.5} />}
      <span style={{ fontSize: 11, fontWeight: 700, color: col, letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }}>
        {label}
      </span>
      {count != null && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: col,
          background: `${col}15`, border: `1px solid ${col}28`,
          borderRadius: 8, padding: '2px 8px',
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── Featured card (horizontal scroll) ────────────────────────────────────────
function FeaturedCard({ iconColor, iconBg, iconBorder, gradStart, Icon, title, subtitle, rewardAmount, rewardLabel = 'GEO', rewardColor, badge, onTap, index }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onTap}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flexShrink: 0, width: 224,
        background: `linear-gradient(145deg, ${gradStart || iconBg} 0%, #16212D 100%)`,
        border: `1px solid ${iconBorder}`,
        borderRadius: 22, padding: '18px 16px',
        cursor: onTap ? 'pointer' : 'default',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: `transform 0.12s ${E.spring}`,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        animation: `staggerIn 0.32s ${E.smooth} ${index * 0.07}s both`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.04) inset`,
      }}
    >
      {/* Icon row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 13,
          background: iconBg, border: `1px solid ${iconBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={19} color={iconColor} strokeWidth={1.75} />
        </div>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: iconColor,
            background: iconBg, border: `1px solid ${iconBorder}`,
            borderRadius: 6, padding: '3px 7px', letterSpacing: 0.6,
          }}>
            {badge}
          </span>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.2 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: C.t3, marginBottom: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {subtitle}
      </div>

      {/* Reward */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: rewardColor || iconColor, letterSpacing: -0.8, lineHeight: 1 }}>
          +{formatGeo(rewardAmount)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>{rewardLabel}</span>
      </div>
    </div>
  );
}

// ── Campaign row ──────────────────────────────────────────────────────────────
function CampaignRow({ campaign, onTap, index }) {
  const [pressed, setPressed] = useState(false);
  const TaskIcon = TASK_ICONS[campaign.task_type] || MapPin;

  return (
    <div
      onClick={() => onTap(campaign)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        transition: `transform 0.10s ${E.spring}`,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        animation: `staggerIn 0.28s ${E.smooth} ${index * 0.045 + 0.06}s both`,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: C.geoDim, border: `1px solid ${C.geoGl}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 2px 14px rgba(201,123,71,0.09)`,
      }}>
        <TaskIcon size={18} color={C.geo} strokeWidth={1.75} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: C.t1, letterSpacing: -0.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4,
        }}>
          {campaign.business_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {campaign.dist !== undefined && campaign.dist !== Infinity && (
            <span style={{ fontSize: 12, color: C.t3, fontWeight: 500 }}>
              {formatDistance(campaign.dist)}
            </span>
          )}
          {campaign.requires_pin && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: C.gold,
              background: C.goldFt, borderRadius: 6, padding: '1px 6px',
              border: `1px solid ${C.goldGl}`,
            }}>
              PIN
            </span>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.geo, letterSpacing: -0.4 }}>
          +{formatGeo(campaign.reward_amount)}
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 2, fontWeight: 500 }}>GEO</div>
      </div>
    </div>
  );
}

// ── Main Home page ────────────────────────────────────────────────────────────
export default function Home() {
  ensureHomeCSS();

  const navigate = useNavigate();
  const { t } = useLanguage();

  const [campaigns,      setCampaigns]      = useState([]);
  const [platformPromos, setPlatformPromos] = useState([]);
  const [promoQrs,       setPromoQrs]       = useState([]);
  const [geohunts,       setGeohunts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [promoLoading,   setPromoLoading]   = useState(true);
  const [error,          setError]          = useState('');
  const [selected,       setSelected]       = useState(null);
  const [userPos,        setUserPos]        = useState(null);

  const loadCampaigns = () => {
    setLoading(true); setError('');
    fetch(`${API_BASE}/api/campaigns`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setError(t('home.error.load')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCampaigns(); }, []);
  useEffect(() => {
    fetch(`${API_BASE}/api/platform-promo/list`)
      .then(r => r.ok ? r.json() : { promos: [] })
      .then(d => setPlatformPromos(d.promos || []))
      .catch(() => {})
      .finally(() => setPromoLoading(false));
  }, []);
  useEffect(() => {
    fetch(`${API_BASE}/api/geohunts/active`)
      .then(r => r.ok ? r.json() : { hunts: [] })
      .then(d => setGeohunts(d.hunts || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch(`${API_BASE}/api/promos/active`)
      .then(r => r.ok ? r.json() : { promos: [] })
      .then(d => setPromoQrs(d.promos || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    getGeoPos().then(p => setUserPos(p)).catch(() => {});
  }, []);

  const displayed = (() => {
    if (!userPos) return campaigns;
    return [...campaigns]
      .map(c => ({ ...c, dist: c.lat && c.lng ? haversineMeters(userPos, { lat: +c.lat, lng: +c.lng }) : Infinity }))
      .sort((a, b) => a.dist - b.dist);
  })();

  const featuredCount = platformPromos.length + geohunts.length + promoQrs.length;
  const hasContent = displayed.length + featuredCount > 0;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.3s ease both' }}>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative',
        height: 280,
        overflow: 'hidden',
        background: 'linear-gradient(180deg,#050C15 0%,#071016 55%,#081018 100%)',
      }}>
        {/* Top atmospheric glow */}
        <div style={{
          position: 'absolute', top: -50, left: '50%',
          transform: 'translateX(-50%)',
          width: 320, height: 200,
          background: 'radial-gradient(ellipse,rgba(201,123,71,0.09) 0%,transparent 68%)',
          pointerEvents: 'none',
        }} />

        {/* Globe + particles */}
        <GlobeVisualization />
        <GeoParticles />

        {/* Bottom fade to page bg */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
          background: `linear-gradient(0deg,${C.bg} 0%,transparent 100%)`,
          pointerEvents: 'none',
        }} />

        {/* Safe-area top tint */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 56,
          background: 'linear-gradient(180deg,rgba(5,12,21,0.65) 0%,transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Text content */}
        <div style={{ position: 'relative', zIndex: 2, padding: '26px 20px 0' }}>

          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 9,
                background: C.geoDim, border: `1px solid ${C.geoGl}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MapPin size={13} color={C.geo} strokeWidth={2.25} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.t1, letterSpacing: -0.3 }}>
                Geo<span style={{ color: C.geo }}>Earn</span>
              </span>
            </div>
            <LanguageSwitcher />
          </div>

          {/* Headline */}
          <div style={{ animation: 'heroReveal 0.55s ease both' }}>
            <div style={{
              fontSize: 42, fontWeight: 900, lineHeight: 0.92,
              letterSpacing: -2, color: C.t1,
            }}>
              Explore
            </div>
            <div style={{
              fontSize: 42, fontWeight: 900, lineHeight: 0.92,
              letterSpacing: -2, color: C.geo, marginBottom: 12,
            }}>
              Nearby.
            </div>
            <div style={{
              fontSize: 14, color: C.t3, fontWeight: 400,
              lineHeight: 1.55, animation: 'heroReveal 0.55s 0.12s ease both',
            }}>
              Every place rewards you with GEO.
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA BUTTONS ── */}
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 10 }}>
        <button
          onClick={() => getGeoPos().then(p => setUserPos(p)).catch(() => {})}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'linear-gradient(135deg,#D48A52 0%,#C97B47 55%,#B36835 100%)',
            color: '#0A0E14', border: 'none', borderRadius: 16, height: 52,
            fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: -0.2,
            boxShadow: '0 6px 24px rgba(201,123,71,0.32), 0 1px 0 rgba(255,255,255,0.12) inset',
            WebkitTapHighlightColor: 'transparent',
            animation: 'ambientBreath 3.5s ease-in-out infinite',
          }}
        >
          <Compass size={16} strokeWidth={2.5} />
          По расстоянию
        </button>
        <button
          onClick={() => navigate('/map')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'rgba(109,139,116,0.09)',
            color: C.teal,
            border: '1px solid rgba(109,139,116,0.22)',
            borderRadius: 16, height: 52,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.2,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <MapPin size={15} strokeWidth={2} />
          Карта
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '0 16px 80px' }}>

        {/* Featured horizontal scroll */}
        {!promoLoading && featuredCount > 0 && (
          <div>
            <SectionHeader icon={Star} label="Featured" count={featuredCount} accent={C.gold} />
            <div style={{
              display: 'flex', gap: 10,
              margin: '0 -16px', padding: '2px 16px 4px',
              overflowX: 'auto', WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}>
              {geohunts.map((h, i) => (
                <FeaturedCard
                  key={h.id} index={i}
                  Icon={Crosshair}
                  iconColor={C.gold} iconBg={C.goldFt} iconBorder={C.goldGl}
                  gradStart="rgba(232,192,104,0.11)"
                  title={h.title}
                  subtitle={`${h.total_codes - h.claimed_codes}/${h.total_codes} осталось`}
                  badge="GEOHUNT"
                  rewardAmount={h.reward_per_code}
                  rewardLabel="GEO/шт"
                  rewardColor={C.gold}
                />
              ))}
              {platformPromos.map((p, i) => (
                <FeaturedCard
                  key={p.id} index={geohunts.length + i}
                  Icon={Tv2}
                  iconColor={C.green} iconBg={C.greenFt} iconBorder={C.greenGl}
                  gradStart="rgba(143,174,123,0.11)"
                  title={p.title}
                  subtitle={p.channel_username || 'Акция платформы'}
                  badge="PLATFORM"
                  rewardAmount={p.reward_amount}
                  rewardColor={C.green}
                  onTap={() => navigate(`/channel-reward?token=${encodeURIComponent(p.token || p.id)}`)}
                />
              ))}
              {promoQrs.map((p, i) => {
                const rr = PROMO_RARITY[p.rarity] || PROMO_RARITY.common;
                return (
                  <FeaturedCard
                    key={p.id} index={geohunts.length + platformPromos.length + i}
                    Icon={Gift}
                    iconColor={rr.color} iconBg={`${rr.color}18`} iconBorder={`${rr.color}30`}
                    gradStart={`${rr.color}0F`}
                    title={p.title}
                    subtitle={p.max_claims - p.claims_count > 0 ? `${p.max_claims - p.claims_count} доступно` : 'Закончилось'}
                    badge={rr.label}
                    rewardAmount={p.reward_amount}
                    rewardColor={rr.color}
                  />
                );
              })}
              {/* Right padding sentinel */}
              <div style={{ flexShrink: 0, width: 2 }} />
            </div>
          </div>
        )}

        {/* Nearby campaigns */}
        <SectionHeader
          icon={MapPin}
          label="Рядом с вами"
          count={!loading ? displayed.length : null}
          accent={C.t2}
        />

        {loading && [0, 1, 2].map(i => <SkeletonRow key={i} />)}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '36px 0 16px' }}>
            <AlertCircle size={28} color={C.red} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
            <div style={{ fontSize: 13, color: C.t3, marginBottom: 18 }}>Не удалось загрузить кампании</div>
            <button onClick={loadCampaigns} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
              color: C.geo, borderRadius: 12, padding: '10px 20px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              <RefreshCw size={13} strokeWidth={2.5} />
              Повторить
            </button>
          </div>
        )}

        {!loading && !error && displayed.length === 0 && !hasContent && (
          <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: `0 0 32px ${C.geoGl}`,
            }}>
              <MapPin size={26} color={C.geo} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t2, marginBottom: 8, letterSpacing: -0.3 }}>
              Кампаний пока нет
            </div>
            <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.6 }}>
              Заведения появятся, когда партнёры добавят их
            </div>
          </div>
        )}

        {!loading && !error && displayed.map((c, i) => (
          <CampaignRow key={c.id} campaign={c} onTap={setSelected} index={i} />
        ))}

        {/* How it works — only when no content */}
        {!loading && !error && !hasContent && displayed.length === 0 && (
          <div style={{
            marginTop: 24, padding: '20px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 18 }}>
              Как это работает
            </div>
            {[[ScanLine, t('home.how.1')], [MapPin, t('home.how.2')], [Wallet, t('home.how.3')]].map(([Icon, text], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < 2 ? 16 : 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: C.geoDim, border: `1px solid ${C.geoGl}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={C.geo} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Legal */}
        <div style={{ display: 'flex', gap: 16, paddingTop: 28 }}>
          {[[t('home.terms'), '/legal'], [t('home.privacy'), '/legal?tab=privacy']].map(([label, path]) => (
            <button key={path} onClick={() => navigate(path)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: C.t3, padding: '4px 0',
              WebkitTapHighlightColor: 'transparent',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
