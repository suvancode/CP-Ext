/**
 * ContinueO Auto Login - Settings Screen Controller
 */
(function() {
  'use strict';

  const form = document.getElementById('credentials-form');
  const usnInput = document.getElementById('usn');
  const dobDaySelect = document.getElementById('dob-day');
  const dobMonthSelect = document.getElementById('dob-month');
  const dobYearSelect = document.getElementById('dob-year');
  const idCardInput = document.getElementById('id-card');

  const enableEncryptionCheckbox = document.getElementById('enable-encryption');
  const pinInputs = document.getElementById('pin-inputs');
  const pinInput = document.getElementById('pin');
  const pinConfirmInput = document.getElementById('pin-confirm');

  const btnSave = document.getElementById('btn-save');
  const btnEdit = document.getElementById('btn-edit');
  const btnClear = document.getElementById('btn-clear');

  const alertBanner = document.getElementById('alert-banner');
  const alertIcon = document.getElementById('alert-icon');
  const alertMessage = document.getElementById('alert-message');

  const statusPill = document.getElementById('status-pill');
  const maskedSummary = document.getElementById('masked-summary');
  const protectionStatus = document.getElementById('protection-status');

  let isEditing = false;

  // Initialize Day and Year select options
  function populateDateOptions() {
    // Days: 01 to 31
    for (let d = 1; d <= 31; d++) {
      const dayVal = d.toString().padStart(2, '0');
      const opt = document.createElement('option');
      opt.value = dayVal;
      opt.textContent = dayVal;
      dobDaySelect.appendChild(opt);
    }

    // Years: Current year down to 1960
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1960; y--) {
      const opt = document.createElement('option');
      opt.value = y.toString();
      opt.textContent = y.toString();
      dobYearSelect.appendChild(opt);
    }
  }

  function showAlert(msg, type = 'success') {
    alertBanner.className = `alert-banner alert-${type}`;
    alertIcon.textContent = type === 'success' ? '✓' : (type === 'error' ? '⚠' : 'ℹ');
    alertMessage.textContent = msg;
    alertBanner.style.display = 'flex';

    if (type === 'success') {
      setTimeout(() => {
        alertBanner.style.display = 'none';
      }, 5000);
    }
  }

  function hideAlert() {
    alertBanner.style.display = 'none';
  }

  function setFormFieldsDisabled(disabled) {
    usnInput.disabled = disabled;
    dobDaySelect.disabled = disabled;
    dobMonthSelect.disabled = disabled;
    dobYearSelect.disabled = disabled;
    idCardInput.disabled = disabled;
    enableEncryptionCheckbox.disabled = disabled;
    pinInput.disabled = disabled;
    pinConfirmInput.disabled = disabled;
  }

  async function loadSettings() {
    try {
      const metadata = await window.ContinueOStorage.getMetadata();

      if (metadata.configured) {
        statusPill.textContent = 'Configured';
        statusPill.className = 'pill pill-success';
        maskedSummary.textContent = metadata.maskedSummary;
        protectionStatus.textContent = metadata.encrypted
          ? 'AES-256-GCM Encrypted (Master PIN)'
          : 'Standard Browser Profile Storage';

        setFormFieldsDisabled(true);
        btnSave.style.display = 'none';
        btnEdit.style.display = 'inline-flex';
        btnClear.style.display = 'inline-flex';
        isEditing = false;
      } else {
        statusPill.textContent = 'Setup Required';
        statusPill.className = 'pill pill-warning';
        maskedSummary.textContent = 'No credentials configured';
        protectionStatus.textContent = 'Standard Browser Storage';

        setFormFieldsDisabled(false);
        btnSave.style.display = 'inline-flex';
        btnEdit.style.display = 'none';
        btnClear.style.display = 'none';
        isEditing = true;
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      showAlert('Failed to load configuration from storage.', 'error');
    }
  }

  // Toggle PIN inputs when encryption checkbox changes
  enableEncryptionCheckbox.addEventListener('change', () => {
    if (enableEncryptionCheckbox.checked) {
      pinInputs.style.display = 'grid';
      pinInput.setAttribute('required', 'true');
      pinConfirmInput.setAttribute('required', 'true');
    } else {
      pinInputs.style.display = 'none';
      pinInput.removeAttribute('required');
      pinConfirmInput.removeAttribute('required');
      pinInput.value = '';
      pinConfirmInput.value = '';
    }
  });

  // Handle Save
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const rawCreds = {
      usn: usnInput.value.trim(),
      dobDay: dobDaySelect.value,
      dobMonth: dobMonthSelect.value,
      dobYear: dobYearSelect.value,
      idCardNumber: idCardInput.value.trim()
    };

    const useEncryption = enableEncryptionCheckbox.checked;
    let pin = null;

    if (useEncryption) {
      pin = pinInput.value.trim();
      const pinConfirm = pinConfirmInput.value.trim();

      if (!pin || pin.length < 4) {
        showAlert('Master PIN must be at least 4 characters long.', 'error');
        pinInput.focus();
        return;
      }

      if (pin !== pinConfirm) {
        showAlert('Master PIN and Confirmation PIN do not match.', 'error');
        pinConfirmInput.focus();
        return;
      }
    }

    try {
      const res = await window.ContinueOStorage.saveCredentials(rawCreds, {
        useEncryption: useEncryption,
        pin: pin
      });

      showAlert('Credentials saved successfully! Your desktop auto-login is now ready.', 'success');
      // Clear PIN fields from DOM memory
      pinInput.value = '';
      pinConfirmInput.value = '';
      await loadSettings();
    } catch (err) {
      showAlert(err.message || 'Failed to save credentials.', 'error');
    }
  });

  // Handle Edit
  btnEdit.addEventListener('click', async () => {
    try {
      const isEnc = await window.ContinueOStorage.isEncrypted();
      let creds = null;

      if (isEnc) {
        const pin = prompt('Enter your Master PIN to edit credentials:');
        if (!pin) return;
        try {
          creds = await window.ContinueOStorage.getCredentials(pin);
          enableEncryptionCheckbox.checked = true;
          pinInputs.style.display = 'grid';
          pinInput.value = pin;
          pinConfirmInput.value = pin;
        } catch (e) {
          showAlert('Incorrect Master PIN. Unable to unlock credentials.', 'error');
          return;
        }
      } else {
        creds = await window.ContinueOStorage.getCredentials();
        enableEncryptionCheckbox.checked = false;
        pinInputs.style.display = 'none';
      }

      if (creds) {
        usnInput.value = creds.usn || '';
        dobDaySelect.value = creds.dobDay || '';
        dobMonthSelect.value = creds.dobMonth || '';
        dobYearSelect.value = creds.dobYear || '';
        idCardInput.value = creds.idCardNumber || '';

        setFormFieldsDisabled(false);
        btnSave.style.display = 'inline-flex';
        btnEdit.style.display = 'none';
        isEditing = true;
        showAlert('Credentials unlocked for editing.', 'warning');
      }
    } catch (err) {
      showAlert(err.message || 'Error unlocking credentials.', 'error');
    }
  });

  // Handle Clear
  btnClear.addEventListener('click', async () => {
    const confirmed = confirm('Are you sure you want to clear your stored credentials? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await window.ContinueOStorage.clearCredentials();
      form.reset();
      pinInputs.style.display = 'none';
      showAlert('All stored credentials have been removed.', 'success');
      await loadSettings();
    } catch (err) {
      showAlert(err.message || 'Failed to clear credentials.', 'error');
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    populateDateOptions();
    loadSettings();
  });
})();
