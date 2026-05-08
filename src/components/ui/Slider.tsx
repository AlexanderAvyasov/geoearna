import { useState } from 'react'

interface SliderProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  label?: string
  formatValue?: (value: number) => string
}

export const Slider = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  formatValue,
}: SliderProps) => {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-2 text-text-secondary">{label}</label>}
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-bg-input rounded appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${percentage}%, rgb(19, 24, 41) ${percentage}%, rgb(19, 24, 41) 100%)`,
          }}
        />
        <div className="text-right min-w-[80px]">
          <p className="text-lg font-semibold text-text">{formatValue ? formatValue(value) : value}</p>
        </div>
      </div>
    </div>
  )
}
