import { ApiException } from './generated/client.api';

/**
 * Extract a human-readable error message from an API call failure.
 *
 * NSwag's `ApiException.message` is always a generic "HTTP status …" string.
 * The actual server message lives in `ApiException.response` as a JSON body
 * shaped `{ statusCode, message }` (from the server's `ApiResponse`).
 */
export function extractApiError(err: unknown, fallback: string): string {
  if (ApiException.isApiException(err)) {
    try {
      const body = JSON.parse(err.response);
      if (typeof body.message === 'string' && body.message) return body.message;
    } catch {
      // response wasn't JSON — fall through
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
