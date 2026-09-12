// components/RoundCard.jsx
import React, { useState } from 'react'
import Avatar from './Avatar'
import { TeamScorePanel, ManualFinishToggle, hasWon } from './ScorePad'

export default function RoundCard({
  roundNumber,
  totalRounds,
  courtLabel,
  team1Players,
  team2Players,
  restingPlayers,
  onWin,
  disabled,
  targetScore = 21,
}) {
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [manualFinish, setManualFinish] = useState(false)

  // Manual finish bypasses the 21/deuce rule so an umpire can close out a
  // match that was cut short (e.g. time ran out) on the score reached.
  const team1Won = manualFinish ? score1 !== score2 : hasWon(score1, score2, targetScore)
  const team2Won = manualFinish ? score1 !== score2 : hasWon(score2, score1, targetScore)

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-brand rounded-xl p-4 text-center text-white shadow-sm">
        <p className="text-xs opacity-70 mb-1">Round</p>
        <p className="text-3xl font-semibold">{roundNumber}</p>
        <p className="text-xs opacity-60">of {totalRounds}</p>
        {courtLabel && (
          <p className="text-xs font-medium mt-1.5 inline-block bg-white/20 rounded-full px-2.5 py-0.5">
            {courtLabel}
          </p>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
        <TeamScorePanel
          side="Team 1"
          players={team1Players}
          score={score1}
          onScore={setScore1}
          onWin={() => onWin(1, { team1: score1, team2: score2 })}
          winLabel="Team 1 Won"
          canWin={team1Won}
          disabled={disabled}
          targetScore={targetScore}
        />
        <span className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-16">vs</span>
        <TeamScorePanel
          side="Team 2"
          players={team2Players}
          score={score2}
          onScore={setScore2}
          onWin={() => onWin(2, { team1: score1, team2: score2 })}
          winLabel="Team 2 Won"
          canWin={team2Won}
          disabled={disabled}
          targetScore={targetScore}
        />
      </div>

      <ManualFinishToggle on={manualFinish} onToggle={() => setManualFinish((v) => !v)} />

      {restingPlayers?.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">Resting</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {restingPlayers.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <Avatar id={p.id} name={p.name} size="xs" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
