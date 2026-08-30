import React from 'react'

export function StatusBadge({ status }) {
  const map = {
    scheduled: 'bg-blue-100 text-blue-800',
    live: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-500 border border-gray-200',
  }
  const label = { scheduled: 'Scheduled', live: 'Live', completed: 'Completed' }[status] || status
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] || ''}`}>{label}</span>
}

const ROLE_STYLES = {
  batsman: 'bg-blue-100 text-blue-800',
  bowler: 'bg-amber-100 text-amber-800',
  allrounder: 'bg-purple-100 text-purple-800',
  wicketkeeper: 'bg-pitch-light text-pitch-dark border border-pitch-border',
}

export function RoleBadge({ role }) {
  if (!role) return null
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_STYLES[role] || 'bg-gray-100 text-gray-500'}`}>{role}</span>
}

export function MetricCard({ label, value, sub, accent = 'gray', icon }) {
  const accentMap = {
    gray: 'text-gray-400',
    blue: 'text-blue-600',
    pitch: 'text-pitch',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon && <span className={accentMap[accent]}>{icon}</span>}
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
