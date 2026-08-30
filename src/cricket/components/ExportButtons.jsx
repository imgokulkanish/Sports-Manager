import React from 'react'
import { exportScorecardPDF, exportBallByBallCSV } from '../engine/pdfExport'
import { buildShareText } from '../engine/shareExport'
import { useToast } from './Toast'

export default function ExportButtons({ match, players }) {
  const { showToast } = useToast()

  const handleShare = async () => {
    const playersById = Object.fromEntries(players.map((p) => [p.id, p]))
    const text = buildShareText(match, playersById)

    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
        // fall through to clipboard fallback
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard')
    } catch {
      showToast('Could not share or copy — try again', 'error')
    }
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleShare} className="flex-1 border border-gray-300 rounded-lg py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
        Share result
      </button>
      <button onClick={() => exportScorecardPDF(match, players)} className="flex-1 border border-gray-300 rounded-lg py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
        PDF
      </button>
      <button onClick={() => exportBallByBallCSV(match)} className="flex-1 border border-gray-300 rounded-lg py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
        CSV
      </button>
    </div>
  )
}
