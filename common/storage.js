/**
 * ContinueO Auto Login - Credential & Settings Storage Manager
 *
 * Interacts with chrome.storage.local with support for AES-256-GCM encryption
 * via Web Crypto. Never logs or transmits credentials to any remote server.
 */
(function(root) {
  'use strict';

  const Constants = (typeof ContinueOConstants !== 'undefined')
    ? ContinueOConstants
    : (typeof require !== 'undefined' ? require('./constants') : null);

  const Crypto = (typeof ContinueOCrypto !== 'undefined')
    ? ContinueOCrypto
    : (typeof require !== 'undefined' ? require('./crypto') : null);

  // In-memory fallback for testing environments outside of browser extension
  const memoryStorage = {};

  const StorageBackend = {
    async get(key) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => {
            resolve(result ? result[key] : null);
          });
        });
      }
      return memoryStorage[key] || null;
    },

    async set(key, value) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
      memoryStorage[key] = value;
    },

    async remove(key) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.remove([key], resolve);
        });
      }
      delete memoryStorage[key];
    }
  };

  const StorageManager = {
    /**
     * Validates that all required credential fields are present and well-formed.
     */
    validateCredentials(creds) {
      if (!creds || typeof creds !== 'object') {
        return { valid: false, error: 'Credentials object is missing' };
      }

      const usn = (creds.usn || '').toString().trim();
      const dobDay = (creds.dobDay || '').toString().trim();
      const dobMonth = (creds.dobMonth || '').toString().trim();
      const dobYear = (creds.dobYear || '').toString().trim();
      const idCardNumber = (creds.idCardNumber || '').toString().trim();

      if (!usn) {
        return { valid: false, error: 'USN is required' };
      }

      const dayNum = parseInt(dobDay, 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
        return { valid: false, error: 'Valid Date of Birth Day (1-31) is required' };
      }

      const monthNum = parseInt(dobMonth, 10);
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return { valid: false, error: 'Valid Date of Birth Month (1-12) is required' };
      }

      const yearNum = parseInt(dobYear, 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(yearNum) || yearNum < 1950 || yearNum > currentYear) {
        return { valid: false, error: `Valid Date of Birth Year (1950-${currentYear}) is required` };
      }

      if (!idCardNumber) {
        return { valid: false, error: 'ID Card Number is required' };
      }

      return {
        valid: true,
        normalized: {
          usn: usn.toUpperCase(),
          dobDay: dayNum.toString().padStart(2, '0'),
          dobMonth: monthNum.toString().padStart(2, '0'),
          dobYear: yearNum.toString(),
          idCardNumber: idCardNumber
        }
      };
    },

    /**
     * Generates a safe masked summary for display in the UI.
     * Never displays full credentials.
     */
    maskSummary(creds) {
      if (!creds) return 'Not configured';
      const usn = (creds.usn || '').toString().trim();
      const id = (creds.idCardNumber || '').toString().trim();

      const maskedUsn = usn.length > 4
        ? `${usn.slice(0, 2)}***${usn.slice(-2)}`
        : '***';
      const maskedId = id.length > 4
        ? `${id.slice(0, 2)}***${id.slice(-2)}`
        : '***';

      return `USN: ${maskedUsn} | ID: ${maskedId}`;
    },

    /**
     * Checks if credentials are configured in local storage.
     */
    async hasCredentials() {
      const stored = await StorageBackend.get(Constants.StorageKeys.CREDENTIALS);
      return !!(stored && (stored.data || stored.usn));
    },

    /**
     * Checks if stored credentials require a PIN to decrypt.
     */
    async isEncrypted() {
      const stored = await StorageBackend.get(Constants.StorageKeys.CREDENTIALS);
      return !!(stored && stored.encrypted === true);
    },

    /**
     * Returns metadata about stored credentials without revealing them.
     */
    async getMetadata() {
      const stored = await StorageBackend.get(Constants.StorageKeys.CREDENTIALS);
      if (!stored) {
        return {
          configured: false,
          encrypted: false,
          maskedSummary: 'Setup required',
          updatedAt: null
        };
      }

      return {
        configured: true,
        encrypted: !!stored.encrypted,
        maskedSummary: stored.maskedSummary || 'Credentials configured',
        updatedAt: stored.updatedAt || null
      };
    },

    /**
     * Saves credentials to local storage.
     * Optionally encrypts with a user PIN/passphrase using AES-256-GCM.
     */
    async saveCredentials(creds, options = {}) {
      const validation = this.validateCredentials(creds);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const normalized = validation.normalized;
      const masked = this.maskSummary(normalized);
      const updatedAt = new Date().toISOString();

      let storagePayload;

      if (options.useEncryption && options.pin) {
        if (!Crypto) {
          throw new Error('Crypto module is required for encryption');
        }
        const jsonStr = JSON.stringify(normalized);
        const encrypted = await Crypto.encrypt(jsonStr, options.pin);
        storagePayload = {
          ...encrypted,
          maskedSummary: masked,
          updatedAt: updatedAt
        };
      } else {
        storagePayload = {
          encrypted: false,
          usn: normalized.usn,
          dobDay: normalized.dobDay,
          dobMonth: normalized.dobMonth,
          dobYear: normalized.dobYear,
          idCardNumber: normalized.idCardNumber,
          maskedSummary: masked,
          updatedAt: updatedAt
        };
      }

      await StorageBackend.set(Constants.StorageKeys.CREDENTIALS, storagePayload);
      return { success: true, maskedSummary: masked };
    },

    /**
     * Retrieves credentials.
     * If encrypted, requires correct PIN to decrypt.
     */
    async getCredentials(pin = null) {
      const stored = await StorageBackend.get(Constants.StorageKeys.CREDENTIALS);
      if (!stored) {
        throw new Error('No credentials configured');
      }

      if (stored.encrypted) {
        if (!pin) {
          const err = new Error('PIN_REQUIRED');
          err.code = 'PIN_REQUIRED';
          throw err;
        }
        if (!Crypto) {
          throw new Error('Crypto module is required for decryption');
        }
        const decryptedJson = await Crypto.decrypt(stored, pin);
        return JSON.parse(decryptedJson);
      }

      return {
        usn: stored.usn,
        dobDay: stored.dobDay,
        dobMonth: stored.dobMonth,
        dobYear: stored.dobYear,
        idCardNumber: stored.idCardNumber
      };
    },

    /**
     * Clears all stored credentials.
     */
    async clearCredentials() {
      await StorageBackend.remove(Constants.StorageKeys.CREDENTIALS);
      return { success: true };
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
  }
  if (root) {
    root.ContinueOStorage = StorageManager;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
