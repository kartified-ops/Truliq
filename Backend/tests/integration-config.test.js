/**
 * Integration config service — encryption, masking, env fallback, tests.
 *
 *   node tests/integration-config.test.js
 */
const assert = require('assert');
const {
  encryptSecret,
  decryptSecret,
  maskSecret,
  isEncryptedValue
} = require('../utils/credentialEncryption');
const {
  SERVICE_NAMES,
  mergeCredentials
} = require('../services/integrationConfigService');

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
  } catch (err) {
    results.push([false, `${name}\n    ${err.message}`]);
  }
};

const main = async () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'test-integration-key-for-unit-tests-only';

  await check('encrypt/decrypt roundtrip', async () => {
    const plain = 'rzp_live_secret_value_1234';
    const enc = encryptSecret(plain);
    assert.ok(isEncryptedValue(enc));
    assert.strictEqual(decryptSecret(enc), plain);
  });

  await check('maskSecret hides middle of secret', async () => {
    const masked = maskSecret('abcdefghijklmnop');
    assert.ok(masked.includes('mnop'));
    assert.ok(masked.includes('•') || masked.includes('*'));
  });

  await check('mergeCredentials keeps existing secret when incoming empty', async () => {
    const merged = mergeCredentials(
      { apiSecret: 'existing-secret' },
      { apiSecret: '' },
      ['apiSecret']
    );
    assert.strictEqual(merged.apiSecret, 'existing-secret');
  });

  await check('mergeCredentials replaces secret when new value provided', async () => {
    const merged = mergeCredentials(
      { apiSecret: 'old-secret' },
      { apiSecret: 'new-secret' },
      ['apiSecret']
    );
    assert.strictEqual(merged.apiSecret, 'new-secret');
  });

  await check('SERVICE_NAMES includes core integrations', async () => {
    assert.ok(SERVICE_NAMES.PAYMENT_GATEWAY);
    assert.ok(SERVICE_NAMES.SMS);
    assert.ok(SERVICE_NAMES.MAPS);
    assert.ok(SERVICE_NAMES.FIREBASE);
    assert.ok(SERVICE_NAMES.CLOUDINARY);
    assert.ok(SERVICE_NAMES.EMAIL);
  });

  const passed = results.filter(([ok]) => ok).length;
  results.forEach(([ok, name]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`));
  console.log(`\n${passed}/${results.length} tests passed`);
  if (passed !== results.length) process.exit(1);
};

main();
