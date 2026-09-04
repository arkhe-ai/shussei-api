import { buildDesktopRedirect, buildDesktopState, parseDesktopState } from './desktop-login';

const NONCE = 'a1b2c3d4e5f60718';

describe('desktop login state', () => {
  it('encodes a desktop sign-in as state', () => {
    expect(buildDesktopState({ desktop: '49732', nonce: NONCE })).toBe(`desktop:49732:${NONCE}`);
  });

  it('treats a request without the desktop marker as a web sign-in', () => {
    expect(buildDesktopState({})).toBeNull();
    expect(buildDesktopState({ nonce: NONCE })).toBeNull();
  });

  it.each([
    ['a privileged port', '80'],
    ['out of range', '70000'],
    ['not a number', '443x'],
    ['negative', '-1'],
    ['fractional', '4000.5'],
  ])('refuses %s rather than trusting it as a port', (_label, desktop) => {
    expect(buildDesktopState({ desktop, nonce: NONCE })).toBeNull();
  });

  it.each([
    ['too short', 'abc'],
    ['not hex', 'ZZZZZZZZZZZZZZZZ'],
    ['carrying a delimiter', 'a1b2c3d4e5f60718:evil'],
    ['carrying a query separator', 'a1b2c3d4e5f60718&code=stolen'],
  ])('refuses a nonce %s', (_label, nonce) => {
    expect(buildDesktopState({ desktop: '49732', nonce })).toBeNull();
  });

  it('reads back what it wrote', () => {
    const state = buildDesktopState({ desktop: '49732', nonce: NONCE });
    expect(parseDesktopState(state)).toEqual({ port: 49732, nonce: NONCE });
  });

  it.each([
    ['absent', undefined],
    ['from a web sign-in', ''],
    ['a foreign prefix', `web:49732:${NONCE}`],
    ['missing the nonce', 'desktop:49732'],
    ['re-validated on the way back', `desktop:80:${NONCE}`],
    ['not a string', 12345],
  ])('answers null for state %s', (_label, state) => {
    expect(parseDesktopState(state)).toBeNull();
  });

  describe('redirect', () => {
    const login = { port: 49732, nonce: NONCE };

    it('always points at loopback, never at a host from the request', () => {
      const url = new URL(buildDesktopRedirect(login, { code: 'abc' }));
      expect(url.protocol).toBe('http:');
      expect(url.hostname).toBe('127.0.0.1');
      expect(url.port).toBe('49732');
      expect(url.pathname).toBe('/callback');
    });

    it('carries the nonce so the app can recognise its own callback', () => {
      const url = new URL(buildDesktopRedirect(login, { code: 'abc' }));
      expect(url.searchParams.get('nonce')).toBe(NONCE);
      expect(url.searchParams.get('code')).toBe('abc');
    });

    it('escapes a parameter instead of letting it grow the query', () => {
      const url = new URL(buildDesktopRedirect(login, { error: 'a&code=stolen' }));
      expect(url.searchParams.get('error')).toBe('a&code=stolen');
      expect(url.searchParams.get('code')).toBeNull();
    });
  });
});
