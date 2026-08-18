/**
 * Banner audience filter tests
 *
 *   node tests/banner-audience.test.js
 */
const assert = require('assert');
const { filterBannersByAudience } = require('../utils/bannerAudience');

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
  } catch (err) {
    results.push([false, `${name}\n    ${err.message}`]);
  }
};

const banners = [
  { imageUrl: 'user-only.jpg', targetAudience: 'user' },
  { imageUrl: 'worker-only.jpg', targetAudience: 'worker' },
  { imageUrl: 'both.jpg', targetAudience: 'all' },
  { imageUrl: 'legacy.jpg' }
];

const main = async () => {
  await check('user app receives user + all banners', async () => {
    const filtered = filterBannersByAudience(banners, 'user');
    assert.strictEqual(filtered.length, 3);
    assert.ok(filtered.some((banner) => banner.imageUrl === 'user-only.jpg'));
    assert.ok(filtered.some((banner) => banner.imageUrl === 'both.jpg'));
    assert.ok(filtered.some((banner) => banner.imageUrl === 'legacy.jpg'));
  });

  await check('worker app receives worker + all banners', async () => {
    const filtered = filterBannersByAudience(banners, 'worker');
    assert.strictEqual(filtered.length, 3);
    assert.ok(filtered.some((banner) => banner.imageUrl === 'worker-only.jpg'));
    assert.ok(filtered.some((banner) => banner.imageUrl === 'both.jpg'));
    assert.ok(filtered.some((banner) => banner.imageUrl === 'legacy.jpg'));
  });

  const passed = results.filter(([ok]) => ok).length;
  results.forEach(([ok, name]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`));
  console.log(`\n${passed}/${results.length} tests passed`);
  if (passed !== results.length) process.exit(1);
};

main();
