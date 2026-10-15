/**
 * ContinueO Auto Login - Crypto & Protection Strategy
 * Implements AES-256-GCM authenticated encryption with PBKDF2 key derivation
 * using the standard Web Crypto API (SubtleCrypto).
 *
 * Provides at-rest protection for stored credentials when a user master PIN
 * or passphrase is configured.
 */
(function(root) {
  'use strict';

  // Get subtle crypto instance across Browser and Node environments
  function getSubtle() {
    if (typeof crypto !== 'undefined') {
      if (crypto.subtle) return crypto.subtle;
      if (crypto.webcrypto && crypto.webcrypto.subtle) return crypto.webcrypto.subtle;
    }
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    throw new Error('Web Crypto API (subtle) is not supported in this environment.');
  }

  function getRandomValues(arr) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(arr);
    }
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      return window.crypto.getRandomValues(arr);
    }
    // Node.js fallback
    try {
      const nodeCrypto = require('crypto');
      return nodeCrypto.randomFillSync(arr);
    } catch (e) {
      throw new Error('Secure random generator not available');
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa === 'function') {
      return btoa(binary);
    }
    return Buffer.from(buffer).toString('base64');
  }

  function base64ToArrayBuffer(base64) {
    if (typeof atob === 'function') {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }
    return Buffer.from(base64, 'base64').buffer;
  }

  const PBKDF2_ITERATIONS = 100000;
  const KEY_LENGTH_BITS = 256;
  const SALT_LENGTH_BYTES = 16;
  const IV_LENGTH_BYTES = 12;

  const Crypto = {
    /**
     * Derives an AES-GCM CryptoKey from a passphrase using PBKDF2.
     */
    async deriveKey(passphrase, salt) {
      const subtle = getSubtle();
      const enc = new TextEncoder();
      const passKey = await subtle.importKey(
        'raw',
        enc.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      return await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        passKey,
        { name: 'AES-GCM', length: KEY_LENGTH_BITS },
        false,
        ['encrypt', 'decrypt']
      );
    },

    /**
     * Encrypts plaintext data using AES-256-GCM with a user-supplied passphrase/PIN.
     * Returns an object containing base64 encoded ciphertext, IV, and salt.
     */
    async encrypt(plainText, passphrase) {
      if (!passphrase || typeof passphrase !== 'string') {
        throw new Error('A valid passphrase or PIN is required for encryption.');
      }
      const subtle = getSubtle();
      const salt = getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
      const iv = getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
      const key = await this.deriveKey(passphrase, salt);

      const enc = new TextEncoder();
      const ciphertextBuffer = await subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(plainText)
      );

      return {
        encrypted: true,
        version: 1,
        salt: arrayBufferToBase64(salt.buffer),
        iv: arrayBufferToBase64(iv.buffer),
        data: arrayBufferToBase64(ciphertextBuffer)
      };
    },

    /**
     * Decrypts ciphertext produced by encrypt().
     */
    async decrypt(encryptedObj, passphrase) {
      if (!encryptedObj || !encryptedObj.data || !encryptedObj.iv || !encryptedObj.salt) {
        throw new Error('Invalid encrypted object payload.');
      }
      if (!passphrase || typeof passphrase !== 'string') {
        throw new Error('Passphrase or PIN is required for decryption.');
      }

      const subtle = getSubtle();
      const salt = new Uint8Array(base64ToArrayBuffer(encryptedObj.salt));
      const iv = new Uint8Array(base64ToArrayBuffer(encryptedObj.iv));
      const ciphertext = base64ToArrayBuffer(encryptedObj.data);

      const key = await this.deriveKey(passphrase, salt);

      try {
        const decryptedBuffer = await subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          ciphertext
        );
        const dec = new TextDecoder();
        return dec.decode(decryptedBuffer);
      } catch (err) {
        throw new Error('Decryption failed. Incorrect PIN or corrupted data.');
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Crypto;
  }
  if (root) {
    root.ContinueOCrypto = Crypto;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
