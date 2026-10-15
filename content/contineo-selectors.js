/**
 * ContinueO Auto Login - Portal Selectors & DOM Identifiers
 *
 * Meticulously mapped to the actual BMSIT&M ContinueO parent portal:
 * https://student.bmsit.ac.in/parents/index.php
 */
(function(root) {
  'use strict';

  const ContineoSelectors = {
    PORTAL_URL: 'https://student.bmsit.ac.in/parents/index.php',

    // Page 1 (Login Page) Selectors
    PAGE1: {
      FORM: 'form.cn-landing-login, form#login-form',
      USERNAME_INPUT: '#username, input[name="username"]',
      DAY_SELECT: '#dd, select[name="dd"]',
      MONTH_SELECT: '#mm, select[name="mm"]',
      YEAR_SELECT: '#yyyy, select[name="yyyy"]',
      PASSWORD_HIDDEN: '#passwd, input[name="passwd"]',
      LOGIN_BUTTON: 'input[type="submit"][value="Login"], input.cn-login-btn, button.cn-login-btn',
      // Note: In ContinueO DOM, Day option values have a trailing space (e.g., "01 ", "15 ")
      DAY_VALUE_SUFFIX: ' '
    },

    // Page 2 (ID Card Verification Page) Selectors & Fallbacks
    PAGE2: {
      INDICATOR_TEXT: 'Enter the ID Card Number',
      INDICATOR_TEXT_ALT: 'ID Card',
      INPUT_PATTERNS: [
        "input[name='otp' i]",
        "input[id='otp' i]",
        "input[name*='otp' i]",
        "input[id*='otp' i]",
        "input[placeholder*='card' i]",
        "input[placeholder*='id' i]",
        "input[name*='card' i]",
        "input[id*='card' i]",
        "input[name*='id' i]:not(#username)",
        "input[id*='id' i]:not(#username)",
        "input[name='login_otp' i]",
        "input[type='text']:not(#username)",
        "input[type='password']:not(#passwd)"
      ],
      SUBMIT_BUTTONS: [
        "input[type='submit'][value*='SUBMIT' i]",
        "button[type='submit']",
        "input[type='submit']",
        "button",
        "a.btn",
        "a.button"
      ]
    },

    // Success Indicators (Authenticated Portal)
    SUCCESS: {
      LOGOUT_INDICATORS: [
        'a[href*="task=logout"]',
        'a[href*="logout"]',
        'form[name="log"]',
        'input[name="task"][value="logout"]'
      ],
      PORTAL_CONTENT_INDICATORS: [
        '.cn-dashboard',
        '.uk-navbar-container',
        '.cn-sidebar',
        'a[href*="attendance"]',
        'a[href*="results"]',
        'a[href*="profile"]'
      ]
    },

    // Error & Challenge Indicators
    CHALLENGES: {
      ERROR_MODAL: '#atPopup, .modal-content, .uk-alert-danger, .alert-danger',
      CAPTCHA_CONTAINERS: [
        'div.g-recaptcha[data-sitekey]',
        'iframe[src*="recaptcha/api2/anchor"]',
        'iframe[src*="recaptcha/api2/bframe"]'
      ]
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContineoSelectors;
  }
  if (root) {
    root.ContineoSelectors = ContineoSelectors;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
