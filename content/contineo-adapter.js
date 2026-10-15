/**
 * ContinueO Auto Login - Portal Automation Adapter
 *
 * Implements deterministic DOM interaction, selector resolution,
 * event dispatching, and page detection for ContinueO.
 * All operations accept a document context to enable headless unit testing.
 */
(function(root) {
  'use strict';

  const Selectors = (typeof ContineoSelectors !== 'undefined')
    ? ContineoSelectors
    : (typeof require !== 'undefined' ? require('./contineo-selectors') : null);

  const ContineoAdapter = {
    /**
     * Dispatches comprehensive DOM events to ensure framework listeners (React, Vue, jQuery)
     * register input and change events.
     */
    triggerEvents(el, eventNames = ['input', 'change', 'blur']) {
      if (!el || typeof el.dispatchEvent !== 'function') return;
      eventNames.forEach(evtName => {
        try {
          const evt = new Event(evtName, { bubbles: true, cancelable: true });
          el.dispatchEvent(evt);
        } catch (e) {
          // Fallback for older event models
          try {
            const evt = el.ownerDocument.createEvent('HTMLEvents');
            evt.initEvent(evtName, true, true);
            el.dispatchEvent(evt);
          } catch (innerErr) {}
        }
      });
    },

    /**
     * Safely sets value on an input element, utilizing native descriptor setter
     * to bypass potential framework controlled-component overrides.
     */
    setInputValue(el, value) {
      if (!el) return false;
      el.focus();
      try {
        const win = el.ownerDocument.defaultView || window;
        const proto = win.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
          desc.set.call(el, value);
        } else {
          el.value = value;
        }
      } catch (e) {
        el.value = value;
      }
      el.setAttribute('value', value);
      this.triggerEvents(el, ['input', 'change', 'blur']);
      return true;
    },

    /**
     * Selects an option in a HTMLSelectElement, matching value or text.
     * Special handling for ContinueO: day options have a trailing space (e.g. "05 ").
     */
    setSelectValue(selectEl, targetValue) {
      if (!selectEl || !selectEl.options) return false;
      const targetStr = (targetValue || '').toString().trim();

      let matchedIndex = -1;
      // 1. Exact value match (e.g. "05 ")
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        if (opt.value === targetValue || opt.value.trim() === targetStr) {
          matchedIndex = i;
          break;
        }
      }

      // 2. Text match (e.g. "Jan" for "01")
      if (matchedIndex === -1) {
        for (let i = 0; i < selectEl.options.length; i++) {
          const opt = selectEl.options[i];
          if (opt.text.trim() === targetStr) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex !== -1) {
        selectEl.selectedIndex = matchedIndex;
        selectEl.value = selectEl.options[matchedIndex].value;
        this.triggerEvents(selectEl, ['change', 'input']);
        return true;
      }
      return false;
    },

    /**
     * Detects current page type.
     * Returns: 'PAGE1' | 'PAGE2' | 'SUCCESS' | 'CHALLENGE' | 'UNKNOWN'
     */
    detectPageType(doc = document) {
      if (!doc || !doc.body) return 'UNKNOWN';

      // 1. Check for Page 1 (Username input and day select)
      const daySelect = doc.querySelector(Selectors.PAGE1.DAY_SELECT);
      const yearSelect = doc.querySelector(Selectors.PAGE1.YEAR_SELECT);
      if (daySelect && yearSelect) {
        return 'PAGE1';
      }

      // 2. Check for Page 2 (ID Card page) - Must be checked BEFORE security challenges
      const bodyTextLower = (doc.body.innerText || doc.body.textContent || '').toLowerCase();
      const hasIdCardText = bodyTextLower.includes('id card') ||
                            bodyTextLower.includes('enter the id card number') ||
                            bodyTextLower.includes('please enter the id card number');

      const hasIdCardInput = !!this.findIdCardInput(doc);

      if (hasIdCardText || (hasIdCardInput && !daySelect)) {
        return 'PAGE2';
      }

      // 3. Check for Success (Authenticated Portal)
      if (this.isSuccessPage(doc)) {
        return 'SUCCESS';
      }

      // 4. Check for genuine Security Challenge (reCAPTCHA v2 checkbox challenge)
      const challenge = this.checkForSecurityChallenge(doc);
      if (challenge.isChallenge) {
        return 'CHALLENGE';
      }

      return 'UNKNOWN';
    },

    /**
     * Checks if current page is the authenticated portal.
     */
    isSuccessPage(doc = document) {
      if (!doc || !doc.body) return false;
      const usernameInput = doc.querySelector(Selectors.PAGE1.USERNAME_INPUT);
      if (usernameInput) return false;

      const bodyText = doc.body.innerText || doc.body.textContent || '';
      if (bodyText.includes(Selectors.PAGE2.INDICATOR_TEXT)) return false;

      // Check for logout indicators
      for (const sel of Selectors.SUCCESS.LOGOUT_INDICATORS) {
        if (doc.querySelector(sel)) return true;
      }

      // Check for portal content indicators
      for (const sel of Selectors.SUCCESS.PORTAL_CONTENT_INDICATORS) {
        if (doc.querySelector(sel)) return true;
      }

      // Check URL and absence of login/id-card forms
      const win = doc.defaultView || window;
      if (win.location && win.location.href) {
        const url = win.location.href;
        if (url.includes('student.bmsit.ac.in') && !url.includes('index.php?option=com_user')) {
          // Further verify absence of login forms
          const loginForm = doc.querySelector(Selectors.PAGE1.FORM);
          if (!loginForm && !doc.querySelector(Selectors.PAGE1.USERNAME_INPUT)) {
            return true;
          }
        }
      }

      return false;
    },

    /**
     * Checks for visible error modals, messages, or alerts on the page.
     */
    checkForErrors(doc = document) {
      if (!doc || !doc.body) return { hasError: false, message: '' };

      const errorModals = doc.querySelectorAll(Selectors.CHALLENGES.ERROR_MODAL);
      for (let i = 0; i < errorModals.length; i++) {
        const el = errorModals[i];
        const isVisible = el.offsetParent !== null ||
          (el.style && el.style.display !== 'none' && el.style.visibility !== 'hidden');
        const text = (el.innerText || el.textContent || '').trim();
        if (isVisible && text.length > 0) {
          return { hasError: true, message: text };
        }
      }

      const bodyText = doc.body.innerText || doc.body.textContent || '';
      const errorPhrases = [
        'Invalid Username or Password',
        'Incorrect Date of Birth',
        'Invalid ID Card',
        'Authentication failed',
        'User not found'
      ];

      for (const phrase of errorPhrases) {
        if (bodyText.includes(phrase)) {
          return { hasError: true, message: phrase };
        }
      }

      return { hasError: false, message: '' };
    },

    /**
     * Checks if manual security challenge (interactive CAPTCHA puzzle) is active.
     */
    checkForSecurityChallenge(doc = document) {
      if (!doc || !doc.body) return { isChallenge: false, type: null };

      // Never treat Page 2 (ID Card page) as a security challenge
      const bodyTextLower = (doc.body.innerText || doc.body.textContent || '').toLowerCase();
      if (bodyTextLower.includes('id card') || bodyTextLower.includes('enter the id card number')) {
        return { isChallenge: false, type: null };
      }

      // Check for interactive CAPTCHA challenge iframe (e.g. reCAPTCHA bframe image puzzle)
      const captchaFrame = doc.querySelector('iframe[src*="recaptcha/api2/bframe"]');
      if (captchaFrame) {
        const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
        const style = (win && typeof win.getComputedStyle === 'function')
          ? win.getComputedStyle(captchaFrame)
          : (captchaFrame.style || {});
        const isHidden = style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none';
        const hasHeight = captchaFrame.offsetHeight === undefined || captchaFrame.offsetHeight > 50;
        if (!isHidden && hasHeight) {
          return { isChallenge: true, type: 'CAPTCHA' };
        }
      }

      return { isChallenge: false, type: null };
    },

    /**
     * Fills Page 1 (USN and Date of Birth).
     * Returns: { success: boolean, error?: string }
     */
    fillLoginPage(doc = document, credentials) {
      try {
        if (!credentials) {
          return { success: false, error: 'Credentials object is required' };
        }

        // 1. Locate USN field
        const usnInput = doc.querySelector(Selectors.PAGE1.USERNAME_INPUT);
        if (!usnInput) {
          return { success: false, error: 'USN input (#username) not found' };
        }
        this.setInputValue(usnInput, credentials.usn);

        // 2. Locate Day selector
        const ddSelect = doc.querySelector(Selectors.PAGE1.DAY_SELECT);
        if (!ddSelect) {
          return { success: false, error: 'Day selector (#dd) not found' };
        }
        // Account for trailing space in ContinueO option values: "01 ", "15 "
        const dayValue = credentials.dobDay + Selectors.PAGE1.DAY_VALUE_SUFFIX;
        const daySelected = this.setSelectValue(ddSelect, dayValue);
        if (!daySelected) {
          // Retry with raw day
          this.setSelectValue(ddSelect, credentials.dobDay);
        }

        // 3. Locate Month selector
        const mmSelect = doc.querySelector(Selectors.PAGE1.MONTH_SELECT);
        if (!mmSelect) {
          return { success: false, error: 'Month selector (#mm) not found' };
        }
        this.setSelectValue(mmSelect, credentials.dobMonth);

        // 4. Locate Year selector
        const yyyySelect = doc.querySelector(Selectors.PAGE1.YEAR_SELECT);
        if (!yyyySelect) {
          return { success: false, error: 'Year selector (#yyyy) not found' };
        }
        this.setSelectValue(yyyySelect, credentials.dobYear);

        // 5. Invoke portal's putdate() if present in page window context
        const win = doc.defaultView || window;
        if (typeof win.putdate === 'function') {
          try { win.putdate(); } catch (e) {}
        }

        // 6. Set hidden passwd field directly as fallback (yyyy-mm-dd)
        const passwdInput = doc.querySelector(Selectors.PAGE1.PASSWORD_HIDDEN);
        const passwdValue = `${credentials.dobYear}-${credentials.dobMonth}-${credentials.dobDay}`;
        if (passwdInput) {
          passwdInput.value = passwdValue;
        }

        // 7. Verify all values are populated
        const verifyUsn = usnInput.value;
        const verifyDd = ddSelect.value;
        const verifyMm = mmSelect.value;
        const verifyYyyy = yyyySelect.value;

        if (!verifyUsn || !verifyDd || !verifyMm || !verifyYyyy) {
          return {
            success: false,
            error: 'One or more login fields could not be populated correctly'
          };
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || err.toString() };
      }
    },

    /**
     * Submits Page 1 login form.
     */
    submitLoginPage(doc = document) {
      try {
        const win = doc.defaultView || window;

        // Trigger portal check() function which performs validation and sets passwd
        if (typeof win.check === 'function') {
          try {
            const checkResult = win.check();
            if (checkResult === false) {
              return { success: false, error: 'Portal validation check() returned false' };
            }
          } catch (e) {}
        }

        // Try clicking submit button first (preserves onClick check() handler)
        const loginBtn = doc.querySelector(Selectors.PAGE1.LOGIN_BUTTON);
        if (loginBtn) {
          loginBtn.click();
          return { success: true, method: 'button.click' };
        }

        // Fallback: submit form directly
        const form = doc.querySelector(Selectors.PAGE1.FORM);
        if (form && typeof form.submit === 'function') {
          form.submit();
          return { success: true, method: 'form.submit' };
        }

        return { success: false, error: 'No submit button or form found on Page 1' };
      } catch (err) {
        return { success: false, error: err.message || err.toString() };
      }
    },

    /**
     * Locates ID Card Number input on Page 2 using robust multi-tier fallback.
     */
    findIdCardInput(root = document) {
      if (!root) return null;

      // Strategy 1: Targeted pattern matching
      for (const pattern of Selectors.PAGE2.INPUT_PATTERNS) {
        const inp = root.querySelector(pattern);
        if (inp && this.isInputInteractable(inp)) {
          return inp;
        }
      }

      // Strategy 2: Scan all input elements across DOM
      const allInputs = root.querySelectorAll('input, textarea');
      const ignoredIds = ['username', 'passwd', 'recaptcha-token', 'token', 'action'];
      const ignoredTypes = ['hidden', 'submit', 'button', 'checkbox', 'radio', 'image'];

      for (let i = 0; i < allInputs.length; i++) {
        const inp = allInputs[i];
        const type = (inp.type || 'text').toLowerCase();
        if (ignoredTypes.includes(type)) continue;

        const id = (inp.id || '').toLowerCase();
        const name = (inp.name || '').toLowerCase();
        const placeholder = (inp.placeholder || '').toLowerCase();

        if (ignoredIds.includes(id) || ignoredIds.includes(name)) continue;

        const combined = `${id} ${name} ${placeholder}`;
        if (combined.includes('card') || combined.includes('id') || combined.includes('regno') || combined.includes('otp')) {
          return inp;
        }
      }

      // Strategy 3: First visible text/number/tel input not ignored
      for (let i = 0; i < allInputs.length; i++) {
        const inp = allInputs[i];
        const type = (inp.type || 'text').toLowerCase();
        if (ignoredTypes.includes(type)) continue;

        const id = (inp.id || '').toLowerCase();
        const name = (inp.name || '').toLowerCase();
        if (ignoredIds.includes(id) || ignoredIds.includes(name)) continue;

        if (this.isInputInteractable(inp)) {
          return inp;
        }
      }

      // Strategy 4: Search inside iframes if any
      const iframes = root.querySelectorAll('iframe, frame');
      for (let k = 0; k < iframes.length; k++) {
        try {
          const frameDoc = iframes[k].contentDocument || iframes[k].contentWindow.document;
          const found = this.findIdCardInput(frameDoc);
          if (found) return found;
        } catch (err) {
          // Cross-origin iframe boundary
        }
      }

      return null;
    },

    isInputInteractable(el) {
      if (!el) return false;
      if (el.disabled || el.readOnly) return false;
      if (el.type === 'hidden') return false;
      return true;
    },

    /**
     * Fills Page 2 ID Card Number.
     * Returns: { success: boolean, error?: string }
     */
    fillIdCardPage(doc = document, idCardNumber) {
      try {
        if (!idCardNumber) {
          return { success: false, error: 'ID Card Number is required' };
        }

        const input = this.findIdCardInput(doc);
        if (!input) {
          return { success: false, error: 'ID Card input field not found on Page 2' };
        }

        this.setInputValue(input, idCardNumber);

        // Verify value was set
        if (!input.value || input.value.trim() !== idCardNumber.trim()) {
          return { success: false, error: 'Failed to populate ID Card Number field' };
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || err.toString() };
      }
    },

    /**
     * Submits Page 2 ID Card verification form.
     */
    submitIdCardPage(doc = document) {
      try {
        // Strategy 1: Look for submit buttons with SUBMIT / LOGIN text or value
        const buttons = doc.querySelectorAll("input[type='submit'], input[type='button'], button, a.btn, a.button");
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          const text = (btn.value || btn.innerText || btn.textContent || '').trim().toUpperCase();
          if (text === 'SUBMIT' || text.includes('SUBMIT') || text === 'LOGIN') {
            btn.click();
            return { success: true, method: 'button.text-match' };
          }
        }

        // Strategy 2: Use selector list
        for (const sel of Selectors.PAGE2.SUBMIT_BUTTONS) {
          const btn = doc.querySelector(sel);
          if (btn) {
            btn.click();
            return { success: true, method: sel };
          }
        }

        // Strategy 3: Form submit fallback
        if (doc.forms && doc.forms.length > 0) {
          doc.forms[0].submit();
          return { success: true, method: 'forms[0].submit' };
        }

        return { success: false, error: 'No submit button or form found on Page 2' };
      } catch (err) {
        return { success: false, error: err.message || err.toString() };
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContineoAdapter;
  }
  if (root) {
    root.ContineoAdapter = ContineoAdapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
