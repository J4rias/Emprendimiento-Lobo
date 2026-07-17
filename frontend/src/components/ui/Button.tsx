import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Spinner } from './Spinner'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-500',
        secondary:
          'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-400',
        ghost:
          'text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-400',
        danger:
          'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
        'danger-outline':
          'border border-red-500 text-red-600 hover:bg-red-50 active:bg-red-100 focus-visible:ring-red-400',
        success:
          'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 focus-visible:ring-green-500',
        link:
          'text-primary-700 underline-offset-4 hover:underline focus-visible:ring-primary-500 h-auto p-0',
      },
      size: {
        sm:        'h-8 px-3 text-xs',
        md:        'h-9 px-4',
        lg:        'h-10 px-5',
        icon:      'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp: React.ElementType = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </Comp>
  )
}
