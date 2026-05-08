import { ReactNode } from 'react'
import { clsx } from '@lib/utils'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

export const Badge = ({ children, variant = 'default', className }: BadgeProps) => {
  const variantStyles = {
    default: 'bg-bg-card text-text',
    success: 'bg-success bg-opacity-20 text-success',
    warning: 'bg-warning bg-opacity-20 text-warning',
    danger: 'bg-danger bg-opacity-20 text-danger',
  }

  return (
    <span className={clsx('inline-block px-2.5 py-1 rounded text-sm font-medium', variantStyles[variant], className)}>
      {children}
    </span>
  )
}
