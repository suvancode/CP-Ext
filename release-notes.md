# ContinueO Auto Login for Desktop (Chromium) - v1.0.0

A Manifest V3 browser extension that automates the authorized two-step login flow for the **BMSIT&M ContinueO Parent Portal** (`https://student.bmsit.ac.in/parents/index.php`) on desktop computers.

Compatible with **Google Chrome**, **Brave**, and **Microsoft Edge** on Windows.

---

### Features
- **Two-Step Login Automation:**
  - **Page 1:** Fills USN, selects Day (handling trailing space formatting), Month, Year, hidden `#passwd`, and submits login.
  - **Page 2:** Detects ID Card verification page, resolves input field via robust multi-tier fallback, and submits.
  - **Success:** Detects authenticated student dashboard and displays a brief in-page status overlay that self-dismisses.
- **Smart Tab Handling:** Automatically finds, focuses, and reuses existing open ContinueO tabs instead of opening duplicates.
- **100% Client-Side & Local Storage:** No external servers, cloud databases, or tracking. Stored locally in `chrome.storage.local`.
- **At-Rest Protection:** Supports optional **AES-256-GCM** encryption using standard Web Crypto API with PBKDF2 key derivation (100,000 iterations).
- **Safety Controls:** Safely pauses on security challenges (CAPTCHA / OTP) for manual intervention without looping.

---

### Quick Installation (Windows)
1. Download **`continueo-auto-login-v1.0.0.zip`** from Assets below and extract it to a folder on your computer.
2. Open your Chromium browser and navigate to the extensions page:
   - **Google Chrome:** `chrome://extensions`
   - **Brave Browser:** `brave://extensions`
   - **Microsoft Edge:** `edge://extensions`
3. Toggle **Developer mode** to **ON** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder.
5. Click the ContinueO icon in your toolbar, open **Settings**, save your credentials once, and click **LOGIN NOW**!
