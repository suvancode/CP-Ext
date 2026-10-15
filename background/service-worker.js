/**
 * ContinueO Auto Login - Background Service Worker (Manifest V3)
 *
 * Coordinates tab management (reusing existing tabs or opening new),
 * state synchronization, and login trigger orchestration.
 */

// Import shared constants
importScripts('../common/constants.js');

let currentAutomationState = 'IDLE';
let currentStatusMessage = 'Ready';
let activeTabId = null;

const PORTAL_URL = ContinueOConstants.PORTAL_URL;

/**
 * Finds an existing ContinueO tab or opens a new one.
 */
async function openOrFocusPortalTab() {
  // Query for tabs matching the ContinueO portal URL
  const tabs = await chrome.tabs.query({ url: '*://student.bmsit.ac.in/*' });

  if (tabs && tabs.length > 0) {
    const existingTab = tabs[0];
    activeTabId = existingTab.id;

    // Focus window and activate tab
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    await chrome.tabs.update(existingTab.id, { active: true });

    return { tab: existingTab, isNew: false };
  } else {
    // Open new tab
    const newTab = await chrome.tabs.create({ url: PORTAL_URL, active: true });
    activeTabId = newTab.id;
    return { tab: newTab, isNew: true };
  }
}

/**
 * Initiates the login flow on the ContinueO portal tab.
 */
async function initiateLogin(credentials) {
  currentAutomationState = ContinueOConstants.States.OPENING_PORTAL;
  currentStatusMessage = ContinueOConstants.StateMessages.OPENING_PORTAL;

  // Set the auto-trigger session flag in storage so the content script picks it up
  await chrome.storage.local.set({
    [ContinueOConstants.StorageKeys.AUTO_TRIGGER]: {
      active: true,
      credentials: credentials,
      timestamp: Date.now()
    }
  });

  const { tab, isNew } = await openOrFocusPortalTab();

  if (!isNew) {
    // If reusing existing tab, attempt to send message directly or navigate to index.php
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'START_LOGIN',
        credentials: credentials
      });
    } catch (err) {
      // Content script may not be loaded if tab was discarded; reload tab
      await chrome.tabs.update(tab.id, { url: PORTAL_URL });
    }
  }

  return { success: true, tabId: tab.id };
}

// Runtime message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_LOGIN') {
    initiateLogin(request.credentials)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'GET_STATUS') {
    sendResponse({
      state: currentAutomationState,
      message: currentStatusMessage,
      tabId: activeTabId
    });
    return true;
  }

  if (request.action === 'UPDATE_STATE') {
    currentAutomationState = request.state || currentAutomationState;
    currentStatusMessage = request.message || currentStatusMessage;
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'CANCEL_AUTOMATION') {
    currentAutomationState = ContinueOConstants.States.IDLE;
    currentStatusMessage = 'Automation cancelled';
    chrome.storage.local.remove([ContinueOConstants.StorageKeys.AUTO_TRIGGER]);
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action: 'CANCEL_AUTOMATION' }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }
});
