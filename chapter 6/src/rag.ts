import documentsJson from '../documents/knowledge-base.json';
import questionsJson from '../datasets/rag-golden.json';

export interface KnowledgeDocument {
  id: string;
  title: string;
  text: string;
  effectiveDate: string;
  status: 'current' | 'superseded';
}

export interface RagQuestion {
  id: string;
  question: string;
  relevantDocIds: string[];
  requiredFacts: string[];
  expectedCitationIds: string[];
  shouldAbstain: boolean;
}

export interface RetrievalMetrics {
  precision: number;
  recall: number | null;
  reciprocalRank: number | null;
}

export interface GeneratedAnswer {
  answer: string;
  citationIds: string[];
}

export interface AnswerChecks {
  missingFacts: string[];
  invalidCitations: string[];
  citationCoverage: boolean;
  correctAbstention: boolean;
}

export const documents = documentsJson as KnowledgeDocument[];
export const questions = questionsJson as RagQuestion[];
export const ABSTENTION_TEXT = 'I cannot answer from the available knowledge base.';

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'do', 'does', 'for', 'how', 'i', 'in', 'is', 'it',
  'my', 'of', 'on', 'the', 'to', 'what', 'when', 'where', 'will', 'with'
]);

export function retrieve(query: string, k: number): KnowledgeDocument[] {
  if (!Number.isInteger(k) || k < 0) {
    throw new Error('k must be a non-negative integer.');
  }

  const queryTokens = tokenize(query);
  return documents
    .filter(document => document.status === 'current')
    .map((document, index) => ({
      document,
      index,
      score: overlapCount(queryTokens, tokenize(`${document.title} ${document.text}`))
    }))
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, k)
    .map(result => result.document);
}

export function scoreRetrieval(
  retrievedIds: string[],
  relevantIds: string[],
  k: number
): RetrievalMetrics {
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error('k must be a positive integer.');
  }

  const rankedIds = [...new Set(retrievedIds)];
  const relevant = new Set(relevantIds);
  const topK = rankedIds.slice(0, k);
  const matches = topK.filter(id => relevant.has(id)).length;
  const firstRelevantRank = rankedIds.findIndex(id => relevant.has(id));

  return {
    precision: matches / k,
    recall: relevant.size === 0 ? null : matches / relevant.size,
    reciprocalRank: relevant.size === 0
      ? null
      : firstRelevantRank < 0 ? 0 : 1 / (firstRelevantRank + 1)
  };
}

export function meanReciprocalRank(metrics: RetrievalMetrics[]): number | null {
  const answerableRanks = metrics
    .map(result => result.reciprocalRank)
    .filter((rank): rank is number => rank !== null);

  return answerableRanks.length === 0
    ? null
    : answerableRanks.reduce((sum, rank) => sum + rank, 0) / answerableRanks.length;
}

export function answer(_question: RagQuestion, hits: KnowledgeDocument[]): GeneratedAnswer {
  if (hits.length === 0) {
    return { answer: ABSTENTION_TEXT, citationIds: [] };
  }

  return {
    answer: hits.map(document => document.text).join('\n'),
    citationIds: hits.map(document => document.id)
  };
}

export function checkAnswer(
  question: RagQuestion,
  generated: GeneratedAnswer
): AnswerChecks {
  const normalizedAnswer = generated.answer.toLowerCase();
  const documentIds = new Set(documents.map(document => document.id));
  const missingFacts = question.requiredFacts.filter(
    fact => !normalizedAnswer.includes(fact.toLowerCase())
  );
  const invalidCitations = generated.citationIds.filter(id => !documentIds.has(id));
  const citationCoverage = question.shouldAbstain
    ? generated.citationIds.length === 0
    : question.expectedCitationIds.every(id => generated.citationIds.includes(id));
  const correctAbstention = question.shouldAbstain
    ? generated.answer === ABSTENTION_TEXT && generated.citationIds.length === 0
    : generated.answer !== ABSTENTION_TEXT;

  return { missingFacts, invalidCitations, citationCoverage, correctAbstention };
}

function tokenize(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens.filter(token => token.length > 2 && !stopWords.has(token)));
}

function overlapCount(left: Set<string>, right: Set<string>): number {
  let matches = 0;
  for (const token of left) {
    if (right.has(token)) matches += 1;
  }
  return matches;
}