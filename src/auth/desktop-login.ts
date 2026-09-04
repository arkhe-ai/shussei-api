/**
 * Loopback callback for the desktop client, as RFC 8252 describes it.
 *
 * Google refuses to run OAuth inside an embedded browser, so the desktop app
 * hands the whole sign-in to the system browser. That browser is not the app,
 * and the session cookie it would receive lands in the wrong place entirely —
 * so a desktop sign-in ends on a loopback address the app is listening on
 * instead of on the web client.
 *
 * The port and nonce make the round trip through Google in the OAuth `state`
 * parameter, which is the only field that survives it.
 */

const STATE_PREFIX = 'desktop';

/** Ephemeral range only: the app binds a random high port, never a service one. */
const MIN_PORT = 1024;
const MAX_PORT = 65535;

/**
 * The nonce is echoed into a URL and compared by the app. Constraining it to
 * hex means it can never carry a delimiter, a query separator or anything else
 * that would let a crafted value rewrite the redirect around it.
 */
const NONCE = /^[a-f0-9]{16,64}$/;

export interface DesktopLogin {
  port: number;
  nonce: string;
}

function readPort(value: unknown): number | null {
  const port = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) return null;
  return port;
}

/**
 * Encodes a desktop sign-in request, or answers null for a normal web one.
 * Anything malformed is treated as a web sign-in rather than rejected: a
 * mistyped query must not be able to stop people logging in.
 */
export function buildDesktopState(query: {
  desktop?: unknown;
  nonce?: unknown;
}): string | null {
  const port = readPort(query.desktop);
  if (port === null) return null;

  const nonce = typeof query.nonce === 'string' ? query.nonce : '';
  if (!NONCE.test(nonce)) return null;

  return `${STATE_PREFIX}:${port}:${nonce}`;
}

/** Reads back what `buildDesktopState` wrote, validating it all over again. */
export function parseDesktopState(state: unknown): DesktopLogin | null {
  if (typeof state !== 'string') return null;

  const [prefix, rawPort, nonce] = state.split(':');
  if (prefix !== STATE_PREFIX || nonce === undefined) return null;

  const port = readPort(rawPort);
  if (port === null || !NONCE.test(nonce)) return null;

  return { port, nonce };
}

/**
 * Always literal `127.0.0.1`, never a host from the request.
 *
 * This URL is where a freshly minted credential is about to be sent, so the
 * destination is not something a query parameter gets to influence. Only the
 * port is variable, and it has already been checked to be a number in range —
 * which is what keeps this from being an open redirect that hands sessions to
 * whoever asks.
 */
export function buildDesktopRedirect(
  login: DesktopLogin,
  params: Record<string, string>,
): string {
  const url = new URL(`http://127.0.0.1:${login.port}/callback`);
  url.searchParams.set('nonce', login.nonce);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
