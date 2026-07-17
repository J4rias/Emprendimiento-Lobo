import React from 'react'
import { Warning } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helper?: string
  rows?: number
}

export function Textarea({ label, error, helper, id, rows = 3, className, ...props }: TextareaProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-gray-600 mb-1">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-md border transition-colors bg-white placeholder-gray-400 resize-y',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-primary-500 focus:ring-primary-200',
          props.disabled && 'bg-gray-100 text-gray-400 cursor-not-allowed',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <Warning size={12} weight="bold" />
          {error}
        </p>
      )}
      {helper && !error && (
        <p className="mt-1 text-xs text-gray-500">{helper}</p>
      )}
    </div>
  )
}
