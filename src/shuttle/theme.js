// Shim — the real ThemeProvider/useTheme now lives at src/theme.jsx (shared
// across the whole shell). Kept as a re-export so Settings.jsx's existing
// `from '../theme'` import continues to work unmodified.
export * from '../theme'
