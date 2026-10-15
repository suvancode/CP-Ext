/**
 * Master test runner for ContinueO Auto Login desktop extension.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
  'tests/crypto.test.js',
  'tests/adapter.test.js'
];

let failed = false;

console.log('====================================================');
console.log(' ContinueO Auto Login - Test Suite Execution');
console.log('====================================================\n');

for (const test of tests) {
  const filePath = path.join(__dirname, '..', test);
  console.log(`▶ Running ${test} ...`);
  const res = spawnSync(process.execPath, [filePath], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`✖ Test failed: ${test} (exit code ${res.status})`);
    failed = true;
    break;
  }
  console.log(`✔ Finished ${test}\n`);
}

if (failed) {
  console.error('\n✖ Some tests failed. Please review the output above.');
  process.exit(1);
} else {
  console.log('====================================================');
  console.log(' ✔ All tests completed successfully! Ready for use.');
  console.log('====================================================');
}
