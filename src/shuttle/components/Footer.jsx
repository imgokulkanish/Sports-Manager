// components/Footer.jsx
import React from 'react'
import { ShuttlecockIcon } from './icons'

export default function Footer() {
  return (
    <div className="text-center py-3 pb-4">
      <p className="text-[11px] text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
        <ShuttlecockIcon className="w-3 h-3" />
        Developed by Gokul Kanish
      </p>
    </div>
  )
}
