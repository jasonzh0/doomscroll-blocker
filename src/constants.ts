/**
 * Shared constants and small helpers for the Doomscroll Blocker extension.
 */

/** Pixels of downward scroll allowed before the warning fires. */
export const DEFAULT_SCROLL_LIMIT = 4000;
/** YouTube Shorts viewed before the warning fires. */
export const DEFAULT_SHORTS_LIMIT = 10;
/** Smallest scroll distance a user may configure. */
export const MIN_SCROLL_LIMIT = 100;
/** Smallest Shorts count a user may configure. */
export const MIN_SHORTS_LIMIT = 1;

/** Warning flash interval, in milliseconds. */
export const DEFAULT_FLASH_INTERVAL = 700;
/** Time, in seconds, for the page to fade out behind the warning. */
export const DEFAULT_SCREEN_DECAY_TIME = 7;

/** Sites blocked out of the box on first install. */
export const DEFAULT_SITES: readonly string[] = [
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'reddit.com',
  'x.com',
  'youtube.com',
];

/** Accepts a bare domain or a domain with an optional path / trailing wildcard. */
export const SITE_PATTERN =
  /^[a-z0-9.-]+\.[a-z]{2,}(\/[a-z0-9\-._~%!$&'()*+,;=:@/]*\*?)?$/i;

/** Narrowing guard for a finite, usable number. */
export const isValidNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Returns `value` when it is a finite number, otherwise `fallback`. */
export const getStoredNumber = (value: unknown, fallback: number): number =>
  isValidNumber(value) ? value : fallback;

/**
 * Does `href` match any entry in the blocklist?
 *
 * Each stored entry is either a bare domain (`reddit.com`) or a domain with an
 * optional path and trailing `*` wildcard (`reddit.com/r/all*`). Matching is
 * done on the *parsed* hostname (with subdomain awareness) plus a path-prefix
 * check — never a raw substring of the full URL. Substring matching is unsafe:
 * `"x.com"` would otherwise match `max.com`, `netflix.com`, or any URL with
 * `x.com` buried in a path or query string.
 */
export function matchesBlocklist(
  href: string,
  patterns: readonly string[]
): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.toLowerCase();

  return patterns.some((raw) => {
    const pattern = raw.trim().toLowerCase();
    if (!pattern) return false;

    const slash = pattern.indexOf('/');
    const domain = (slash === -1 ? pattern : pattern.slice(0, slash)).replace(
      /^www\./,
      ''
    );
    if (!domain) return false;

    // Exact host or a subdomain of the pattern's domain.
    const hostMatches = host === domain || host.endsWith('.' + domain);
    if (!hostMatches) return false;

    // No path constraint → the host match is enough.
    if (slash === -1) return true;

    let want = pattern.slice(slash); // begins with '/'
    const wildcard = want.endsWith('*');
    if (wildcard) {
      want = want.slice(0, -1);
      return path.startsWith(want);
    }
    // Path without a wildcard matches that path or anything beneath it.
    const boundary = want.endsWith('/') ? want : want + '/';
    return path === want || path.startsWith(boundary);
  });
}
