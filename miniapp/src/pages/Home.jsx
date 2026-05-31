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
    /* Strong ease-out — instant start, settles naturally */
    @keyframes heroReveal {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes staggerIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ptFade0 { 0%,100%{opacity:0} 10%{opacity:0.85} 80%{opacity:0.3} }
    @keyframes ptFade1 { 0%,100%{opacity:0} 10%{opacity:0.75} 80%{opacity:0.25} }
    @keyframes ptFade2 { 0%,100%{opacity:0} 10%{opacity:0.65} 80%{opacity:0.2} }
    @keyframes ptFade3 { 0%,100%{opacity:0} 10%{opacity:0.80} 80%{opacity:0.28} }
    @keyframes ptFade4 { 0%,100%{opacity:0} 10%{opacity:0.60} 80%{opacity:0.18} }
    @keyframes ptFade5 { 0%,100%{opacity:0} 10%{opacity:0.70} 80%{opacity:0.22} }
    /* Ambient glow behind primary CTA — on its own layer, not on the button transform */
    @keyframes glowPulse {
      0%,100% { opacity: 0.55; transform: scale(1); }
      50%      { opacity: 0.85; transform: scale(1.04); }
    }
    @media (prefers-reduced-motion: reduce) {
      .home-hero-reveal, .home-stagger { animation: none !important; opacity: 1 !important; transform: none !important; }
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

      {/* Secondary nodes — SVG SMIL animate for opacity (reliable in WebView) */}
      <circle cx="138" cy="167" r="2.5" fill="#C97B47">
        <animate attributeName="opacity" values="0.60;1;0.60"   dur="2.5s" begin="0.3s" repeatCount="indefinite"/>
      </circle>
      <circle cx="248" cy="162" r="2.5" fill="#C97B47">
        <animate attributeName="opacity" values="0.50;0.90;0.50" dur="3.1s" begin="1.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="114" cy="191" r="2"   fill="#C97B47">
        <animate attributeName="opacity" values="0.35;0.70;0.35" dur="3.6s" begin="0.7s" repeatCount="indefinite"/>
      </circle>
      <circle cx="291" cy="186" r="2"   fill="#C97B47">
        <animate attributeName="opacity" values="0.30;0.65;0.30" dur="2.8s" begin="2.1s" repeatCount="indefinite"/>
      </circle>
      <circle cx="165" cy="139" r="1.5" fill="#C97B47">
        <animate attributeName="opacity" values="0.25;0.55;0.25" dur="4.0s" begin="1.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="216" cy="136" r="1.5" fill="#C97B47">
        <animate attributeName="opacity" values="0.20;0.50;0.20" dur="3.4s" begin="2.6s" repeatCount="indefinite"/>
      </circle>

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

// ── Floating geo particles — individual named animations, no CSS custom props ──
const PARTICLES = [
  { x: 14, y: 55, s: 2.5, delay: 0,   dur: 4.2, anim: 'ptFade0' },
  { x: 82, y: 40, s: 2.0, delay: 0.9, dur: 5.0, anim: 'ptFade1' },
  { x: 28, y: 72, s: 1.5, delay: 1.6, dur: 4.6, anim: 'ptFade2' },
  { x: 68, y: 65, s: 2.0, delay: 2.1, dur: 3.8, anim: 'ptFade3' },
  { x: 50, y: 30, s: 1.5, delay: 3.0, dur: 5.2, anim: 'ptFade4' },
  { x: 92, y: 50, s: 2.0, delay: 1.1, dur: 4.0, anim: 'ptFade5' },
];

function GeoParticles() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {PARTICLES.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.s, height: p.s, borderRadius: '50%',
          background: C.geo,
          boxShadow: `0 0 ${p.s * 3}px ${C.geo}`,
          animation: `${p.anim} ${p.dur}s ${p.delay}s ease-in-out infinite`,
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
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        // Asymmetric: fast press (instant feedback), springy release (natural)
        transition: pressed
          ? 'transform 100ms cubic-bezier(0.23,1,0.32,1)'
          : 'transform 180ms cubic-bezier(0.32,0.72,0,1)',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        animation: `staggerIn 0.30s cubic-bezier(0.23,1,0.32,1) ${index * 0.07}s both`,
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
        transition: pressed
          ? 'transform 90ms cubic-bezier(0.23,1,0.32,1)'
          : 'transform 160ms cubic-bezier(0.32,0.72,0,1)',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        animation: `staggerIn 0.28s cubic-bezier(0.23,1,0.32,1) ${index * 0.045 + 0.06}s both`,
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

// ── Hero headline — splits title into two lines, accents last word ────────────
function HeroHeadline({ t }) {
  const title = t('home.title') || 'Зарабатывайте GEO';
  const words = title.trim().split(' ');
  const lastWord = words[words.length - 1];
  const restWords = words.slice(0, -1).join(' ');
  const subtitle = t('home.subtitle') || '';

  // Each line animates independently with stagger — no parent wrapper animation
  const easeOut = 'cubic-bezier(0.23,1,0.32,1)';
  return (
    <div>
      {restWords ? (
        <>
          <div className="home-hero-reveal" style={{
            fontSize: 40, fontWeight: 900, lineHeight: 0.92, letterSpacing: -1.8, color: C.t1,
            animation: `heroReveal 0.50s ${easeOut} both`,
          }}>
            {restWords}
          </div>
          <div className="home-hero-reveal" style={{
            fontSize: 40, fontWeight: 900, lineHeight: 0.92, letterSpacing: -1.8, color: C.geo,
            marginBottom: 12,
            animation: `heroReveal 0.50s 0.06s ${easeOut} both`,
          }}>
            {lastWord}.
          </div>
        </>
      ) : (
        <div className="home-hero-reveal" style={{
          fontSize: 40, fontWeight: 900, lineHeight: 0.92, letterSpacing: -1.8, color: C.geo,
          marginBottom: 12,
          animation: `heroReveal 0.50s ${easeOut} both`,
        }}>
          {lastWord}.
        </div>
      )}
      {subtitle ? (
        <div className="home-hero-reveal" style={{
          fontSize: 14, color: C.t3, fontWeight: 400, lineHeight: 1.55,
          animation: `heroReveal 0.50s 0.14s ${easeOut} both`,
        }}>
          {subtitle}
        </div>
      ) : null}
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
  const [pressedSort,    setPressedSort]    = useState(false);
  const [pressedMap,     setPressedMap]     = useState(false);

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

          {/* Headline — uses translations */}
          <HeroHeadline t={t} />
        </div>
      </div>

      {/* ── CTA BUTTONS ── */}
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 10 }}>

        {/* Primary — ambient glow decoupled from button transform so press state works cleanly */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16,
            background: 'linear-gradient(135deg,#D48A52 0%,#C97B47 55%,#B36835 100%)',
            opacity: 0.55, filter: 'blur(10px)',
            animation: 'glowPulse 3.5s ease-in-out infinite',
            pointerEvents: 'none', zIndex: 0,
          }} />
          <button
            onClick={() => getGeoPos().then(p => setUserPos(p)).catch(() => {})}
            onTouchStart={() => setPressedSort(true)}
            onTouchEnd={() => setPressedSort(false)}
            onMouseDown={() => setPressedSort(true)}
            onMouseUp={() => setPressedSort(false)}
            onMouseLeave={() => setPressedSort(false)}
            style={{
              position: 'relative', zIndex: 1,
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'linear-gradient(135deg,#D48A52 0%,#C97B47 55%,#B36835 100%)',
              color: '#0A0E14', border: 'none', borderRadius: 16, height: 52,
              fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: -0.2,
              boxShadow: '0 4px 20px rgba(201,123,71,0.28), 0 1px 0 rgba(255,255,255,0.14) inset',
              WebkitTapHighlightColor: 'transparent',
              transform: pressedSort ? 'scale(0.97)' : 'scale(1)',
              transition: pressedSort
                ? 'transform 100ms cubic-bezier(0.23,1,0.32,1)'
                : 'transform 180ms cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            <Compass size={16} strokeWidth={2.5} />
            {t('home.sorted') || 'По расстоянию'}
          </button>
        </div>

        {/* Secondary */}
        <button
          onClick={() => navigate('/map')}
          onTouchStart={() => setPressedMap(true)}
          onTouchEnd={() => setPressedMap(false)}
          onMouseDown={() => setPressedMap(true)}
          onMouseUp={() => setPressedMap(false)}
          onMouseLeave={() => setPressedMap(false)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'rgba(109,139,116,0.09)',
            color: C.teal,
            border: '1px solid rgba(109,139,116,0.22)',
            borderRadius: 16, height: 52,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.2,
            WebkitTapHighlightColor: 'transparent',
            transform: pressedMap ? 'scale(0.97)' : 'scale(1)',
            transition: pressedMap
              ? 'transform 100ms cubic-bezier(0.23,1,0.32,1)'
              : 'transform 180ms cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <MapPin size={15} strokeWidth={2} />
          {t('home.map') || 'Карта'}
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
