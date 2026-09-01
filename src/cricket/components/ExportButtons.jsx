import React from 'react'
import { exportScorecardPDF, exportBallByBallCSV } from '../engine/pdfExport'
import { buildShareText, buildScorecardShareText } from '../engine/shareExport'
import WhatsAppShareButton from '../../shell/components/WhatsAppShareButton'
import { useToast } from '../../shell/components/Toast'

const OUTLINE_BTN =
  'flex-1 border border-gray-300 rounded-lg py-2 text-xs font-medium text-gray-700 hover:bg-gray-50'

export default function ExportButtons({ match, players }) {
  const { showToast } = useToast()
  const playersById = React.useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  // The WhatsApp button sends the whole scorecard — it's there to replace
  // screenshotting the page. "Share result" stays the one-line version for
  // every other destination the OS sheet offers.
  const scorecardText = () => buildScorecardShareText(match, playersById)
  const resultLine = () => buildShareText(match, playersById)

  const handleShare = async () => {
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
    <div className="flex flex-col gap-2">
      <WhatsAppShareButton buildText={scorecardText} buildShortText={resultLine} />
      <div className="flex gap-2">
        <button onClick={handleShare} className={OUTLINE_BTN}>
          Share result
        </button>
        <button onClick={() => exportScorecardPDF(match, players)} className={OUTLINE_BTN}>
          PDF
        </button>
        <button onClick={() => exportBallByBallCSV(match)} className={OUTLINE_BTN}>
          CSV
        </button>
      </div>
    </div>
  )
}
