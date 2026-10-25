import { test, expect } from '@playwright/test';
import { scoreRetrieval } from '../src/rag';

test('DEMONSTRATION: relevant result ranked second misses a rank-one gate', () => {
  const metrics = scoreRetrieval(['KB-UNRELATED', 'KB-VPN-001'], ['KB-VPN-001'], 3);
  expect(metrics.reciprocalRank).toBe(1);
});