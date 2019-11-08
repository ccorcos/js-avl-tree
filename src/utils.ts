export function randomId() {
  return Math.round(Math.random() * 1e10).toString()
}

/**
 * Compares two keys with each other.
 * Returns -1, 0 or 1 if a < b, a == b or a > b respectively.
 */
export function defaultCompare<K>(a: K, b: K): number {
  if (a > b) {
    return 1
  }
  if (a < b) {
    return -1
  }
  return 0
}
