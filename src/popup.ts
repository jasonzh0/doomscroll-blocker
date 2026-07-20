import {
  DEFAULT_SCROLL_LIMIT,
  DEFAULT_SHORTS_LIMIT,
  DEFAULT_WARNING_MESSAGE,
  MAX_WARNING_MESSAGE_LENGTH,
  MIN_SCROLL_LIMIT,
  MIN_SHORTS_LIMIT,
  SITE_PATTERN,
  getStoredAlertSound,
  getStoredMessage,
  getStoredNumber,
} from './constants';
import type { StoredState } from './types';

type StatusKind = 'success' | 'error';

/** Update a sites count badge, with a small pop animation. */
function updateSitesCount(elementId: string, count: number): void {
  const countElement = document.getElementById(elementId);
  if (!countElement) return;

  countElement.textContent = String(count);
  countElement.style.animation = 'none';
  window.setTimeout(() => {
    countElement.style.animation = 'countPop 0.3s ease-out';
  }, 10);
}

/** Build the empty-state node using DOM APIs (no innerHTML). */
function buildEmptyState(messageText: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-icon';
  icon.textContent = '⌖';

  const message = document.createElement('div');
  message.textContent = messageText;

  wrap.append(icon, message);
  return wrap;
}

/** Build one monitored-site row. */
function buildSiteRow(site: string, index: number): HTMLLIElement {
  const li = document.createElement('li');
  li.style.animationDelay = `${index * 0.05}s`;

  const siteName = document.createElement('span');
  siteName.className = 'site-name';
  siteName.textContent = site;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remove';
  removeBtn.dataset.site = site;
  removeBtn.setAttribute('aria-label', `Remove ${site}`);

  li.append(siteName, removeBtn);
  return li;
}

/** Render the monitored-sites list from storage. */
async function renderSiteList(): Promise<void> {
  const siteList = document.getElementById('siteList');
  if (!siteList) return;

  let result: StoredState;
  try {
    result = (await chrome.storage.local.get(['blockedSites'])) as StoredState;
  } catch {
    return;
  }

  const sites = result.blockedSites ?? [];
  updateSitesCount('sitesCount', sites.length);
  siteList.replaceChildren();

  if (sites.length === 0) {
    siteList.appendChild(
      buildEmptyState('No targets monitored — register a site to begin.')
    );
    return;
  }

  sites.forEach((site, index) =>
    siteList.appendChild(buildSiteRow(site, index))
  );
}

/** Render the sites that override broader monitored-domain matches. */
async function renderExcludedSiteList(): Promise<void> {
  const excludedSiteList = document.getElementById('excludedSiteList');
  if (!excludedSiteList) return;

  let result: StoredState;
  try {
    result = (await chrome.storage.local.get(['excludedSites'])) as StoredState;
  } catch {
    return;
  }

  const sites = result.excludedSites ?? [];
  updateSitesCount('excludedSitesCount', sites.length);
  excludedSiteList.replaceChildren();

  if (sites.length === 0) {
    excludedSiteList.appendChild(
      buildEmptyState('No exclusions — all monitored domains are active.')
    );
    return;
  }

  sites.forEach((site, index) =>
    excludedSiteList.appendChild(buildSiteRow(site, index))
  );
}

/** Briefly recolor the site input to convey a transient message. */
function flashSiteInput(
  inputId: string,
  message: string,
  kind: StatusKind
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;

  const originalPlaceholder = input.placeholder;
  input.placeholder = message;
  input.classList.add(`is-${kind}`);
  if (kind === 'error') {
    input.style.animation = 'shake 0.5s ease-in-out';
  }

  window.setTimeout(() => {
    input.placeholder = originalPlaceholder;
    input.classList.remove(`is-${kind}`);
    input.style.animation = '';
  }, 2000);
}

const showSuccessMessage = (message: string): void =>
  flashSiteInput('siteInput', message, 'success');
const showErrorMessage = (message: string): void =>
  flashSiteInput('siteInput', message, 'error');

document.addEventListener('DOMContentLoaded', () => {
  const siteInput = document.getElementById(
    'siteInput'
  ) as HTMLInputElement | null;
  const addSiteBtn = document.getElementById('addSiteBtn');
  const siteList = document.getElementById('siteList');
  const closeButton = document.getElementById('closeButton');
  const versionNumber = document.getElementById('versionNumber');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsCard = document.querySelector<HTMLElement>('.settings-card');
  const scrollLimitInput = document.getElementById(
    'scrollLimitInput'
  ) as HTMLInputElement | null;
  const shortsLimitInput = document.getElementById(
    'shortsLimitInput'
  ) as HTMLInputElement | null;
  const warningMessageInput = document.getElementById(
    'warningMessageInput'
  ) as HTMLInputElement | null;
  const alertSoundSelect = document.getElementById(
    'alertSoundSelect'
  ) as HTMLSelectElement | null;
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  const enabledToggle = document.getElementById('enabledToggle');
  const powerHint = document.getElementById('powerHint');
  const systemStatus = document.getElementById('systemStatus');
  const systemStatusText = document.getElementById('systemStatusText');
  const excludedSiteInput = document.getElementById(
    'excludedSiteInput'
  ) as HTMLInputElement | null;
  const addExcludedSiteBtn = document.getElementById('addExcludedSiteBtn');
  const excludedSiteList = document.getElementById('excludedSiteList');

  const SETTINGS_OPEN_CLASS = 'is-open';
  const SETTINGS_OPEN_TEXT = 'Hide settings';
  const SETTINGS_CLOSED_TEXT = 'Settings';
  let settingsStatusTimeout: number | undefined;

  if (!siteInput || !addSiteBtn || !siteList || !closeButton) {
    return; // core controls missing — nothing to wire up
  }

  const manifest = chrome.runtime.getManifest();
  if (versionNumber) {
    versionNumber.textContent = manifest.version;
  }

  void renderSiteList();
  void renderExcludedSiteList();

  /** Reflect the master on/off state across the toggle and header indicator. */
  const reflectEnabledState = (enabled: boolean): void => {
    if (enabledToggle) {
      enabledToggle.setAttribute('aria-checked', String(enabled));
    }
    if (powerHint) {
      powerHint.textContent = enabled ? 'Monitoring active' : 'Monitoring paused';
      powerHint.classList.toggle('is-off', !enabled);
    }
    if (systemStatus) {
      systemStatus.classList.toggle('is-offline', !enabled);
    }
    if (systemStatusText) {
      systemStatusText.textContent = enabled ? 'System Online' : 'System Offline';
    }
  };

  const loadEnabledState = async (): Promise<void> => {
    let result: StoredState;
    try {
      result = (await chrome.storage.local.get(['enabled'])) as StoredState;
    } catch {
      return;
    }
    // Unset is treated as enabled (matches the content script's default).
    reflectEnabledState(result.enabled !== false);
  };

  void loadEnabledState();

  if (enabledToggle) {
    enabledToggle.addEventListener('click', async () => {
      const enabled = enabledToggle.getAttribute('aria-checked') !== 'true';
      // Optimistically reflect, then persist.
      reflectEnabledState(enabled);
      try {
        await chrome.storage.local.set({ enabled });
      } catch (error) {
        console.error('Error saving power state:', error);
        reflectEnabledState(!enabled); // revert on failure
      }
    });
  }

  const setSettingsStatus = (message: string, kind?: StatusKind): void => {
    if (!settingsStatus) return;
    settingsStatus.textContent = message;
    settingsStatus.className = 'settings-status';
    if (kind) settingsStatus.classList.add(kind);

    if (settingsStatusTimeout) {
      window.clearTimeout(settingsStatusTimeout);
    }
    if (message) {
      settingsStatusTimeout = window.setTimeout(() => {
        settingsStatus.textContent = '';
        settingsStatus.className = 'settings-status';
      }, 3000);
    }
  };

  const populateSettingsInputs = async (): Promise<void> => {
    if (!scrollLimitInput || !shortsLimitInput) return;
    let result: StoredState;
    try {
      result = (await chrome.storage.local.get([
        'scrollLimit',
        'shortsLimit',
        'warningMessage',
        'alertSound',
      ])) as StoredState;
    } catch {
      return;
    }
    scrollLimitInput.value = String(
      getStoredNumber(result.scrollLimit, DEFAULT_SCROLL_LIMIT)
    );
    shortsLimitInput.value = String(
      getStoredNumber(result.shortsLimit, DEFAULT_SHORTS_LIMIT)
    );
    if (warningMessageInput) {
      warningMessageInput.value = getStoredMessage(
        result.warningMessage,
        DEFAULT_WARNING_MESSAGE
      );
    }
    if (alertSoundSelect) {
      alertSoundSelect.value = getStoredAlertSound(result.alertSound);
    }
  };

  const toggleSettings = (): void => {
    if (!settingsToggle || !settingsCard) return;
    const willOpen = !settingsCard.classList.contains(SETTINGS_OPEN_CLASS);
    if (willOpen) {
      settingsCard.classList.add(SETTINGS_OPEN_CLASS);
      settingsCard.setAttribute('aria-hidden', 'false');
      settingsToggle.textContent = SETTINGS_OPEN_TEXT;
      settingsToggle.setAttribute('aria-expanded', 'true');
      void populateSettingsInputs();
    } else {
      settingsCard.classList.remove(SETTINGS_OPEN_CLASS);
      settingsCard.setAttribute('aria-hidden', 'true');
      settingsToggle.textContent = SETTINGS_CLOSED_TEXT;
      settingsToggle.setAttribute('aria-expanded', 'false');
      setSettingsStatus('');
    }
  };

  if (settingsToggle) {
    settingsToggle.textContent = SETTINGS_CLOSED_TEXT;
    settingsToggle.addEventListener('click', toggleSettings);
  }

  if (scrollLimitInput && shortsLimitInput) {
    void populateSettingsInputs();
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      if (!scrollLimitInput || !shortsLimitInput) return;
      const scrollLimit = Number(scrollLimitInput.value);
      const shortsLimit = Number(shortsLimitInput.value);

      if (!Number.isFinite(scrollLimit) || scrollLimit < MIN_SCROLL_LIMIT) {
        setSettingsStatus(
          `Scroll distance must be at least ${MIN_SCROLL_LIMIT} px`,
          'error'
        );
        return;
      }
      if (!Number.isFinite(shortsLimit) || shortsLimit < MIN_SHORTS_LIMIT) {
        setSettingsStatus(
          `Shorts limit must be at least ${MIN_SHORTS_LIMIT}`,
          'error'
        );
        return;
      }

      // Empty message is allowed — it falls back to the default at warn time.
      const warningMessage = (warningMessageInput?.value ?? '')
        .trim()
        .slice(0, MAX_WARNING_MESSAGE_LENGTH);
      const alertSound = getStoredAlertSound(alertSoundSelect?.value);

      try {
        await chrome.storage.local.set({
          scrollLimit,
          shortsLimit,
          warningMessage,
          alertSound,
        });
        setSettingsStatus('Settings locked in', 'success');
      } catch (error) {
        console.error('Error saving thresholds:', error);
        setSettingsStatus('Unable to save thresholds', 'error');
      }
    });
  }

  siteInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      addSiteBtn.click();
    }
  });

  addSiteBtn.addEventListener('click', async () => {
    const site = siteInput.value.trim().toLowerCase();
    if (!site) {
      showErrorMessage('Enter a website URL');
      return;
    }
    if (!SITE_PATTERN.test(site)) {
      showErrorMessage('Invalid domain format');
      return;
    }

    try {
      const result = (await chrome.storage.local.get([
        'blockedSites',
      ])) as StoredState;
      const sites = result.blockedSites ?? [];
      if (sites.includes(site)) {
        showErrorMessage('Site already monitored');
        return;
      }
      sites.push(site);
      await chrome.storage.local.set({ blockedSites: sites });
      siteInput.value = '';
      showSuccessMessage('Target acquired');
      void renderSiteList();
    } catch (error) {
      console.error('Error saving site:', error);
      showErrorMessage('Error saving site');
    }
  });

  siteList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button || !siteList.contains(button)) return;

    const site = button.dataset.site;
    const listItem = button.closest('li');
    if (!site || !listItem) return;

    listItem.classList.add('removing');
    window.setTimeout(async () => {
      try {
        const result = (await chrome.storage.local.get([
          'blockedSites',
        ])) as StoredState;
        const sites = (result.blockedSites ?? []).filter((s) => s !== site);
        await chrome.storage.local.set({ blockedSites: sites });
        void renderSiteList();
      } catch (error) {
        console.error('Error removing site:', error);
      }
    }, 300);
  });

  if (excludedSiteInput && addExcludedSiteBtn && excludedSiteList) {
    excludedSiteInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        addExcludedSiteBtn.click();
      }
    });

    addExcludedSiteBtn.addEventListener('click', async () => {
      const site = excludedSiteInput.value.trim().toLowerCase();
      if (!site) {
        flashSiteInput('excludedSiteInput', 'Enter a website URL', 'error');
        return;
      }
      if (!SITE_PATTERN.test(site)) {
        flashSiteInput('excludedSiteInput', 'Invalid domain format', 'error');
        return;
      }

      try {
        const result = (await chrome.storage.local.get([
          'excludedSites',
        ])) as StoredState;
        const sites = result.excludedSites ?? [];
        if (sites.includes(site)) {
          flashSiteInput('excludedSiteInput', 'Site already excluded', 'error');
          return;
        }
        sites.push(site);
        await chrome.storage.local.set({ excludedSites: sites });
        excludedSiteInput.value = '';
        flashSiteInput('excludedSiteInput', 'Exception added', 'success');
        void renderExcludedSiteList();
      } catch (error) {
        console.error('Error saving excluded site:', error);
        flashSiteInput('excludedSiteInput', 'Error saving site', 'error');
      }
    });

    excludedSiteList.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      if (!button || !excludedSiteList.contains(button)) return;

      const site = button.dataset.site;
      const listItem = button.closest('li');
      if (!site || !listItem) return;

      listItem.classList.add('removing');
      window.setTimeout(async () => {
        try {
          const result = (await chrome.storage.local.get([
            'excludedSites',
          ])) as StoredState;
          const sites = (result.excludedSites ?? []).filter((s) => s !== site);
          await chrome.storage.local.set({ excludedSites: sites });
          void renderExcludedSiteList();
        } catch (error) {
          console.error('Error removing excluded site:', error);
        }
      }, 300);
    });
  }

  closeButton.addEventListener('click', () => window.close());
});
