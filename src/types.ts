/**
 * Shared types for the Doomscroll Blocker extension.
 */

/** Shape of the data persisted in `chrome.storage.local`. */
export interface StoredState {
  blockedSites?: string[];
  scrollLimit?: number;
  shortsLimit?: number;
  /** Master switch. When `false`, the extension does no blocking at all. */
  enabled?: boolean;
}

/** Timing shared by every warning animation. */
export interface WarningConfig {
  flashInterval: number;
  screenDecayTime: number;
}
