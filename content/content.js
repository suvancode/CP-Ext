/**
 * ContinueO Auto Login - Content Script & State Machine Controller
 *
 * Runs directly on https://student.bmsit.ac.in/* to execute the
 * two-step login automation sequence safely and deterministically.
 */
(function() {
  'use strict';

  const Constants = window.ContinueOConstants || {
    States: {
      IDLE: 'IDLE',
      OPENING_PORTAL: 'OPENING_PORTAL',
      DETECTING_LOGIN_PAGE: 'DETECTING_LOGIN_PAGE',
      FILLING_USN_AND_DOB: 'FILLING_USN_AND_DOB',
      SUBMITTING_LOGIN: 'SUBMITTING_LOGIN',
      WAITING_FOR_ID_CARD_PAGE: 'WAITING_FOR_ID_CARD_PAGE',
      FILLING_ID_CARD: 'FILLING_ID_CARD',
      SUBMITTING_ID_CARD: 'SUBMITTING_ID_CARD',
      VERIFYING_SUCCESS: 'VERIFYING_SUCCESS',
      COMPLETED: 'COMPLETED',
      ERROR: 'ERROR',
      MANUAL_INTERVENTION_REQUIRED: 'MANUAL_INTERVENTION_REQUIRED'
    },
    StateMessages: {},
    StorageKeys: {
      AUTO_TRIGGER: 'continueo_auto_trigger',
      CREDENTIALS: 'continueo_credentials'
    }
  };

  const Adapter = window.ContineoAdapter;
  const Overlay = window.ContinueOOverlay;

  let currentState = Constants.States.IDLE;
  let lastMessage = 'Ready';
  let isExecuting = false;

  function updateState(newState, message) {
    currentState = newState;
    lastMessage = message || Constants.StateMessages[newState] || newState;
    console.log(`[ContinueO] State: ${currentState} - ${lastMessage}`);

    if (Overlay && typeof Overlay.update === 'function') {
      Overlay.update(currentState, lastMessage);
    }

    // Inform runtime background
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'UPDATE_STATE',
          state: currentState,
          message: lastMessage
        }, () => {
          // Ignore errors if popup closed
          if (chrome.runtime.lastError) {}
        });
      }
    } catch (e) {}
  }

  async function getAutoTriggerSession() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([Constants.StorageKeys.AUTO_TRIGGER], (res) => {
          resolve(res ? res[Constants.StorageKeys.AUTO_TRIGGER] : null);
        });
      } else {
        resolve(null);
      }
    });
  }

  async function setAutoTriggerSession(session) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [Constants.StorageKeys.AUTO_TRIGGER]: session }, resolve);
      } else {
        resolve();
      }
    });
  }

  async function clearAutoTriggerSession() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove([Constants.StorageKeys.AUTO_TRIGGER], resolve);
      } else {
        resolve();
      }
    });
  }

  async function getStoredCredentials(pin = null) {
    if (window.ContinueOStorage && typeof window.ContinueOStorage.getCredentials === 'function') {
      return await window.ContinueOStorage.getCredentials(pin);
    }
    // Fallback: direct storage read
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([Constants.StorageKeys.CREDENTIALS], (res) => {
        const stored = res ? res[Constants.StorageKeys.CREDENTIALS] : null;
        if (!stored) {
          return reject(new Error('No credentials configured'));
        }
        if (stored.encrypted) {
          const err = new Error('PIN_REQUIRED');
          err.code = 'PIN_REQUIRED';
          return reject(err);
        }
        resolve(stored);
      });
    });
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main automation runner.
   */
  async function runAutomation(passedCredentials = null) {
    if (isExecuting) return;
    isExecuting = true;

    try {
      // 1. Check for immediate portal error messages
      const errorCheck = Adapter.checkForErrors(document);
      if (errorCheck.hasError) {
        await clearAutoTriggerSession();
        updateState(Constants.States.ERROR, `Portal Error: ${errorCheck.message}`);
        isExecuting = false;
        return;
      }

      // 2. Check for Security Challenge (interactive CAPTCHA or OTP)
      const challengeCheck = Adapter.checkForSecurityChallenge(document);
      if (challengeCheck.isChallenge) {
        await clearAutoTriggerSession();
        updateState(
          Constants.States.MANUAL_INTERVENTION_REQUIRED,
          `Security check detected (${challengeCheck.type}). Please complete it manually.`
        );
        isExecuting = false;
        return;
      }

      // 3. Resolve credentials
      let creds = passedCredentials;
      if (!creds) {
        const session = await getAutoTriggerSession();
        if (session && session.credentials) {
          creds = session.credentials;
        } else {
          try {
            creds = await getStoredCredentials();
          } catch (credErr) {
            await clearAutoTriggerSession();
            updateState(Constants.States.ERROR, 'Credentials required. Open extension to configure.');
            isExecuting = false;
            return;
          }
        }
      }

      if (!creds || !creds.usn || !creds.idCardNumber) {
        await clearAutoTriggerSession();
        updateState(Constants.States.ERROR, 'Invalid or incomplete credentials.');
        isExecuting = false;
        return;
      }

      // 4. Detect Current Page
      updateState(Constants.States.DETECTING_LOGIN_PAGE, 'Detecting ContinueO page…');
      let pageType = Adapter.detectPageType(document);

      // Handle Page 1: USN & DOB
      if (pageType === 'PAGE1') {
        updateState(Constants.States.FILLING_USN_AND_DOB, 'Entering USN and Date of Birth…');
        await delay(200);

        const fillResult = Adapter.fillLoginPage(document, creds);
        if (!fillResult.success) {
          await clearAutoTriggerSession();
          updateState(Constants.States.ERROR, fillResult.error || 'Failed to fill login details');
          isExecuting = false;
          return;
        }

        // Brief delay before submit to let DOM register inputs and events
        await delay(350);

        // Update trigger session so next page knows automation is in-flight
        await setAutoTriggerSession({
          active: true,
          step: 'WAITING_PAGE2',
          credentials: creds,
          timestamp: Date.now()
        });

        updateState(Constants.States.SUBMITTING_LOGIN, 'Submitting login credentials…');
        const submitResult = Adapter.submitLoginPage(document);
        if (!submitResult.success) {
          await clearAutoTriggerSession();
          updateState(Constants.States.ERROR, submitResult.error || 'Failed to submit login form');
          isExecuting = false;
          return;
        }

        updateState(Constants.States.WAITING_FOR_ID_CARD_PAGE, 'Waiting for verification page…');
        // Navigation will now occur. State will resume on Page 2 load.
        return;
      }

      // Handle Page 2: ID Card Number
      if (pageType === 'PAGE2') {
        updateState(Constants.States.FILLING_ID_CARD, 'Entering ID Card Number…');

        // Poll for ID card input (up to 6 seconds) in case of asynchronous render
        let inputFound = false;
        const maxAttempts = 24;
        for (let i = 0; i < maxAttempts; i++) {
          const fillResult = Adapter.fillIdCardPage(document, creds.idCardNumber);
          if (fillResult.success) {
            inputFound = true;
            break;
          }
          await delay(250);
        }

        if (!inputFound) {
          await clearAutoTriggerSession();
          updateState(Constants.States.ERROR, 'ID Card Number field could not be found');
          isExecuting = false;
          return;
        }

        await delay(350);

        updateState(Constants.States.SUBMITTING_ID_CARD, 'Submitting ID Card verification…');
        const submitResult = Adapter.submitIdCardPage(document);
        if (!submitResult.success) {
          await clearAutoTriggerSession();
          updateState(Constants.States.ERROR, submitResult.error || 'Failed to submit ID Card verification');
          isExecuting = false;
          return;
        }

        updateState(Constants.States.VERIFYING_SUCCESS, 'Verifying login…');
        return;
      }

      // Handle Success Page
      if (pageType === 'SUCCESS') {
        await clearAutoTriggerSession();
        updateState(Constants.States.COMPLETED, '✓ Successfully logged in to ContinueO!');
        isExecuting = false;
        return;
      }

      // Unknown page: Check if already logged in or stuck
      if (pageType === 'UNKNOWN') {
        // Give 2 seconds for page to settle
        await delay(1500);
        const retryType = Adapter.detectPageType(document);
        if (retryType === 'SUCCESS') {
          await clearAutoTriggerSession();
          updateState(Constants.States.COMPLETED, '✓ Successfully logged in to ContinueO!');
        } else if (retryType === 'PAGE2') {
          isExecuting = false;
          runAutomation(creds);
          return;
        } else {
          await clearAutoTriggerSession();
          updateState(Constants.States.ERROR, 'Unrecognized page structure. Automation halted safely.');
        }
      }

    } catch (err) {
      console.error('[ContinueO] Automation Error:', err);
      await clearAutoTriggerSession();
      updateState(Constants.States.ERROR, err.message || 'Unexpected automation error');
    } finally {
      isExecuting = false;
    }
  }

  // Check on page load if an automated login session is in progress
  async function checkPendingAutomation() {
    const session = await getAutoTriggerSession();
    if (!session || !session.active) return;

    // Trigger expiration (60 seconds) to prevent infinite loops
    if (Date.now() - session.timestamp > 60000) {
      await clearAutoTriggerSession();
      return;
    }

    // Small delay to allow portal DOM scripts to execute
    setTimeout(() => {
      runAutomation(session.credentials);
    }, 400);
  }

  // Listen for messages from popup or background worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'START_LOGIN') {
        runAutomation(request.credentials);
        sendResponse({ success: true, state: currentState });
      } else if (request.action === 'GET_STATUS') {
        sendResponse({ state: currentState, message: lastMessage });
      } else if (request.action === 'CANCEL_AUTOMATION') {
        clearAutoTriggerSession();
        updateState(Constants.States.IDLE, 'Automation cancelled');
        if (Overlay) Overlay.hide();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  // Initialize check when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkPendingAutomation);
  } else {
    checkPendingAutomation();
  }

})();
