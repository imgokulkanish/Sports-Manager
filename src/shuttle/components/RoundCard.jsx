// components/RoundCard.jsx
import React, { useState } from 'react'
import Avatar from './Avatar'
import { TeamScorePanel, ManualFinishToggle, hasWon } from './ScorePad'

export default function RoundCard({
  roundNumber,
  totalRounds,
  courtLabel,
  // Multi-court sessions lead with the court rather than the round: the
  // courts run as separate queues, so two cards can be from different rounds.
  // `court` switches the header over; `note` flags a match started early.
  court = null,
  note = null,
  team1Players,
  team2Players,
  restingPlayers,
  onWin,
  disabled,
  targetScore = 21,
  // Per-side targets for a handicapped 2 vs 1 (e.g. the solo side wins at 15).
  team1Target = targetScore,
  team2Target = targetScore,
}) {
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [manualFinish, setManualFinish] = useState(false)

  // Manual finish bypasses the 21/deuce rule so an umpire can close out a
  // match that was cut short (e.g. time ran out) on the score reached.
  const handicap = team1Target !== team2Target
  const team1Won = manualFinish ? score1 !== score2 : hasWon(score1, score2, team1Target, team2Target)
  const team2Won = manualFinish ? score1 !== score2 : hasWon(score2, score1, team2Target, team1Target)

  return (
    <div className="flex flex-col gap-3">
      {court != null ? (
        <div className="bg-brand rounded-xl px-4 py-3 text-white shadow-sm flex items-center gap-3">
          <p className="text-2xl font-semibold shrink-0">Court {court}</p>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs opacity-80 truncate">
              {courtLabel ? `${courtLabel} · ` : ''}Round {roundNumber} of {totalRounds}
            </p>
            {note && (
              <p className="text-[11px] font-medium mt-1 inline-block bg-white/20 rounded-full px-2 py-0.5">{note}</p>
            )}
          </div>
        </div>
      ) : (
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
      )}

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
          targetScore={team1Target}
          handicap={handicap}
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
          targetScore={team2Target}
          handicap={handicap}
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
