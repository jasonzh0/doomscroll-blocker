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
  /** Custom directive headline shown when the warning resolves. */
  warningMessage?: string;
}

/** Timing shared by every warning animation. */
export interface WarningConfig {
  flashInterval: number;
  screenDecayTime: number;
}
