// useFirstRun.js
//
// True only while the first-run sport picker is on screen: no sport has ever
// been chosen AND we're on "/", the one route that asks. See
// shell/pages/SportPicker.jsx for the whole rationale.
//
// It exists so the shell chrome can step out of the way. The Sidebar and
// BottomNav both render a sport switcher, and showing either behind the
// picker would offer the same choice twice — and the bottom tab bar would be
// linking into a sport the person hasn't picked yet.
import { useLocation } from 'react-router-dom'
import { useShellStore } from '../store/useShellStore'

export function useFirstRun() {
  const { pathname } = useLocation()
  const hasChosenSport = useShellStore((s) => s.hasChosenSport)
  return pathname === '/' && !hasChosenSport
}

export default useFirstRun
