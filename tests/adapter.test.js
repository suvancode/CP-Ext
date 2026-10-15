/**
 * Unit & Integration tests for ContineoAdapter & ContineoSelectors
 * Executed against realistic HTML DOM fixtures.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parseHTML } = require('./mock-dom');
const ContineoSelectors = require('../content/contineo-selectors');
const ContineoAdapter = require('../content/contineo-adapter');

const page1Html = fs.readFileSync(path.join(__dirname, 'fixtures/portal_page1.html'), 'utf8');
const page2Html = fs.readFileSync(path.join(__dirname, 'fixtures/portal_page2.html'), 'utf8');
const page3Html = fs.readFileSync(path.join(__dirname, 'fixtures/portal_page3.html'), 'utf8');

function testPageDetection() {
  console.log('Testing Page Detection...');

  // Page 1
  const doc1 = parseHTML(page1Html);
  const type1 = ContineoAdapter.detectPageType(doc1);
  assert.strictEqual(type1, 'PAGE1', 'Should correctly identify Page 1 (Login page)');
  console.log('✓ Page 1 successfully detected');

  // Page 2 (Must be PAGE2 even when input has name="otp")
  const doc2 = parseHTML(page2Html);
  const type2 = ContineoAdapter.detectPageType(doc2);
  assert.strictEqual(type2, 'PAGE2', 'Should correctly identify Page 2 (ID Card page even if input is named otp)');
  console.log('✓ Page 2 successfully detected without false-positive OTP');

  // Verify that Page 2 is NOT considered a security challenge
  const chal2 = ContineoAdapter.checkForSecurityChallenge(doc2);
  assert.strictEqual(chal2.isChallenge, false, 'Page 2 must NOT be flagged as security challenge');
  console.log('✓ Page 2 confirmed NOT a security challenge');

  // Page 3 (Success)
  const doc3 = parseHTML(page3Html);
  const type3 = ContineoAdapter.detectPageType(doc3);
  assert.strictEqual(type3, 'SUCCESS', 'Should correctly identify Page 3 (Authenticated dashboard)');
  console.log('✓ Page 3 (Authenticated portal) successfully detected');
}

function testPage1Automation() {
  console.log('\nTesting Page 1 Automation (USN & DOB Fill + Submit)...');
  const doc = parseHTML(page1Html);

  // Define mock putdate and check functions in window
  let putDateCalled = false;
  let checkCalled = false;
  doc.defaultView.putdate = () => { putDateCalled = true; };
  doc.defaultView.check = () => { checkCalled = true; return true; };

  const dummyCreds = {
    usn: '1BY21CS999',
    dobDay: '05',
    dobMonth: '03',
    dobYear: '2004',
    idCardNumber: 'CARD12345'
  };

  // 1. Fill Page 1
  const fillRes = ContineoAdapter.fillLoginPage(doc, dummyCreds);
  assert.strictEqual(fillRes.success, true, 'Page 1 fill must succeed');

  // Verify inputs were set
  const usnInput = doc.querySelector('#username');
  assert.strictEqual(usnInput.value, '1BY21CS999', 'USN input must match');

  const ddSelect = doc.querySelector('#dd');
  // In the real portal, day options have trailing spaces e.g. "05 "
  assert(ddSelect.value.startsWith('05'), 'Day selector must select day 05');

  const mmSelect = doc.querySelector('#mm');
  assert.strictEqual(mmSelect.value, '03', 'Month selector must select 03');

  const yyyySelect = doc.querySelector('#yyyy');
  assert.strictEqual(yyyySelect.value, '2004', 'Year selector must select 2004');

  const passwdInput = doc.querySelector('#passwd');
  assert.strictEqual(passwdInput.value, '2004-03-05', 'Password hidden input must be yyyy-mm-dd');
  console.log('✓ Page 1 fields populated & verified: USN, DD, MM, YYYY, PASSWD');

  // 2. Submit Page 1
  let submitClicked = false;
  const submitBtn = doc.querySelector(ContineoSelectors.PAGE1.LOGIN_BUTTON);
  assert(submitBtn, 'Submit button must be found on Page 1');
  submitBtn.addEventListener('click', () => { submitClicked = true; });

  const submitRes = ContineoAdapter.submitLoginPage(doc);
  assert.strictEqual(submitRes.success, true, 'Page 1 submit must succeed');
  assert.strictEqual(submitClicked, true, 'Submit button click must be triggered');
  console.log('✓ Page 1 submit executed successfully');
}

function testPage2Automation() {
  console.log('\nTesting Page 2 Automation (ID Card Number Fill + Submit)...');
  const doc = parseHTML(page2Html);

  // 1. Find ID Card Input (matches input even if named 'otp')
  const idInput = ContineoAdapter.findIdCardInput(doc);
  assert(idInput, 'Must locate ID card input on Page 2');
  assert.strictEqual(idInput.id, 'otp');
  console.log('✓ Page 2 ID Card input identified (id: otp)');

  // 2. Fill ID Card
  const fillRes = ContineoAdapter.fillIdCardPage(doc, 'IDCARD-98765');
  assert.strictEqual(fillRes.success, true, 'Page 2 fill must succeed');
  assert.strictEqual(idInput.value, 'IDCARD-98765', 'ID card input value must match');
  console.log('✓ Page 2 ID Card number populated & verified');

  // 3. Submit Page 2
  let submitClicked = false;
  const submitBtn = doc.querySelector("input[value='SUBMIT']");
  submitBtn.addEventListener('click', () => { submitClicked = true; });

  const submitRes = ContineoAdapter.submitIdCardPage(doc);
  assert.strictEqual(submitRes.success, true, 'Page 2 submit must succeed');
  assert.strictEqual(submitClicked, true, 'Page 2 submit click must be triggered');
  console.log('✓ Page 2 ID Card submit executed successfully');
}

function testErrorHandling() {
  console.log('\nTesting Error Detection...');
  const errorHtml = `
    <html><body>
      <div id="atPopup" style="display:block;">
        <div class="modal-content"><p>Invalid Username or Password</p></div>
      </div>
    </body></html>
  `;
  const doc = parseHTML(errorHtml);
  const errRes = ContineoAdapter.checkForErrors(doc);
  assert.strictEqual(errRes.hasError, true);
  assert(errRes.message.includes('Invalid Username or Password'));
  console.log('✓ Error modal and error text correctly intercepted');

  console.log('\nTesting Security Challenge Detection...');
  const challengeHtml = `
    <html><body>
      <p>Enter the SMS OTP verification code sent to your registered phone</p>
      <input type="text" name="otp_input" placeholder="Enter OTP code" />
    </body></html>
  `;
  const challengeDoc = parseHTML(challengeHtml);
  const chalRes = ContineoAdapter.checkForSecurityChallenge(challengeDoc);
  assert.strictEqual(chalRes.isChallenge, true);
  assert.strictEqual(chalRes.type, 'OTP');
  console.log('✓ Genuine security challenge (OTP) intercepted');
}

function run() {
  testPageDetection();
  testPage1Automation();
  testPage2Automation();
  testErrorHandling();
  console.log('\nAll adapter & DOM automation tests passed successfully! 🚀');
}

run();
