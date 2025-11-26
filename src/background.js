/**
 * Default list of sites to block for doomscrolling prevention
 * @type {string[]}
 */
const defaultSites = [
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'reddit.com',
  'x.com',
  'youtube.com',
];

const DEFAULT_SCROLL_LIMIT = 4000;
const DEFAULT_SHORTS_LIMIT = 10;
const isValidNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Initialize blocked sites list on extension installation
 * Sets default sites if no custom list exists
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    ['blockedSites', 'scrollLimit', 'shortsLimit'],
    function (result) {
      const updates = {};
      if (!result.blockedSites) {
        updates.blockedSites = defaultSites;
      }
      if (!isValidNumber(result.scrollLimit)) {
        updates.scrollLimit = DEFAULT_SCROLL_LIMIT;
      }
      if (!isValidNumber(result.shortsLimit)) {
        updates.shortsLimit = DEFAULT_SHORTS_LIMIT;
      }

      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    }
  );
});

/**
 * Listen for tab updates and check if the loaded site should be blocked
 * Sends message to content script when page finishes loading
 */
chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, {
      action: 'checkBlockedSite',
      url: tab.url,
    });
  }
});
