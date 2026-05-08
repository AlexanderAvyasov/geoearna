import { InputHTMLAttributes } from 'react'
import { clsx } from '@lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = ({ label, error, hint, className, ...props }: InputProps) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-2 text-text-secondary">{label}</label>}
      <input
        className={clsx(
          'w-full px-4 py-2.5 rounded bg-bg-input border border-bg-card text-text placeholder-text-secondary focus:border-primary focus:outline-none transition-colors',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      {error && <p className="text-danger text-sm mt-1">{error}</p>}
      {hint && !error && <p className="text-text-secondary text-sm mt-1">{hint}</p>}
    </div>
  )
}
