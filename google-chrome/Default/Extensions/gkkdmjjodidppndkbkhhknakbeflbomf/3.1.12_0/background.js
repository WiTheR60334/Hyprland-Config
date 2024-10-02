import { WEBSITE_URL, API_URL, BROWSER_TYPE, WEB_STORE_URL } from "./config-module.js";
import "./polyfills/browser-polyfill.min.js";


const SELECTEXT_SIGNIN_URL = `${WEBSITE_URL}/login`;
const SELECTEXT_TUTORIAL_URL = `${WEBSITE_URL}/tutorial`;
const DETECT_TEXT_URL = `${API_URL}/detect-text`
const LOG_SELECTION_URL = `${API_URL}/log-selection`
const UPGRADE_URL = `${WEBSITE_URL}/portal/plans`
const IS_SCREENSHOT_UNLOCKED_URL = `${API_URL}/is-screenshot-unlocked`;
const LEAVE_REVIEW_URL = `${WEB_STORE_URL}/reviews`

/**
 * When the user first installs the extension, set the uninstall URL
 */
browser.runtime.onInstalled.addListener(function (details) {
  var uninstallFormLink = 'https://docs.google.com/forms/d/e/1FAIpQLSdixngMC3LLQMTpT7RKNCPtbr8W9pv4mAqNsz4V3ba4xVzJBQ/viewform?usp=sf_link';
  browser.runtime.setUninstallURL(uninstallFormLink);

  if (details.reason === "install") {
    browser.tabs.create({ url: SELECTEXT_TUTORIAL_URL })
  }

  injectContentScriptsOnInstall();
  clearWebsiteCache();
});

async function injectContentScriptsOnInstall() {
  for (const tab of await browser.tabs.query({})) {
    if (tab.url !== undefined) {
      browser.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["initialInjectOnly.js"],
      }).catch((e) => {});
      for (const cs of browser.runtime.getManifest().content_scripts) {
        browser.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: cs.js,
        }).catch((e) => {});
      }
    }
  }
}


browser.commands.onCommand.addListener(async (command) => {
  if (command === "copy-text-from-video") {
    let tabs = await browser.tabs.query({ currentWindow: true, active: true })
    let activeTab = tabs[0];
    await browser.tabs.sendMessage(activeTab.id, {"type": "COPY_TEXT_FROM_VIDEO_SHORTCUT"});
  } else if (command === "copy-video-screenshot") {
    let tabs = await browser.tabs.query({ currentWindow: true, active: true })
    let activeTab = tabs[0];
    await browser.tabs.sendMessage(activeTab.id, {"type": "COPY_VIDEO_SCREENSHOT_SHORTCUT"});
  }
})


/**
 * When the content script to notifies the background script.
 */
browser.runtime.onMessage.addListener((request, sender) => {
  const requestType = request["type"];
  const dataURI = request["dataURI"];

  const url = request["url"]
  if (requestType !== undefined && requestType === "ocr" && dataURI !== undefined) {
    return OCRRequest(dataURI, url, sender.tab.id);
  }

  const currentSelectionInfo = request["currentSelectionInfo"]
  if (currentSelectionInfo !== undefined) {
    return logSelection(currentSelectionInfo)
  }

  const loginComplete = request["loginComplete"];
  if (loginComplete !== undefined && loginComplete === true) {
    OCRAfterManualSignIn()
  }

  const loginInNewTab = request["loginInNewTab"];
  if (loginInNewTab !== undefined && loginInNewTab === true) {
    initiateManualSignin(sender.tab.id)
  }

  const upgradeInNewTab = request["upgradeInNewTab"];
  if (upgradeInNewTab !== undefined && upgradeInNewTab === true) {
    openUpgrade(sender.tab.id);
  }

  const leaveReviewClicked = request["leaveReviewClicked"];
  if (leaveReviewClicked !== undefined && leaveReviewClicked === true) {
    openReview(sender.tab.id);
  }

  if (requestType !== undefined && requestType === "capture") {
    return captureTab();
  }

  if (requestType !== undefined && requestType === "is-screenshot-unlocked") {
    return isScreenshotUnlocked()
  }

  // The message has been resolved but we dont want to send a response
  return false
})


function openUpgrade(activeTabId) {
  browser.tabs.create({ url: UPGRADE_URL, openerTabId: activeTabId })
}


function openReview(activeTabId) {
  browser.tabs.create({ url: LEAVE_REVIEW_URL, openerTabId: activeTabId })
}


async function captureTab() {
  try {
    return await browser.tabs.captureVisibleTab(undefined, { format: "jpeg", quality: 100 })
  } catch {
    return null;
  }
}

function clearWebsiteCache() {
  let clearCachePromise;

  if (BROWSER_TYPE === "firefox") {
    clearCachePromise = browser.browsingData.remove({
      "hostnames": [WEBSITE_URL.replace("https://", "")]
    }, {
      "cache": true
    })
  } else {
    clearCachePromise = browser.browsingData.remove({
      "origins": [WEBSITE_URL]
    }, {
      "cacheStorage": true,
      "cache": true
    })
  }

  clearCachePromise.then(
    () => {
      console.log(`Cleared cache for ${WEBSITE_URL}`)
    },
    (error) => {
      console.log(`Failed to clear cache for ${WEBSITE_URL}`)
      console.log(error)
    }
  );
}


/**
 * Close the tab that get's opened for login, once the user has signed in
 */
function closeTab(tabId) {
  browser.tabs.remove(tabId);
}


/**
 * When the user has made a request for text to be detected
 * @param {Object} videoPosition the position object as returned by getBoundingClientRect
 * @param {Object} viewportDimensions the size of the viewport (position object)
 * @param {Double} quality the quality of the captured video frame
 * @returns The response from the Selectext OCR API
 */
async function OCRRequest(dataURI, url, activeTabId) {
  try {
    const response = await performOCR(dataURI, url);
    if (response.status === 401) {
      await browser.storage.local.set({ "cachedDataUri": dataURI, "cachedUrl": url, "cachedTabId": activeTabId })
      showLoginOnPage(activeTabId);
      return "login";
    } else if (response.status === 403) {
      const json = await response.json();
      return {
        type: "limitExceeded",
        limit: json.limit,
        planIsFree: json.planIsFree
      }
    } else {
      return await response.json();
    }
  } catch(e) {
    return "error";
  }
}


async function OCRAfterManualSignIn() {
  const res = await browser.storage.local.get({ "cachedDataUri": "", "cachedUrl": "", "openLoginTabId": "", "cachedTabId": "" })
  const dataURI = res.cachedDataUri;
  if (dataURI === "") {
    return;
  }
  const url = res.cachedUrl;
  const openLoginTabId = res.openLoginTabId;
  const activeTabId = res.cachedTabId;

  browser.tabs.sendMessage(activeTabId, { type: "login_success" })

  closeTab(openLoginTabId);
  const response = await performOCR(dataURI, url);
  const json = await response.json();

  browser.tabs.sendMessage(activeTabId, { type: "OCR", json: json })
  await browser.storage.local.set({ "cachedDataUri": "", "cachedUrl": "", "openLoginTabId": "", "cachedTabId": "" })
}


/**
 * Send a request to the active tab that prompts it to open the manual sign in UI
 */
function showLoginOnPage(tabId) {
  browser.tabs.sendMessage(tabId, { type: "login" })
}


/**
 * Open a new tab on selectext.app with the sign in UI once the user has continued on the video UI
 */
function initiateManualSignin(activeTabId) {
  browser.tabs.create({ url: SELECTEXT_SIGNIN_URL, openerTabId: activeTabId }).then(
    async (tab) => {
      await browser.storage.local.set({ "openLoginTabId": tab.id })
    }
  );
}


/**
 * Send usage data to Selectext's API. This data is used simply to understand how to improve Selectext.
 * @param {Object} currentSelectionInfo the javascript object containing information about the latest selection made by the user
 */
function logSelection(currentSelectionInfo) {
  fetch(LOG_SELECTION_URL, {
    method: 'POST',
    body: JSON.stringify(currentSelectionInfo),
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
  }).catch((e) => {})
}


/**
 * Call the Selectext API with the data URI extracted from the video frame image
 * @param {string} dataURI the base64 encoded dataURI representing the image
 * @return {Promise} a promise that returns the output of OCR in JSON format
 */
async function performOCR(dataURI, url) {
  const response = await fetch(DETECT_TEXT_URL, {
    method: 'POST',
    body: JSON.stringify({ dataURI: dataURI, url: url }),
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  return response;
}


async function isScreenshotUnlocked() {
  const response = await fetch(IS_SCREENSHOT_UNLOCKED_URL, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  let json = await response.json();
  if (json.hasVideoScreenshot === true) {
    await browser.storage.sync.set({"copyScreenshotUnlocked": true, "copyScreenshotToggleChecked": true, "copyScreenshotKeyboardShortcutChecked": true});
  }
}
