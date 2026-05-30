import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Compass, ScanLine, Wallet, Lock, ShoppingBag, Star, AlertCircle,
  Store, Tv2, Crosshair, ExternalLink, Gift, RefreshCw, ChevronRight,
} from 'lucide-react';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { getGeoPos } from '../lib/geoPos';
import { C, E, cardBase, pressable } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import { parseTaskDesc } from '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

const RYE = { fontFamily: "'Rye', serif" };

const TASK_ICONS = { visit: MapPin, purchase: ShoppingBag, review: Star };

// ── Promo QR rarity ────────────────────────────────────────────────────────────
const PROMO_RARITY = {
  common:    { label: 'COMMON',    color: '#9CA3AF' },
  rare:      { label: 'RARE',      color: '#60A5FA' },
  epic:      { label: 'EPIC',      color: '#C084FC' },
  legendary: { label: 'LEGENDARY', color: C.gold     },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="sk" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="sk" style={{ height: 13, width: '55%', borderRadius: 6, marginBottom: 7 }} />
        <div className="sk" style={{ height: 10, width: '32%', borderRadius: 5 }} />
      </div>
      <div className="sk" style={{ height: 20, width: 52, borderRadius: 6 }} />
    </div>
  );
}

// ── Campaign detail sheet ──────────────────────────────────────────────────────
function CampaignSheet({ campaign, userPos, onClose }) {
  const { t, lang } = useLanguage();
  const dist = userPos && campaign.lat && campaign.lng
    ? haversineMeters(userPos, { lat: +campaign.lat, lng: +campaign.lng }) : null;
  const TaskIcon = TASK_ICONS[campaign.task_type] || MapPin;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        zIndex: 200, animation: 'backdropIn 0.22s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: '0.5px solid rgba(255,255,255,0.08)', borderBottom: 'none',
        padding: '0 0 44px', zIndex: 201, maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275)',
      }}>
        <div style={{ width: 32, height: 3, borderRadius: 2, background: C.b2, margin: '14px auto 22px' }} />
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: C.t1, letterSpacing: -0.3, marginBottom: 4 }}>
            {campaign.business_name}
          </div>
          {campaign.address && (
            <div style={{ fontSize: 13, color: C.t3, marginBottom: dist !== null ? 4 : 16, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} color={C.t3} /><span>{campaign.address}</span>
            </div>
          )}
          {dist !== null && (
            <div style={{ fontSize: 13, color: C.geo, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Compass size={12} color={C.geo} />{formatDistance(dist)} {t('home.from_you')}
            </div>
          )}
          <div style={{ background: C.geoDim, border: `0.5px solid ${C.geoGl}`, borderRadius: 20, padding: '20px', textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.t3, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{t('home.reward')}</div>
            <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.5, color: C.geo, lineHeight: 1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 18, fontWeight: 700, color: C.t2, marginLeft: 8 }}>GEO</span>
            </div>
          </div>
          <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{t('home.task_type')}</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.t1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TaskIcon size={15} color={C.geo} strokeWidth={2} />
              {t(`task.${campaign.task_type}`) || t('task.visit')}
            </div>
            {campaign.task_description && (
              <div style={{ fontSize: 14, color: C.t2, lineHeight: 1.55, marginTop: 6 }}>
                {parseTaskDesc(campaign.task_description, lang)}
              </div>
            )}
          </div>
          {campaign.requires_pin && (
            <div style={{ background: C.goldFt, border: '0.5px solid rgba(245,166,35,0.20)', borderRadius: 14, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Lock size={16} color={C.gold} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.gold, marginBottom: 2 }}>{t('home.pin_required')}</div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.4 }}>{t('home.pin_hint')}</div>
              </div>
            </div>
          )}
          <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>{t('home.how.title')}</div>
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
            <button onClick={() => openMaps(campaign.lat, campaign.lng)} style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: C.geoDim, border: `0.5px solid ${C.geoGl}`, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, color: C.geo, cursor: 'pointer' }}>
              <ExternalLink size={16} color={C.geo} strokeWidth={2} />
              Открыть в Google Картах
            </button>
          )}
          <button onClick={onClose} style={{ width: '100%', background: C.card, border: `0.5px solid ${C.b2}`, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 600, color: C.t2, cursor: 'pointer' }}>
            {t('home.close')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, count, color = C.t3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '18px 0 10px' }}>
      <div style={{ width: 3, height: 13, background: color, borderRadius: 2, flexShrink: 0 }} />
      {Icon && <Icon size={12} color={color} strokeWidth={2.5} />}
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }}>{label}</span>
      {count != null && (
        <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}28`, borderRadius: 8, padding: '2px 8px' }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── Featured card (GeoHunt / Platform promo / Promo QR) ───────────────────────
function FeaturedCard({ iconColor, iconBg, iconBorder, Icon, title, subtitle, rewardAmount, rewardLabel = 'GEO', rewardColor, badge, onTap, index }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onTap}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: C.card, borderRadius: 18,
        border: `1px solid ${iconBorder}`,
        padding: '14px 16px',
        marginBottom: 8, cursor: onTap ? 'pointer' : 'default',
        ...pressable(pressed),
        animation: `fadeUp 0.28s ${E.smooth} both`,
        animationDelay: `${index * 0.05}s`,
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: iconBg, border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={iconColor} strokeWidth={1.75} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge && (
            <span style={{ fontSize: 9, fontWeight: 700, color: iconColor, background: iconBg, border: `1px solid ${iconBorder}`, borderRadius: 5, padding: '2px 6px', letterSpacing: 0.5 }}>
              {badge}
            </span>
          )}
          <span style={{ fontSize: 12, color: C.t3 }}>{subtitle}</span>
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: rewardColor || iconColor, lineHeight: 1 }}>
          +{formatGeo(rewardAmount)}
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>{rewardLabel}</div>
      </div>
    </div>
  );
}

// ── Business campaign row ─────────────────────────────────────────────────────
function CampaignRow({ campaign, onTap, index }) {
  const [pressed, setPressed] = useState(false);
  const TaskIcon = TASK_ICONS[campaign.task_type] || MapPin;

  return (
    <div
      onClick={() => onTap(campaign)}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer', ...pressable(pressed),
        animation: `fadeUp 0.26s ${E.smooth} both`,
        animationDelay: `${index * 0.04}s`,
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: C.geoDim, border: `1px solid ${C.geoGl}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TaskIcon size={16} color={C.geo} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
          {campaign.business_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {campaign.dist !== undefined && campaign.dist !== Infinity && (
            <span style={{ fontSize: 12, color: C.t2 }}>{formatDistance(campaign.dist)}</span>
          )}
          {campaign.requires_pin && (
            <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, background: C.goldFt, borderRadius: 5, padding: '1px 6px', border: `1px solid ${C.goldGl}` }}>PIN</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.geo }}>+{formatGeo(campaign.reward_amount)}</div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>GEO</div>
      </div>
    </div>
  );
}

function openMaps(lat, lng) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
  else window.open(url, '_blank');
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
      .then(d => setGeohunts(d.hunts || [])).catch(() => {});
  }, []);
  useEffect(() => {
    fetch(`${API_BASE}/api/promos/active`)
      .then(r => r.ok ? r.json() : { promos: [] })
      .then(d => setPromoQrs(d.promos || [])).catch(() => {});
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

  const hasContent = displayed.length + platformPromos.length + geohunts.length + promoQrs.length > 0;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.3s ease both' }}>

      {/* ── Hero ── */}
      <div style={{ padding: '16px 16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ ...RYE, fontSize: 34, lineHeight: 1.05, color: C.t1 }}>
              {t('home.title').split(' ').slice(0, -1).join(' ') || 'Зарабатывайте'}
            </div>
            <div style={{ ...RYE, fontSize: 34, lineHeight: 1.05, color: C.geo }}>GEO.</div>
          </div>
          <LanguageSwitcher />
        </div>

        <div style={{ fontSize: 14, color: C.t2, lineHeight: 1.6, marginBottom: 18, maxWidth: 300 }}>
          {t('home.subtitle')}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => getGeoPos().then(p => setUserPos(p)).catch(() => {})}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: C.geo, color: C.bg, border: 'none', borderRadius: 14, padding: '14px 0',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(201,123,71,0.32)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Compass size={15} strokeWidth={2.25} />
            По расстоянию
          </button>
          <button
            onClick={() => navigate('/map')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: C.tealDim, color: C.teal,
              border: `1px solid ${C.tealGl}`, borderRadius: 14, padding: '14px 0',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <MapPin size={15} strokeWidth={2.25} />
            Карта
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '0 16px 40px' }}>

        {/* Platform promos */}
        {!promoLoading && platformPromos.length > 0 && (
          <div>
            <SectionHeader icon={Tv2} label="Акции GeoEarn" count={platformPromos.length} color={C.green} />
            {platformPromos.map((p, i) => (
              <FeaturedCard
                key={p.id} index={i}
                Icon={Tv2} iconColor={C.green} iconBg={C.greenFt} iconBorder={C.greenGl}
                title={p.title}
                subtitle={p.channel_username || 'Акция платформы'}
                badge="PLATFORM"
                rewardAmount={p.reward_amount}
                onTap={() => navigate(`/channel-reward?token=${encodeURIComponent(p.token || p.id)}`)}
              />
            ))}
          </div>
        )}

        {/* GeoHunts */}
        {geohunts.length > 0 && (
          <div>
            <SectionHeader icon={Crosshair} label="GeoHunt" count={geohunts.length} color={C.gold} />
            {geohunts.map((h, i) => {
              const remaining = h.total_codes - h.claimed_codes;
              return (
                <FeaturedCard
                  key={h.id} index={i}
                  Icon={Crosshair} iconColor={C.gold} iconBg={C.goldFt} iconBorder={C.goldGl}
                  title={h.title}
                  subtitle={`${remaining}/${h.total_codes} осталось`}
                  badge="GEOHUNT"
                  rewardAmount={h.reward_per_code}
                  rewardLabel="GEO/шт"
                />
              );
            })}
          </div>
        )}

        {/* Promo QRs */}
        {promoQrs.length > 0 && (
          <div>
            <SectionHeader icon={Gift} label="Promo QR" count={promoQrs.length} color={C.geo} />
            {promoQrs.map((p, i) => {
              const rr = PROMO_RARITY[p.rarity] || PROMO_RARITY.common;
              const remaining = p.max_claims - p.claims_count;
              return (
                <FeaturedCard
                  key={p.id} index={i}
                  Icon={Gift} iconColor={rr.color} iconBg={`${rr.color}18`} iconBorder={`${rr.color}30`}
                  title={p.title}
                  subtitle={remaining > 0 ? `${remaining} доступно` : 'Закончилось'}
                  badge={rr.label}
                  rewardAmount={p.reward_amount}
                  rewardColor={rr.color}
                />
              );
            })}
          </div>
        )}

        {/* Business campaigns */}
        <SectionHeader
          icon={MapPin}
          label="Рядом с вами"
          count={!loading ? displayed.length : null}
          color={C.t2}
        />

        {loading && (
          <div>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
            <AlertCircle size={32} color={C.red} strokeWidth={1.5} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.7 }} />
            <div style={{ fontSize: 13, color: C.t2, marginBottom: 16 }}>Не удалось загрузить кампании</div>
            <button onClick={loadCampaigns} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
              color: C.geo, borderRadius: 10, padding: '9px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <RefreshCw size={14} strokeWidth={2} />
              Повторить
            </button>
          </div>
        )}

        {!loading && !error && displayed.length === 0 && !hasContent && (
          <div style={{ textAlign: 'center', padding: '36px 0 20px' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: C.geoDim, border: `1px solid ${C.geoGl}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <MapPin size={24} color={C.geo} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.t2, marginBottom: 6 }}>Кампаний пока нет</div>
            <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.5 }}>Заведения появятся, когда партнёры добавят их</div>
          </div>
        )}

        {!loading && !error && displayed.map((c, i) => (
          <CampaignRow key={c.id} campaign={c} onTap={setSelected} index={i} />
        ))}

        {/* How it works — shown only when there's no content yet */}
        {!loading && !error && !hasContent && (
          <div style={{ marginTop: 28, padding: '20px', background: C.card, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 }}>Как это работает</div>
            {[
              [ScanLine, t('home.how.1')],
              [MapPin,   t('home.how.2')],
              [Wallet,   t('home.how.3')],
            ].map(([Icon, text], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 14 : 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: C.geoDim, border: `1px solid ${C.geoGl}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={C.geo} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Legal */}
        <div style={{ display: 'flex', gap: 16, paddingTop: 24 }}>
          {[
            [t('home.terms'),   '/legal'],
            [t('home.privacy'), '/legal?tab=privacy'],
          ].map(([label, path]) => (
            <button key={path} onClick={() => navigate(path)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: C.t3, padding: '4px 0',
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
