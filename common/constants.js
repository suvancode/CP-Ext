/**
 * ContinueO Auto Login - Shared Constants
 * Compatible with Content Scripts, Service Worker, Popups, and Node.js testing.
 */
(function(root) {
  'use strict';

  const Constants = {
    PORTAL_URL: 'https://student.bmsit.ac.in/parents/index.php',
    PORTAL_ORIGIN: 'https://student.bmsit.ac.in',
    PORTAL_PATH: '/parents/index.php',

    // Automation States (as specified in requirements)
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

    // Human-friendly status descriptions
    StateMessages: {
      IDLE: 'Ready to log in',
      OPENING_PORTAL: 'Opening ContinueO portal…',
      DETECTING_LOGIN_PAGE: 'Detecting login page…',
      FILLING_USN_AND_DOB: 'Entering USN and Date of Birth…',
      SUBMITTING_LOGIN: 'Submitting login credentials…',
      WAITING_FOR_ID_CARD_PAGE: 'Waiting for verification page…',
      FILLING_ID_CARD: 'Entering ID Card number…',
      SUBMITTING_ID_CARD: 'Submitting ID Card verification…',
      VERIFYING_SUCCESS: 'Verifying successful login…',
      COMPLETED: '✓ Successfully logged in!',
      ERROR: 'Automation encountered an error',
      MANUAL_INTERVENTION_REQUIRED: 'Manual intervention required (CAPTCHA/OTP)'
    },

    // Message Actions for runtime communication
    Actions: {
      START_LOGIN: 'START_LOGIN',
      GET_STATUS: 'GET_STATUS',
      TRIGGER_LOGIN_IN_TAB: 'TRIGGER_LOGIN_IN_TAB',
      UPDATE_STATE: 'UPDATE_STATE',
      CANCEL_AUTOMATION: 'CANCEL_AUTOMATION',
      GET_CREDENTIALS: 'GET_CREDENTIALS',
      SAVE_CREDENTIALS: 'SAVE_CREDENTIALS',
      CLEAR_CREDENTIALS: 'CLEAR_CREDENTIALS',
      CHECK_CREDENTIALS: 'CHECK_CREDENTIALS'
    },

    // Storage keys
    StorageKeys: {
      CREDENTIALS: 'continueo_credentials',
      SETTINGS: 'continueo_settings',
      LAST_LOGIN_STATE: 'continueo_last_state',
      AUTO_TRIGGER: 'continueo_auto_trigger'
    },

    // Timeouts and delays (ms)
    Timeouts: {
      PAGE_LOAD_TIMEOUT: 15000,
      ELEMENT_DETECT_TIMEOUT: 10000,
      POLL_INTERVAL: 200,
      ACTION_DELAY: 350
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Constants;
  }
  if (root) {
    root.ContinueOConstants = Constants;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
