/**
 * Joins className fragments, dropping falsy values so conditional classes
 * (`cond && 'x'`, `cond ? 'x' : ''`) don't leave stray empty strings / double spaces.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
