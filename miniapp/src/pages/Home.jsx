import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Compass, ScanLine, Wallet, Lock, ShoppingBag, Star, AlertCircle,
  Store, ChevronRight, Tv2, Crosshair, ExternalLink, Gift, Shield, Gem, Zap,
} from 'lucide-react';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { getGeoPos } from '../lib/geoPos';
import { C, E, cardBase, pressable } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const RYE = { fontFamily: "'Rye', serif" };

function HeroIllustration() {
  return (
    <div style={{ position: 'relative', width: 148, height: 190, flexShrink: 0 }}>
      {/* Mountain scene */}
      <svg viewBox="0 0 148 190" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="32" cy="32" rx="24" ry="10" fill="rgba(109,139,116,0.10)"/>
        <ellipse cx="118" cy="22" rx="18" ry="8" fill="rgba(109,139,116,0.08)"/>
        <path d="M15 148 L58 52 L101 148Z" fill="#101A24"/>
        <path d="M55 148 L92 68 L129 148Z" fill="#16212D"/>
        <path d="M92 68 L102 90 L82 90Z" fill="rgba(244,235,221,0.10)"/>
        <polygon points="4,148 11,128 18,148" fill="#1A2C1F"/>
        <polygon points="10,148 19,122 28,148" fill="#152318"/>
        <polygon points="126,148 133,130 140,148" fill="#1A2C1F"/>
        <polygon points="119,148 128,125 137,148" fill="#152318"/>
        <rect x="0" y="148" width="148" height="42" fill="#0D161F"/>
      </svg>
      {/* Post */}
      <div style={{ position: 'absolute', left: '50%', top: 22, bottom: 42, transform: 'translateX(-50%)', width: 7, background: 'linear-gradient(90deg,#3A2408,#7A5018,#3A2408)', borderRadius: 3, boxShadow: '2px 0 4px rgba(0,0,0,0.4)' }} />
      {/* EXPLORE */}
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%) rotate(2.5deg)', background: 'linear-gradient(180deg,#C97B47,#9E4E1A)', borderRadius: 5, padding: '6px 0', color: '#F4EBDD', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.5)', boxShadow: '0 3px 8px rgba(0,0,0,0.4)', width: 110, textAlign: 'center', clipPath: 'polygon(0 0,91% 0,100% 50%,91% 100%,0 100%)' }}>EXPLORE</div>
      {/* EARN */}
      <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%) rotate(-2deg)', background: 'linear-gradient(180deg,#6D8B74,#3D5E47)', borderRadius: 5, padding: '6px 0', color: '#F4EBDD', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.5)', boxShadow: '0 3px 8px rgba(0,0,0,0.4)', width: 95, textAlign: 'center', clipPath: 'polygon(0 0,91% 0,100% 50%,91% 100%,0 100%)' }}>EARN</div>
      {/* REPEAT */}
      <div style={{ position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%) rotate(1.5deg)', background: 'linear-gradient(180deg,#C9A042,#8E6810)', borderRadius: 5, padding: '6px 0', color: '#F4EBDD', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.5)', boxShadow: '0 3px 8px rgba(0,0,0,0.4)', width: 110, textAlign: 'center', clipPath: 'polygon(0 0,91% 0,100% 50%,91% 100%,0 100%)' }}>REPEAT</div>
      {/* Route 66 shield */}
      <div style={{ position: 'absolute', bottom: 46, right: 4, width: 40, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#C97B47,#7A3E10)', borderRadius: '40% 40% 48% 48% / 28% 28% 52% 52%', border: '2px solid rgba(244,235,221,0.65)', boxShadow: '0 3px 10px rgba(0,0,0,0.55)', gap: 0 }}>
        <span style={{ fontSize: 6.5, fontWeight: 800, color: '#F4EBDD', letterSpacing: 0.2, lineHeight: 1.2 }}>ROUTE</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: '#F4EBDD', lineHeight: 1 }}>66</span>
      </div>
    </div>
  );
}

const TASK_ICONS = {
  visit:    MapPin,
  purchase: ShoppingBag,
  review:   Star,
};

// ── Campaign type tokens ──────────────────────────────────────────────────────
// business   → purple border
// platform   → green border + PLATFORM badge
// geohunt    → gold border + GEOHUNT badge
const TYPE = {
  business: {
    border:  'rgba(160,80,255,0.35)',
    glow:    'rgba(160,80,255,0.12)',
    badge:   null,
  },
  platform: {
    border:  C.greenGl,
    glow:    C.greenFt,
    badge:   { label: 'PLATFORM', color: C.green, bg: C.greenFt },
  },
  geohunt: {
    border:  C.goldGl,
    glow:    C.goldFt,
    badge:   { label: 'GEOHUNT', color: C.gold, bg: C.goldFt },
  },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ ...cardBase, padding: '16px 18px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sk" style={{ height: 14, width: '58%', borderRadius: 6, marginBottom: 10 }} />
        <div className="sk" style={{ height: 10, width: '33%', borderRadius: 5 }} />
      </div>
      <div className="sk" style={{ height: 36, width: 92, borderRadius: 12, marginLeft: 14 }} />
    </div>
  );
}

// ── Campaign detail sheet (business campaigns) ────────────────────────────────
function CampaignSheet({ campaign, userPos, onClose }) {
  const { t } = useLanguage();
  const dist = userPos && campaign.lat && campaign.lng
    ? haversineMeters(userPos, { lat: +campaign.lat, lng: +campaign.lng })
    : null;

  const TaskIcon = TASK_ICONS[campaign.task_type] || MapPin;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 200, animation: 'backdropIn 0.22s ease',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf,
        borderRadius: '24px 24px 0 0',
        border: `0.5px solid rgba(255,255,255,0.08)`,
        borderBottom: 'none',
        padding: '0 0 40px',
        zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275)',
      }}>
        <div style={{ width: 32, height: 3, borderRadius: 2, background: C.b2, margin: '14px auto 22px' }} />

        <div style={{ padding: '0 20px' }}>
          {/* Business name + type badge */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 22, color: C.t1, letterSpacing: -0.3 }}>
              {campaign.business_name}
            </div>
          </div>

          {campaign.address && (
            <div style={{ fontSize: 13, color: C.t3, marginBottom: dist !== null ? 4 : 18, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} color={C.t3} />
              <span>{campaign.address}</span>
            </div>
          )}

          {dist !== null && (
            <div style={{ fontSize: 13, color: C.geo, fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Compass size={12} color={C.geo} />
              {formatDistance(dist)} {t('home.from_you')}
            </div>
          )}

          {/* Reward */}
          <div style={{
            background: C.geoDim,
            border: `0.5px solid ${C.geoGl}`,
            borderRadius: 20, padding: '20px',
            textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: C.t3, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('home.reward')}
            </div>
            <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.5, color: C.geo, lineHeight: 1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 18, fontWeight: 700, color: C.t2, marginLeft: 8 }}>GEO</span>
            </div>
          </div>

          {/* Task type */}
          <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              {t('home.task_type')}
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.t1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TaskIcon size={15} color={C.geo} strokeWidth={2} />
              {t(`task.${campaign.task_type}`) || t('task.visit')}
            </div>
            {campaign.task_description && (
              <div style={{ fontSize: 14, color: C.t2, lineHeight: 1.55, marginTop: 6 }}>
                {campaign.task_description}
              </div>
            )}
          </div>

          {campaign.requires_pin && (
            <div style={{
              background: C.goldFt, border: `0.5px solid rgba(245,166,35,0.20)`,
              borderRadius: 14, padding: '12px 14px', marginBottom: 10,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <Lock size={16} color={C.gold} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.gold, marginBottom: 2 }}>{t('home.pin_required')}</div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.4 }}>
                  {t('home.pin_hint')}
                </div>
              </div>
            </div>
          )}

          {/* How to earn */}
          <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              {t('home.how.title')}
            </div>
            {[
              [ScanLine, t('home.sheet.how.1')],
              [MapPin,   t('home.sheet.how.2')],
              [Wallet,   t('home.sheet.how.3')],
            ].map(([Icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color={C.geo} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: C.t2 }}>{text}</span>
              </div>
            ))}
          </div>

          {campaign.lat && campaign.lng && (
            <button
              onClick={() => openMaps(campaign.lat, campaign.lng)}
              style={{
                width: '100%', marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: C.geoDim,
                border: `0.5px solid ${C.geoGl}`,
                borderRadius: 14, padding: '14px',
                fontSize: 15, fontWeight: 700,
                color: C.geo, cursor: 'pointer',
              }}
            >
              <ExternalLink size={16} color={C.geo} strokeWidth={2} />
              Открыть в Google Картах
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%', background: C.card,
              border: `0.5px solid ${C.b2}`,
              borderRadius: 14, padding: '14px',
              fontSize: 15, fontWeight: 600,
              color: C.t2, cursor: 'pointer',
            }}
          >
            {t('home.close')}
          </button>
        </div>
      </div>
    </>
  );
}

const MONO = {};

// ── Section divider label ─────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label, count, color = C.t3 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '14px 0 10px',
      borderBottom: `1px solid rgba(255,255,255,0.06)`,
      marginBottom: 4,
    }}>
      <div style={{ width: 3, height: 14, background: color, borderRadius: 2, flexShrink: 0 }} />
      {Icon && <Icon size={12} color={color} strokeWidth={2} />}
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
      {count != null && (
        <span style={{
          fontSize: 10, fontWeight: 600, color,
          background: `${color}18`, border: `1px solid ${color}30`,
          borderRadius: 8, padding: '1px 7px', marginLeft: 'auto',
        }}>{String(count).padStart(2, '0')}</span>
      )}
    </div>
  );
}

// ── Business campaign card ────────────────────────────────────────────────────
function CampaignCard({ campaign, onTap, index }) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={() => onTap(campaign)}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        ...pressable(pressed),
        animation: `fadeUp 0.28s ${E.smooth} both`,
        animationDelay: `${index * 0.04}s`,
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: C.t3, width: 20, flexShrink: 0, textAlign: 'right' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campaign.business_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {campaign.dist !== undefined && campaign.dist !== Infinity && (
            <span style={{ fontSize: 12, color: C.t2 }}>
              {formatDistance(campaign.dist)}
            </span>
          )}
          {campaign.requires_pin && (
            <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, background: C.goldFt, borderRadius: 6, padding: '1px 6px', border: `1px solid ${C.goldGl}` }}>
              PIN
            </span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.geo }}>
          +{formatGeo(campaign.reward_amount)}
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>GEO</div>
      </div>
    </div>
  );
}

// ── Platform promo card ───────────────────────────────────────────────────────
function PlatformPromoCard({ promo, onTap, index }) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={() => onTap(promo)}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        ...pressable(pressed),
        animation: `fadeUp 0.28s ${E.smooth} both`,
        animationDelay: `${index * 0.04}s`,
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ ...MONO, fontSize: 10, color: C.t3, width: 18, flexShrink: 0, textAlign: 'right' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {promo.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ ...MONO, fontSize: 8, color: C.green, background: C.greenFt, borderRadius: 2, padding: '1px 4px', border: `1px solid ${C.greenGl}` }}>
            PLATFORM
          </span>
          {promo.channel_username && (
            <span style={{ ...MONO, fontSize: 9, color: C.t2 }}>{promo.channel_username}</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ ...MONO, fontSize: 13, fontWeight: 700, color: C.green }}>+{formatGeo(promo.reward_amount)}</div>
        <div style={{ ...MONO, fontSize: 8, color: C.t3, marginTop: 2 }}>GEO</div>
      </div>
    </div>
  );
}

// ── GeoHunt card ──────────────────────────────────────────────────────────────
function GeoHuntCard({ hunt, index }) {
  const [pressed, setPressed] = useState(false);
  const remaining = hunt.total_codes - hunt.claimed_codes;

  return (
    <div
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
        ...pressable(pressed),
        animation: `fadeUp 0.28s ${E.smooth} both`,
        animationDelay: `${index * 0.04}s`,
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ ...MONO, fontSize: 10, color: C.t3, width: 18, flexShrink: 0, textAlign: 'right' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hunt.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ ...MONO, fontSize: 8, color: C.gold, background: C.goldFt, borderRadius: 2, padding: '1px 4px', border: `1px solid ${C.goldGl}` }}>
            GEOHUNT
          </span>
          <span style={{ ...MONO, fontSize: 9, color: C.t2 }}>{remaining}/{hunt.total_codes} pts</span>
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ ...MONO, fontSize: 13, fontWeight: 700, color: C.gold }}>+{hunt.reward_per_code}</div>
        <div style={{ ...MONO, fontSize: 8, color: C.t3, marginTop: 2 }}>GEO</div>
      </div>
    </div>
  );
}

// ── Promo QR rarity config ────────────────────────────────────────────────────
const PROMO_RARITY = {
  common:    { label: 'COMMON',    color: '#9CA3AF' },
  rare:      { label: 'RARE',      color: '#60A5FA' },
  epic:      { label: 'EPIC',      color: '#C084FC' },
  legendary: { label: 'LEGENDARY', color: '#FBBF24' },
};

// ── Promo QR card ─────────────────────────────────────────────────────────────
function PromoQrCard({ promo, index }) {
  const [pressed, setPressed] = useState(false);
  const rr = PROMO_RARITY[promo.rarity] || PROMO_RARITY.common;
  const remaining = promo.max_claims - promo.claims_count;

  return (
    <div
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
        ...pressable(pressed),
        animation: `fadeUp 0.28s ${E.smooth} both`,
        animationDelay: `${index * 0.04}s`,
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ ...MONO, fontSize: 10, color: C.t3, width: 18, flexShrink: 0, textAlign: 'right' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {promo.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ ...MONO, fontSize: 8, color: rr.color, background: `${rr.color}18`, borderRadius: 2, padding: '1px 4px', border: `1px solid ${rr.color}40` }}>
            {rr.label}
          </span>
          {remaining > 0 && (
            <span style={{ ...MONO, fontSize: 9, color: C.t2 }}>{remaining} left</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ ...MONO, fontSize: 13, fontWeight: 700, color: rr.color }}>+{formatGeo(promo.reward_amount)}</div>
        <div style={{ ...MONO, fontSize: 8, color: C.t3, marginTop: 2 }}>GEO</div>
      </div>
    </div>
  );
}

function openMaps(lat, lng) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}

// ── Main Home page ────────────────────────────────────────────────────────────
export default function Home() {
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
    setLoading(true);
    setError('');
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
      .map(c => ({
        ...c,
        dist: c.lat && c.lng ? haversineMeters(userPos, { lat: +c.lat, lng: +c.lng }) : Infinity,
      }))
      .sort((a, b) => a.dist - b.dist);
  })();

  function handlePlatformTap(promo) {
    navigate(`/channel-reward?token=${encodeURIComponent(promo.token || promo.id)}`);
  }

  const totalCampaigns = displayed.length + platformPromos.length + geohunts.length + promoQrs.length;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.3s ease both' }}>

      {/* ── Hero ── */}
      <div style={{
        padding: '0 16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: `linear-gradient(135deg, ${C.bg} 55%, rgba(201,123,71,0.04) 100%)`,
        overflow: 'hidden',
      }}>
        {/* Top bar: language switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0 4px' }}>
          <LanguageSwitcher />
        </div>

        {/* Hero body: text left, illustration right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...RYE, fontSize: 36, lineHeight: 1.05, color: C.t1 }}>
              {t('home.title').split(' ').slice(0, -1).join(' ') || 'Зарабатывайте'}
            </div>
            <div style={{ ...RYE, fontSize: 36, lineHeight: 1.05, color: C.geo, marginBottom: 12 }}>
              GEO.
            </div>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, maxWidth: 200 }}>
              {t('home.subtitle')}
            </div>
          </div>
          <HeroIllustration />
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => getGeoPos().then(p => setUserPos(p)).catch(() => {})}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: C.geo, color: '#F4EBDD',
              border: 'none', borderRadius: 14, padding: '13px 0',
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              boxShadow: '0 4px 20px rgba(201,123,71,0.35)',
            }}
          >
            <Compass size={14} strokeWidth={2} />
            По расстоянию
          </button>
          <button
            onClick={() => navigate('/map')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: 'transparent', color: C.teal,
              border: `1px solid ${C.tealGl}`, borderRadius: 14, padding: '13px 0',
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <MapPin size={14} strokeWidth={2} />
            Карта
          </button>
        </div>
      </div>

      {/* ── Campaign lists ── */}
      <div style={{ padding: '0 16px 32px' }}>

        {/* Platform promos */}
        {!promoLoading && platformPromos.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <SectionLabel icon={Tv2} label="АКЦИИ GEOEARN" count={platformPromos.length} color={C.green} />
            {platformPromos.map((p, i) => (
              <PlatformPromoCard key={p.id} promo={p} onTap={handlePlatformTap} index={i} />
            ))}
          </div>
        )}

        {/* GeoHunts */}
        {geohunts.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <SectionLabel icon={Crosshair} label="GEOHUNT" count={geohunts.length} color={C.gold} />
            {geohunts.map((h, i) => <GeoHuntCard key={h.id} hunt={h} index={i} />)}
          </div>
        )}

        {/* Promo QRs */}
        {promoQrs.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <SectionLabel icon={Gift} label="PROMO QR" count={promoQrs.length} color={C.geo} />
            {promoQrs.map((p, i) => <PromoQrCard key={p.id} promo={p} index={i} />)}
          </div>
        )}

        {/* Business campaigns */}
        <SectionLabel
          icon={MapPin}
          label="NEARBY TARGETS"
          count={!loading ? displayed.length : null}
          color={C.t2}
        />

        {loading && (
          <div style={{ paddingTop: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="sk" style={{ height: 10, width: 18, borderRadius: 2 }} />
                <div style={{ flex: 1 }}>
                  <div className="sk" style={{ height: 12, width: '55%', borderRadius: 2, marginBottom: 6 }} />
                  <div className="sk" style={{ height: 9, width: '30%', borderRadius: 2 }} />
                </div>
                <div className="sk" style={{ height: 14, width: 40, borderRadius: 2 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
            <AlertCircle size={36} color={C.red} strokeWidth={1.5} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.7 }} />
            <div style={{ ...MONO, fontSize: 11, color: C.red, marginBottom: 16, letterSpacing: 1 }}>ОШИБКА ЗАГРУЗКИ</div>
            <button onClick={loadCampaigns} style={{
              background: 'transparent', border: `1px solid ${C.geoGl}`,
              color: C.geo, borderRadius: 4, padding: '8px 20px',
              fontFamily: "'Inter', sans-serif",
              fontSize: 10, letterSpacing: 1.5, cursor: 'pointer',
            }}>
              RETRY
            </button>
          </div>
        )}

        {!loading && !error && totalCampaigns === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
            <div style={{ ...MONO, fontSize: 10, color: C.t3, letterSpacing: 2 }}>NO TARGETS IN RANGE</div>
          </div>
        )}

        {!loading && !error && displayed.map((c, i) => (
          <CampaignCard key={c.id} campaign={c} onTap={setSelected} index={i} />
        ))}

        {/* How it works */}
        {!loading && !error && totalCampaigns > 0 && (
          <div style={{ marginTop: 20, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ ...MONO, fontSize: 8, color: C.t3, letterSpacing: 2, marginBottom: 12 }}>КАК ЭТО РАБОТАЕТ</div>
            {[
              [ScanLine, t('home.how.1')],
              [MapPin,   t('home.how.2')],
              [Wallet,   t('home.how.3')],
            ].map(([Icon, text], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ ...MONO, fontSize: 9, color: C.t3, width: 16, flexShrink: 0 }}>0{i + 1}</div>
                <Icon size={12} color={C.geo} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.t2 }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Legal */}
        <div style={{ display: 'flex', gap: 16, paddingTop: 16 }}>
          {[
            [t('home.terms'),   '/legal'],
            [t('home.privacy'), '/legal?tab=privacy'],
          ].map(([label, path]) => (
            <button key={path} onClick={() => navigate(path)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              ...MONO, fontSize: 9, color: C.t3, letterSpacing: 1, padding: '4px 0',
              WebkitTapHighlightColor: 'transparent',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {selected && (
        <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
