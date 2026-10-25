import { test, expect } from '../../src/fixtures/test-fixtures';
import { vpnPolicy, vpnQuestion } from '../../data/vpn-policy';

test('returns a nonempty VPN-support response', async ({ modelProvider }, testInfo) => {
  test.setTimeout(150_000);

  const result = await modelProvider.generate({
    system: `Answer only using this policy:\n${vpnPolicy}`,
    user: vpnQuestion
  });

  expect(result.text.trim().length).toBeGreaterThan(0);
  expect(result.provider).toMatch(/^(mock|ollama)$/);

  await testInfo.attach('model-response', {
    body: JSON.stringify({
      profile: process.env.TEST_PROFILE ?? 'mock',
      ...result
    }, null, 2),
    contentType: 'application/json'
  });
});