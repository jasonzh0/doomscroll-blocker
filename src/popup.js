const DEFAULT_SCROLL_LIMIT = 4000;
const DEFAULT_SHORTS_LIMIT = 10;
const MIN_SCROLL_LIMIT = 100;
const MIN_SHORTS_LIMIT = 1;

const getStoredNumber = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Update the sites count badge
 */
function updateSitesCount(count) {
  const sitesCount = document.getElementById('sitesCount');
  if (sitesCount) {
    sitesCount.textContent = count;
    // Add a little bounce animation when count changes
    sitesCount.style.animation = 'none';
    setTimeout(() => {
      sitesCount.style.animation = 'scaleIn 0.3s ease-out';
    }, 10);
  }
}

/**
 * Render the list of blocked sites in the popup UI
 * Fetches sites from storage and creates list items with remove buttons
 */
function renderSiteList() {
  const siteList = document.getElementById('siteList');

  chrome.storage.local.get(['blockedSites'], function (result) {
    const sites = result.blockedSites || [];

    // Update count badge
    updateSitesCount(sites.length);

    // Clear the list
    siteList.innerHTML = '';

    // Show empty state if no sites
    if (sites.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <div class="empty-icon">📋</div>
        <div>No sites blocked yet</div>
      `;
      siteList.appendChild(emptyState);
      return;
    }

    // Render each site with staggered animation
    sites.forEach((site, index) => {
      const li = document.createElement('li');
      li.style.animationDelay = `${index * 0.05}s`;

      const siteName = document.createElement('span');
      siteName.className = 'site-name';
      siteName.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕ Remove';
      removeBtn.dataset.site = site;
      removeBtn.setAttribute('aria-label', `Remove ${site}`);

      li.appendChild(siteName);
      li.appendChild(removeBtn);
      siteList.appendChild(li);
    });
  });
}

/**
 * Show a temporary success message
 */
function showSuccessMessage(message) {
  const input = document.getElementById('siteInput');
  const originalPlaceholder = input.placeholder;
  input.placeholder = message;
  input.style.borderColor = '#48bb78';
  input.style.background = '#f0fff4';

  setTimeout(() => {
    input.placeholder = originalPlaceholder;
    input.style.borderColor = '';
    input.style.background = '';
  }, 2000);
}

/**
 * Show a temporary error message
 */
function showErrorMessage(message) {
  const input = document.getElementById('siteInput');
  const originalPlaceholder = input.placeholder;
  input.placeholder = message;
  input.style.borderColor = '#f56565';
  input.style.background = '#fff5f5';

  // Shake animation
  input.style.animation = 'shake 0.5s ease-in-out';

  setTimeout(() => {
    input.placeholder = originalPlaceholder;
    input.style.borderColor = '';
    input.style.background = '';
    input.style.animation = '';
  }, 2000);
}

/**
 * Initialize popup UI and set up event listeners
 */
document.addEventListener('DOMContentLoaded', function () {
  const siteInput = document.getElementById('siteInput');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const siteList = document.getElementById('siteList');
  const closeButton = document.getElementById('closeButton');
  const versionNumber = document.getElementById('versionNumber');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsCard = document.querySelector('.settings-card');
  const scrollLimitInput = document.getElementById('scrollLimitInput');
  const shortsLimitInput = document.getElementById('shortsLimitInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  const SETTINGS_OPEN_CLASS = 'is-open';
  const SETTINGS_OPEN_TEXT = 'Hide settings';
  const SETTINGS_CLOSED_TEXT = 'Settings';
  let settingsStatusTimeout;

  // Set version number
  const manifest = chrome.runtime.getManifest();
  if (versionNumber) {
    versionNumber.textContent = manifest.version;
  }

  // Add shake animation to styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);

  renderSiteList();

  const setSettingsStatus = (message, type) => {
    if (!settingsStatus) return;
    settingsStatus.textContent = message;
    settingsStatus.className = 'settings-status';
    if (type) settingsStatus.classList.add(type);
    if (settingsStatusTimeout) {
      clearTimeout(settingsStatusTimeout);
    }
    if (message) {
      settingsStatusTimeout = setTimeout(() => {
        settingsStatus.textContent = '';
        settingsStatus.className = 'settings-status';
      }, 3000);
    }
  };

  const populateSettingsInputs = () => {
    if (!scrollLimitInput || !shortsLimitInput) return;
    chrome.storage.local.get(['scrollLimit', 'shortsLimit'], function (result) {
      scrollLimitInput.value = getStoredNumber(result.scrollLimit, DEFAULT_SCROLL_LIMIT);
      shortsLimitInput.value = getStoredNumber(result.shortsLimit, DEFAULT_SHORTS_LIMIT);
    });
  };

  const toggleSettings = () => {
    if (!settingsToggle || !settingsCard) return;
    const willOpen = !settingsCard.classList.contains(SETTINGS_OPEN_CLASS);
    if (willOpen) {
      settingsCard.classList.add(SETTINGS_OPEN_CLASS);
      settingsCard.setAttribute('aria-hidden', 'false');
      settingsToggle.textContent = SETTINGS_OPEN_TEXT;
      populateSettingsInputs();
    } else {
      settingsCard.classList.remove(SETTINGS_OPEN_CLASS);
      settingsCard.setAttribute('aria-hidden', 'true');
      settingsToggle.textContent = SETTINGS_CLOSED_TEXT;
      setSettingsStatus('');
    }
  };

  if (settingsToggle) {
    settingsToggle.addEventListener('click', () => {
      toggleSettings();
    });
    settingsToggle.textContent = SETTINGS_CLOSED_TEXT;
  }

  if (scrollLimitInput && shortsLimitInput) {
    populateSettingsInputs();
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      if (!scrollLimitInput || !shortsLimitInput) return;
      const scrollLimit = Number(scrollLimitInput.value);
      const shortsLimit = Number(shortsLimitInput.value);

      if (!Number.isFinite(scrollLimit) || scrollLimit < MIN_SCROLL_LIMIT) {
        setSettingsStatus(`Scroll distance must be at least ${MIN_SCROLL_LIMIT} px`, 'error');
        return;
      }

      if (!Number.isFinite(shortsLimit) || shortsLimit < MIN_SHORTS_LIMIT) {
        setSettingsStatus(`Shorts limit must be at least ${MIN_SHORTS_LIMIT}`, 'error');
        return;
      }

      chrome.storage.local.set(
        {
          scrollLimit,
          shortsLimit,
        },
        function () {
          if (chrome.runtime.lastError) {
            console.error('Error saving thresholds:', chrome.runtime.lastError);
            setSettingsStatus('Unable to save thresholds', 'error');
            return;
          }
          setSettingsStatus('Thresholds saved', 'success');
        }
      );
    });
  }

  // Add site on Enter key
  siteInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      addSiteBtn.click();
    }
  });

  addSiteBtn.addEventListener('click', function () {
    const site = siteInput.value.trim().toLowerCase();
    if (!site) {
      showErrorMessage('Please enter a website URL');
      return;
    }

    if (
      !/^[a-z0-9.-]+\.[a-z]{2,}(\/[a-z0-9\-._~%!$&'()*+,;=:@/]*\*?)?$/i.test(
        site
      )
    ) {
      showErrorMessage('Invalid domain format');
      return;
    }

    chrome.storage.local.get(['blockedSites'], function (result) {
      const sites = result.blockedSites || [];
      if (sites.includes(site)) {
        showErrorMessage('Site already blocked');
        return;
      }
      sites.push(site);
      chrome.storage.local.set({ blockedSites: sites }, function () {
        if (chrome.runtime.lastError) {
          console.error('Error saving site:', chrome.runtime.lastError);
          showErrorMessage('Error saving site');
          return;
        }
        siteInput.value = '';
        showSuccessMessage('✓ Site added successfully!');
        renderSiteList();
      });
    });
  });

  siteList.addEventListener('click', function (e) {
    if (e.target.tagName === 'BUTTON') {
      const site = e.target.dataset.site;
      const listItem = e.target.closest('li');

      // Add removing animation
      listItem.classList.add('removing');

      // Wait for animation to complete before removing
      setTimeout(() => {
        chrome.storage.local.get(['blockedSites'], function (result) {
          const sites = result.blockedSites.filter((s) => s !== site);
          chrome.storage.local.set({ blockedSites: sites }, function () {
            if (chrome.runtime.lastError) {
              console.error('Error removing site:', chrome.runtime.lastError);
              return;
            }
            renderSiteList();
          });
        });
      }, 300);
    }
  });

  closeButton.addEventListener('click', function () {
    window.close();
  });
});
