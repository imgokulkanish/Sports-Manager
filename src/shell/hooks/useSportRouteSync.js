// useSportRouteSync.js
//
// Keeps the shell store's `currentSport` in agreement with the URL.
//
// The switcher pushes state one way (click Cricket -> store + navigate), but
// the URL can also change on its own: back/forward, a deep link, a refresh on
// /cricket/history, or an in-page navigate() from a sport's own pages. Without
// this, the store keeps whatever sport was last clicked and the sidebar renders
// the wrong sport's nav next to the other sport's content.
//
// Shared routes (/players, /expenses) carry no sport prefix, so they leave the
// selected sport alone rather than resetting it.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useShellStore, SPORTS } from '../store/useShellStore'

const PREFIX_TO_SPORT = {
  shuttle: SPORTS.SHUTTLE,
  cricket: SPORTS.CRICKET,
}

export function useSportRouteSync() {
  const { pathname } = useLocation()
  const currentSport = useShellStore((s) => s.currentSport)
  const setSport = useShellStore((s) => s.setSport)

  const sportFromPath = PREFIX_TO_SPORT[pathname.split('/')[1]]

  useEffect(() => {
    if (sportFromPath && sportFromPath !== currentSport) setSport(sportFromPath)
  }, [sportFromPath, currentSport, setSport])
}

// Renderless component so App can mount the hook inside <BrowserRouter>.
export default function SportRouteSync() {
  useSportRouteSync()
  return null
}
