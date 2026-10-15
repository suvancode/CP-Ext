/**
 * ContinueO Auto Login - Popup Controller
 */
(function() {
  'use strict';

  const statusBadge = document.getElementById('status-badge');
  const credentialPreview = document.getElementById('credential-preview');
  const btnLoginNow = document.getElementById('btn-login-now');
  const btnSettings = document.getElementById('btn-settings');
  const pinSection = document.getElementById('pin-section');
  const loginPinInput = document.getElementById('login-pin');
  const pinError = document.getElementById('pin-error');
  const statusFeedback = document.getElementById('status-feedback');
  const feedbackText = document.getElementById('feedback-text');

  let isEncrypted = false;
  let isConfigured = false;

  async function loadState() {
    try {
      const metadata = await window.ContinueOStorage.getMetadata();
      isConfigured = metadata.configured;
      isEncrypted = metadata.encrypted;

      if (isConfigured) {
        statusBadge.textContent = 'Credentials configured';
        statusBadge.className = 'badge badge-success';
        credentialPreview.textContent = metadata.maskedSummary;
        btnLoginNow.disabled = false;

        if (isEncrypted) {
          pinSection.style.display = 'block';
          loginPinInput.focus();
        } else {
          pinSection.style.display = 'none';
        }
      } else {
        statusBadge.textContent = 'Setup required';
        statusBadge.className = 'badge badge-warning';
        credentialPreview.textContent = 'Click "Settings" below to configure your login details.';
        btnLoginNow.disabled = true;
        pinSection.style.display = 'none';
      }

      // Check current background status
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
          if (res && res.state && res.state !== 'IDLE' && res.state !== 'COMPLETED') {
            showFeedback(res.message || res.state);
          }
        });
      }
    } catch (err) {
      console.error('Error loading popup state:', err);
      statusBadge.textContent = 'Error loading';
      statusBadge.className = 'badge badge-warning';
    }
  }

  function showFeedback(msg) {
    if (!statusFeedback || !feedbackText) return;
    statusFeedback.style.display = 'flex';
    feedbackText.textContent = msg;
  }

  // Handle LOGIN NOW
  btnLoginNow.addEventListener('click', async () => {
    try {
      pinError.style.display = 'none';
      let credentials = null;

      if (isEncrypted) {
        const pin = loginPinInput.value.trim();
        if (!pin) {
          pinError.textContent = 'Please enter your PIN to unlock';
          pinError.style.display = 'block';
          loginPinInput.focus();
          return;
        }

        try {
          credentials = await window.ContinueOStorage.getCredentials(pin);
        } catch (e) {
          pinError.textContent = 'Incorrect PIN. Unable to decrypt credentials.';
          pinError.style.display = 'block';
          loginPinInput.focus();
          return;
        }
      } else {
        credentials = await window.ContinueOStorage.getCredentials();
      }

      if (!credentials) {
        showFeedback('No credentials found. Please configure in Settings.');
        return;
      }

      btnLoginNow.disabled = true;
      showFeedback('Connecting to ContinueO…');

      // Send to background service worker to open/focus tab
      chrome.runtime.sendMessage({
        action: 'START_LOGIN',
        credentials: credentials
      }, (response) => {
        if (response && response.success) {
          showFeedback('Portal opened! Automating login…');
          // Brief pause then close popup so user sees their browser tab
          setTimeout(() => {
            window.close();
          }, 600);
        } else {
          showFeedback(response && response.error ? response.error : 'Failed to launch portal');
          btnLoginNow.disabled = false;
        }
      });

    } catch (err) {
      console.error('Login action error:', err);
      showFeedback(err.message || 'Error initiating login');
      btnLoginNow.disabled = false;
    }
  });

  // Enter key in PIN triggers login
  loginPinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnLoginNow.click();
    }
  });

  // Open Settings screen
  btnSettings.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
    }
    window.close();
  });

  document.addEventListener('DOMContentLoaded', loadState);
})();
