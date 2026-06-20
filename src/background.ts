import {
  DEFAULT_SCROLL_LIMIT,
  DEFAULT_SHORTS_LIMIT,
  DEFAULT_SITES,
  isValidNumber,
} from './constants';
import type { StoredState } from './types';

/**
 * Seed default blocked sites and thresholds on install, without clobbering any
 * values the user has already configured.
 *
 * This is the only background responsibility: the content script self-decides
 * what to block from its own page, so the service worker can stay asleep the
 * rest of the time (no tabs.onUpdated wake-ups, no per-navigation messaging).
 */
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const result = (await chrome.storage.local.get([
      'blockedSites',
      'scrollLimit',
      'shortsLimit',
      'enabled',
    ])) as StoredState;

    const updates: StoredState = {};
    if (!result.blockedSites) {
      updates.blockedSites = [...DEFAULT_SITES];
    }
    if (!isValidNumber(result.scrollLimit)) {
      updates.scrollLimit = DEFAULT_SCROLL_LIMIT;
    }
    if (!isValidNumber(result.shortsLimit)) {
      updates.shortsLimit = DEFAULT_SHORTS_LIMIT;
    }
    if (typeof result.enabled !== 'boolean') {
      updates.enabled = true;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  } catch (error) {
    console.error('Doomscroll Blocker: failed to seed defaults', error);
  }
});
