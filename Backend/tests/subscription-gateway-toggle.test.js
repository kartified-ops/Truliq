const assert = require('assert');

async function testSubscriptionGatewayToggle() {
  console.log('Running Subscription Payment Gateway Toggle Tests...');

  const Settings = require('../models/Settings');
  const schema = Settings.schema.paths;
  assert.ok(schema.isSubscriptionPaymentEnabled, 'Settings model must contain isSubscriptionPaymentEnabled field');
  assert.strictEqual(schema.isSubscriptionPaymentEnabled.defaultValue, true, 'isSubscriptionPaymentEnabled default must be true');
  console.log('  PASS  Settings schema has isSubscriptionPaymentEnabled default true');

  // Verify routes exist
  const workerPlanRoutes = require('../routes/admin-routes/workerPlanManagement.routes');
  assert.ok(workerPlanRoutes, 'Worker plan admin routes loaded successfully');
  console.log('  PASS  Worker plan admin routes loaded');

  console.log('\nAll subscription gateway toggle unit tests passed!');
}

testSubscriptionGatewayToggle().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
