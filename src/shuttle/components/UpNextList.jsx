// components/UpNextList.jsx
import React, { useRef, useState } from 'react'
import { matchFormatLabel } from '../engine/scheduleEngine'

// How far a shifted row travels while a drag is in progress. Rows are only
// uniform when every round is single-court, so this is measured from the row
// being dragged rather than assumed - see beginDrag.
const GAP_PX = 8

function GripIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}

/**
 * The rounds still to come, in playing order, reorderable by dragging one to
 * a new position. Each row lists only its matches not yet played or on court
 * (see queuedSlots); a round can still carry a result from a match pulled
 * forward, which reordering can't disturb since results go by array index.
 * A row's number is its `roundNumber` when it has one.
 *
 * The drag runs on pointer events rather than HTML5 drag-and-drop, which
 * doesn't fire on touch at all - this is a phone-in-one-hand screen court-side
 * far more often than it's a desktop one. The grip is the only drag handle so
 * that a finger dragged anywhere else still scrolls the page, and it carries
 * arrow-key handling too, since a drag is unusable with a keyboard.
 *
 * `onMove(fromSlot, toSlot)` gets slot numbers, not positions: the caller
 * renumbers the running order (see moveSlot), and the row a round is drawn in
 * is not its index in the schedule array.
 */
export default function UpNextList({ rows, startNumber = 1, isMultiCourt, playersById, onMove, disabled = false }) {
  // { from, to, dy, height } while a row is in hand, null otherwise.
  const [drag, setDrag] = useState(null)
  const rowRefs = useRef([])
  // Row geometry is measured once at drag start: the rows themselves are
  // moving under the finger, so re-measuring mid-drag would chase itself.
  const rectsRef = useRef([])

  const canReorder = !disabled && rows.length > 1

  const beginDrag = (i, e) => {
    if (!canReorder) return
    const rects = rowRefs.current.slice(0, rows.length).map((el) => el?.getBoundingClientRect())
    if (rects.some((r) => !r)) return
    rectsRef.current = rects
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ from: i, to: i, startY: e.clientY, dy: 0, height: rects[i].height + GAP_PX })
  }

  const onPointerMove = (e) => {
    if (!drag) return
    const rects = rectsRef.current
    const dy = e.clientY - drag.startY
    const center = rects[drag.from].top + rects[drag.from].height / 2 + dy
    const centerOf = (j) => rects[j].top + rects[j].height / 2

    // Walk outward from the row's home position for as long as its centre has
    // passed the next neighbour's, so the target only ever moves one row at a
    // time however fast the finger travels.
    let to = drag.from
    if (dy > 0) {
      for (let j = drag.from + 1; j < rects.length; j++) {
        if (center > centerOf(j)) to = j
      }
    } else if (dy < 0) {
      for (let j = drag.from - 1; j >= 0; j--) {
        if (center < centerOf(j)) to = j
      }
    }
    setDrag((d) => (d ? { ...d, dy, to } : d))
  }

  const endDrag = () => {
    if (!drag) return
    const { from, to } = drag
    setDrag(null)
    if (from !== to) onMove(rows[from].slot, rows[to].slot)
  }

  const onKeyDown = (i, e) => {
    if (!canReorder) return
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    const target = i + delta
    if (target < 0 || target >= rows.length) return
    e.preventDefault()
    onMove(rows[i].slot, rows[target].slot)
  }

  // Where each row sits while another is in hand: the dragged one follows the
  // finger, everything it has passed slides one place the other way.
  const offsetFor = (i) => {
    if (!drag) return 0
    if (i === drag.from) return drag.dy
    if (drag.to > drag.from && i > drag.from && i <= drag.to) return -drag.height
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.height
    return 0
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ slot, matches }, i) => {
        const held = drag?.from === i
        return (
          <div
            key={slot}
            ref={(el) => (rowRefs.current[i] = el)}
            style={{ transform: `translateY(${offsetFor(i)}px)` }}
            className={`flex items-start gap-2 bg-white dark:bg-gray-900 border rounded-lg pl-1 pr-3 py-2 text-sm ${
              held
                ? 'relative z-10 border-brand dark:border-brand shadow-lg'
                : 'border-gray-200 dark:border-gray-800 transition-transform duration-150'
            }`}
          >
            <button
              type="button"
              aria-label={`Reorder round ${rows[i].roundNumber ?? startNumber + i}`}
              disabled={!canReorder}
              onPointerDown={(e) => beginDrag(i, e)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(e) => onKeyDown(i, e)}
              // touch-none keeps the page from scrolling out from under a drag
              // that starts on the grip; everywhere else on the row still scrolls.
              className={`touch-none shrink-0 -my-1 px-1 py-2 rounded text-gray-300 dark:text-gray-600 ${
                canReorder
                  ? 'cursor-grab active:cursor-grabbing hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                  : 'opacity-40'
              }`}
            >
              <GripIcon className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4 text-center shrink-0 mt-0.5">
              {rows[i].roundNumber ?? startNumber + i}
            </span>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {matches.map(({ index, match, court }) => (
                <span key={index} className="text-gray-900 dark:text-gray-100 truncate">
                  {isMultiCourt && (
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mr-1.5">
                      C{court}
                      {matchFormatLabel(match) === 'Singles' ? ' · S' : matchFormatLabel(match) ? ' · 2v1' : ''}
                    </span>
                  )}
                  {match.team1.map((pid) => playersById[pid]?.name || pid).join(' & ')}
                  <span className="text-gray-400 dark:text-gray-500 mx-1.5">vs</span>
                  {match.team2.map((pid) => playersById[pid]?.name || pid).join(' & ')}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
