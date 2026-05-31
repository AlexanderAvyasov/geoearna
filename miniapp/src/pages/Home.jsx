import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Compass, ScanLine, Wallet, Lock, ShoppingBag, Star, AlertCircle,
  Tv2, Crosshair, ExternalLink, Gift, RefreshCw, Navigation,
  Flame, Crown,
} from 'lucide-react';
import { API_BASE, apiFetch } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { getGeoPos } from '../lib/geoPos';
import { C, E } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import { parseTaskDesc } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

// ── CSS (module-level, once) ───────────────────────────────────────────────────
let _cssInjected = false;
function ensureHomeCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const el = document.createElement('style');
  el.dataset.src = 'home-page';
  el.textContent = `
    @keyframes heroReveal {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes staggerIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes balanceFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ptFade0 { 0%,100%{opacity:0} 10%{opacity:0.85} 80%{opacity:0.30} }
    @keyframes ptFade1 { 0%,100%{opacity:0} 10%{opacity:0.75} 80%{opacity:0.25} }
    @keyframes ptFade2 { 0%,100%{opacity:0} 10%{opacity:0.65} 80%{opacity:0.20} }
    @keyframes ptFade3 { 0%,100%{opacity:0} 10%{opacity:0.80} 80%{opacity:0.28} }
    @keyframes ptFade4 { 0%,100%{opacity:0} 10%{opacity:0.60} 80%{opacity:0.18} }
    @keyframes ptFade5 { 0%,100%{opacity:0} 10%{opacity:0.70} 80%{opacity:0.22} }
    @keyframes orbBreathe {
      0%,100% { opacity: 0.55; }
      50%      { opacity: 1; }
    }
    @keyframes orbRotateSlow {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes orbPulseOpacity {
      0%,100% { opacity: 0.28; }
      50%      { opacity: 0.58; }
    }
    @keyframes liveSignal {
      0%,100% { opacity: 1; }
      50%      { opacity: 0.30; }
    }
    @keyframes glowPulse {
      0%,100% { opacity: 0.50; }
      50%      { opacity: 0.80; }
    }
    @media (prefers-reduced-motion: reduce) {
      .home-hero-reveal, .home-stagger { animation: none !important; opacity: 1 !important; transform: none !important; }
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
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

const EASE_OUT  = 'cubic-bezier(0.22,1,0.36,1)';
const EASE_FAST = 'cubic-bezier(0.23,1,0.32,1)';
const EASE_SPR  = 'cubic-bezier(0.32,0.72,0,1)';

function openMaps(lat, lng) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
  else window.open(url, '_blank');
}

// ── Level config (subset — color + bg only) ───────────────────────────────────
const LV_CFG = {
  1:  { color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  2:  { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  3:  { color: C.green,   bg: C.greenFt },
  4:  { color: C.gold,    bg: C.goldFt },
  5:  { color: C.orange,  bg: 'rgba(212,135,79,0.12)' },
  6:  { color: '#F472B6', bg: 'rgba(244,114,182,0.12)' },
  7:  { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  8:  { color: '#22D3EE', bg: 'rgba(34,211,238,0.12)' },
  9:  { color: C.red,     bg: C.redFt },
  10: { color: C.geo,     bg: C.geoDim },
};

// XP thresholds per level
const XP_MIN  = [0, 0, 100, 250, 500, 1000, 2000, 3000, 3750, 4500, 5000];
const XP_NEXT = [null, 100, 250, 500, 1000, 2000, 3000, 3750, 4500, 5000, null];
function xpProgress(xp, level) {
  const min  = XP_MIN[level]  ?? 0;
  const next = XP_NEXT[level] ?? null;
  if (!next) return 1;
  return Math.min(1, (xp - min) / (next - min));
}

// ── User state classification ─────────────────────────────────────────────────
// 'new'    — first-time, no visits, no balance
// 'active' — has visited at least once or earned something
// 'power'  — deeply engaged (10+ visits, 200+ GEO, or 5+ streak)
function getUserState(heroData) {
  if (!heroData) return 'loading';
  const { balance = 0, visits = 0, streak = 0 } = heroData;
  if (visits >= 10 || balance >= 200 || streak >= 5) return 'power';
  if (visits >= 1  || balance > 0)                   return 'active';
  return 'new';
}

// ── Satellite node positions ───────────────────────────────────────────────────
const ORB_NODES = [
  { angle: 18,  r: 64, size: 3,   anim: 'ptFade0', dur: 4.2, delay: 0 },
  { angle: 148, r: 64, size: 2.5, anim: 'ptFade1', dur: 5.0, delay: 0.9 },
  { angle: 260, r: 64, size: 2,   anim: 'ptFade2', dur: 4.6, delay: 1.6 },
  { angle: 60,  r: 90, size: 2,   anim: 'ptFade3', dur: 3.8, delay: 2.1 },
  { angle: 200, r: 90, size: 1.5, anim: 'ptFade4', dur: 5.2, delay: 3.0 },
  { angle: 322, r: 90, size: 1.5, anim: 'ptFade5', dur: 4.0, delay: 1.1 },
];

// ── GeoOrb — premium animated orb, GPU-safe ───────────────────────────────────
function GeoOrb() {
  const CX = 90; const CY = 90;
  return (
    <div style={{ position: 'relative', width: 180, height: 180 }}>
      {/* Ambient glow layer — opacity-only animation, separate from rings */}
      <div style={{
        position: 'absolute', inset: -24,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(201,123,71,0.22) 0%, rgba(201,123,71,0.06) 45%, transparent 70%)',
        filter: 'blur(22px)',
        animation: 'orbBreathe 5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* SVG: rings + radar (SMIL reliable in WebView) */}
      <svg
        width="180" height="180" viewBox="0 0 180 180"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {/* Outer dashed ring — slow rotation */}
        <g style={{ transformOrigin: '90px 90px', animation: 'orbRotateSlow 100s linear infinite' }}>
          <circle cx={CX} cy={CY} r="88" fill="none"
            stroke="rgba(201,123,71,0.09)" strokeWidth="0.5" strokeDasharray="3 10" />
        </g>

        {/* Mid ring — static */}
        <circle cx={CX} cy={CY} r="64" fill="none"
          stroke="rgba(201,123,71,0.16)" strokeWidth="0.5" />

        {/* Inner ring — pulse opacity */}
        <circle cx={CX} cy={CY} r="42" fill="none"
          stroke="rgba(201,123,71,0.32)" strokeWidth="1"
          style={{ animation: 'orbPulseOpacity 4s ease-in-out infinite' }} />

        {/* Core halo fill */}
        <circle cx={CX} cy={CY} r="18" fill="rgba(201,123,71,0.07)" />

        {/* Radar expand pulses — SMIL, reliable in Telegram WebView */}
        <circle cx={CX} cy={CY} r="8" fill="none" stroke="rgba(201,123,71,0.48)" strokeWidth="1.5">
          <animate attributeName="r"       values="8;50;8"     dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.48;0;0.48" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx={CX} cy={CY} r="8" fill="none" stroke="rgba(201,123,71,0.24)" strokeWidth="1">
          <animate attributeName="r"       values="8;72;8"     dur="3s" begin="0.75s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.24;0;0.24" dur="3s" begin="0.75s" repeatCount="indefinite" />
        </circle>

        {/* Connection lines to primary nodes */}
        <line
          x1={CX} y1={CY}
          x2={Math.round(CX + Math.cos(18  * Math.PI / 180) * 64)}
          y2={Math.round(CY + Math.sin(18  * Math.PI / 180) * 64)}
          stroke="rgba(201,123,71,0.11)" strokeWidth="0.5" strokeDasharray="2 6"
        />
        <line
          x1={CX} y1={CY}
          x2={Math.round(CX + Math.cos(148 * Math.PI / 180) * 64)}
          y2={Math.round(CY + Math.sin(148 * Math.PI / 180) * 64)}
          stroke="rgba(201,123,71,0.11)" strokeWidth="0.5" strokeDasharray="2 6"
        />

        {/* Teal accent nodes (secondary signal) */}
        <circle cx={Math.round(CX + Math.cos(290 * Math.PI / 180) * 90)} cy={Math.round(CY + Math.sin(290 * Math.PI / 180) * 90)} r="1.5" fill="#6D8B74">
          <animate attributeName="opacity" values="0;0.42;0" dur="3.2s" begin="0s" repeatCount="indefinite" />
        </circle>
        <circle cx={Math.round(CX + Math.cos(112 * Math.PI / 180) * 90)} cy={Math.round(CY + Math.sin(112 * Math.PI / 180) * 90)} r="1.5" fill="#6D8B74">
          <animate attributeName="opacity" values="0;0.35;0" dur="2.8s" begin="1.4s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Core dot — radial-gradient highlight for 3D depth */}
      <div style={{
        position: 'absolute',
        left: CX - 11, top: CY - 11,
        width: 22, height: 22, borderRadius: '50%',
        background: 'radial-gradient(circle at 36% 30%, rgba(255,215,170,0.95), #C97B47 52%, #8B5020)',
        boxShadow: '0 0 18px rgba(201,123,71,0.82), 0 0 36px rgba(201,123,71,0.28)',
      }} />

      {/* Satellite nodes — opacity-only animations (no custom property) */}
      {ORB_NODES.map((n, i) => {
        const rad = n.angle * Math.PI / 180;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: CX + Math.round(Math.cos(rad) * n.r) - n.size,
            top:  CY + Math.round(Math.sin(rad) * n.r) - n.size,
            width: n.size * 2, height: n.size * 2, borderRadius: '50%',
            background: '#C97B47',
            animation: `${n.anim} ${n.dur}s ${n.delay}s ease-in-out infinite`,
          }} />
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: `1px solid ${C.b0}` }}>
      <div className="sk" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="sk" style={{ height: 14, width: '52%', borderRadius: 7, marginBottom: 8 }} />
        <div className="sk" style={{ height: 11, width: '30%', borderRadius: 5 }} />
      </div>
      <div className="sk" style={{ height: 20, width: 62, borderRadius: 8 }} />
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
        zIndex: 200, animation: `heroReveal 0.2s ${EASE_OUT}`,
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg,#141E2A 0%,#101A24 100%)',
        borderRadius: '28px 28px 0 0',
        border: '0.5px solid rgba(255,255,255,0.10)', borderBottom: 'none',
        padding: '0 0 44px', zIndex: 201, maxWidth: 480, margin: '0 auto',
        animation: `slideUp 0.34s ${EASE_OUT}`,
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

          {/* Reward */}
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
          <div style={{ background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${C.b1}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
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
              background: 'rgba(232,192,104,0.08)', border: `0.5px solid ${C.goldGl}`,
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
          <div style={{ background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${C.b1}`, borderRadius: 16, padding: '14px 16px', marginBottom: 18 }}>
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
            border: `0.5px solid ${C.b2}`, borderRadius: 14, padding: '14px',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0 12px' }}>
      {Icon && <Icon size={13} color={col} strokeWidth={2.5} />}
      <span style={{ fontSize: 12, fontWeight: 600, color: col, flex: 1, letterSpacing: 0.2 }}>
        {label}
      </span>
      {count != null && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: col,
          background: `${col}14`, border: `1px solid ${col}24`,
          borderRadius: 8, padding: '2px 8px',
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── Featured card ─────────────────────────────────────────────────────────────
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
        flexShrink: 0, width: 216,
        // outer shell — double-bezel
        background: `rgba(16,22,30,0.97)`,
        border: `1px solid ${iconBorder}`,
        borderRadius: 22, padding: '1.5px',
        cursor: onTap ? 'pointer' : 'default',
        transform: pressed ? 'scale(0.968)' : 'scale(1)',
        transition: pressed
          ? `transform 100ms ${EASE_FAST}`
          : `transform 180ms ${EASE_SPR}`,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        animation: `staggerIn 0.30s ${EASE_FAST} ${index * 0.07}s both`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.04) inset',
      }}
    >
      {/* inner core */}
      <div style={{
        background: `linear-gradient(148deg, ${gradStart || iconBg} 0%, ${C.card} 100%)`,
        borderRadius: 21, padding: '17px 15px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }}>
        {/* Icon row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: iconBg, border: `1px solid ${iconBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 10px ${iconColor}18`,
          }}>
            <Icon size={17} color={iconColor} strokeWidth={1.75} />
          </div>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: iconColor,
              background: iconBg, border: `1px solid ${iconBorder}`,
              borderRadius: 6, padding: '3px 7px', letterSpacing: 0.5,
            }}>
              {badge}
            </span>
          )}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </div>

        {/* Reward */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: rewardColor || iconColor, letterSpacing: -0.6, lineHeight: 1 }}>
            +{formatGeo(rewardAmount)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>{rewardLabel}</span>
        </div>
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
        padding: '12px 0',
        borderBottom: `1px solid ${C.b0}`,
        cursor: 'pointer',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        transition: pressed
          ? `transform 90ms ${EASE_FAST}`
          : `transform 160ms ${EASE_SPR}`,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        animation: `staggerIn 0.28s ${EASE_FAST} ${index * 0.045 + 0.06}s both`,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: 'linear-gradient(145deg, rgba(201,123,71,0.15) 0%, rgba(201,123,71,0.08) 100%)',
        border: `1px solid ${C.geoGl}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 2px 12px rgba(201,123,71,0.08)`,
      }}>
        <TaskIcon size={18} color={C.geo} strokeWidth={1.75} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: C.t1, letterSpacing: -0.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4,
        }}>
          {campaign.business_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {campaign.dist !== undefined && campaign.dist !== Infinity && (
            <span style={{ fontSize: 12, color: C.t3, fontWeight: 400 }}>
              {formatDistance(campaign.dist)}
            </span>
          )}
          {campaign.requires_pin && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: C.gold,
              background: C.goldFt, borderRadius: 5, padding: '1px 6px',
              border: `1px solid ${C.goldGl}`, letterSpacing: 0.3,
            }}>
              PIN
            </span>
          )}
        </div>
      </div>

      {/* Reward */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.geo, letterSpacing: -0.4 }}>
          +{formatGeo(campaign.reward_amount)}
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 2, fontWeight: 500 }}>GEO</div>
      </div>
    </div>
  );
}

// ── Hero headline — shown when balance is 0/null ─────────────────────────────
function HeroHeadline({ t }) {
  const title     = t('home.title') || 'Зарабатывайте GEO';
  const subtitle  = t('home.subtitle') || '';
  const words     = title.trim().split(' ');
  const lastWord  = words[words.length - 1];
  const restWords = words.slice(0, -1).join(' ');
  const EO = 'cubic-bezier(0.23,1,0.32,1)';

  return (
    <div>
      {restWords && (
        <div style={{
          fontSize: 36, fontWeight: 800, lineHeight: 0.96,
          letterSpacing: -1.5, color: C.t1,
          animation: `heroReveal 0.48s ${EO} both`,
        }}>
          {restWords}
        </div>
      )}
      <div style={{
        fontSize: 36, fontWeight: 800, lineHeight: 0.96,
        letterSpacing: -1.5, color: C.geo,
        marginBottom: subtitle ? 10 : 0,
        animation: `heroReveal 0.48s 0.07s ${EO} both`,
      }}>
        {lastWord}.
      </div>
      {subtitle && (
        <div style={{
          fontSize: 13, color: C.t3, fontWeight: 400, lineHeight: 1.5,
          animation: `heroReveal 0.48s 0.15s ${EO} both`,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ── Hero: new user — product pitch, aspirational ─────────────────────────────
function NewHeroContent({ t }) {
  return (
    <div style={{ padding: '0 22px', animation: `heroReveal 0.5s ${EASE_OUT} 0.1s both` }}>
      <HeroHeadline t={t} />
    </div>
  );
}

// ── Hero: active user — balance + streak ─────────────────────────────────────
function ActiveHeroContent({ balance, streak }) {
  return (
    <div style={{ textAlign: 'center', animation: `balanceFadeIn 0.4s ${EASE_OUT} both` }}>
      {/* Live label */}
      <div style={{
        fontSize: 10, fontWeight: 600, color: C.t3, letterSpacing: 1.4,
        textTransform: 'uppercase', marginBottom: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: C.green, display: 'inline-block',
          animation: 'liveSignal 2.2s ease-in-out infinite',
        }} />
        GEO Balance
      </div>

      {/* Balance number */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 7 }}>
        <span style={{
          fontSize: 48, fontWeight: 300, color: C.t1,
          letterSpacing: -2.2, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatGeo(balance)}
        </span>
        <span style={{ fontSize: 15, fontWeight: 500, color: C.t3, paddingBottom: 4 }}>
          GEO
        </span>
      </div>

      {/* Streak pill — motivational, shown only when active */}
      {streak > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 9 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(212,135,79,0.13)',
            border: '1px solid rgba(212,135,79,0.24)',
            borderRadius: 20, padding: '4px 12px',
            animation: `heroReveal 0.4s ${EASE_OUT} 0.14s both`,
          }}>
            <Flame size={11} color={C.orange} strokeWidth={2.5} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, letterSpacing: -0.1 }}>
              {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hero: power user — status dashboard ──────────────────────────────────────
function PowerHeroContent({ balance, streak, level, xp, visits }) {
  const cfg = LV_CFG[level] || LV_CFG[1];
  const pct = xpProgress(xp, level);

  return (
    <div style={{ textAlign: 'center', padding: '0 20px', animation: `balanceFadeIn 0.4s ${EASE_OUT} both` }}>
      {/* Balance — slightly smaller to leave room for stats */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{
          fontSize: 44, fontWeight: 300, color: C.t1,
          letterSpacing: -2, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatGeo(balance)}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.geo, paddingBottom: 3 }}>
          GEO
        </span>
      </div>

      {/* Status pills row */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 9,
        animation: `heroReveal 0.4s ${EASE_OUT} 0.1s both`,
      }}>
        {/* Level */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: cfg.bg, border: `1px solid ${cfg.color}30`,
          borderRadius: 20, padding: '4px 10px',
        }}>
          <Crown size={10} color={cfg.color} strokeWidth={2.5} />
          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>
            Lv.{level}
          </span>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(212,135,79,0.13)', border: '1px solid rgba(212,135,79,0.25)',
            borderRadius: 20, padding: '4px 10px',
          }}>
            <Flame size={10} color={C.orange} strokeWidth={2.5} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>{streak}</span>
          </div>
        )}

        {/* Visits */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'rgba(109,139,116,0.12)', border: '1px solid rgba(109,139,116,0.25)',
          borderRadius: 20, padding: '4px 10px',
        }}>
          <MapPin size={10} color={C.teal} strokeWidth={2.5} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.teal }}>{visits}</span>
        </div>
      </div>

      {/* XP progress bar */}
      {XP_NEXT[level] && (
        <div style={{
          width: 144, margin: '0 auto',
          animation: `heroReveal 0.4s ${EASE_OUT} 0.18s both`,
        }}>
          <div style={{
            height: 2, borderRadius: 2,
            background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: cfg.color,
              width: `${pct * 100}%`,
              transition: `width 1s ${EASE_OUT} 0.3s`,
            }} />
          </div>
          <div style={{ fontSize: 9, color: C.t3, marginTop: 4, textAlign: 'right' }}>
            {xp.toLocaleString('ru-RU')} / {XP_NEXT[level].toLocaleString('ru-RU')} XP
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Home page ────────────────────────────────────────────────────────────
export default function Home() {
  ensureHomeCSS();

  const navigate  = useNavigate();
  const { t }     = useLanguage();

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

  // Unified hero data — same /api/me source as Balance page (ensures consistency)
  const [heroData,    setHeroData]    = useState(null); // null = loading
  const [heroLoading, setHeroLoading] = useState(true);

  const userState = useMemo(() => getUserState(heroData), [heroData]);

  const loadCampaigns = () => {
    setLoading(true); setError('');
    fetch(`${API_BASE}/api/campaigns`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setError(t('home.error.load')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCampaigns(); }, []);

  // Fetch user identity + game state in parallel — same endpoints as Balance/Profile
  // so both screens always show the same numbers
  useEffect(() => {
    Promise.all([
      apiFetch('/api/me').then(r => r.ok ? r.json() : null).catch(() => null),
      apiFetch('/api/me/game').then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([me, game]) => {
        setHeroData({
          balance: me?.user?.balance ?? 0,
          visits:  me?.user?.total_visits ?? me?.user?.checkin_count ?? 0,
          streak:  game?.streak?.current_streak ?? 0,
          level:   game?.level ?? 1,
          xp:      game?.xp ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setHeroLoading(false));
  }, []);

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
  const hasContent    = displayed.length + featuredCount > 0;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: `pageEnter 0.35s ${EASE_OUT} both` }}>

      {/* ── HERO — height grows slightly for power users ─────────────────── */}
      <div style={{
        position: 'relative',
        height: userState === 'power' ? 316 : 292,
        overflow: 'hidden',
        background: 'linear-gradient(185deg, #040B13 0%, #071018 50%, #081018 100%)',
        transition: `height 0.4s ${EASE_OUT}`,
      }}>
        {/* Top atmospheric gradient — static, no animation (GPU savings) */}
        <div style={{
          position: 'absolute', top: -40, left: '50%',
          width: 280, height: 180,
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(201,123,71,0.11) 0%, transparent 72%)',
          pointerEvents: 'none',
        }} />

        {/* Bottom atmospheric fill behind balance text */}
        <div style={{
          position: 'absolute', bottom: 0, left: '30%', right: '30%',
          height: 100,
          background: 'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(201,123,71,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Orb — centered in the upper half */}
        <div style={{
          position: 'absolute',
          top: 36, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1,
        }}>
          <GeoOrb />
        </div>

        {/* Bottom page blend */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: `linear-gradient(0deg, ${C.bg} 0%, transparent 100%)`,
          pointerEvents: 'none', zIndex: 2,
        }} />

        {/* Top bar — always on top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '26px 20px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 4,
          background: 'linear-gradient(180deg,rgba(4,11,19,0.70) 0%,transparent 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={12} color={C.geo} strokeWidth={2.25} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.t1, letterSpacing: -0.3 }}>
              Geo<span style={{ color: C.geo }}>Earn</span>
            </span>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Adaptive hero content — keyed by state to trigger entrance on change */}
        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, zIndex: 3 }}>
          {heroLoading ? (
            /* Skeleton — never flash "0" */
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 72 }}>
              <div className="sk" style={{ width: 144, height: 44, borderRadius: 12 }} />
            </div>
          ) : (
            <div key={userState}>
              {userState === 'new'    && <NewHeroContent t={t} />}
              {userState === 'active' && (
                <ActiveHeroContent
                  balance={heroData.balance}
                  streak={heroData.streak}
                />
              )}
              {userState === 'power'  && (
                <PowerHeroContent
                  balance={heroData.balance}
                  streak={heroData.streak}
                  level={heroData.level}
                  xp={heroData.xp}
                  visits={heroData.visits}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CTA BUTTONS ─────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 10 }}>

        {/* Primary — ambient glow layer decoupled from button transform */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: 1, borderRadius: 16,
            background: 'linear-gradient(135deg,#D48A52,#C97B47 55%,#B36835)',
            opacity: 0.45, filter: 'blur(11px)',
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
              boxShadow: '0 3px 18px rgba(201,123,71,0.25), 0 1px 0 rgba(255,255,255,0.14) inset',
              WebkitTapHighlightColor: 'transparent',
              transform: pressedSort ? 'scale(0.97)' : 'scale(1)',
              transition: pressedSort
                ? `transform 100ms ${EASE_FAST}`
                : `transform 180ms ${EASE_SPR}`,
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
            border: `1px solid rgba(109,139,116,0.22)`,
            borderRadius: 16, height: 52,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.2,
            WebkitTapHighlightColor: 'transparent',
            transform: pressedMap ? 'scale(0.97)' : 'scale(1)',
            transition: pressedMap
              ? `transform 100ms ${EASE_FAST}`
              : `transform 180ms ${EASE_SPR}`,
          }}
        >
          <MapPin size={15} strokeWidth={2} />
          {t('home.map') || 'Карта'}
        </button>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
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
                  gradStart="rgba(232,192,104,0.10)"
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
                  gradStart="rgba(143,174,123,0.10)"
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
                    gradStart={`${rr.color}0E`}
                    title={p.title}
                    subtitle={p.max_claims - p.claims_count > 0 ? `${p.max_claims - p.claims_count} доступно` : 'Закончилось'}
                    badge={rr.label}
                    rewardAmount={p.reward_amount}
                    rewardColor={rr.color}
                  />
                );
              })}
              <div style={{ flexShrink: 0, width: 2 }} />
            </div>
          </div>
        )}

        {/* Nearby section */}
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
              width: 52, height: 52, borderRadius: 16,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: `0 0 24px ${C.geoGl}`,
            }}>
              <MapPin size={24} color={C.geo} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.t2, marginBottom: 6, letterSpacing: -0.3 }}>
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

        {/* How it works — only when empty */}
        {!loading && !error && !hasContent && displayed.length === 0 && (
          <div style={{
            marginTop: 22, padding: '18px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${C.b0}`,
            borderRadius: 18,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, letterSpacing: 0.3, marginBottom: 16 }}>
              Как это работает
            </div>
            {[[ScanLine, t('home.how.1')], [MapPin, t('home.how.2')], [Wallet, t('home.how.3')]].map(([Icon, text], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < 2 ? 14 : 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: C.geoDim, border: `1px solid ${C.geoGl}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color={C.geo} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Legal */}
        <div style={{ display: 'flex', gap: 16, paddingTop: 26 }}>
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
