import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGlobalStore } from '@store/global.store'
import { updateUserFinances } from '@services/user.service'
import { getTelegramUserId } from '@lib/telegram'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'

export const OnboardingPage = () => {
  const navigate = useNavigate()
  const { setUser } = useGlobalStore()
  const [income, setIncome] = useState<string>('')
  const [expenses, setExpenses] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ income?: string; expenses?: string }>({})

  const validate = () => {
    const newErrors: typeof errors = {}

    if (!income || Number(income) <= 0) {
      newErrors.income = 'Введите корректный доход'
    }
    if (!expenses || Number(expenses) < 0) {
      newErrors.expenses = 'Введите корректные расходы'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    try {
      const telegramId = getTelegramUserId()
      if (!telegramId) throw new Error('Telegram ID not found')

      const updated = await updateUserFinances(BigInt(telegramId), Number(income), Number(expenses))

      if (updated) {
        setUser(updated)
        navigate('/')
      } else {
        throw new Error('Failed to save finances')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка при сохранении')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg p-4 flex flex-col justify-between">
      <div>
        <h1 className="text-3xl font-bold text-text mt-8 mb-2">Добро пожаловать в Kreditly</h1>
        <p className="text-text-secondary mb-8">Расскажите о своих финансах, чтобы начать</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Ежемесячный доход (UZS)"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={income}
            onChange={e => setIncome(e.target.value)}
            error={errors.income}
            hint="Ваш регулярный ежемесячный доход после налогов"
          />

          <Input
            label="Ежемесячные расходы (UZS)"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={expenses}
            onChange={e => setExpenses(e.target.value)}
            error={errors.expenses}
            hint="Все ваши обычные ежемесячные расходы"
          />

          <Button type="submit" size="lg" className="w-full mt-6" isLoading={loading}>
            Начать
          </Button>
        </form>

        <p className="text-text-secondary text-xs text-center mt-6">
          Вы сможете изменить эти данные позже в профиле
        </p>
      </div>
    </div>
  )
}
