// components/SessionEditModal.jsx
import React, { useEffect, useState } from 'react'

const INPUT =
  'w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm'

export default function SessionEditModal({ open, session, onClose, onSubmit }) {
  const [date, setDate] = useState('')
  const [umpire, setUmpire] = useState('')
  const [courtCost, setCourtCost] = useState('')
  const [waterCost, setWaterCost] = useState('')

  useEffect(() => {
    if (!session) return
    setDate(new Date(session.date).toISOString().slice(0, 10))
    setUmpire(session.umpire || '')
    setCourtCost(session.courtCost ?? '')
    setWaterCost(session.waterCost ?? '')
  }, [session])

  if (!open || !session) return null

  const handleSubmit = () => {
    onSubmit({
      date: new Date(date).toISOString(),
      umpire,
      courtCost: parseFloat(courtCost) || 0,
      waterCost: parseFloat(waterCost) || 0,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[85vh] overflow-y-auto animate-[fadein_0.15s_ease-out]">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit Session</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Umpire</label>
            <input
              type="text"
              value={umpire}
              onChange={(e) => setUmpire(e.target.value)}
              placeholder="Name"
              className={INPUT}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Court cost (SAR)</label>
            <input
              type="number"
              value={courtCost}
              onChange={(e) => setCourtCost(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Water cost (SAR)</label>
            <input
              type="number"
              value={waterCost}
              onChange={(e) => setWaterCost(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-4">
          Players and the match schedule can't be changed here — delete and recreate the session for that.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-brand hover:bg-brand-dark py-2.5 text-sm font-medium text-white transition-all active:scale-[0.98]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
