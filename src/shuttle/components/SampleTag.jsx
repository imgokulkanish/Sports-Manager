// components/SampleTag.jsx
import React from 'react'
import { isLowSample } from '../engine/statsEngine'

/** Small muted "n=X" pill shown next to a stat derived from too few matches to trust. */
export default function SampleTag({ matches, className = '' }) {
  if (!isLowSample(matches)) return null
  return (
    <span
      title={`Based on only ${matches} match${matches === 1 ? '' : 'es'} - small sample`}
      className={`inline-block text-[9px] font-medium leading-none px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 align-middle ${className}`}
    >
      n={matches}
    </span>
  )
}
