// components/WhatsAppShareButton.jsx
//
// Shared by both apps' export rows: the thing people actually do with a
// finished session or match is paste it into the group chat, and this saves
// them screenshotting the page to do it. Each app supplies its own message
// (see shuttle/engine/shareExport.js and cricket/engine/shareExport.js); the
// hand-off to WhatsApp is identical for both and lives here.
import React from 'react'
import { useToast } from './Toast'

// Conservative ceiling for the percent-encoded wa.me query string; browsers
// start truncating a URL somewhere past this, and a half-sent scorecard is
// worse than a short one.
const MAX_ENCODED_LENGTH = 6000

// Solid glyph rather than a stroked outline like the nav icons: WhatsApp's
// mark is only recognisable filled, and it sits on a coloured button where a
// thin outline would disappear.
function WhatsAppIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2 22l5.36-1.4a9.82 9.82 0 0 0 4.68 1.19h.01c5.43 0 9.85-4.42 9.85-9.86 0-2.63-1.02-5.11-2.88-6.97A9.79 9.79 0 0 0 12.04 2Zm0 1.8c2.15 0 4.17.84 5.69 2.36a7.99 7.99 0 0 1 2.36 5.7c0 4.45-3.62 8.06-8.06 8.06a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.09.81.82-3.02-.19-.31a8.02 8.02 0 0 1-1.24-4.29c0-4.44 3.62-8.06 8.06-8.06Zm-3.2 4.1c-.16 0-.4.06-.62.29-.21.23-.81.79-.81 1.93 0 1.14.83 2.24.94 2.39.12.15 1.6 2.55 3.92 3.47 1.93.76 2.33.61 2.75.57.42-.04 1.35-.55 1.54-1.09.19-.54.19-1 .13-1.09-.06-.1-.21-.16-.44-.27-.23-.12-1.35-.67-1.56-.74-.21-.08-.36-.12-.51.11-.15.23-.58.74-.71.89-.13.15-.26.17-.49.06-.23-.12-.97-.36-1.85-1.14a6.9 6.9 0 0 1-1.28-1.59c-.13-.23-.01-.35.1-.47.1-.1.23-.27.35-.4.11-.14.15-.23.23-.39.08-.15.04-.29-.02-.4-.06-.12-.51-1.25-.71-1.71-.18-.44-.37-.38-.51-.39l-.44-.01Z" />
    </svg>
  )
}

/**
 * @param {() => string} buildText - called on click, so the (potentially
 *   expensive) summary isn't rebuilt on every render. May return a second,
 *   shorter string via `buildShortText` if the first is too long for a URL.
 * @param {() => string} [buildShortText] - fallback message for a session long
 *   enough to blow the URL cap; without one, an over-long message is sent as is.
 */
export default function WhatsAppShareButton({ buildText, buildShortText, label = 'Share to WhatsApp' }) {
  const { showToast } = useToast()

  // wa.me with no phone number opens WhatsApp's "choose a chat" flow — the app
  // on a phone, WhatsApp Web on a desktop — with the message pre-filled, which
  // is one tap fewer than the OS share sheet and the whole point of the button.
  // window.open has to be called straight off the click with nothing awaited
  // before it, or Safari treats it as a pop-up and blocks it.
  const handleClick = () => {
    let text = buildText()
    if (buildShortText && encodeURIComponent(text).length > MAX_ENCODED_LENGTH) text = buildShortText()
    const win = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    if (win) return
    // Pop-up blocked (or nothing registered to handle the URL): leave them
    // with the text rather than nothing, so it can still be pasted by hand.
    if (!navigator.clipboard) {
      showToast('Could not open WhatsApp', 'error')
      return
    }
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('WhatsApp blocked — summary copied instead', 'info'))
      .catch(() => showToast('Could not open WhatsApp', 'error'))
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1DA851] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors active:scale-[0.98]"
    >
      <WhatsAppIcon className="w-4 h-4" />
      {label}
    </button>
  )
}
