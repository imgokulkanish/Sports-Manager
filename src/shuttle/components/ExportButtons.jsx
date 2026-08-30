// components/ExportButtons.jsx
import React from 'react'
import { exportSchedulePDF, exportResultsPDF, exportSessionCSV } from '../engine/pdfExport'

export default function ExportButtons({ session, players, variant = 'results' }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => (variant === 'schedule' ? exportSchedulePDF(session, players) : exportResultsPDF(session, players))}
        className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg py-2 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        PDF
      </button>
      <button
        onClick={() => exportSessionCSV(session, players)}
        className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg py-2 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        CSV
      </button>
    </div>
  )
}
