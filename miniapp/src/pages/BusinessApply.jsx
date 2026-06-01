import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Store, CheckCircle, Clock, XCircle, Loader2, AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { C, FF, inputStyle, cardBase } from '../lib/design';
import RippleButton from '../lib/RippleButton';

const CATEGORIES = [
  'Кафе / Ресторан',
  'Магазин',
  'Аптека',
  'Салон красоты',
  'Спортзал / Фитнес',
  'Автосервис',
  'Другое',
];

function Field({ label, value, onChange, placeholder, inputMode, required, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode || 'text'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle(focused, false)}
      />
      {hint && <div style={{ fontSize: 12, color: C.t3, marginTop: 6, paddingLeft: 2 }}>{hint}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle(focused, false),
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234A5560' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
          paddingRight: 36,
          cursor: 'pointer',
        }}
      >
        <option value="">— не выбрано —</option>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function StatusBanner({ application }) {
  const cfg = {
    pending:  { icon: Clock,        color: C.gold,  bg: C.goldFt,  title: 'Заявка на рассмотрении',    sub: 'Мы проверяем вашу заявку. Обычно это занимает 1–2 рабочих дня.' },
    approved: { icon: CheckCircle,  color: C.green, bg: C.greenFt, title: 'Заявка одобрена!',           sub: 'Ваш бизнес-аккаунт активирован. Перейдите в раздел Бизнес.' },
    rejected: { icon: XCircle,      color: C.red,   bg: C.redFt,   title: 'Заявка отклонена',           sub: application?.review_note || 'Свяжитесь с поддержкой для уточнения причины.' },
  };
  const { icon: Icon, color, bg, title, sub } = cfg[application.status] || cfg.pending;

  return (
    <div style={{
      ...cardBase,
      padding: '20px 18px',
      marginBottom: 24,
      background: bg,
      border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <Icon size={24} color={color} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>{sub}</div>
        <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>
          Заявка №{application.id} · {new Date(application.created_at).toLocaleDateString('ru-RU')}
        </div>
      </div>
    </div>
  );
}

export default function BusinessApply() {
  const navigate = useNavigate();

  const [existing,    setExisting]    = useState(undefined); // undefined=loading, null=none
  const [loadingInit, setLoadingInit] = useState(true);

  const [name,    setName]    = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [phone,   setPhone]   = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    apiFetch('/api/user/apply-business')
      .then(r => r.ok ? r.json() : null)
      .then(data => setExisting(data?.application || null))
      .catch(() => setExisting(null))
      .finally(() => setLoadingInit(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Введите название заведения');

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/user/apply-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
          category: category || undefined,
          contact_phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'ALREADY_BUSINESS_OWNER')      return setError('У вас уже есть бизнес-аккаунт');
        if (data.error === 'APPLICATION_ALREADY_PENDING') return setError('Заявка уже отправлена и ожидает рассмотрения');
        return setError('Ошибка при отправке заявки. Попробуйте ещё раз.');
      }
      setExisting(data.application);
      setSuccess(true);
    } catch {
      setError('Нет соединения. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${C.b1}`,
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,16,24,0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', padding: 6,
            cursor: 'pointer', color: C.t2, display: 'flex', borderRadius: 10,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Store size={18} color={C.geo} strokeWidth={1.75} />
          <span style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: FF.body }}>
            Стать партнёром
          </span>
        </div>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>

        {/* Loading state */}
        {loadingInit && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Loader2 size={28} color={C.geo} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {/* Existing application status */}
        {!loadingInit && existing && (
          <>
            <StatusBanner application={existing} />
            {existing.status === 'rejected' && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <RippleButton
                  onClick={() => { setExisting(null); setSuccess(false); setError(''); }}
                  style={{
                    background: C.geoDim, border: `1px solid ${C.geoGl}`,
                    color: C.geo, borderRadius: 12, padding: '12px 28px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    fontFamily: FF.body,
                  }}
                >
                  Подать повторно
                </RippleButton>
              </div>
            )}
          </>
        )}

        {/* Form */}
        {!loadingInit && !existing && (
          <>
            {/* Intro */}
            <div style={{
              ...cardBase,
              padding: '18px 16px',
              marginBottom: 28,
              background: C.geoDim,
              border: `1px solid ${C.geoGl}`,
            }}>
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>
                Заполните форму — мы рассмотрим заявку и свяжемся с вами через Telegram.
                После одобрения вы получите доступ к панели бизнеса и сможете создавать кампании.
              </div>
            </div>

            {/* Success state (post-submit) */}
            {success && (
              <div style={{
                ...cardBase,
                padding: '20px 18px',
                marginBottom: 24,
                background: C.greenFt,
                border: `1px solid ${C.greenGl}`,
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <CheckCircle size={24} color={C.green} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 4 }}>Заявка отправлена!</div>
                  <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>
                    Мы уведомим вас в Telegram когда заявка будет рассмотрена.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Field
                label="Название заведения"
                required
                value={name}
                onChange={setName}
                placeholder="Например: Кафе «Уют»"
              />
              <Field
                label="Адрес"
                value={address}
                onChange={setAddress}
                placeholder="Ташкент, ул. Амира Темура, 15"
              />
              <SelectField
                label="Категория"
                value={category}
                onChange={setCategory}
              />
              <Field
                label="Контактный телефон"
                value={phone}
                onChange={setPhone}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
                hint="Для связи по вопросам заявки"
              />

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: C.redFt, border: `1px solid ${C.redGl}`,
                  borderRadius: 12, padding: '12px 14px',
                  marginBottom: 18,
                }}>
                  <AlertTriangle size={16} color={C.red} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>{error}</span>
                </div>
              )}

              <RippleButton
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '16px 0',
                  borderRadius: 14,
                  background: submitting ? C.geoDim : C.geo,
                  border: 'none',
                  color: submitting ? C.t3 : C.bg,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: FF.body,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.2s',
                  boxShadow: submitting ? 'none' : '0 6px 24px rgba(201,123,71,0.30)',
                }}
              >
                {submitting
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Отправляем…</>
                  : 'Отправить заявку'
                }
              </RippleButton>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
