import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@hooks/useUser'
import { updateUserFinances } from '@services/user.service'
import { getTelegramUserId } from '@lib/telegram'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card } from '@components/ui/Card'

export const ProfilePage = () => {
  const navigate = useNavigate()
  const { user, loading } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [income, setIncome] = useState<string>(user?.income.toString() || '')
  const [expenses, setExpenses] = useState<string>(user?.expenses.toString() || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const telegramId = getTelegramUserId()
      if (!telegramId) throw new Error('Telegram ID not found')

      await updateUserFinances(BigInt(telegramId), Number(income), Number(expenses))
      setIsEditing(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg p-4 flex items-center justify-center">
        <p className="text-text-secondary">Загрузка...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg p-4 flex items-center justify-center">
        <p className="text-text-secondary">Данные профиля не найдены</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <button onClick={() => navigate(-1)} className="text-primary mb-6">
          ← Назад
        </button>
        <h1 className="text-2xl font-bold text-text mb-6">Профиль</h1>

        {/* User Info */}
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary bg-opacity-20 flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">{user.first_name}</h2>
              <p className="text-text-secondary text-sm">@{user.username || 'username'}</p>
              <p className="text-text-secondary text-xs mt-1">ID: {user.telegram_id.toString()}</p>
            </div>
          </div>
        </Card>

        {/* Referral Code */}
        <Card className="mb-6">
          <p className="text-text-secondary text-sm font-medium mb-2">Реферальный код</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={user.referral_code}
              readOnly
              className="flex-1 px-3 py-2 rounded bg-bg-input border border-bg-card text-text"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.referral_code)
              }}
              className="px-3 py-2 bg-primary text-white rounded font-medium text-sm hover:bg-primary-hover transition"
            >
              📋
            </button>
          </div>
        </Card>

        {/* Finances */}
        {isEditing ? (
          <Card className="mb-6 p-6">
            <h3 className="text-lg font-semibold text-text mb-4">Редактировать финансы</h3>
            <div className="space-y-4">
              <Input
                label="Ежемесячный доход (UZS)"
                type="number"
                value={income}
                onChange={e => setIncome(e.target.value)}
              />
              <Input
                label="Ежемесячные расходы (UZS)"
                type="number"
                value={expenses}
                onChange={e => setExpenses(e.target.value)}
              />
              <div className="flex gap-3">
                <Button onClick={handleSave} isLoading={saving} className="flex-1">
                  Сохранить
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="secondary" className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mb-6">
            <h3 className="font-semibold text-text mb-3">Финансы</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <p className="text-text-secondary">Доход</p>
                <p className="text-text font-semibold">{user.income.toLocaleString()} UZS</p>
              </div>
              <div className="flex justify-between">
                <p className="text-text-secondary">Расходы</p>
                <p className="text-text font-semibold">{user.expenses.toLocaleString()} UZS</p>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-bg-input">
                <p className="text-text">Свободно</p>
                <p className={user.income - user.expenses > 0 ? 'text-success' : 'text-danger'}>
                  {(user.income - user.expenses).toLocaleString()} UZS
                </p>
              </div>
            </div>
            <Button onClick={() => setIsEditing(true)} variant="secondary" className="w-full">
              Редактировать
            </Button>
          </Card>
        )}

        {/* About */}
        <Card className="text-sm text-text-secondary mb-6">
          <p className="font-medium text-text mb-2">О приложении</p>
          <p>Kreditly v1.0.0</p>
          <p>Финансовый калькулятор для Telegram</p>
        </Card>

        <Button onClick={() => navigate('/')} variant="secondary" className="w-full">
          На главную
        </Button>
      </div>
    </div>
  )
}
