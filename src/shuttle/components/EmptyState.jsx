// components/EmptyState.jsx
import React from 'react'

export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="w-14 h-14 rounded-full bg-brand-light dark:bg-brand/15 text-brand dark:text-emerald-400 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{title}</p>
      {message && <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 max-w-[22rem]">{message}</p>}
      {action}
    </div>
  )
}
