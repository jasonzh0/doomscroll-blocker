/**
 * Render the list of blocked sites in the popup UI
 * Fetches sites from storage and creates list items with remove buttons
 */
function renderSiteList() {
  const siteList = document.getElementById('siteList');
  siteList.innerHTML = '';

  chrome.storage.local.get(['blockedSites'], function (result) {
    const sites = result.blockedSites || [];
    sites.forEach((site) => {
      const li = document.createElement('li');
      li.textContent = site;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.dataset.site = site;
      li.appendChild(removeBtn);
      siteList.appendChild(li);
    });
  });
}

/**
 * Initialize popup UI and set up event listeners
 */
document.addEventListener('DOMContentLoaded', function () {
  const siteInput = document.getElementById('siteInput');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const closeButton = document.getElementById('closeButton');

  renderSiteList();

  addSiteBtn.addEventListener('click', function () {
    const site = siteInput.value.trim().toLowerCase();
    if (!site) return;

    if (
      !/^[a-z0-9.-]+\.[a-z]{2,}(\/[a-z0-9\-._~%!$&'()*+,;=:@/]*\*?)?$/i.test(
        site
      )
    ) {
      alert(
        'Please enter a valid domain (e.g., example.com or example.com/*)'
      );
      return;
    }

    chrome.storage.local.get(['blockedSites'], function (result) {
      const sites = result.blockedSites || [];
      if (sites.includes(site)) {
        alert('This site is already blocked');
        return;
      }
      sites.push(site);
      chrome.storage.local.set({ blockedSites: sites }, function () {
        if (chrome.runtime.lastError) {
          console.error('Error saving site:', chrome.runtime.lastError);
          return;
        }
        siteInput.value = '';
        renderSiteList();
      });
    });
  });

  siteList.addEventListener('click', function (e) {
    if (e.target.tagName === 'BUTTON') {
      const site = e.target.dataset.site;
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
    }
  });

  closeButton.addEventListener('click', function () {
    window.close();
  });
});
