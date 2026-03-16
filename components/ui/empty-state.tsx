import * as React from 'react'
import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode | LucideIcon
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  const iconEl =
    icon == null
      ? null
      : typeof icon === 'function'
        ? React.createElement(icon as LucideIcon, { className: 'h-12 w-12 text-muted-foreground' })
        : React.isValidElement(icon) || typeof icon === 'string' || typeof icon === 'number'
          ? icon
          : null
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {iconEl != null && <div className="mb-4">{iconEl}</div>}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  )
}