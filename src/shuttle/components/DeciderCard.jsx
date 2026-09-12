// components/DeciderCard.jsx
//
// The singles tiebreaker played when two people finish a session level on
// match points. Without it the session is settled on total rally points,
// which can come down to a single point across a whole evening - a real
// enough outcome that the group would rather play for it.
//
// Scored exactly like any other match (see ScorePad's hasWon), just one
// player a side and the buttons carry their names instead of "Team 1".
import React, { useState } from 'react'
import Avatar from './Avatar'
import { TeamScorePanel, ManualFinishToggle, hasWon } from './ScorePad'

export default function DeciderCard({ playerA, playerB, tiedOn, onWin, onCancel, disabled, targetScore = 21 }) {
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [manualFinish, setManualFinish] = useState(false)

  const aWon = manualFinish ? scoreA !== scoreB : hasWon(scoreA, scoreB, targetScore)
  const bWon = manualFinish ? scoreA !== scoreB : hasWon(scoreB, scoreA, targetScore)

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-amber-500 dark:bg-amber-600 rounded-xl p-4 text-center text-white shadow-sm">
        <p className="text-xs opacity-80 mb-1">Tiebreaker</p>
        <p className="text-2xl font-semibold">Singles decider</p>
        <p className="text-xs opacity-80 mt-0.5">
          {playerA.name} vs {playerB.name} — level on {tiedOn} points
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
        <TeamScorePanel
          side={playerA.name}
          players={[playerA]}
          score={scoreA}
          onScore={setScoreA}
          onWin={() => onWin(playerA.id, [scoreA, scoreB])}
          winLabel={`${playerA.name} won`}
          canWin={aWon}
          disabled={disabled}
          targetScore={targetScore}
        />
        <span className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-16">vs</span>
        <TeamScorePanel
          side={playerB.name}
          players={[playerB]}
          score={scoreB}
          onScore={setScoreB}
          onWin={() => onWin(playerB.id, [scoreA, scoreB])}
          winLabel={`${playerB.name} won`}
          canWin={bWon}
          disabled={disabled}
          targetScore={targetScore}
        />
      </div>

      <ManualFinishToggle on={manualFinish} onToggle={() => setManualFinish((v) => !v)} />

      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-gray-400 dark:text-gray-500 underline text-center hover:text-gray-600 dark:hover:text-gray-300"
      >
        Not playing it after all — settle on points scored
      </button>
    </div>
  )
}
