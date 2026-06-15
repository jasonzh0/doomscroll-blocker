/**
 * Shared types for the Doomscroll Blocker extension.
 */

/** Shape of the data persisted in `chrome.storage.local`. */
export interface StoredState {
  blockedSites?: string[];
  scrollLimit?: number;
  shortsLimit?: number;
}

/** Timing shared by every warning animation. */
export interface WarningConfig {
  flashInterval: number;
  screenDecayTime: number;
}
