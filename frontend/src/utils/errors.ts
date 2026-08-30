/**
 * Extract a human-readable error message from an Axios/DRF error response.
 *
 * The backend (portal/exceptions.py) wraps every API error in a consistent
 * envelope: { error, message, code, fields? }. For validation failures `error`
 * is a flattened string that already includes the field name
 * (e.g. "email: Enter a valid email address.") and the raw DRF per-field map
 * is preserved under `fields`. Some code paths may still return a bare DRF
 * field map such as { email: ["Enter a valid email address."] }, so we handle
 * that too.
 *
 * Returns `fallback` when no usable message can be extracted.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const response =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: unknown; status?: number } }).response
      : undefined;
  const resp = response?.data;

  if (!isRecord(resp)) {
    // A throttled request can be rejected before any JSON body is parsed
    // (e.g. a proxy-level limiter), so still say something useful.
    if (response?.status === 429) return 'Too many attempts. Please try again in a few minutes.';
    return fallback;
  }

  // 429: the envelope carries `retry_after` in seconds. Tell the user how long
  // to wait instead of a vague "try again later".
  if (response?.status === 429 || resp.code === 'too_many_requests') {
    const seconds = typeof resp.retry_after === 'number' ? resp.retry_after : null;
    return `Too many attempts. Please try again${seconds ? ` in ${formatWait(seconds)}` : ' in a few minutes'}.`;
  }

  // Custom envelope: a flattened top-level message (includes the field name
  // for validation errors, e.g. "email: Enter a valid email address.").
  const envelopeMsg =
    firstString(resp.error) ?? firstString(resp.message) ?? firstString(resp.detail);
  if (envelopeMsg) return envelopeMsg;

  // Envelope keeps the raw DRF field map under `fields`.
  if (isRecord(resp.fields)) {
    const fieldMsg = firstFieldMessage(resp.fields);
    if (fieldMsg) return fieldMsg;
  }

  // Bare DRF field map: { field: ["message", ...] }.
  const fieldMsg = firstFieldMessage(resp);
  if (fieldMsg) return fieldMsg;

  return fallback;
}

function firstString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function firstFieldMessage(fieldMap: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(fieldMap)) {
    if (Array.isArray(value) && firstString(value[0])) {
      // Include the field name, matching the envelope's flattened message
      // format (e.g. "experience_required: This field is required.").
      return `${key}: ${value[0] as string}`;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render a retry delay in seconds as a short human phrase. */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
