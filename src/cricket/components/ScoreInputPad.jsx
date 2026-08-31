import React, { useState } from 'react'

const RUNS = [0, 1, 2, 3, 4, 6]
// Box Cricket with "a six is out" has no 6 to score, so the sixth key
// becomes the dismissal instead of a run — same grid position, so muscle
// memory still lands on the right button.
const BOX_RUNS = [0, 1, 2, 3, 4]

// A batsman can still be run out or stumped off a wide/no ball, even though
// the delivery itself doesn't count as a normal wicket-taking ball — this
// checkbox routes the tap through the wicket flow (with extraType preset)
// instead of logging a plain extra.
export default function ScoreInputPad({ onRun, onWicket, onWide, onNoBall, onWideWicket, onNoBallWicket, onSixOut, sixIsOut = false, disabled }) {
  const [extraRuns, setExtraRuns] = useState(1)
  const [extraWicket, setExtraWicket] = useState(false)

  const fireWide = () => {
    if (extraWicket) onWideWicket(extraRuns)
    else onWide(extraRuns)
    setExtraRuns(1)
    setExtraWicket(false)
  }
  const fireNoBall = () => {
    if (extraWicket) onNoBallWicket(extraRuns)
    else onNoBall(extraRuns)
    setExtraRuns(1)
    setExtraWicket(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {(sixIsOut ? BOX_RUNS : RUNS).map((r) => (
          <button
            key={r}
            onClick={() => onRun(r)}
            disabled={disabled}
            className={`rounded-lg py-4 text-lg font-semibold active:scale-[0.97] transition-transform disabled:opacity-40 ${
              r === 4 || r === 6 ? 'bg-pitch text-white' : 'bg-white border border-gray-300 text-gray-900'
            }`}
          >
            {r}
          </button>
        ))}
        {sixIsOut && (
          <button
            onClick={onSixOut}
            disabled={disabled}
            className="rounded-lg py-4 leading-tight font-semibold bg-red-600 text-white active:scale-[0.97] transition-transform disabled:opacity-40"
          >
            <span className="block text-lg">6</span>
            <span className="block text-[10px] font-medium tracking-wide opacity-90">OUT</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
        <span className="text-[11px] text-gray-500">Extra runs on wide/no ball</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExtraRuns((v) => Math.max(1, v - 1))}
            disabled={disabled}
            aria-label="Decrease extra runs"
            className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 text-sm font-semibold disabled:opacity-40"
          >
            −
          </button>
          <span className="w-4 text-center text-sm font-semibold text-gray-900">{extraRuns}</span>
          <button
            onClick={() => setExtraRuns((v) => v + 1)}
            disabled={disabled}
            aria-label="Increase extra runs"
            className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 text-sm font-semibold disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={() => setExtraWicket((v) => !v)}
        disabled={disabled}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left disabled:opacity-40 ${
          extraWicket ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'
        }`}
      >
        <span className={`w-3.5 h-3.5 rounded-sm border-2 shrink-0 ${extraWicket ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`} />
        <span className={`text-[11px] ${extraWicket ? 'text-amber-800 font-medium' : 'text-gray-500'}`}>
          Also a wicket on this wide/no ball (e.g. run out, stumped)
        </span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onWicket}
          disabled={disabled}
          className="rounded-lg py-3 text-sm font-semibold bg-red-600 text-white active:scale-[0.97] transition-transform disabled:opacity-40"
        >
          Wicket
        </button>
        <button
          onClick={fireWide}
          disabled={disabled}
          className="rounded-lg py-3 text-sm font-semibold bg-amber-500 text-white active:scale-[0.97] transition-transform disabled:opacity-40"
        >
          Wide
        </button>
        <button
          onClick={fireNoBall}
          disabled={disabled}
          className="rounded-lg py-3 text-sm font-semibold bg-amber-500 text-white active:scale-[0.97] transition-transform disabled:opacity-40"
        >
          No ball
        </button>
      </div>
    </div>
  )
}
