import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin, Wallet, Lock, Store, CheckCircle, AlertTriangle, Loader2,
  RefreshCw, Zap, Copy, Calendar, StopCircle, ShoppingBag, Star,
  BarChart2, Megaphone, CreditCard, Download, TrendingUp, TrendingDown,
  Users, Clock, AlertCircle, QrCode,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatGeo } from '../lib/geo';
import { C, G, E, cardBase, inputStyle } from '../lib/design';

// ─── Constants ───────────────────────────────────────────────────────────────

const TASK_META = {
  visit:    { label: 'Визит',   Icon: MapPin      },
  purchase: { label: 'Покупка', Icon: ShoppingBag },
  review:   { label: 'Отзыв',  Icon: Star        },
};


const TOPUP_STATUS = {
  pending:   { label: 'Ожидает',  color: C.orange },
  confirmed: { label: 'Зачислено', color: C.geo   },
  rejected:  { label: 'Отклонено', color: C.red   },
};

const TABS = [
  { key: 'overview',   label: 'Обзор',       Icon: BarChart2  },
  { key: 'campaigns',  label: 'Кампании',    Icon: Megaphone  },
  { key: 'topup',      label: 'Пополнение',  Icon: CreditCard },
  { key: 'qr',         label: 'QR',          Icon: QrCode     },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_FEE = 0.05; // 5% комиссия платформы

function calcCampaign(budget, visits) {
  if (!budget || !visits || visits < 1) return { reward: 0, commission: 0, totalCost: 0 };
  const reward     = Math.floor(budget / visits);
  const rewardsSum = reward * visits;
  const commission = Math.max(Math.ceil(rewardsSum * PLATFORM_FEE), rewardsSum > 0 ? 1 : 0);
  return { reward, rewardsSum, commission, totalCost: rewardsSum + commission };
}

function formatUZS(amount) {
  return amount.toLocaleString('ru-RU') + ' сум';
}

function pctDelta(curr, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: C.t3,
  textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7,
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Skel({ h = 20, w = '100%', r = 8 }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r }} />;
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      width: 44, height: 26, borderRadius: 13,
      background: on ? C.geo : C.b2,
      transition: 'background 0.2s',
      position: 'relative', cursor: 'pointer', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        transition: `left 0.2s ${E.spring}`,
      }} />
    </div>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: C.b1, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${Math.min(100, pct)}%`,
        background: color || G.geo,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, subUp, Icon, color, loading }) {
  return (
    <div style={{
      flex: 1, ...cardBase,
      border: `1px solid ${C.b0}`,
      padding: '14px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.3 }}>
          {label}
        </div>
        {Icon && <Icon size={14} color={color || C.t3} strokeWidth={2} style={{ opacity: 0.7 }} />}
      </div>
      {loading
        ? <Skel h={26} r={6} />
        : <div style={{ fontSize: 24, fontWeight: 900, color: color || C.t1, letterSpacing: -0.5 }}>{value}</div>
      }
      {sub !== undefined && !loading && (
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: subUp === true ? C.geo : subUp === false ? C.red : C.t3,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {subUp === true && <TrendingUp size={10} color={C.geo} />}
          {subUp === false && <TrendingDown size={10} color={C.red} />}
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── CampaignCard ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign, business, webappUrl, onStop, stopping, onOpenDetail }) {
  const isActive   = campaign.active;
  const remaining  = campaign.max_visits - campaign.visits_count;
  const exhausted  = remaining <= 0;
  const pct        = campaign.max_visits > 0 ? (campaign.visits_count / campaign.max_visits) * 100 : 0;
  const meta       = TASK_META[campaign.task_type] || TASK_META.visit;

  const statusLabel = isActive ? 'Активна' : exhausted ? 'Завершена' : 'Остановлена';
  const statusColor = isActive ? C.geo : C.t3;

  const endsDate = campaign.ends_at
    ? new Date(campaign.ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div style={{
      ...cardBase,
      border: `1px solid ${isActive ? C.geoGl : C.b0}`,
      padding: '16px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {isActive && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: C.geo, boxShadow: `0 0 6px ${C.geo}`,
              display: 'inline-block',
            }} />
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {statusLabel}
          </span>
          <span style={{
            fontSize: 11, color: C.t3, fontWeight: 600,
            background: C.card, borderRadius: 6, padding: '2px 7px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <meta.Icon size={10} color={C.t3} strokeWidth={2} />
            {meta.label}
          </span>
        </div>
        {isActive && (
          <button
            onClick={() => onStop(campaign.id)}
            disabled={stopping === campaign.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: C.redFt, border: `1px solid rgba(255,59,92,0.2)`,
              borderRadius: 10, padding: '6px 11px',
              fontSize: 12, fontWeight: 700, color: C.red,
              cursor: stopping === campaign.id ? 'not-allowed' : 'pointer',
              opacity: stopping === campaign.id ? 0.6 : 1,
            }}>
            {stopping === campaign.id
              ? <Loader2 size={12} color={C.red} style={{ animation: 'spin 1s linear infinite' }} />
              : <StopCircle size={12} color={C.red} strokeWidth={2} />
            }
            Стоп
          </button>
        )}
      </div>

      {/* Reward */}
      <div style={{ fontSize: 20, fontWeight: 900, color: isActive ? C.geo : C.t2, marginBottom: 10, letterSpacing: -0.4 }}>
        +{formatGeo(campaign.reward_amount)}
        <span style={{ fontSize: 13, fontWeight: 600, color: C.t3, marginLeft: 6 }}>GEO / задание</span>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t3, marginBottom: 5 }}>
          <span>{campaign.visits_count} из {campaign.max_visits} активаций</span>
          {isActive && !exhausted && (
            <span style={{ color: C.geo, fontWeight: 700 }}>{remaining} осталось</span>
          )}
          {exhausted && <span style={{ color: C.t3 }}>Лимит исчерпан</span>}
        </div>
        <ProgressBar pct={pct} color={isActive && !exhausted ? G.geo : C.b2} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {endsDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: isActive ? C.orange : C.t3 }}>
              <Clock size={11} color={isActive ? C.orange : C.t3} />
              до {endsDate}
            </div>
          )}
          {campaign.requires_pin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.gold }}>
              <Lock size={11} color={C.gold} />
              PIN
            </div>
          )}
        </div>
        <button
          onClick={() => onOpenDetail && onOpenDetail(campaign)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: C.card, border: `1px solid ${C.b1}`,
            borderRadius: 8, padding: '6px 12px',
            fontSize: 12, fontWeight: 700, color: C.purpleL,
            cursor: 'pointer',
          }}>
          <QrCode size={12} color={C.purpleL} strokeWidth={2} />
          Карточка
        </button>
      </div>
    </div>
  );
}

// ─── CampaignDetailModal ──────────────────────────────────────────────────────

function CampaignDetailModal({ campaign, business, webappUrl, onClose, onStop, stopping, onEdit, onSaved }) {
  const [dlLoading, setDlLoading] = useState(false);
  const [qrLoaded,  setQrLoaded]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [showEdit,  setShowEdit]  = useState(false);

  const isActive  = campaign.active;
  const pct       = campaign.max_visits > 0 ? (campaign.visits_count / campaign.max_visits) * 100 : 0;
  const remaining = campaign.max_visits - campaign.visits_count;
  const exhausted = remaining <= 0;
  const meta      = TASK_META[campaign.task_type] || TASK_META.visit;

  const statusLabel = isActive ? 'Активна' : exhausted ? 'Завершена' : 'Остановлена';
  const statusColor = isActive ? C.geo : C.t3;

  const endsDate = campaign.ends_at
    ? new Date(campaign.ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const createdDate = campaign.created_at
    ? new Date(campaign.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Campaign-specific QR (falls back to business token for old campaigns without their own token)
  const checkinToken = campaign.qr_token || business?.qr_token;
  const checkinUrl   = checkinToken ? `${webappUrl}/checkin?token=${encodeURIComponent(checkinToken)}` : null;
  const qrImageUrl   = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=3&bgcolor=FFFFFF&color=000000&data=${encodeURIComponent(checkinUrl)}`
    : null;

  function copyLink() {
    if (!checkinUrl) return;
    navigator.clipboard?.writeText(checkinUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const [dlSent, setDlSent] = useState(false);

  async function sendQR() {
    if (!checkinUrl) return;
    setDlLoading(true);
    try {
      const r = await apiFetch('/api/send-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: checkinUrl,
          caption: `🏪 *${business?.name || 'Заведение'}*\nQR-код кампании`,
        }),
      });
      if (r.ok) { setDlSent(true); setTimeout(() => setDlSent(false), 3000); }
    } catch { /* silent */ } finally {
      setDlLoading(false);
    }
  }

  if (showEdit) {
    return (
      <CampaignEditModal
        campaign={campaign}
        balance={business?.balance || 0}
        onClose={() => setShowEdit(false)}
        onSaved={() => { setShowEdit(false); onSaved && onSaved(); onClose(); }}
      />
    );
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        zIndex: 200, animation: 'backdropIn 0.25s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: C.surf, borderRadius: '28px 28px 0 0',
        border: `1px solid ${C.b1}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto',
        maxHeight: '92vh', overflowY: 'auto',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 0' }} />

        <div style={{ padding: '20px 20px 48px' }}>
          {/* Status + title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isActive && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: C.geo, boxShadow: `0 0 6px ${C.geo}`, display: 'inline-block',
                }} />
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {statusLabel}
              </span>
              <span style={{
                fontSize: 11, color: C.t3, fontWeight: 600,
                background: C.card, borderRadius: 6, padding: '2px 8px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <meta.Icon size={10} color={C.t3} strokeWidth={2} />
                {meta.label}
              </span>
            </div>
            {createdDate && (
              <span style={{ fontSize: 11, color: C.t3 }}>{createdDate}</span>
            )}
          </div>

          {/* Reward */}
          <div style={{ fontSize: 38, fontWeight: 900, color: isActive ? C.geo : C.t2, letterSpacing: -1.5, marginBottom: 4 }}>
            +{formatGeo(campaign.reward_amount)}
            <span style={{ fontSize: 16, fontWeight: 600, color: C.t3, marginLeft: 8 }}>GEO / задание</span>
          </div>

          {campaign.task_description && (
            <div style={{ fontSize: 14, color: C.t2, lineHeight: 1.5, marginBottom: 16 }}>
              {campaign.task_description}
            </div>
          )}

          {/* Progress */}
          <div style={{
            ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.t3, marginBottom: 8 }}>
              <span>Активации</span>
              <span style={{ fontWeight: 700, color: isActive && !exhausted ? C.geo : C.t2 }}>
                {campaign.visits_count} / {campaign.max_visits}
              </span>
            </div>
            <ProgressBar pct={pct} color={isActive && !exhausted ? G.geo : C.b2} />
            {isActive && !exhausted && (
              <div style={{ fontSize: 12, color: C.t3, marginTop: 8, textAlign: 'right' }}>
                Осталось: <strong style={{ color: C.geo }}>{remaining}</strong>
              </div>
            )}
          </div>

          {/* Info pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {endsDate && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: C.card, border: `1px solid ${C.b1}`,
                borderRadius: 10, padding: '7px 12px',
                fontSize: 12, fontWeight: 600, color: isActive ? C.orange : C.t3,
              }}>
                <Clock size={12} color={isActive ? C.orange : C.t3} strokeWidth={2} />
                до {endsDate}
              </div>
            )}
            {campaign.requires_pin && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: C.goldFt, border: `1px solid ${C.goldGl}`,
                borderRadius: 10, padding: '7px 12px',
                fontSize: 12, fontWeight: 600, color: C.gold,
              }}>
                <Lock size={12} color={C.gold} strokeWidth={2} />
                Требует PIN
              </div>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: C.card, border: `1px solid ${C.b1}`,
              borderRadius: 10, padding: '7px 12px',
              fontSize: 12, fontWeight: 600, color: C.t3,
            }}>
              <Wallet size={12} color={C.t3} strokeWidth={2} />
              Бюджет: {formatGeo(campaign.budget)} GEO
            </div>
          </div>

          {/* QR code */}
          {qrImageUrl && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
                QR-код кампании
              </div>
              <div style={{
                background: C.card, border: `1px solid ${C.b1}`,
                borderRadius: 20, padding: '20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: 14,
              }}>
                <div style={{
                  width: 200, height: 200,
                  background: '#fff', borderRadius: 16, padding: 12,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  marginBottom: 16, position: 'relative', overflow: 'hidden',
                }}>
                  {!qrLoaded && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 16,
                      background: 'rgba(255,255,255,0.95)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Loader2 size={24} color={C.t3} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                  <img
                    src={qrImageUrl}
                    alt={`QR кампании ${campaign.id}`}
                    onLoad={() => setQrLoaded(true)}
                    style={{ width: '100%', height: '100%', borderRadius: 8, display: 'block' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button onClick={sendQR} disabled={dlLoading} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: dlSent ? C.geoFt : C.blue, color: dlSent ? C.geo : '#fff',
                    border: dlSent ? `1px solid ${C.geoGl}` : 'none',
                    borderRadius: 12, padding: '11px',
                    fontSize: 13, fontWeight: 700,
                    cursor: dlLoading ? 'not-allowed' : 'pointer',
                    opacity: dlLoading ? 0.7 : 1,
                    transition: 'all 0.2s',
                    boxShadow: dlSent ? 'none' : `0 4px 14px ${C.blueGl}`,
                  }}>
                    {dlLoading
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : dlSent
                        ? <CheckCircle size={14} color={C.geo} strokeWidth={2} />
                        : <Send size={14} strokeWidth={2} />
                    }
                    {dlSent ? 'Отправлено' : 'В Telegram'}
                  </button>
                  <button onClick={copyLink} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: copied ? C.geoFt : C.card,
                    color: copied ? C.geo : C.t2,
                    border: `1px solid ${copied ? C.geoGl : C.b1}`,
                    borderRadius: 12, padding: '11px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>
                    {copied
                      ? <CheckCircle size={14} color={C.geo} strokeWidth={2} />
                      : <Copy size={14} strokeWidth={2} />
                    }
                    {copied ? 'Скопировано' : 'Ссылка'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowEdit(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: C.card, border: `1px solid ${C.b1}`,
              borderRadius: 14, padding: '14px',
              fontSize: 14, fontWeight: 700, color: C.t2, cursor: 'pointer',
            }}>
              <RefreshCw size={15} color={C.t2} strokeWidth={2} />
              Изменить
            </button>
            {isActive && (
              <button
                onClick={() => { onStop(campaign.id); onClose(); }}
                disabled={stopping === campaign.id}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: C.redFt, border: `1px solid rgba(255,59,92,0.2)`,
                  borderRadius: 14, padding: '14px',
                  fontSize: 14, fontWeight: 700, color: C.red,
                  cursor: stopping === campaign.id ? 'not-allowed' : 'pointer',
                  opacity: stopping === campaign.id ? 0.6 : 1,
                }}>
                {stopping === campaign.id
                  ? <Loader2 size={15} color={C.red} style={{ animation: 'spin 1s linear infinite' }} />
                  : <StopCircle size={15} color={C.red} strokeWidth={2} />
                }
                Остановить
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CampaignEditModal ────────────────────────────────────────────────────────

function CampaignEditModal({ campaign, balance, onClose, onSaved }) {
  const [addVisits, setAddVisits] = useState('');
  const [endsAt,    setEndsAt]    = useState(
    campaign.ends_at ? new Date(campaign.ends_at).toISOString().split('T')[0] : ''
  );
  const [noEnd,    setNoEnd]     = useState(!campaign.ends_at);
  const [loading,  setLoading]   = useState(false);
  const [error,    setError]     = useState('');
  const [fAdd,     setFAdd]      = useState(false);

  const addNum    = parseInt(addVisits, 10) || 0;
  const extraCost = addNum * campaign.reward_amount;
  const canAfford = extraCost <= balance;
  const today     = new Date().toISOString().split('T')[0];

  const hasChanges = addNum > 0 || (noEnd !== !campaign.ends_at) || (endsAt && endsAt !== (campaign.ends_at ? new Date(campaign.ends_at).toISOString().split('T')[0] : ''));

  async function handleSave() {
    if (!hasChanges) return;
    setLoading(true); setError('');
    try {
      const body = {};
      if (addNum > 0) body.additional_visits = addNum;
      if (noEnd) body.ends_at = null;
      else if (endsAt) body.ends_at = new Date(endsAt + 'T23:59:59').toISOString();
      const r = await apiFetch(`/api/admin/campaign/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error === 'INSUFFICIENT_BALANCE' ? 'Недостаточно GEO на балансе.' : 'Ошибка сохранения.');
        return;
      }
      onSaved();
    } finally { setLoading(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        zIndex: 200, animation: 'backdropIn 0.25s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: C.surf, borderRadius: '28px 28px 0 0',
        border: `1px solid ${C.b1}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto',
        maxHeight: '85vh', overflowY: 'auto',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 0' }} />
        <div style={{ padding: '20px 22px 48px' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4, color: C.t1 }}>Редактировать кампанию</div>
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 24 }}>
            +{formatGeo(campaign.reward_amount)} GEO / задание · {campaign.visits_count}/{campaign.max_visits} активаций
          </div>

          {/* Extend activations */}
          <div style={{ marginBottom: 18 }}>
            <div style={labelStyle}>Добавить активации</div>
            <input
              value={addVisits}
              onChange={e => setAddVisits(e.target.value.replace(/\D/g, ''))}
              placeholder="Например: 50"
              inputMode="numeric"
              onFocus={() => setFAdd(true)} onBlur={() => setFAdd(false)}
              style={inputStyle(fAdd)}
            />
            {addNum > 0 && (
              <div style={{
                marginTop: 8, padding: '10px 14px', borderRadius: 12,
                background: canAfford ? C.geoFt : C.redFt,
                border: `1px solid ${canAfford ? C.geoGl : 'rgba(255,59,92,0.25)'}`,
                fontSize: 13, color: canAfford ? C.geo : C.red, fontWeight: 700,
              }}>
                Стоимость: {formatGeo(extraCost)} GEO
                {!canAfford && ' — недостаточно баланса'}
              </div>
            )}
          </div>

          {/* Ends at */}
          <div style={{ marginBottom: 22 }}>
            <div style={labelStyle}>Дата окончания</div>
            <div onClick={() => setNoEnd(v => !v)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: C.card, border: `1px solid ${C.b0}`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 10, cursor: 'pointer',
            }}>
              <span style={{ fontSize: 14, color: C.t2 }}>Без ограничения</span>
              <Toggle on={noEnd} onToggle={() => setNoEnd(v => !v)} />
            </div>
            {!noEnd && (
              <input type="date" value={endsAt} min={today}
                onChange={e => setEndsAt(e.target.value)}
                style={{ ...inputStyle(false), colorScheme: 'dark', cursor: 'pointer' }} />
            )}
          </div>

          {error && (
            <div style={{
              background: C.redFt, color: C.red, borderRadius: 12,
              padding: '10px 14px', fontSize: 14, fontWeight: 600,
              marginBottom: 16, border: `1px solid rgba(255,59,92,0.2)`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={15} color={C.red} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!hasChanges || loading || (addNum > 0 && !canAfford)}
            style={{
              width: '100%',
              background: hasChanges && !(addNum > 0 && !canAfford) && !loading ? G.blue : C.b2,
              color: hasChanges && !(addNum > 0 && !canAfford) && !loading ? '#fff' : C.t3,
              border: 'none', borderRadius: 16, padding: '17px',
              fontSize: 16, fontWeight: 700,
              cursor: hasChanges && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading
              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Сохраняем...</>
              : 'Сохранить изменения'
            }
          </button>
        </div>
      </div>
    </>
  );
}

// ─── CampaignForm ─────────────────────────────────────────────────────────────

function CampaignForm({ balance, onClose, onCreated }) {
  const [budget,      setBudget]      = useState('');
  const [visits,      setVisits]      = useState('');
  const [taskType,    setTaskType]    = useState('visit');
  const [desc,        setDesc]        = useState('');
  const [endsAt,      setEndsAt]      = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [fBudget, setFBudget] = useState(false);
  const [fVisits, setFVisits] = useState(false);
  const [fDesc,   setFDesc]   = useState(false);

  const budgetNum = parseInt(budget, 10) || 0;
  const visitsNum = parseInt(visits, 10) || 0;
  const { reward, rewardsSum, commission, totalCost } = calcCampaign(budgetNum, visitsNum);
  const canSubmit = budgetNum >= 1000 && visitsNum >= 1 && reward >= 1 && totalCost <= balance;
  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const r = await apiFetch('/api/admin/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: budgetNum, max_visits: visitsNum,
          task_type: taskType, task_description: desc || null,
          requires_pin: requiresPin,
          ends_at: endsAt ? new Date(endsAt + 'T23:59:59').toISOString() : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        const msgs = {
          INSUFFICIENT_BALANCE: 'Недостаточно GEO на балансе заведения.',
          REWARD_TOO_LOW: 'Увеличьте бюджет или уменьшите активации.',
        };
        setError(msgs[d.error] || 'Ошибка создания кампании.');
        return;
      }
      onCreated();
    } finally { setLoading(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        zIndex: 200, animation: 'backdropIn 0.25s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: C.surf, borderRadius: '28px 28px 0 0',
        border: `1px solid ${C.b1}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto',
        maxHeight: '92vh', overflowY: 'auto',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 0' }} />
        <div style={{ padding: '20px 22px 48px' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4, color: C.t1 }}>Новая кампания</div>
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 24 }}>
            Баланс: <strong style={{ color: C.geo }}>{formatGeo(balance)} GEO</strong>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Бюджет кампании (GEO)</div>
              <input value={budget} onChange={e => setBudget(e.target.value.replace(/\D/g, ''))}
                placeholder="Например: 50 000" inputMode="numeric"
                onFocus={() => setFBudget(true)} onBlur={() => setFBudget(false)}
                style={inputStyle(fBudget)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Количество активаций</div>
              <input value={visits} onChange={e => setVisits(e.target.value.replace(/\D/g, ''))}
                placeholder="Например: 100" inputMode="numeric"
                onFocus={() => setFVisits(true)} onBlur={() => setFVisits(false)}
                style={inputStyle(fVisits)} />
            </div>

            {budgetNum > 0 && visitsNum > 0 && (
              <div style={{
                background: reward >= 1 && totalCost <= balance ? C.geoFt : C.redFt,
                border: `1.5px solid ${reward >= 1 && totalCost <= balance ? C.geoGl : 'rgba(255,59,92,0.25)'}`,
                borderRadius: 14, padding: '14px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, color: C.t2, lineHeight: 1 }}>
                  {[
                    ['Пул наград', `${formatGeo(rewardsSum)} GEO`],
                    [`Комиссия платформы 5%`, `+ ${formatGeo(commission)} GEO`],
                    ['Итого с вашего баланса', `${formatGeo(totalCost)} GEO`],
                  ].map(([label, val], i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 0',
                      borderTop: i > 0 ? `1px solid ${C.b1}` : 'none',
                    }}>
                      <span>{label}</span>
                      <strong style={{ color: i === 2 ? (totalCost <= balance ? C.geo : C.red) : C.t1 }}>{val}</strong>
                    </div>
                  ))}
                  <div style={{
                    borderTop: `1px solid ${C.b1}`, paddingTop: 9, marginTop: 0,
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>Награда за задание</span>
                    <strong style={{ color: reward >= 1 ? C.geo : C.red, fontSize: 15 }}>
                      {formatGeo(reward)} GEO
                    </strong>
                  </div>
                </div>
                {reward < 1 && (
                  <div style={{ color: C.red, fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                    Увеличьте бюджет или уменьшите активации
                  </div>
                )}
                {reward >= 1 && totalCost > balance && (
                  <div style={{ color: C.red, fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                    Недостаточно GEO — нужно ещё {formatGeo(totalCost - balance)} GEO
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Тип задания</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(TASK_META).map(([val, { label }]) => (
                  <button key={val} type="button" onClick={() => setTaskType(val)}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      border: taskType === val ? `2px solid ${C.blue}` : `2px solid ${C.b1}`,
                      background: taskType === val ? C.blueFt : C.card,
                      color: taskType === val ? C.blue : C.t2,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Описание задания (необязательно)</div>
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Что должен сделать клиент..." rows={2}
                onFocus={() => setFDesc(true)} onBlur={() => setFDesc(false)}
                style={{ ...inputStyle(fDesc), resize: 'none', fontFamily: 'inherit' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Дата окончания (необязательно)</div>
              <input type="date" value={endsAt} min={today}
                onChange={e => setEndsAt(e.target.value)}
                style={{ ...inputStyle(false), colorScheme: 'dark', cursor: 'pointer' }} />
              {endsAt && (
                <div style={{ fontSize: 12, color: C.t3, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={11} color={C.t3} />
                  Завершится {new Date(endsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>

            <div onClick={() => setRequiresPin(p => !p)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: C.card, border: `1px solid ${C.b0}`,
                borderRadius: 14, padding: '14px 16px', marginBottom: 22, cursor: 'pointer',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={18} color={requiresPin ? C.gold : C.t3} strokeWidth={2} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.t1 }}>Требовать PIN</div>
                  <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>Сотрудник называет PIN клиенту</div>
                </div>
              </div>
              <Toggle on={requiresPin} onToggle={() => setRequiresPin(p => !p)} />
            </div>

            {error && (
              <div style={{
                background: C.redFt, color: C.red, borderRadius: 12,
                padding: '10px 14px', fontSize: 14, fontWeight: 600,
                marginBottom: 16, border: `1px solid rgba(255,59,92,0.2)`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={15} color={C.red} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button type="submit" disabled={!canSubmit || loading}
              style={{
                width: '100%',
                background: canSubmit && !loading ? G.blue : C.b2,
                color: canSubmit && !loading ? '#fff' : C.t3,
                border: 'none', borderRadius: 16, padding: '17px',
                fontSize: 16, fontWeight: 700,
                cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit && !loading ? `0 6px 24px ${C.blueGl}` : 'none',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Создаём...</>
                : `Запустить · ${formatGeo(reward)} GEO / задание`
              }
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── PaymentModal ─────────────────────────────────────────────────────────────

function PaymentModal({ payment, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyCard() {
    navigator.clipboard?.writeText(payment.cardNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        zIndex: 300, animation: 'backdropIn 0.25s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
        background: C.surf, borderRadius: '28px 28px 0 0',
        border: `1px solid ${C.b1}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 60px rgba(0,0,0,0.7)',
        padding: '0 0 44px',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 24px' }} />
        <div style={{ padding: '0 22px' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, color: C.t1 }}>Оплата</div>
          <div style={{ fontSize: 15, color: C.t3, marginBottom: 24 }}>
            Переведите <strong style={{ color: C.gold }}>{(payment.uzsAmount || 0).toLocaleString('ru-RU')} сум</strong> по реквизитам.
            После подтверждения зачислим <strong style={{ color: C.geo }}>{formatGeo(payment.netGeo)} GEO</strong>.
          </div>

          <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: 16, marginBottom: 14 }}>
            {[
              { label: 'Банк',         value: payment.bank },
              { label: 'Получатель',   value: payment.cardHolder },
              { label: 'Комментарий',  value: payment.comment },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${C.b0}` }}>
                <span style={{ fontSize: 13, color: C.t3 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: C.t3, marginBottom: 3 }}>Номер карты</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, letterSpacing: 2 }}>{payment.cardNumber}</div>
              </div>
              <button onClick={copyCard} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: copied ? C.geoFt : C.card,
                border: `1px solid ${copied ? C.geoGl : C.b1}`,
                borderRadius: 10, padding: '8px 12px',
                fontSize: 12, fontWeight: 700,
                color: copied ? C.geo : C.t2, cursor: 'pointer',
              }}>
                {copied ? <CheckCircle size={13} color={C.geo} /> : <Copy size={13} color={C.t2} />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>

          <div style={{
            background: C.goldFt, border: `1px solid ${C.goldGl}`,
            borderRadius: 14, padding: '12px 14px', marginBottom: 20,
            fontSize: 13, color: C.gold, fontWeight: 600,
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <AlertCircle size={15} color={C.gold} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            После оплаты GEO зачисляется в течение 24 часов. Укажите комментарий при переводе.
          </div>

          <button onClick={onClose} style={{
            width: '100%', background: G.gold, color: '#1a0800',
            border: 'none', borderRadius: 16, padding: '16px',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 6px 24px ${C.goldGl}`,
          }}>
            Я оплатил — ожидаю зачисления
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Tab: Обзор ───────────────────────────────────────────────────────────────

function OverviewTab({ business, stats, statsLoading, onShowForm }) {
  const allCampaigns   = business?.campaigns || [];
  const activeCampaign = allCampaigns.find(c => c.active);
  const geoSpentTotal  = allCampaigns.reduce((s, c) => s + c.visits_count * c.reward_amount, 0);
  const totalVisits    = allCampaigns.reduce((s, c) => s + c.visits_count, 0);

  const avgRewardPerVisit = totalVisits > 0 ? geoSpentTotal / totalVisits : 0;
  const dailyRate   = stats?.visits7d > 0 ? (stats.visits7d * avgRewardPerVisit / 7) : 0;
  const forecastDays = dailyRate > 0 ? Math.floor((business?.balance || 0) / dailyRate) : null;

  const lastTopup = stats?.lastTopupAmount || null;
  const balance   = business?.balance || 0;

  let balanceLevel = 'ok';
  if (lastTopup) {
    const pct = balance / lastTopup;
    if (pct < 0.05) balanceLevel = 'critical';
    else if (pct < 0.10) balanceLevel = 'danger';
    else if (pct < 0.25) balanceLevel = 'warn';
  } else if (balance < 5000) balanceLevel = 'critical';
  else if (balance < 20000) balanceLevel = 'warn';

  const balanceColor = { ok: C.geo, warn: C.orange, danger: C.red, critical: C.red }[balanceLevel];

  const pct7d = pctDelta(stats?.visits7d, stats?.visitsPrev7d);

  return (
    <div>
      {/* Balance card */}
      <div style={{
        ...cardBase,
        border: `1px solid ${balanceLevel !== 'ok' ? `${balanceColor}40` : C.b1}`,
        padding: '20px', marginBottom: 14,
        background: balanceLevel === 'critical' ? `rgba(255,59,92,0.06)` : C.card,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              GEO Баланс
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1.5, color: balanceColor }}>
              {formatGeo(balance)}
              <span style={{ fontSize: 15, fontWeight: 600, color: C.t3, marginLeft: 8 }}>GEO</span>
            </div>
          </div>
          <Wallet size={34} color={balanceColor} strokeWidth={1.5} style={{ opacity: 0.7 }} />
        </div>

        {lastTopup && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.t3, marginBottom: 5 }}>
              <span>Использовано</span>
              <span style={{ color: balanceColor, fontWeight: 700 }}>
                {Math.round((1 - balance / lastTopup) * 100)}%
              </span>
            </div>
            <ProgressBar
              pct={Math.max(0, (balance / lastTopup) * 100)}
              color={balanceLevel === 'ok' ? G.geo : balanceLevel === 'warn' ? G.orange : 'linear-gradient(135deg, #FF3B5C, #FF0040)'}
            />
          </div>
        )}

        {balanceLevel !== 'ok' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: `${balanceColor}15`, border: `1px solid ${balanceColor}35`,
            borderRadius: 10, padding: '9px 12px', marginBottom: 12,
            fontSize: 13, fontWeight: 700, color: balanceColor,
          }}>
            <AlertTriangle size={14} color={balanceColor} />
            {balanceLevel === 'critical' ? 'Критически низкий баланс — пополните срочно' : 'Остаток баланса менее 25% — пополните скоро'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {forecastDays !== null ? (
            <div style={{ fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} color={C.t3} />
              Хватит на <strong style={{ color: forecastDays < 3 ? C.red : C.t2 }}> ~{forecastDays} {forecastDays === 1 ? 'день' : forecastDays < 5 ? 'дня' : 'дней'}</strong>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.t3 }}>Нет данных о трафике</div>
          )}
          <button onClick={onShowForm} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: G.geo, color: '#071a0c',
            border: 'none', borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}>
            <Zap size={13} color="#071a0c" strokeWidth={2.5} />
            Кампания
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <StatCard
          label="Сегодня"
          value={statsLoading ? '—' : stats?.visitsToday ?? 0}
          sub={statsLoading ? undefined : 'визитов'}
          Icon={Users}
          color={C.blue}
          loading={statsLoading}
        />
        <StatCard
          label="За 7 дней"
          value={statsLoading ? '—' : stats?.visits7d ?? 0}
          sub={pct7d !== null ? `${pct7d >= 0 ? '+' : ''}${pct7d}% vs прошлая` : 'визитов'}
          subUp={pct7d !== null ? pct7d >= 0 : undefined}
          Icon={TrendingUp}
          color={C.geo}
          loading={statsLoading}
        />
        <StatCard
          label="GEO выдано"
          value={formatGeo(geoSpentTotal)}
          sub="всего"
          Icon={Wallet}
          color={C.gold}
        />
      </div>

      {/* Active campaign mini */}
      {activeCampaign ? (
        <div style={{
          ...cardBase, border: `1px solid ${C.geoGl}`, padding: '14px 16px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.geo, boxShadow: `0 0 6px ${C.geo}`, display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.geo, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Активная кампания
              </span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 900, color: C.geo }}>+{formatGeo(activeCampaign.reward_amount)} GEO</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t3, marginBottom: 6 }}>
            <span>{activeCampaign.visits_count} из {activeCampaign.max_visits} активаций</span>
            <span style={{ color: C.geo, fontWeight: 700 }}>{activeCampaign.max_visits - activeCampaign.visits_count} осталось</span>
          </div>
          <ProgressBar pct={(activeCampaign.visits_count / activeCampaign.max_visits) * 100} />
        </div>
      ) : (
        <div style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '20px', marginBottom: 14, textAlign: 'center' }}>
          <Zap size={28} color={C.t3} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.5 }}>Нет активных кампаний</div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Кампании ────────────────────────────────────────────────────────────

function CampaignsTab({ business, webappUrl, onStop, stopping, onShowForm, pin, pinExpires, pinLoading, pinCopied, onGeneratePin, onCopyPin, onReload }) {
  const [detailCampaign, setDetailCampaign] = useState(null);

  const allCampaigns = [...(business?.campaigns || [])].sort((a, b) => {
    if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0);
    return b.id - a.id;
  });

  return (
    <div>
      <button onClick={onShowForm} style={{
        width: '100%', background: G.geo, color: '#071a0c',
        border: 'none', borderRadius: 14, padding: '14px',
        fontSize: 15, fontWeight: 800, cursor: 'pointer',
        boxShadow: `0 4px 16px ${C.geoGl}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginBottom: 20,
      }}>
        <Zap size={16} color="#071a0c" strokeWidth={2.5} />
        Создать кампанию
      </button>

      {/* Campaign list */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
        Все кампании ({allCampaigns.length})
      </div>

      {allCampaigns.length === 0 ? (
        <div style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '28px 20px', textAlign: 'center', marginBottom: 20 }}>
          <Megaphone size={32} color={C.t3} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: C.t3 }}>Создайте первую кампанию</div>
        </div>
      ) : (
        allCampaigns.map(c => (
          <CampaignCard
            key={c.id}
            campaign={c}
            business={business}
            webappUrl={webappUrl}
            onStop={onStop}
            stopping={stopping}
            onOpenDetail={setDetailCampaign}
          />
        ))
      )}

      {/* PIN section */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12, marginTop: 4 }}>
        PIN для клиента
      </div>
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '20px', marginBottom: 20 }}>
        {pin ? (
          <div style={{ animation: 'pop 0.4s ease' }}>
            <div onClick={onCopyPin} style={{
              background: G.gold, borderRadius: 16, padding: '18px',
              textAlign: 'center', cursor: 'pointer', marginBottom: 12,
              boxShadow: `0 6px 24px ${C.goldGl}`,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 6, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {pinCopied ? <CheckCircle size={12} color="rgba(0,0,0,0.5)" /> : <Copy size={12} color="rgba(0,0,0,0.5)" />}
                {pinCopied ? 'СКОПИРОВАНО' : 'НАЖМИТЕ ЧТОБЫ СКОПИРОВАТЬ'}
              </div>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#1a0800', letterSpacing: 12 }}>{pin}</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 6 }}>
                До {pinExpires?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (15 мин)
              </div>
            </div>
            <button onClick={onGeneratePin} disabled={pinLoading} style={{
              width: '100%', background: C.card, border: `1px solid ${C.b1}`,
              borderRadius: 12, padding: '12px', fontSize: 14,
              fontWeight: 700, color: C.t2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <RefreshCw size={15} color={C.t2} />
              Сгенерировать новый
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.5, marginBottom: 14 }}>
              Сгенерируйте одноразовый PIN и назовите его клиенту.
            </div>
            <button onClick={onGeneratePin} disabled={pinLoading} style={{
              width: '100%', background: pinLoading ? C.b2 : G.gold,
              color: pinLoading ? C.t3 : '#1a0800',
              border: 'none', borderRadius: 14, padding: '15px',
              fontSize: 15, fontWeight: 700,
              cursor: pinLoading ? 'not-allowed' : 'pointer',
              boxShadow: pinLoading ? 'none' : `0 6px 24px ${C.goldGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {pinLoading
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Генерируем...</>
                : <><Lock size={18} color="#1a0800" strokeWidth={2} /> Создать PIN</>
              }
            </button>
          </>
        )}
      </div>

      {detailCampaign && createPortal(
        <CampaignDetailModal
          campaign={detailCampaign}
          business={business}
          webappUrl={webappUrl}
          onClose={() => setDetailCampaign(null)}
          onStop={onStop}
          stopping={stopping}
          onSaved={() => { setDetailCampaign(null); onReload && onReload(); }}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Tab: Пополнение ──────────────────────────────────────────────────────────

function TopupTab({ business, stats }) {
  const [geoRate,      setGeoRate]      = useState(1000);
  const [uzsInput,     setUzsInput]     = useState('');
  const [payLoading,   setPayLoading]   = useState(false);
  const [payment,      setPayment]      = useState(null);
  const [topups,       setTopups]       = useState([]);
  const [topupsLoaded, setTopupsLoaded] = useState(false);

  useEffect(() => {
    apiFetch('/api/config').then(r => r.json()).then(d => setGeoRate(d.geoRate || 1000)).catch(() => {});
    apiFetch('/api/admin/topups')
      .then(r => r.json())
      .then(d => { setTopups(d.requests || []); setTopupsLoaded(true); })
      .catch(() => setTopupsLoaded(true));
  }, []);

  const allCampaigns      = business?.campaigns || [];
  const totalVisits       = allCampaigns.reduce((s, c) => s + c.visits_count, 0);
  const geoSpentTotal     = allCampaigns.reduce((s, c) => s + c.visits_count * c.reward_amount, 0);
  const avgRewardPerVisit = totalVisits > 0 ? geoSpentTotal / totalVisits : 0;
  const dailyRate         = stats?.visits7d > 0 ? (stats.visits7d * avgRewardPerVisit / 7) : 0;
  const forecastDays      = dailyRate > 0 ? Math.floor((business?.balance || 0) / dailyRate) : null;

  const uzsAmount  = parseInt(uzsInput.replace(/\D/g, '') || '0', 10);
  const grossGeo   = Math.floor(uzsAmount / geoRate);
  const commission = Math.floor(grossGeo * 0.10);
  const netGeo     = grossGeo - commission;
  const canSubmit  = uzsAmount >= 10_000 && netGeo >= 1;

  async function handleTopup() {
    if (!canSubmit) return;
    setPayLoading(true);
    try {
      const r = await apiFetch('/api/admin/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uzsAmount }),
      });
      const d = await r.json();
      if (r.ok) setPayment(d.paymentDetails);
    } finally { setPayLoading(false); }
  }

  return (
    <div>
      {/* Balance + Forecast */}
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Текущий баланс</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.t1 }}>
              {formatGeo(business?.balance || 0)}
              <span style={{ fontSize: 13, color: C.t3, marginLeft: 6 }}>GEO</span>
            </div>
          </div>
          {forecastDays !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Прогноз</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: forecastDays < 3 ? C.red : C.geo }}>
                ~{forecastDays} <span style={{ fontSize: 12, color: C.t3, fontWeight: 600 }}>{forecastDays === 1 ? 'день' : forecastDays < 5 ? 'дня' : 'дней'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UZS Input */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
        Сумма пополнения
      </div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          value={uzsInput}
          onChange={e => setUzsInput(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="Например: 100 000"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.card, border: `1px solid ${uzsAmount >= 10_000 ? C.geoGl : C.b1}`,
            borderRadius: 14, padding: '15px 64px 15px 16px',
            fontSize: 18, fontWeight: 700, color: C.t1, outline: 'none',
            transition: 'border-color 0.15s',
          }}
        />
        <span style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, fontWeight: 700, color: C.t3,
        }}>сум</span>
      </div>

      {/* Conversion preview */}
      {uzsAmount > 0 && (
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 16px', marginBottom: 14 }}>
          {[
            { label: 'Сумма перевода',    value: `${uzsAmount.toLocaleString('ru-RU')} сум`,     color: C.t1 },
            { label: 'GEO (до комиссии)', value: `${formatGeo(grossGeo)} GEO`,                   color: C.t2 },
            { label: 'Комиссия 10%',      value: `− ${formatGeo(commission)} GEO`,               color: C.red },
            { label: 'Вы получите',       value: `${formatGeo(netGeo)} GEO`,                      color: C.geo, bold: true },
          ].map(({ label, value, color, bold }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              paddingBottom: 8, marginBottom: 8,
              borderBottom: label === 'Комиссия 10%' ? `1px solid ${C.b0}` : 'none',
            }}>
              <span style={{ fontSize: 13, color: C.t3 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color }}>{value}</span>
            </div>
          ))}
          {avgRewardPerVisit > 0 && netGeo > 0 && (
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2, textAlign: 'right' }}>
              ≈ {Math.round(netGeo / avgRewardPerVisit)} активаций кампании
            </div>
          )}
        </div>
      )}

      {uzsAmount > 0 && uzsAmount < 10_000 && (
        <div style={{ fontSize: 13, color: C.red, marginBottom: 12, fontWeight: 600 }}>
          Минимальная сумма пополнения: 10 000 сум
        </div>
      )}

      <button onClick={handleTopup} disabled={payLoading || !canSubmit} style={{
        width: '100%',
        background: !canSubmit || payLoading ? C.b2 : G.blue,
        color: !canSubmit || payLoading ? C.t3 : '#fff',
        border: 'none', borderRadius: 16, padding: '16px',
        fontSize: 16, fontWeight: 700,
        cursor: !canSubmit || payLoading ? 'not-allowed' : 'pointer',
        boxShadow: !canSubmit || payLoading ? 'none' : `0 6px 24px ${C.blueGl}`,
        transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginBottom: 24,
      }}>
        {payLoading
          ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Создаём заявку...</>
          : canSubmit
            ? `Пополнить — ${uzsAmount.toLocaleString('ru-RU')} сум`
            : 'Введите сумму'
        }
      </button>

      {/* Top-up history */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
        История пополнений
      </div>
      {!topupsLoaded && [1, 2].map(i => (
        <div key={i} style={{ marginBottom: 8 }}><Skel h={56} r={14} /></div>
      ))}
      {topupsLoaded && topups.length === 0 && (
        <div style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: C.t3 }}>Пополнений пока нет</div>
        </div>
      )}
      {topupsLoaded && topups.map(t => {
        const st = TOPUP_STATUS[t.status] || TOPUP_STATUS.pending;
        return (
          <div key={t.id} style={{
            ...cardBase, border: `1px solid ${C.b0}`,
            padding: '14px 16px', marginBottom: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 3 }}>
                {formatGeo(t.amount)} GEO
              </div>
              <div style={{ fontSize: 12, color: C.t3 }}>
                {new Date(t.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                {t.note && <span style={{ marginLeft: 6 }}>· {t.note}</span>}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: st.color,
              background: `${st.color}18`, borderRadius: 8, padding: '4px 10px',
            }}>
              {st.label}
            </span>
          </div>
        );
      })}

      {payment && createPortal(
        <PaymentModal payment={payment} onClose={() => setPayment(null)} />,
        document.body
      )}
    </div>
  );
}

// ─── Tab: QR заведения ───────────────────────────────────────────────────────

function QrTab({ business, webappUrl }) {
  const [copied,    setCopied]    = useState(false);
  const [dlLoading, setDlLoading] = useState(false);
  const [qrLoaded,  setQrLoaded]  = useState(false);

  const checkinUrl = `${webappUrl}/checkin?token=${encodeURIComponent(business.qr_token)}`;
  const qrImageUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=3` +
    `&bgcolor=FFFFFF&color=000000&data=${encodeURIComponent(checkinUrl)}`;

  function copyLink() {
    navigator.clipboard?.writeText(checkinUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadQR() {
    setDlLoading(true);
    try {
      const resp = await fetch(qrImageUrl);
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `geo-qr-${(business.name || 'business').replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(qrImageUrl, '_blank');
    } finally {
      setDlLoading(false);
    }
  }

  const infoRows = [
    { label: 'Название',   value: business.name },
    { label: 'Адрес',      value: business.address || '—' },
    { label: 'Баланс',     value: `${(business.balance || 0).toLocaleString('ru-RU')} GEO` },
  ];

  return (
    <div>
      {/* Business card with QR */}
      <div style={{
        ...cardBase,
        border: `1px solid ${C.b1}`,
        padding: '28px 20px 24px',
        marginBottom: 14,
        textAlign: 'center',
      }}>
        {/* QR image */}
        <div style={{
          width: 220, height: 220,
          margin: '0 auto 22px',
          borderRadius: 20,
          background: '#fff',
          padding: 14,
          boxShadow: '0 6px 32px rgba(0,0,0,0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {!qrLoaded && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 20,
              background: 'rgba(255,255,255,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Loader2 size={28} color={C.t3} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          <img
            src={qrImageUrl}
            alt="QR код заведения"
            onLoad={() => setQrLoaded(true)}
            style={{ width: '100%', height: '100%', borderRadius: 8, display: 'block' }}
          />
        </div>

        {/* Name & address */}
        <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 5 }}>
          {business.name}
        </div>
        {business.address && (
          <div style={{ fontSize: 13, color: C.t3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 18 }}>
            <MapPin size={13} color={C.t3} strokeWidth={2} />
            {business.address}
          </div>
        )}

        <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.6, marginBottom: 22, maxWidth: 280, margin: '0 auto 22px' }}>
          Разместите QR в заведении. Клиенты сканируют и получают GEO-бонусы при чекине.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={downloadQR}
            disabled={dlLoading}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: C.blue, color: '#fff',
              border: 'none', borderRadius: 14, padding: '13px',
              fontSize: 14, fontWeight: 700,
              cursor: dlLoading ? 'not-allowed' : 'pointer',
              opacity: dlLoading ? 0.7 : 1,
              boxShadow: `0 4px 16px ${C.blueGl}`,
            }}>
            {dlLoading
              ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <Download size={15} color="#fff" strokeWidth={2} />
            }
            Скачать
          </button>
          <button
            onClick={copyLink}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: copied ? C.geoFt : C.card,
              color: copied ? C.geo : C.t2,
              border: `1px solid ${copied ? C.geoGl : C.b1}`,
              borderRadius: 14, padding: '13px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
            {copied
              ? <CheckCircle size={15} color={C.geo} strokeWidth={2} />
              : <Copy size={15} color={C.t2} strokeWidth={2} />
            }
            {copied ? 'Скопировано' : 'Ссылка'}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '18px 18px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 }}>
          Информация о заведении
        </div>
        {infoRows.map(({ label, value }, i) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: 12, marginBottom: 12,
            borderBottom: i < infoRows.length - 1 ? `1px solid ${C.b0}` : 'none',
          }}>
            <span style={{ fontSize: 13, color: C.t3 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, maxWidth: '60%', textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin (root) ─────────────────────────────────────────────────────────────

export default function Admin() {
  const [business,    setBusiness]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [notOwner,    setNotOwner]    = useState(false);
  const [stats,       setStats]       = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab,   setActiveTab]   = useState('overview');
  const [stopping,    setStopping]    = useState(null);
  const [pin,         setPin]         = useState(null);
  const [pinExpires,  setPinExpires]  = useState(null);
  const [pinLoading,  setPinLoading]  = useState(false);
  const [pinCopied,   setPinCopied]   = useState(false);
  const [showForm,    setShowForm]    = useState(false);

  const webappUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const loadBusiness = useCallback(() => {
    apiFetch('/api/admin/business')
      .then(async r => {
        if (r.status === 404 || r.status === 403) { setNotOwner(true); return; }
        const d = await r.json();
        setBusiness(d.business);
      })
      .catch(() => setNotOwner(true))
      .finally(() => setLoading(false));
  }, []);

  const loadStats = useCallback(() => {
    apiFetch('/api/admin/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => { loadBusiness(); loadStats(); }, [loadBusiness, loadStats]);

  async function generatePin() {
    setPinLoading(true);
    try {
      const r = await apiFetch('/api/admin/pin', { method: 'POST' });
      const d = await r.json();
      if (r.ok) { setPin(d.pin); setPinExpires(new Date(d.expiresAt)); setPinCopied(false); }
    } finally { setPinLoading(false); }
  }

  function copyPin() {
    if (!pin) return;
    navigator.clipboard?.writeText(pin).catch(() => {});
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 2000);
  }

  async function stopCampaign(id) {
    setStopping(id);
    try {
      const r = await apiFetch(`/api/admin/campaign/${id}/stop`, {
        method: 'POST',
      });
      if (r.ok) loadBusiness();
    } finally { setStopping(null); }
  }

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: 20 }}>
        {/* Business header card */}
        <Skel h={118} r={20} />
        {/* Tab bar */}
        <div style={{ marginTop: 14 }}><Skel h={48} r={12} /></div>
        {/* Stats 2×2 */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <Skel h={82} r={16} />
          <Skel h={82} r={16} />
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
          <Skel h={82} r={16} />
          <Skel h={82} r={16} />
        </div>
        {/* Campaign rows */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{ marginTop: 10 }}>
            <Skel h={74} r={16} />
          </div>
        ))}
      </div>
    );
  }

  if (notOwner) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <Store size={64} color={C.t3} strokeWidth={1.25} style={{ marginBottom: 20, opacity: 0.4 }} />
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 12, color: C.t1 }}>Панель бизнеса</div>
        <div style={{ color: C.t3, fontSize: 15, lineHeight: 1.6, maxWidth: 280 }}>
          Вы не зарегистрированы как владелец заведения.<br /><br />
          Обратитесь к администратору GeoEarn для подключения.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.4s ease both' }}>
      {/* Header */}
      <div style={{ background: G.admin, padding: '32px 20px 52px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,184,0,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
          Бизнес-панель
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: C.t1, letterSpacing: -0.5 }}>
          {business.name}
        </div>
        {business.address && (
          <div style={{ fontSize: 13, color: C.t3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={13} color={C.t3} />
            {business.address}
          </div>
        )}
      </div>

      <div style={{
        marginTop: -24, borderRadius: '28px 28px 0 0',
        background: C.bg, border: `1px solid ${C.b0}`, borderBottom: 'none',
        paddingTop: 16,
      }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 16px', borderBottom: `1px solid ${C.b0}` }}>
          {TABS.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '10px 4px',
                background: isActive ? C.blueFt : 'transparent',
                border: `1.5px solid ${isActive ? C.blue : 'transparent'}`,
                borderRadius: 12, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <Icon size={18} color={isActive ? C.blue : C.t3} strokeWidth={isActive ? 2 : 1.75} />
                <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? C.blue : C.t3, letterSpacing: 0.3 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ padding: '16px 16px 32px' }}>
          {activeTab === 'overview' && (
            <OverviewTab
              business={business}
              stats={stats}
              statsLoading={statsLoading}
              onShowForm={() => { setActiveTab('campaigns'); setShowForm(true); }}
            />
          )}
          {activeTab === 'campaigns' && (
            <CampaignsTab
              business={business}
              webappUrl={webappUrl}
              onStop={stopCampaign}
              stopping={stopping}
              onShowForm={() => setShowForm(true)}
              pin={pin}
              pinExpires={pinExpires}
              pinLoading={pinLoading}
              pinCopied={pinCopied}
              onGeneratePin={generatePin}
              onCopyPin={copyPin}
              onReload={() => { loadBusiness(); loadStats(); }}
            />
          )}
          {activeTab === 'topup' && (
            <TopupTab business={business} stats={stats} />
          )}
          {activeTab === 'qr' && (
            <QrTab business={business} webappUrl={webappUrl} />
          )}
        </div>
      </div>

      {showForm && createPortal(
        <CampaignForm
          balance={business.balance || 0}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); loadBusiness(); loadStats(); }}
        />,
        document.body
      )}
    </div>
  );
}
