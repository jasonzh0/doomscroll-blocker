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

/**
 * Initialize blocked sites list on extension installation
 * Sets default sites if no custom list exists
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['blockedSites'], function (result) {
    if (!result.blockedSites) {
      chrome.storage.local.set({ blockedSites: defaultSites });
    }
  });
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
