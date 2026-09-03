/**
 * Safely extract an array from an API response.
 *
 * Axios responses can be:
 *  - A paginated object: `{ count, results: [...] }`  → return `results`
 *  - A flat array: `[...]`                            → return the array
 *  - An HTML string (when the SPA rewrite catches /api/*) → return `[]`
 *  - undefined / null                                 → return `[]`
 *
 * Using this at every `.map()` site prevents the dreaded
 * "X.map is not a function" crash when the backend is offline.
 */
export function asArray<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).results)) {
    return (data as Record<string, unknown>).results as T[];
  }
  return [];
}

/**
 * Same as `asArray` but also unwraps the nested `data` property of an
 * Axios response if accidentally passed in.
 */
export function extractArray<T = unknown>(responseData: unknown): T[] {
  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    return asArray<T>((responseData as Record<string, unknown>).data);
  }
  return asArray<T>(responseData);
}
