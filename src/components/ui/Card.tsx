import { ReactNode } from 'react'
import { clsx } from '@lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export const Card = ({ children, className, onClick }: CardProps) => {
  return (
    <div
      className={clsx(
        'rounded-lg bg-bg-card p-4 border border-bg-input transition-colors',
        onClick && 'cursor-pointer hover:bg-opacity-80',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
