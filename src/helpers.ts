import string from '@poppinss/utils/string'

/**
 * Convert user defined milliseconds to duration expression
 * to seconds
 */
export function timeToSeconds(duration?: string | number): undefined | number {
  return duration ? string.milliseconds.parse(duration) / 1000 : undefined
}
