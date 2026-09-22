// backfillTournamentCaptain.js
//
// ONE-TIME, ADDITIVE migration: sets `teamA.captainId` on the matches of one
// tournament that were created before the tournament form asked for a
// captain (it hardcoded `captainId: null` — see NewTournamentMatch.jsx).
// Without this, a whole tournament's rounds are invisible to the captaincy
// stats even though the same person led every one of them.
//
// SAFE BY CONSTRUCTION:
//   - Dry run unless you pass --apply: prints exactly what it would change.
//   - Only ever writes the single nested field `teamA.captainId`, by dot
//     path, so the rest of the teamA map (name, playerIds, umpireId) is
//     untouched.
//   - Skips any match that already has a captain, so it's safe to re-run and
//     can't overwrite a correction made in the UI.
//   - Skips any match where the named captain wasn't in that round's playing
//     XI — a captain who didn't play is a data-entry mistake, not a fact.
//   - Reversible: set the field back to null on the ids it prints.
//
// Run from the repo root (the env files are resolved relative to cwd):
//   node scripts/backfillTournamentCaptain.js --tournament <id|name> --captain "<player name>"
//   node scripts/backfillTournamentCaptain.js --tournament <id|name> --captain "<player name>" --apply
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import dotenv from 'dotenv'

// The Firebase config lives in .env.local (that's what .env.example tells you
// to create, and what Vite itself reads) — plain `dotenv/config` would only
// look at .env and find nothing. .env is still read as a fallback.
dotenv.config({ path: '.env.local' })
dotenv.config()

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

function arg(flag) {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : process.argv[i + 1]
}

async function main() {
  const tournamentArg = arg('--tournament')
  const captainArg = arg('--captain')
  const apply = process.argv.includes('--apply')

  if (!tournamentArg || !captainArg) {
    console.error('Usage: node scripts/backfillTournamentCaptain.js --tournament <id|name> --captain "<player name>" [--apply]')
    process.exit(1)
  }
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('Missing Firebase config. Fill in .env.local before running.')
    process.exit(1)
  }

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  // Resolve the tournament by document id first, then by exact name — the id
  // is what the URL shows, the name is what a human remembers.
  const tournaments = await getDocs(collection(db, 'cricketTournaments'))
  const tournament =
    tournaments.docs.find((d) => d.id === tournamentArg) ||
    tournaments.docs.find((d) => (d.data().name || '').toLowerCase() === tournamentArg.toLowerCase())
  if (!tournament) {
    console.error(`No tournament matching "${tournamentArg}".`)
    process.exit(1)
  }

  const players = await getDocs(collection(db, 'cricketPlayers'))
  const byName = players.docs.filter((d) => (d.data().name || '').toLowerCase() === captainArg.toLowerCase())
  const captain = players.docs.find((d) => d.id === captainArg) || (byName.length === 1 ? byName[0] : null)
  if (!captain) {
    // Ambiguity is fatal rather than resolved by picking the first — writing
    // a whole tournament to the wrong person's record is the exact mistake
    // this script exists to avoid.
    console.error(byName.length > 1 ? `"${captainArg}" matches ${byName.length} players — pass the player id instead.` : `No player named "${captainArg}".`)
    process.exit(1)
  }

  const matches = await getDocs(collection(db, 'cricketMatches'))
  const rounds = matches.docs.filter((d) => d.data().tournamentId === tournament.id)

  console.log(`Tournament: ${tournament.data().name} (${tournament.id})`)
  console.log(`Captain:    ${captain.data().name} (${captain.id})`)
  console.log(`Rounds:     ${rounds.length}\n`)

  let updated = 0
  let skipped = 0

  for (const docSnap of rounds) {
    const data = docSnap.data()
    const label = `${data.tournamentStage || 'Round'} vs ${data.teamB?.name || '?'} [${docSnap.id}]`

    if (data.teamA?.captainId) {
      console.log(`  skip    ${label} — already captained`)
      skipped += 1
      continue
    }
    if (!(data.teamA?.playerIds || []).includes(captain.id)) {
      console.log(`  skip    ${label} — ${captain.data().name} didn't play this round`)
      skipped += 1
      continue
    }

    if (apply) await updateDoc(doc(db, 'cricketMatches', docSnap.id), { 'teamA.captainId': captain.id })
    console.log(`  ${apply ? 'set   ' : 'would '} ${label}`)
    updated += 1
  }

  console.log(
    apply
      ? `\nBackfill complete: ${updated} matches updated, ${skipped} skipped.`
      : `\nDry run: ${updated} matches would be updated, ${skipped} skipped. Re-run with --apply to write.`,
  )
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
