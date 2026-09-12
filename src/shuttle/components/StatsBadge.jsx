// components/StatsBadge.jsx
import React from 'react'

export function StatusBadge({ status }) {
  const map = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    live: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
    completed: 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  }
  const label = { scheduled: 'Scheduled', live: 'Live', completed: 'Completed' }[status] || status
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] || ''}`}>{label}</span>
}

const METRIC_ACCENTS = {
  gray: {
    border: 'border-l-gray-300 dark:border-l-gray-700',
    iconBg: 'bg-gray-100 dark:bg-gray-800',
    iconText: 'text-gray-500 dark:text-gray-400',
  },
  blue: {
    border: 'border-l-sky-400 dark:border-l-sky-500',
    iconBg: 'bg-sky-50 dark:bg-sky-500/15',
    iconText: 'text-sky-600 dark:text-sky-400',
  },
  brand: {
    border: 'border-l-brand dark:border-l-emerald-500',
    iconBg: 'bg-brand-light dark:bg-brand/15',
    iconText: 'text-brand dark:text-emerald-400',
  },
}

export function MetricCard({ label, value, sub, trend, tag, icon: Icon, accent = 'gray', className = '' }) {
  const a = METRIC_ACCENTS[accent] || METRIC_ACCENTS.gray
  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 ${a.border} rounded-lg p-3 transition-shadow hover:shadow-sm ${className}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {Icon && (
          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${a.iconBg} ${a.iconText}`}>
            <Icon className="w-3 h-3" />
          </span>
        )}
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
      </div>
      <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-1.5">
        {value}
        {tag}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5 min-h-[14px]">
        {sub && <p className="text-[10px] text-gray-500 dark:text-gray-400">{sub}</p>}
        {trend && (
          <span
            className={`text-[10px] font-medium ${
              trend.direction === 'up'
                ? 'text-brand dark:text-emerald-400'
                : trend.direction === 'down'
                ? 'text-red-500'
                : 'text-gray-400'
            }`}
          >
            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '–'} {trend.label}
          </span>
        )}
      </div>
    </div>
  )
}
