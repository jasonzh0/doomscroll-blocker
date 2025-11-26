const DEFAULT_SCROLL_LIMIT = 4000;
const DEFAULT_SHORTS_LIMIT = 10;
const DEFAULT_FLASH_INTERVAL = 700;
const DEFAULT_SCREEN_DECAY_TIME = 7;
const isValidNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Listen for messages from the background script to check if current site is blocked
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkBlockedSite') {
    chrome.storage.local.get(
      ['blockedSites', 'scrollLimit', 'shortsLimit'],
      function (result) {
        const blockedSites = result.blockedSites || [];
        const scrollLimit = isValidNumber(result.scrollLimit)
          ? result.scrollLimit
          : DEFAULT_SCROLL_LIMIT;
        const shortsLimit = isValidNumber(result.shortsLimit)
          ? result.shortsLimit
          : DEFAULT_SHORTS_LIMIT;

        const scrollConfig = { scrollLimit };
        const shortsConfig = { shortsLimit };

        const href = window.location.href;
        const pathname = window.location.pathname;
        const isBlocked = blockedSites.some((site) => href.includes(site));

        if (isBlocked) {
          // Check if we're on YouTube Shorts
          const isShortsPage = pathname.includes('/shorts/');

          if (isShortsPage) {
            // Only initialize once - check if already initialized
            if (!initializeShortsBlocker.isInitialized) {
              initializeShortsBlocker(shortsConfig);
            }
          } else {
            // Clean up Shorts blocker if switching away from Shorts
            if (initializeShortsBlocker.observer) {
              initializeShortsBlocker.observer.disconnect();
              initializeShortsBlocker.isInitialized = false;
            }

            initialSiteBlocker(scrollConfig);
          }
        } else {
          // Clean up event listeners
          if (initialSiteBlocker.scrollHandler) {
            window.removeEventListener(
              'scroll',
              initialSiteBlocker.scrollHandler
            );
          }
          if (initializeShortsBlocker.observer) {
            initializeShortsBlocker.observer.disconnect();
            initializeShortsBlocker.isInitialized = false;
          }
        }

        // Always send response to prevent channel closure error
        sendResponse({ isBlocked });
      }
    );
    return true; // Indicates async response
  }
  return false; // Not handling this message
});

/**
 * Create the warning overlay element with help button
 * @returns {HTMLDivElement} The warning element
 */
function createWarningElement() {
  const element = document.createElement('div');
  element.id = 'doomscroll';
  element.style = `
    height: 100%;
    position: fixed;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 9000;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    color: #f94144;
    font-weight: bolder;
    text-align: center;
    font-size: 7vw;
    transition-property: opacity;
    transition-duration: 0.3s;
    background: rgba(0, 0, 0, 0.95);
  `;

  // Main warning text
  const warningText = document.createElement('div');
  warningText.innerText = 'DOOMSCROLL!';
  warningText.style = `
    margin-bottom: 30px;
  `;

  element.appendChild(warningText);

  return element;
}

/**
 * Create a toggler that flips the warning opacity to produce the flashing effect.
 * @param {HTMLDivElement} warningElement
 * @returns {() => void}
 */
function createWarningFlasher(warningElement) {
  let isVisible = false;
  return () => {
    warningElement.style.opacity = isVisible ? 0 : 1;
    isVisible = !isVisible;
  };
}

/**
 * Apply the doomscroll warning animation sequence.
 * @param {HTMLDivElement} warningElement
 * @param {{FLASH_INTERVAL: number, SCREEN_DECAY_TIME: number}} config
 */
function startWarningAnimation(warningElement, config) {
  document.body.insertAdjacentElement('afterbegin', warningElement);
  const bodyChildren = Array.from(document.body.children);

  for (const child of bodyChildren) {
    if (child.id !== 'doomscroll') {
      child.style.opacity = 1;
      child.style.transitionProperty = 'opacity';
      child.style.transitionDuration = config.SCREEN_DECAY_TIME + 's';
    }
  }

  const toggleWarning = createWarningFlasher(warningElement);
  const flashIntervalId = setInterval(toggleWarning, config.FLASH_INTERVAL);

  for (const child of bodyChildren) {
    if (child.id !== 'doomscroll') {
      child.style.opacity = 0;
    }
  }

  const timeoutId = setTimeout(() => {
    document.body.innerHTML = '';

    clearInterval(flashIntervalId);

    document.body.appendChild(warningElement);
    warningElement.style.opacity = 1;
    warningElement.style.color = '#8ac926';
    warningElement.style.fontFamily = 'sans-serif';

    const warningText = warningElement.querySelector('div');
    if (warningText) {
      warningText.innerText = 'Touch some grass!';
    }

    clearTimeout(timeoutId);
  }, config.SCREEN_DECAY_TIME * 1000);
}

/**
 * Initialize the doomscroll blocker for the current page
 * Sets up scroll tracking and warning display logic
 */
function initialSiteBlocker(config = {}) {
  /**
   * Configuration for doomscroll detection
   * @property {number} SCROLL_LIMIT - Pixels scrolled before triggering warning (4000px)
   * @property {number} FLASH_INTERVAL - Flash animation interval in ms (400ms)
   * @property {number} SCREEN_DECAY_TIME - Time in seconds for fade-out animation (7s)
   */
  const CONFIG = {
    SCROLL_LIMIT: isValidNumber(config.scrollLimit)
      ? config.scrollLimit
      : DEFAULT_SCROLL_LIMIT,
    FLASH_INTERVAL: isValidNumber(config.flashInterval)
      ? config.flashInterval
      : DEFAULT_FLASH_INTERVAL,
    SCREEN_DECAY_TIME: isValidNumber(config.screenDecayTime)
      ? config.screenDecayTime
      : DEFAULT_SCREEN_DECAY_TIME,
  };

  let scrollDistance = 0;
  let isWarningEnabled = false;

  const warningElement = createWarningElement();

  /**
   * Handle scroll events and trigger warning when threshold is exceeded
   */
  const handleScroll = () => {
    const scrollDelta = document.documentElement.scrollTop - scrollDistance;
    scrollDistance = document.documentElement.scrollTop;

    if (scrollDelta > 0 && !isWarningEnabled && scrollDistance > CONFIG.SCROLL_LIMIT) {
      isWarningEnabled = true;
      startWarningAnimation(warningElement, CONFIG);
    }
  };

  window.addEventListener('scroll', handleScroll);
  initialSiteBlocker.scrollHandler = handleScroll;
}

/**
 * Initialize the doomscroll blocker for YouTube Shorts
 * Tracks video views instead of scroll distance
 */
function initializeShortsBlocker(config = {}) {
  /**
   * Configuration for YouTube Shorts detection
   * @property {number} SHORTS_LIMIT - Number of shorts before triggering warning (10 videos)
   * @property {number} FLASH_INTERVAL - Flash animation interval in ms (400ms)
   * @property {number} SCREEN_DECAY_TIME - Time in seconds for fade-out animation (7s)
   */
  const CONFIG = {
    SHORTS_LIMIT: isValidNumber(config.shortsLimit)
      ? config.shortsLimit
      : DEFAULT_SHORTS_LIMIT,
    FLASH_INTERVAL: isValidNumber(config.flashInterval)
      ? config.flashInterval
      : DEFAULT_FLASH_INTERVAL,
    SCREEN_DECAY_TIME: isValidNumber(config.screenDecayTime)
      ? config.screenDecayTime
      : DEFAULT_SCREEN_DECAY_TIME,
  };

  let shortsViewed = 0;
  let isWarningEnabled = false;
  let currentVideoId = null;

  const warningElement = createWarningElement();

  /**
   * Track when a new Short video is viewed
   */
  const trackShortView = () => {
    // Get current video ID from URL
    const match = window.location.pathname.match(/\/shorts\/([^/?]+)/);
    const videoId = match ? match[1] : null;

    // Only count if it's a new video
    if (videoId && videoId !== currentVideoId) {
      currentVideoId = videoId;
      shortsViewed++;

      if (!isWarningEnabled && shortsViewed >= CONFIG.SHORTS_LIMIT) {
        triggerWarning();
      }
    }
  };

  /**
   * Trigger the doomscroll warning overlay
   */
  const triggerWarning = () => {
    isWarningEnabled = true;
    startWarningAnimation(warningElement, CONFIG);
  };

  // Track initial video
  trackShortView();

  // Watch for URL changes (when user swipes to next/previous short)
  let lastUrl = window.location.href;

  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      trackShortView();
    }
  });

  // Observe changes to the document
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Store observer for cleanup
  initializeShortsBlocker.observer = urlObserver;

  // Mark as initialized to prevent re-initialization
  initializeShortsBlocker.isInitialized = true;
}
