// Unit tests for crypto.js and storage.js
const Crypto = require('../common/crypto.js');
const Storage = require('../common/storage.js');
const assert = require('assert');

async function testCrypto() {
  console.log('Testing Crypto AES-256-GCM...');
  const secret = JSON.stringify({ usn: '1BY21CS001', pin: '1234' });
  const passphrase = 'mySecurePin123';

  const encrypted = await Crypto.encrypt(secret, passphrase);
  assert(encrypted.encrypted === true);
  assert(encrypted.salt);
  assert(encrypted.iv);
  assert(encrypted.data);

  const decrypted = await Crypto.decrypt(encrypted, passphrase);
  assert.strictEqual(decrypted, secret);
  console.log('✓ Encrypt and decrypt with correct PIN succeeded');

  try {
    await Crypto.decrypt(encrypted, 'wrongPin');
    assert.fail('Should have failed with wrong PIN');
  } catch (err) {
    assert(err.message.includes('Decryption failed'));
    console.log('✓ Decryption with wrong PIN correctly rejected');
  }
}

async function testStorage() {
  console.log('\nTesting Storage Manager...');
  
  // Test validation
  const invalid = Storage.validateCredentials({ usn: '', dobDay: '12' });
  assert.strictEqual(invalid.valid, false);

  const valid = Storage.validateCredentials({
    usn: '1by21cs001',
    dobDay: '5',
    dobMonth: '3',
    dobYear: '2004',
    idCardNumber: 'ID998877'
  });
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.normalized.usn, '1BY21CS001');
  assert.strictEqual(valid.normalized.dobDay, '05');
  assert.strictEqual(valid.normalized.dobMonth, '03');
  assert.strictEqual(valid.normalized.dobYear, '2004');

  // Test masking
  const masked = Storage.maskSummary(valid.normalized);
  assert(masked.includes('1B***01'));
  assert(masked.includes('ID: ID***77'));
  console.log('✓ Validation and masking work:', masked);

  // Test save unencrypted
  await Storage.saveCredentials(valid.normalized, { useEncryption: false });
  const meta1 = await Storage.getMetadata();
  assert.strictEqual(meta1.configured, true);
  assert.strictEqual(meta1.encrypted, false);
  const creds1 = await Storage.getCredentials();
  assert.strictEqual(creds1.usn, '1BY21CS001');

  // Test save encrypted with PIN
  await Storage.saveCredentials(valid.normalized, { useEncryption: true, pin: '4321' });
  const meta2 = await Storage.getMetadata();
  assert.strictEqual(meta2.configured, true);
  assert.strictEqual(meta2.encrypted, true);

  try {
    await Storage.getCredentials();
    assert.fail('Should require PIN');
  } catch (e) {
    assert.strictEqual(e.code, 'PIN_REQUIRED');
  }

  const creds2 = await Storage.getCredentials('4321');
  assert.strictEqual(creds2.usn, '1BY21CS001');
  console.log('✓ Save, encrypted storage & retrieval work as expected');

  // Test clear
  await Storage.clearCredentials();
  const meta3 = await Storage.getMetadata();
  assert.strictEqual(meta3.configured, false);
  console.log('✓ Clear credentials works');
}

async function run() {
  await testCrypto();
  await testStorage();
  console.log('\nAll crypto & storage tests passed successfully! 🎉');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
