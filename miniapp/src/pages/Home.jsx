import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Compass, ScanLine, Wallet, Lock, ShoppingBag, Star, AlertCircle,
  Store, ChevronRight, Tv2, Crosshair, ExternalLink,
} from 'lucide-react';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { getGeoPos } from '../lib/geoPos';
import { C, E, cardBase, pressable } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BC = { fontFamily: "'Barlow Condensed', sans-serif" };

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
            <div style={{ ...BC, fontWeight: 700, fontSize: 22, color: C.t1, letterSpacing: -0.3 }}>
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
            <div style={{ ...BC, fontSize: 48, fontWeight: 800, letterSpacing: -1.5, color: C.geo, lineHeight: 1 }}>
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

// ── Business campaign card (location-based) ───────────────────────────────────
function CampaignCard({ campaign, onTap, index }) {
  const { t } = useLanguage();
  const [pressed, setPressed] = useState(false);
  const tp = TYPE.business;

  return (
    <div
      onClick={() => onTap(campaign)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        ...cardBase,
        padding: '14px 16px',
        marginBottom: 8,
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer',
        border: `0.5px solid ${tp.border}`,
        ...pressable(pressed),
        animation: `fadeUp 0.32s ${E.smooth} both`,
        animationDelay: `${index * 0.05}s`,
        userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        background: `linear-gradient(135deg, ${tp.glow} 0%, #161B24 50%)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
            {campaign.business_name}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {campaign.dist !== undefined && campaign.dist !== Infinity && (
              <span style={{ fontSize: 12, color: C.geo, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Compass size={11} color={C.geo} />
                {formatDistance(campaign.dist)}
              </span>
            )}
            {campaign.address && campaign.dist === undefined && (
              <span style={{ fontSize: 12, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                <MapPin size={11} color={C.t3} />
                {campaign.address}
              </span>
            )}
            {campaign.requires_pin && (
              <span style={{
                fontSize: 10, color: C.gold, fontWeight: 700,
                background: C.goldFt, borderRadius: 6, padding: '2px 6px',
                border: `0.5px solid rgba(245,166,35,0.20)`,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <Lock size={9} color={C.gold} /> PIN
              </span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            background: C.geoDim,
            border: `0.5px solid ${C.geoGl}`,
            color: C.geo, borderRadius: 12, padding: '8px 12px',
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            +{formatGeo(campaign.reward_amount)} GEO
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            {t('home.details')} <ChevronRight size={10} color={C.t3} />
          </div>
        </div>
      </div>

      {campaign.lat && campaign.lng && (
        <button
          onClick={e => { e.stopPropagation(); openMaps(campaign.lat, campaign.lng); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'transparent',
            border: `0.5px solid ${C.b2}`,
            borderRadius: 8, padding: '6px 10px',
            fontSize: 12, fontWeight: 600, color: C.t2,
            cursor: 'pointer', alignSelf: 'flex-start',
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
          }}
        >
          <ExternalLink size={11} color={C.t2} strokeWidth={2} />
          Открыть в картах
        </button>
      )}
    </div>
  );
}

// ── Platform promo card (channel subscription) ────────────────────────────────
function PlatformPromoCard({ promo, onTap, index }) {
  const [pressed, setPressed] = useState(false);
  const tp = TYPE.platform;

  return (
    <div
      onClick={() => onTap(promo)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        ...cardBase,
        padding: '14px 16px',
        marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer',
        border: `0.5px solid ${tp.border}`,
        background: `linear-gradient(135deg, ${tp.glow} 0%, #161B24 50%)`,
        ...pressable(pressed),
        animation: `fadeUp 0.32s ${E.smooth} both`,
        animationDelay: `${index * 0.05}s`,
        userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
          <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
            {promo.title}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: tp.badge.bg, color: tp.badge.color,
            borderRadius: 6, padding: '2px 7px',
            border: `0.5px solid ${tp.border}`,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Tv2 size={9} color={tp.badge.color} />
            {tp.badge.label}
          </span>
          <span style={{ fontSize: 12, color: C.t3 }}>{promo.channel_username}</span>
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{
          background: C.geoDim,
          border: `0.5px solid ${C.geoGl}`,
          color: C.geo, borderRadius: 12, padding: '8px 12px',
          fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          +{formatGeo(promo.reward_amount)} GEO
        </div>
        <div style={{ fontSize: 11, color: C.t3, marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
          Подписаться <ChevronRight size={10} color={C.t3} />
        </div>
      </div>
    </div>
  );
}

// ── GeoHunt card ──────────────────────────────────────────────────────────────
function GeoHuntCard({ hunt, index }) {
  const [pressed, setPressed] = useState(false);
  const tp = TYPE.geohunt;
  const remaining = hunt.total_codes - hunt.claimed_codes;

  return (
    <div
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        ...cardBase,
        padding: '14px 16px', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        border: `0.5px solid ${tp.border}`,
        background: `linear-gradient(135deg, ${tp.glow} 0%, #161B24 50%)`,
        ...pressable(pressed),
        animation: `fadeUp 0.32s ${E.smooth} both`,
        animationDelay: `${index * 0.05}s`,
        userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
          <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
            {hunt.title}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: tp.badge.bg, color: tp.badge.color,
            borderRadius: 6, padding: '2px 7px',
            border: `0.5px solid ${tp.border}`,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Crosshair size={9} color={tp.badge.color} />
            {tp.badge.label}
          </span>
          <span style={{ fontSize: 12, color: C.t3 }}>
            {remaining} / {hunt.total_codes} точек осталось
          </span>
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{
          background: C.goldFt, border: `0.5px solid ${C.goldGl}`,
          color: C.gold, borderRadius: 12, padding: '8px 12px',
          fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          +{hunt.reward_per_code} GEO
        </div>
        <div style={{ fontSize: 11, color: C.t3, marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
          Сканировать QR <ChevronRight size={10} color={C.t3} />
        </div>
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
  const [campaigns,    setCampaigns]    = useState([]);
  const [platformPromos, setPlatformPromos] = useState([]);
  const [geohunts,     setGeohunts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [promoLoading, setPromoLoading] = useState(true);
  const [error,        setError]        = useState('');
  const [selected,     setSelected]     = useState(null);
  const [userPos,      setUserPos]      = useState(null);

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

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.35s ease both' }}>
      {/* Hero */}
      <div style={{ padding: '44px 20px 28px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: 2, textTransform: 'uppercase' }}>
            GeoEarn
          </div>
          <LanguageSwitcher />
        </div>
        <div style={{ ...BC, fontSize: 28, fontWeight: 700, marginBottom: 8, lineHeight: 1.15, letterSpacing: -0.5, color: C.t1 }}>
          {t('home.title')}
        </div>
        <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.6, maxWidth: 280 }}>
          {t('home.subtitle')}
        </div>

        {userPos && !loading && displayed.length > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
            borderRadius: 20, padding: '5px 12px', marginTop: 20,
            fontSize: 12, color: C.geo, fontWeight: 600,
          }}>
            <Compass size={11} color={C.geo} />
            {t('home.sorted')}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '0.5px', background: C.b1, marginBottom: 8 }} />

      {/* Content */}
      <div style={{ padding: '12px 16px 32px' }}>

        {/* ── Platform promos section ── */}
        {(!promoLoading && platformPromos.length > 0) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tv2 size={11} color={C.green} strokeWidth={2} />
                <div style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  Акции GeoEarn
                </div>
              </div>
              <div style={{
                fontSize: 11, color: C.green, fontWeight: 700,
                background: C.greenFt, borderRadius: 8, padding: '3px 9px',
                border: `0.5px solid ${C.greenGl}`,
              }}>
                {platformPromos.length}
              </div>
            </div>
            {platformPromos.map((p, i) => (
              <PlatformPromoCard key={p.id} promo={p} onTap={handlePlatformTap} index={i} />
            ))}
          </div>
        )}

        {/* ── GeoHunt section ── */}
        {geohunts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crosshair size={11} color={C.gold} strokeWidth={2} />
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  GeoHunt
                </div>
              </div>
              <div style={{
                fontSize: 11, color: C.gold, fontWeight: 700,
                background: C.goldFt, borderRadius: 8, padding: '3px 9px',
                border: `0.5px solid ${C.goldGl}`,
              }}>
                {geohunts.length}
              </div>
            </div>
            {geohunts.map((h, i) => (
              <GeoHuntCard key={h.id} hunt={h} index={i} />
            ))}
          </div>
        )}

        {/* ── Business campaigns section ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={11} color={C.t3} strokeWidth={2} />
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {t('home.campaigns')}
            </div>
          </div>
          {!loading && displayed.length > 0 && (
            <div style={{
              fontSize: 11, color: C.geo, fontWeight: 700,
              background: C.geoDim, borderRadius: 8, padding: '3px 9px',
              border: `0.5px solid ${C.geoGl}`,
            }}>
              {displayed.length}
            </div>
          )}
        </div>

        {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

        {!loading && error && (
          <div style={{ textAlign: 'center', paddingTop: 56 }}>
            <AlertCircle size={48} color={C.red} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: C.red, marginBottom: 6 }}>{t('home.error.title')}</div>
            <div style={{ color: C.t3, fontSize: 14, marginBottom: 20 }}>{error}</div>
            <button onClick={loadCampaigns} style={{
              background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
              color: C.geo, borderRadius: 12, padding: '11px 28px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              {t('home.error.retry')}
            </button>
          </div>
        )}

        {!loading && !error && displayed.length === 0 && platformPromos.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 56, paddingBottom: 24 }}>
            <Store size={52} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.25 }} />
            <div style={{ ...BC, fontWeight: 700, fontSize: 18, marginBottom: 8, color: C.t1 }}>{t('home.empty.title')}</div>
            <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.65 }}>
              {t('home.empty.text').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
            </div>
          </div>
        )}

        {!loading && !error && displayed.length === 0 && platformPromos.length > 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <div style={{ color: C.t3, fontSize: 13 }}>Бизнес-кампаний рядом нет</div>
          </div>
        )}

        {!loading && !error && displayed.map((c, i) => (
          <CampaignCard key={c.id} campaign={c} onTap={setSelected} index={i} />
        ))}

        {!loading && !error && (displayed.length > 0 || platformPromos.length > 0) && (
          <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '16px', marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 12, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('home.how.title')}
            </div>
            {[
              [ScanLine, t('home.how.1')],
              [MapPin,   t('home.how.2')],
              [Wallet,   t('home.how.3')],
            ].map(([Icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color={C.geo} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 14, color: C.t2 }}>{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />
      )}

      {/* Legal footer */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 20,
        padding: '20px 24px 8px',
      }}>
        <button
          onClick={() => navigate('/legal')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: C.t3, padding: '4px 0',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t('home.terms')}
        </button>
        <button
          onClick={() => navigate('/legal?tab=privacy')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: C.t3, padding: '4px 0',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t('home.privacy')}
        </button>
      </div>
    </div>
  );
}
