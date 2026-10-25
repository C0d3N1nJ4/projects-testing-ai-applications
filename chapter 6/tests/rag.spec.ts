import { test, expect } from '@playwright/test';
import {
  answer,
  checkAnswer,
  documents,
  meanReciprocalRank,
  questions,
  retrieve,
  scoreRetrieval
} from '../src/rag';

test.describe('RAG evaluation metrics', () => {
  test('matches the documented precision, recall, and reciprocal-rank example', () => {
    const relevantIds = ['A', 'C'];
    const topThree = scoreRetrieval(['B', 'C', 'D', 'A', 'E'], relevantIds, 3);
    const topFive = scoreRetrieval(['B', 'C', 'D', 'A', 'E'], relevantIds, 5);

    expect(topThree).toEqual({ precision: 1 / 3, recall: 0.5, reciprocalRank: 0.5 });
    expect(topFive).toEqual({ precision: 0.4, recall: 1, reciprocalRank: 0.5 });
  });

  test('uses requested k as the precision denominator when fewer results are returned', () => {
    expect(scoreRetrieval(['A'], ['A'], 3).precision).toBe(1 / 3);
  });

  test('reports null recall and reciprocal rank for unanswerable queries', () => {
    expect(scoreRetrieval(['A', 'B'], [], 3)).toEqual({
      precision: 0,
      recall: null,
      reciprocalRank: null
    });
  });

  test('calculates MRR over answerable queries only', () => {
    const metrics = [
      scoreRetrieval(['B', 'A'], ['A'], 2),
      scoreRetrieval(['A'], ['A'], 2),
      scoreRetrieval([], [], 2)
    ];

    expect(meanReciprocalRank(metrics)).toBe(0.75);
    expect(meanReciprocalRank([scoreRetrieval([], [], 2)])).toBeNull();
  });
});

test.describe('seeded RAG cases', () => {
  for (const question of questions) {
    test(`${question.id}: retrieve, answer, and preserve evidence`, async ({}, testInfo) => {
      const hits = retrieve(question.question, 3);
      const retrievedIds = hits.map(document => document.id);
      const metrics = scoreRetrieval(retrievedIds, question.relevantDocIds, 3);
      const generated = answer(question, hits);
      const checks = checkAnswer(question, generated);
      const evidence = {
        id: question.id,
        question: question.question,
        retrievedIds,
        retrievalMetrics: metrics,
        generated,
        checks
      };

      await testInfo.attach('rag-evidence', {
        body: Buffer.from(JSON.stringify(evidence, null, 2)),
        contentType: 'application/json'
      });

      if (question.relevantDocIds.length > 0) {
        expect(metrics.recall).toBe(1);
      } else {
        expect(metrics.recall).toBeNull();
        expect(metrics.reciprocalRank).toBeNull();
      }
      expect(checks.missingFacts).toEqual([]);
      expect(checks.invalidCitations).toEqual([]);
      expect(checks.correctAbstention).toBe(true);
      expect(checks.citationCoverage).toBe(true);
    });
  }

  test('does not retrieve superseded VPN policy', () => {
    const results = retrieve('corporate VPN disconnect reconnect', 3);
    const resultIds = results.map(document => document.id);

    expect(resultIds).toContain('KB-VPN-001');
    expect(resultIds).not.toContain('KB-VPN-OLD');
    expect(documents.find(document => document.id === 'KB-VPN-OLD')?.status).toBe('superseded');
  });

  test('flags missing facts and citations to unknown documents', () => {
    const question = questions.find(item => item.id === 'Q1');
    if (!question) throw new Error('Expected Q1 in the golden dataset.');

    const checks = checkAnswer(question, {
      answer: 'Open VPN settings.',
      citationIds: ['KB-NOT-REAL']
    });

    expect(checks.missingFacts).toEqual([
      'corporate VPN profile',
      'attempt to reconnect',
      'contact IT support'
    ]);
    expect(checks.invalidCitations).toEqual(['KB-NOT-REAL']);
    expect(checks.citationCoverage).toBe(false);
  });
});