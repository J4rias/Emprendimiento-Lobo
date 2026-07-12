import { cn } from '../../lib/utils'

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-gray-200', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export function SkeletonText({ lines = 1, className }) {
  const widths = ['w-full', 'w-3/4', 'w-1/2', 'w-5/6', 'w-2/3']
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', widths[i % widths.length])}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 6, columns = 5 }) {
  return (
    <tbody aria-label="Cargando datos">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-gray-200">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4" style={{ width: `${55 + ((i * 3 + j * 7) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}
