# ContinueO Auto Login for Windows Desktop

A secure, high-reliability Chromium browser extension built with **Manifest V3** that automates the authorized two-step authentication flow for the **BMSIT&M ContinueO Parent Portal** (`https://student.bmsit.ac.in/parents/index.php`) on desktop computers.

Compatible with **Google Chrome**, **Brave Browser**, and **Microsoft Edge** on Windows.

---

## Table of Contents

1. [Overview & Objective](#overview--objective)
2. [Portal Authentication Flow](#portal-authentication-flow)
3. [Architecture & Components](#architecture--components)
4. [Installation Guide (Windows)](#installation-guide-windows)
5. [First-Time Setup & Configuration](#first-time-setup--configuration)
6. [Security & Credential Storage Strategy](#security--credential-storage-strategy)
7. [State Machine Architecture](#state-machine-architecture)
8. [Permissions Scope](#permissions-scope)
9. [Automated Unit Testing & Verification](#automated-unit-testing--verification)
10. [Testing & Quality Assurance Checklist](#testing--quality-assurance-checklist)

---

## Overview & Objective

The **ContinueO Auto Login** desktop extension extends the existing ContinueO ecosystem to Windows desktop environments. It allows authorized students and parents to log into the ContinueO portal with a single click, eliminating tedious manual entry of USN, date-of-birth dropdowns, and ID card numbers.

### Key Highlights
- **100% Client-Side:** No cloud databases, no backend servers, zero telemetry or tracking.
- **Strictly Scoped:** Automation executes only on `https://student.bmsit.ac.in/*`.
- **Smart Tab Management:** Focuses and reuses existing ContinueO tabs to prevent tab clutter.
- **Deterministic DOM Interaction:** Handles portal quirks (such as trailing whitespace in date option values and hidden password field synchronization).
- **At-Rest Protection:** Supports optional **AES-256-GCM** encryption using standard Web Crypto API with PBKDF2 key derivation.
- **Safety & Compliance:** Never bypasses CAPTCHA, OTP, MFA, or security challenges; pauses safely for manual user completion.

---

## Portal Authentication Flow

The ContinueO portal enforces a strict two-step authentication sequence:

```
┌─────────────────────────────────┐
│ Page 1: Initial Login           │
│  - USN Input (#username)        │
│  - Day Selector (#dd)           │
│  - Month Selector (#mm)         │
│  - Year Selector (#yyyy)        │
│  - [ Login Button ]             │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Page 2: Verification            │
│  - ID Card Number (#idcard)     │
│  - [ Submit Button ]            │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Authenticated ContinueO Portal  │
│  - Student Dashboard            │
│  - Attendance & Academic Data   │
└─────────────────────────────────┘
```

### Critical DOM Nuances
1. **Day Selector Trailing Space:** The portal's `<select name="dd" id="dd">` uses option values with a trailing space (e.g., `'01 '`, `'15 '`). The extension's adapter formats day selections to match this exact value structure.
2. **Hidden Password Field (`#passwd`):** The portal requires a hidden field `#passwd` in `YYYY-MM-DD` format. The extension invokes the portal's native `putdate()` function and explicitly updates `#passwd` as a fail-safe.
3. **Form Submission Validation:** The extension triggers the portal's native `check()` validator to ensure complete parity with manual user interactions.

---

## Architecture & Components

The desktop extension is organized as an unbundled, modular project:

```
CP-Ext/
├── manifest.json              # Manifest V3 extension configuration
├── package.json               # Test script and module metadata
├── icons/                     # Vector SVG and 16x16, 48x48, 128x128 PNG icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
├── common/
│   ├── constants.js           # Shared URLs, states, actions, timeouts
│   ├── crypto.js              # Web Crypto AES-256-GCM & PBKDF2 engine
│   └── storage.js             # chrome.storage.local wrapper, validation, masking
├── popup/
│   ├── popup.html             # Minimal popup interface (Status, [LOGIN NOW], [Settings])
│   ├── popup.css              # Responsive styling matching ContinueO theme
│   └── popup.js               # Popup interactions and tab launch triggers
├── settings/
│   ├── settings.html          # Setup screen: USN, DOB, ID Card, Master PIN
│   ├── settings.css           # Accessible, modern configuration form styles
│   └── settings.js            # Form validation, save/edit/clear actions
├── background/
│   └── service-worker.js      # Tab reuse, tab creation, and message routing
├── content/
│   ├── contineo-selectors.js  # Verified DOM selectors for ContinueO
│   ├── contineo-adapter.js    # DOM interaction, filling, and page detection
│   ├── overlay.js             # Floating in-page status HUD
│   └── content.js             # Content script runner & state machine
└── tests/
    ├── fixtures/              # Real DOM fixtures for Page 1, Page 2, Page 3
    │   ├── portal_page1.html
    │   ├── portal_page2.html
    │   └── portal_page3.html
    ├── mock-dom.js            # Lightweight headless DOM implementation for Node.js
    ├── crypto.test.js         # Encryption, validation, and storage unit tests
    ├── adapter.test.js        # DOM interaction and page detection unit tests
    └── run-tests.js           # Master test runner
```

---

## Installation Guide (Windows)

You can load the unpacked extension in any Chromium-based desktop browser on Windows.

### Google Chrome
1. Open Google Chrome.
2. Navigate to `chrome://extensions` in the address bar.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker, select the extension directory:
   ```
   C:\Users\AADI\Desktop\My\CODE\Github\CP-Ext
   ```
6. The **ContinueO Auto Login** extension is now installed. Pin it to your toolbar for easy access.

### Brave Browser
1. Open Brave.
2. Navigate to `brave://extensions`.
3. Enable **Developer mode** (toggle in the top-right).
4. Click **Load unpacked** and select `C:\Users\AADI\Desktop\My\CODE\Github\CP-Ext`.

### Microsoft Edge
1. Open Microsoft Edge.
2. Navigate to `edge://extensions`.
3. Enable **Developer mode** in the left sidebar.
4. Click **Load unpacked** and select `C:\Users\AADI\Desktop\My\CODE\Github\CP-Ext`.

---

## First-Time Setup & Configuration

1. Click the **ContinueO Auto Login** icon in your browser toolbar.
2. The popup will display:
   ```
   Status: Setup required
   [ LOGIN NOW ] (Disabled)
   [ Settings ]
   ```
3. Click **Settings** (or right-click the extension icon and select **Options**).
4. Enter your authorized credentials:
   - **USN:** e.g., `1BY21CS001`
   - **Date of Birth:** Select your Day (01–31), Month (Jan–Dec), and Year (1955–2026).
   - **College ID Card Number:** e.g., smart card ID number.
5. *(Optional)* Check **Protect with Master PIN (AES-256-GCM)** to encrypt your credentials at rest with a custom PIN.
6. Click **Save Credentials**.
7. Your credentials are now safely saved in local storage.

---

## Security & Credential Storage Strategy

### Zero Remote Transmission
- No remote servers, cloud databases (Firebase, Supabase, MySQL, MongoDB), or external APIs are used.
- Credentials never leave your local computer.
- Network requests are restricted strictly to ContinueO portal navigation.

### Storage Modes & At-Rest Protection

#### 1. Standard Browser Profile Storage (Default)
- Stored locally via `chrome.storage.local`.
- Managed within Chromium's per-profile SQLite/LevelDB database.
- **Protection Scope:** Sandboxed by the browser's origin security model and protected by Windows user account filesystem permissions (ACLs).
- **Limitation:** Raw files on the local disk can theoretically be read by applications running with the same Windows user privileges if unencrypted.

#### 2. Master PIN Protected Storage (Recommended for Shared PCs)
- When enabled in Settings, the extension uses the **Web Crypto API** (`SubtleCrypto`):
  - **Key Derivation:** PBKDF2 using SHA-256 with **100,000 iterations** and a 16-byte cryptographically secure random salt (`crypto.getRandomValues`).
  - **Symmetric Cipher:** **AES-256-GCM** with a unique 12-byte initialization vector (IV) per save.
  - **At Rest:** Only the ciphertext, salt, and IV are stored in `chrome.storage.local`. The decryption key exists only ephemerally in memory during login and is never written to disk.

### Additional Safeguards
- **Credential Masking:** UI summaries display only masked identifiers (e.g. `1B***01`). Full credentials are never logged to console or included in URLs.
- **Strict Verification:** All inputs are validated before storage to prevent malformed submissions.

---

## State Machine Architecture

The automation controller implements an explicit state machine:

```
[ IDLE ]
   │
   ▼ User clicks "LOGIN NOW"
[ OPENING_PORTAL ] ─────────► (Reuses open tab or opens new tab)
   │
   ▼
[ DETECTING_LOGIN_PAGE ]
   │
   ▼
[ FILLING_USN_AND_DOB ] ─────► (Populates #username, #dd, #mm, #yyyy, #passwd)
   │
   ▼
[ SUBMITTING_LOGIN ] ────────► (Executes check() & clicks Login button)
   │
   ▼ (Page navigates to Page 2)
[ WAITING_FOR_ID_CARD_PAGE ]
   │
   ▼
[ FILLING_ID_CARD ] ─────────► (Multi-tier resolution & fills ID card number)
   │
   ▼
[ SUBMITTING_ID_CARD ] ──────► (Clicks SUBMIT button)
   │
   ▼ (Page navigates to Dashboard)
[ VERIFYING_SUCCESS ]
   │
   ▼
[ COMPLETED ] ───────────────► (HUD shows checkmark & fades; portal is ready)
```

### Resilient Error & Challenge Handling
- **`ERROR` State:** If invalid credentials, portal errors, or missing fields occur, the state machine halts immediately, displays the error in the HUD, and clears the session flag. It **never** loops or repeatedly submits failed forms.
- **`MANUAL_INTERVENTION_REQUIRED` State:** If an interactive CAPTCHA puzzle or OTP challenge is detected, the extension pauses automation and invites the user to solve it manually without interfering with the session.

---

## Permissions Scope

The extension requests only minimal, necessary permissions:

| Permission | Purpose |
| :--- | :--- |
| `storage` | Stores credentials and configuration in local `chrome.storage.local`. |
| `tabs` | Finds open ContinueO tabs to avoid opening duplicate tabs. |
| `https://student.bmsit.ac.in/*` | Host permission restricted strictly to the ContinueO domain. |

*No access to all URLs (`<all_urls>`), browsing history, or remote script execution is requested.*

---

## Automated Unit Testing & Verification

The project includes unit and integration tests executing against DOM fixtures derived from the real ContinueO portal.

### Run Tests
Open a terminal in `c:\Users\AADI\Desktop\My\CODE\Github\CP-Ext`:

```powershell
npm test
```

### Verified Test Suites
1. **`crypto.test.js`**:
   - AES-256-GCM encryption & decryption
   - Tamper and incorrect PIN rejection
   - Credential validation rules (USN, Day, Month, Year, ID)
   - Masked summary generation
   - Save, retrieve, and clear operations

2. **`adapter.test.js`**:
   - Page 1 detection against actual portal HTML
   - Day selector trailing-space value matching (`"05 "`)
   - Hidden `#passwd` calculation (`YYYY-MM-DD`)
   - Page 1 form submission trigger
   - Page 2 detection and ID card multi-fallback location
   - Page 2 form submission trigger
   - Authenticated dashboard (Page 3) detection
   - Error modal and security challenge interception

---

## Testing & Quality Assurance Checklist

Use this checklist to verify manual functionality:

- [x] **First-Time Setup:**
  - Open extension popup -> Status shows `Setup required`.
  - Open Settings -> Fill USN, DOB, ID Card -> Click Save -> Status updates to `Configured`.
- [x] **Editing & Clearing:**
  - Click Edit -> Fields unlock.
  - Click Clear -> Confirmation prompt -> All credentials removed.
- [x] **Tab Reuse:**
  - Open ContinueO portal tab in browser.
  - Click "LOGIN NOW" in extension popup -> Extension focuses the existing tab instead of opening a duplicate.
- [x] **Page 1 Automation:**
  - USN is populated.
  - Day, Month, Year are selected properly in dropdowns.
  - Hidden password field is updated.
  - Submit button is triggered automatically.
- [x] **Page 2 Automation:**
  - ID card page is detected.
  - ID card input is located and populated.
  - SUBMIT is triggered automatically.
- [x] **Authentication Success:**
  - Dashboard appears.
  - In-page HUD overlay displays `✓ Successfully logged in to ContinueO!`.
  - HUD overlay automatically fades out after 3.5 seconds.
- [x] **Master PIN Protection:**
  - Enable PIN protection in Settings.
  - Click LOGIN NOW in popup -> PIN prompt appears.
  - Enter correct PIN -> Decrypts and logs in smoothly.
  - Enter incorrect PIN -> Shows error without leaking credentials.
- [x] **Security Challenges:**
  - If a CAPTCHA or OTP appears, automation pauses safely with `MANUAL_INTERVENTION_REQUIRED`.
- [x] **Portal Error Handling:**
  - If invalid credentials produce an error popup, automation halts safely without looping.

---

## License

MIT License. Designed for personal and authorized educational use.
