/**
 * Absolute URL for a backend-served file (resume, logo, photo).
 *
 * Most serializers already return absolute URLs (DRF FileField +
 * build_absolute_uri), but relative "/media/..." paths can still come back
 * from some endpoints — those must resolve against the backend origin
 * (Render), not the SPA origin (Vercel). This normalises at render time.
 */
import { backendUrl } from '../config/api';

export function mediaUrl(path: string | null | undefined): string | null {
  return backendUrl(path);
}
