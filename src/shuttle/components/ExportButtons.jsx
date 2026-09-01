// components/ExportButtons.jsx
import React from 'react'
import { exportSchedulePDF, exportResultsPDF, exportSessionCSV } from '../engine/pdfExport'
import { buildSessionShareText, buildScheduleShareText } from '../engine/shareExport'
import WhatsAppShareButton from '../../shell/components/WhatsAppShareButton'

const OUTLINE_BTN =
  'flex-1 border border-gray-300 dark:border-gray-700 rounded-lg py-2 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800'

export default function ExportButtons({ session, players, variant = 'results' }) {
  // Both variants share the same message: before a session the match log is
  // the schedule ("not played" on every round), after it it's the scores. A
  // long session drops the log rather than risk a truncated URL — the
  // standings are the part worth sending, and the PDF has the rest.
  const summary = () => buildSessionShareText(session, players)
  const withLog = () => `${summary()}\n${buildScheduleShareText(session, players)}`

  return (
    <div className="flex flex-col gap-2">
      <WhatsAppShareButton buildText={withLog} buildShortText={summary} />
      <div className="flex gap-2">
        <button
          onClick={() => (variant === 'schedule' ? exportSchedulePDF(session, players) : exportResultsPDF(session, players))}
          className={OUTLINE_BTN}
        >
          PDF
        </button>
        <button onClick={() => exportSessionCSV(session, players)} className={OUTLINE_BTN}>
          CSV
        </button>
      </div>
    </div>
  )
}
