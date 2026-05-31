import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ExternalLink, Loader2, AlertTriangle, Tv2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatGeo } from '../lib/geo';
import { C, E, cardBase } from '../lib/design';
import RippleButton from '../lib/RippleButton';
import { tg } from '../hooks/useTelegram';

const BC = { fontFamily: "'Barlow Condensed', sans-serif" };

export default function ChannelSub() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [promo,      setPromo]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [claiming,   setClaiming]   = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error,      setError]      = useState('');
  const [subOpened,  setSubOpened]  = useState(false);

  useEffect(() => {
    if (!token) { setError('Ссылка недействительна'); setLoading(false); return; }
    apiFetch(`/api/platform-promo/info?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) {
          const msgs = {
            NOT_FOUND:       'Акция не найдена',
            PROMO_INACTIVE:  'Акция уже завершена',
            PROMO_EXPIRED:   'Акция истекла',
            PROMO_EXHAUSTED: 'Все награды уже разобраны',
          };
          setError(msgs[d.error] || 'Ошибка загрузки акции');
        } else {
          setPromo(d);
        }
      })
      .catch(() => setError('Нет соединения'))
      .finally(() => setLoading(false));
  }, [token]);

  function openChannel() {
    if (!promo) return;
    const url = `https://t.me/${promo.channelUsername.replace('@', '')}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
    setSubOpened(true);
  }

  async function handleClaim() {
    if (!promo || !token) return;
    setError('');
    setClaiming(true);
    try {
      const r = await apiFetch('/api/platform-promo/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (!r.ok) {
        const msgs = {
          NOT_SUBSCRIBED:  `Вы не подписаны на ${promo.channelUsername}. Подпишитесь и попробуйте снова.`,
          ALREADY_CLAIMED: 'Вы уже получили эту награду',
          PROMO_INACTIVE:  'Акция завершена',
          PROMO_EXHAUSTED: 'Все награды уже разобраны',
          SUBSCRIPTION_CHECK_FAILED: 'Не удалось проверить подписку. Попробуйте позже.',
        };
        setError(msgs[data.error] || 'Ошибка получения награды');
        return;
      }
      setSuccessData(data);
      setSuccess(true);
      tg?.HapticFeedback?.notificationOccurred('success');
    } catch {
      setError('Нет соединения');
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={36} color={C.geo} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error && !promo) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <AlertTriangle size={52} color={C.red} strokeWidth={1.5} style={{ marginBottom: 16 }} />
        <div style={{ ...BC, fontSize: 20, fontWeight: 700, color: C.t1, marginBottom: 8 }}>Не удалось загрузить</div>
        <div style={{ fontSize: 14, color: C.t3, marginBottom: 28 }}>{error}</div>
        <button onClick={() => navigate('/')} style={{
          background: C.card, border: `0.5px solid ${C.b2}`, color: C.t2,
          borderRadius: 13, padding: '13px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          На главную
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', animation: 'pageEnter 0.4s ease both', textAlign: 'center' }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: C.greenFt, border: `0.5px solid ${C.greenGl}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          animation: 'pop 0.5s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <CheckCircle size={46} color={C.green} strokeWidth={2} />
        </div>

        <div style={{ ...BC, fontSize: 24, fontWeight: 700, color: C.t1, marginBottom: 8 }}>
          Награда получена!
        </div>

        <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '18px 24px', marginBottom: 24, width: '100%', maxWidth: 320 }}>
          <div style={{ fontSize: 13, color: C.t3, marginBottom: 4 }}>Начислено</div>
          <div style={{ ...BC, fontSize: 32, fontWeight: 700, color: C.geo, lineHeight: 1 }}>
            +{formatGeo(successData?.reward)} <span style={{ fontSize: 16, color: C.t3, fontWeight: 500 }}>GEO</span>
          </div>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 6 }}>{promo?.title}</div>
        </div>

        <RippleButton onClick={() => navigate('/balance')} style={{
          background: C.geo, color: C.bg,
          border: 'none', borderRadius: 13,
          padding: '14px 40px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          Посмотреть баланс
        </RippleButton>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, animation: 'pageEnter 0.4s ease both' }}>
      {/* Header */}
      <div style={{
        background: C.bg,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `0.5px solid ${C.b1}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.t2, padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <ArrowLeft size={22} color={C.t2} strokeWidth={1.75} />
        </button>
        <div style={{ ...BC, fontWeight: 700, fontSize: 18, color: C.t1 }}>Акция GeoEarn</div>
        {/* GeoEarn platform badge */}
        <div style={{
          marginLeft: 'auto', padding: '4px 10px', borderRadius: 8,
          background: C.greenFt, border: `0.5px solid ${C.greenGl}`,
          fontSize: 11, fontWeight: 700, color: C.green,
        }}>
          PLATFORM
        </div>
      </div>

      <div style={{ padding: '20px 16px 40px' }}>
        {/* Reward hero */}
        <div style={{
          ...cardBase,
          border: `0.5px solid ${C.greenGl}`,
          padding: '28px 20px',
          textAlign: 'center',
          marginBottom: 16,
          animation: 'fadeUp 0.35s ease both',
          background: 'linear-gradient(160deg, rgba(74,222,128,0.06) 0%, #161B24 60%)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: C.greenFt, border: `0.5px solid ${C.greenGl}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Tv2 size={28} color={C.green} strokeWidth={1.75} />
          </div>
          <div style={{ ...BC, fontSize: 38, fontWeight: 800, color: C.geo, letterSpacing: -1, lineHeight: 1 }}>
            +{formatGeo(promo?.reward)} <span style={{ fontSize: 18, fontWeight: 500, color: C.t3 }}>GEO</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, marginTop: 8 }}>{promo?.title}</div>
          {promo?.description && (
            <div style={{ fontSize: 13, color: C.t3, marginTop: 6, lineHeight: 1.55 }}>{promo.description}</div>
          )}
          {promo?.remaining !== undefined && (
            <div style={{ fontSize: 12, color: C.t3, marginTop: 10 }}>
              Осталось: <strong style={{ color: C.t2 }}>{promo.remaining}</strong>
            </div>
          )}
        </div>

        {/* Steps */}
        <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '18px 16px', marginBottom: 16, animation: 'fadeUp 0.35s 0.08s both' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
            Как получить
          </div>
          {[
            { n: '1', text: `Подпишитесь на канал ${promo?.channelUsername}` },
            { n: '2', text: 'Нажмите «Подтвердить подписку»' },
            { n: '3', text: 'GEO начислятся на ваш баланс' },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: C.greenFt, border: `0.5px solid ${C.greenGl}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: C.green,
              }}>
                {n}
              </div>
              <span style={{ fontSize: 14, color: C.t2, paddingTop: 4 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: C.redFt, color: C.red,
            borderRadius: 12, padding: '12px 14px', marginBottom: 14,
            fontSize: 14, fontWeight: 600,
            border: `0.5px solid rgba(248,113,113,0.20)`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={16} color={C.red} strokeWidth={2} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Subscribe button */}
        <RippleButton onClick={openChannel} style={{
          width: '100%', marginBottom: 10,
          background: subOpened ? C.cardHi : C.green,
          color: subOpened ? C.t2 : C.bg,
          border: `0.5px solid ${subOpened ? C.b2 : 'transparent'}`,
          padding: '15px', borderRadius: 13,
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
          transition: `all 0.18s ${E.smooth}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <ExternalLink size={17} strokeWidth={2} color={subOpened ? C.t3 : C.bg} />
          {subOpened ? 'Открыть снова' : `Подписаться на ${promo?.channelUsername}`}
        </RippleButton>

        <RippleButton
          onClick={handleClaim}
          disabled={claiming || !subOpened}
          style={{
            width: '100%',
            background: (!subOpened || claiming) ? C.cardHi : C.geo,
            color: (!subOpened || claiming) ? C.t3 : C.bg,
            border: `0.5px solid ${(!subOpened || claiming) ? C.b2 : 'transparent'}`,
            padding: '15px', borderRadius: 13,
            fontWeight: 700, fontSize: 15,
            cursor: (!subOpened || claiming) ? 'not-allowed' : 'pointer',
            transition: `all 0.18s ${E.smooth}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {claiming
            ? <><Loader2 size={18} color={C.t3} style={{ animation: 'spin 1s linear infinite' }} /> Проверяем подписку…</>
            : <><CheckCircle size={17} strokeWidth={2} color={(!subOpened || claiming) ? C.t3 : C.bg} /> Подтвердить подписку</>
          }
        </RippleButton>

        {!subOpened && (
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: C.t3 }}>
            Сначала подпишитесь на канал, затем нажмите «Подтвердить»
          </div>
        )}
      </div>
    </div>
  );
}
