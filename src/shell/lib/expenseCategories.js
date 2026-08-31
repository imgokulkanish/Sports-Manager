// expenseCategories.js
//
// Extends Shuttle Manager's existing EXPENSE_CATEGORIES (values frozen,
// per the original file's comment — don't rename these, historical entries
// use them verbatim) with Cricket's own non-overlapping category values.
// Both sports' categories live in one table so categoryLabel()/
// categoryShort() keep their existing signature (no `sport` argument
// needed) — only the entry FORM needs to filter by sport, via
// categoriesForSport().
export const EXPENSE_CATEGORIES = [
  // --- Shuttle Manager (unchanged from the original file — do not rename) ---
  { value: 'court', label: 'Court booking', short: 'Court', sport: 'shuttle' },
  { value: 'shuttles', label: 'Shuttlecocks', short: 'Shuttles', sport: 'shuttle' },
  { value: 'breakfast', label: 'Food after - breakfast, lunch or dinner', short: 'Food', sport: 'shuttle' },
  { value: 'tea', label: 'Pre-match snacks - tea, sandwich, juice', short: 'Snacks', sport: 'shuttle' },

  // --- Cricket Manager (new — pick your own wording/values before shipping,
  //     these are a starting proposal, not a decision) ---
  { value: 'ground', label: 'Ground/turf booking', short: 'Ground', sport: 'cricket' },
  { value: 'equipment', label: 'Bats, balls and other gear', short: 'Bat & Balls', sport: 'cricket' },
  { value: 'cricket-food', label: 'Food after', short: 'Food', sport: 'cricket' },
  { value: 'cricket-snacks', label: 'Pre-match snacks', short: 'Snacks', sport: 'cricket' },
]

export function categoryLabel(value) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value
}

export function categoryShort(value) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.short || value
}

/** Categories relevant to one sport — feeds the entry form's dropdown. */
export function categoriesForSport(sport) {
  return EXPENSE_CATEGORIES.filter((c) => c.sport === sport)
}
