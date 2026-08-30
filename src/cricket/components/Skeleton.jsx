import React from 'react'

const shimmer =
  'bg-gray-200 bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.7)_50%,transparent_70%)] bg-[length:200%_100%] animate-shimmer'

export function CardSkeleton({ className = '' }) {
  return <div className={`${shimmer} rounded-lg ${className}`} />
}

function Line({ className = '' }) {
  return <div className={`${shimmer} rounded ${className}`} />
}

const CARD = 'bg-white border border-gray-200 rounded-lg p-3'

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${CARD} flex items-center justify-between`}>
          <div className="flex flex-col gap-1.5">
            <Line className="h-3.5 w-20" />
            <Line className="h-2.5 w-16" />
          </div>
          <Line className="h-4 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function GridSkeleton({ items = 6 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className={`${CARD} flex flex-col gap-1.5`}>
          <div className={`${shimmer} w-9 h-9 rounded-full mb-1`} />
          <Line className="h-3.5 w-3/4" />
          <Line className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  )
}
