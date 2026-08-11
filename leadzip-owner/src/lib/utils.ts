import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build a double-quoted PostgREST `ilike` pattern ("%term%") for a
 * user-supplied search term. Quoting makes commas, parentheses, and dots
 * literal inside `.or()` filter strings (preventing filter injection);
 * embedded quotes and backslashes are backslash-escaped per PostgREST rules.
 */
export function pgrestIlikePattern(term: string) {
  return `"%${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`
}
