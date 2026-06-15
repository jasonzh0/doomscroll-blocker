import {
  DEFAULT_FLASH_INTERVAL,
  DEFAULT_SCREEN_DECAY_TIME,
  DEFAULT_SCROLL_LIMIT,
  DEFAULT_SHORTS_LIMIT,
  getStoredNumber,
  matchesBlocklist,
} from './constants';
import type { StoredState, WarningConfig } from './types';
import { runDoomscrollWarning } from './warning';

/** Warning timing is fixed (not user-configurable today). */
const TIMING: WarningConfig = {
  flashInterval: DEFAULT_FLASH_INTERVAL,
  screenDecayTime: DEFAULT_SCREEN_DECAY_TIME,
};

// Page-lifetime state. The content script is one bundle per page, so these
// module-scoped values persist across re-evaluations without leaking globals.
// Thresholds live here (not captured per-blocker) so a settings change applies
// immediately to a running tab without resetting any in-progress count.
let scrollLimit = DEFAULT_SCROLL_LIMIT;
let shortsLimit = DEFAULT_SHORTS_LIMIT;

let activeScrollHandler: ((event: Event) => void) | null = null;
let shortsCleanup: (() => void) | null = null;
let shortsInitialized = false;

/** Minimal shape of the SPA Navigation API we rely on (feature-detected). */
interface NavigationLike {
  addEventListener(type: 'currententrychange', listener: () => void): void;
  removeEventListener(type: 'currententrychange', listener: () => void): void;
}

/**
 * Read storage and decide what (if anything) to block on this page. Runs once
 * on injection and again whenever the blocklist changes.
 */
async function init(): Promise<void> {
  let state: StoredState;
  try {
    state = (await chrome.storage.local.get([
      'blockedSites',
      'scrollLimit',
      'shortsLimit',
    ])) as StoredState;
  } catch {
    return; // storage unavailable (e.g. context invalidated) — nothing to do
  }

  scrollLimit = getStoredNumber(state.scrollLimit, DEFAULT_SCROLL_LIMIT);
  shortsLimit = getStoredNumber(state.shortsLimit, DEFAULT_SHORTS_LIMIT);

  const isBlocked = matchesBlocklist(
    window.location.href,
    state.blockedSites ?? []
  );

  if (!isBlocked) {
    teardownScrollBlocker();
    teardownShortsBlocker();
    return;
  }

  if (window.location.pathname.includes('/shorts/')) {
    teardownScrollBlocker();
    if (!shortsInitialized) {
      initializeShortsBlocker();
    }
  } else {
    teardownShortsBlocker();
    initializeScrollBlocker();
  }
}

/** Stop tracking scroll distance, if a tracker is active. */
function teardownScrollBlocker(): void {
  if (activeScrollHandler) {
    window.removeEventListener('scroll', activeScrollHandler, true);
    activeScrollHandler = null;
  }
}

/** Stop watching for Shorts navigations, if active. */
function teardownShortsBlocker(): void {
  if (shortsCleanup) {
    shortsCleanup();
    shortsCleanup = null;
  }
  shortsInitialized = false;
}

/**
 * Warn once the user scrolls past the configured distance on a blocked page.
 */
function initializeScrollBlocker(): void {
  // Replace any previous tracker so repeated evaluations can't stack listeners.
  teardownScrollBlocker();

  // Accumulated downward scroll distance, summed across every scroll source.
  // Sites like LinkedIn scroll an inner container rather than the document, so
  // we can't rely on `document.documentElement.scrollTop`. Instead we track the
  // last scrollTop per scrolling element and sum the positive deltas.
  let totalScrolled = 0;
  let warned = false;
  const lastTops = new WeakMap<EventTarget, number>();

  const handleScroll = (event: Event): void => {
    // `document`/`window` scroll events report on the scrolling element; an
    // inner container reports on itself (event.target is that element).
    const target = event.target;
    const el =
      target === document || target === window || !(target instanceof Element)
        ? document.scrollingElement || document.documentElement
        : target;
    if (!el) return;

    const top = el.scrollTop;
    const previous = lastTops.get(el) ?? 0;
    lastTops.set(el, top);

    const delta = top - previous;
    if (delta > 0) totalScrolled += delta;

    if (!warned && totalScrolled > scrollLimit) {
      warned = true;
      runDoomscrollWarning(TIMING);
    }
  };

  // Capture phase so we also catch scroll events from inner scroll containers
  // (scroll events don't bubble, but they do propagate during capture).
  window.addEventListener('scroll', handleScroll, {
    passive: true,
    capture: true,
  });
  activeScrollHandler = handleScroll;
}

/**
 * Warn once the user views the configured number of YouTube Shorts. Shorts
 * change the URL without a full navigation, so we count distinct video IDs and
 * watch for same-document navigations.
 */
function initializeShortsBlocker(): void {
  let shortsViewed = 0;
  let warned = false;
  let currentVideoId: string | null = null;

  const trackShortView = (): void => {
    const match = window.location.pathname.match(/\/shorts\/([^/?]+)/);
    const videoId = match ? match[1] : null;

    if (videoId && videoId !== currentVideoId) {
      currentVideoId = videoId;
      shortsViewed += 1;

      if (!warned && shortsViewed >= shortsLimit) {
        warned = true;
        runDoomscrollWarning(TIMING);
      }
    }
  };

  trackShortView();

  const cleanups: Array<() => void> = [];
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;

  if (nav) {
    // Navigation API: the purpose-built signal for same-document SPA nav.
    nav.addEventListener('currententrychange', trackShortView);
    cleanups.push(() =>
      nav.removeEventListener('currententrychange', trackShortView)
    );
  } else {
    // Fallback for older runtimes: history navigations + a body observer.
    let lastUrl = window.location.href;
    const onChange = (): void => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        trackShortView();
      }
    };
    window.addEventListener('popstate', onChange);
    cleanups.push(() => window.removeEventListener('popstate', onChange));

    const observer = new MutationObserver(onChange);
    observer.observe(document.body, { childList: true, subtree: true });
    cleanups.push(() => observer.disconnect());
  }

  shortsCleanup = () => cleanups.forEach((fn) => fn());
  shortsInitialized = true;
}

// React to live config changes so open tabs apply new settings without reload.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes.scrollLimit) {
    scrollLimit = getStoredNumber(
      changes.scrollLimit.newValue,
      DEFAULT_SCROLL_LIMIT
    );
  }
  if (changes.shortsLimit) {
    shortsLimit = getStoredNumber(
      changes.shortsLimit.newValue,
      DEFAULT_SHORTS_LIMIT
    );
  }
  // Only the blocklist changing can flip whether this page is blocked, so only
  // then do we re-evaluate setup/teardown (threshold edits apply live above
  // without resetting any running counter).
  if (changes.blockedSites) {
    void init();
  }
});

void init();
