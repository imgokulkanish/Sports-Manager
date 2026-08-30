// styles.js
//
// Shared Tailwind class fragments for the small set of interaction states
// that recur across many independent button components. Kept centralized so
// "disabled" (and hover/press) always reads the same way everywhere instead
// of drifting file-to-file (e.g. the old `disabled:opacity-40` on a green
// button faded to a washed-out sage rather than reading as "disabled").

// For solid brand-colored buttons (bg-brand).
export const BTN_SOLID =
  'transition-all active:scale-[0.98] hover:bg-brand-dark disabled:bg-gray-300 disabled:text-gray-400 disabled:hover:bg-gray-300 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 dark:disabled:bg-gray-700 dark:disabled:text-gray-500'

// For light/outline buttons (bg-brand-light + border-brand-border, or plain white/border).
export const BTN_OUTLINE =
  'transition-all active:scale-[0.98] disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 dark:disabled:bg-gray-800 dark:disabled:text-gray-600 dark:disabled:border-gray-700'
