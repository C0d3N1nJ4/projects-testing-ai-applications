# Chapter 6 Companion Project

This standalone TypeScript and Playwright project demonstrates RAG evaluation with a six-document fictional knowledge base and five golden questions. It uses a deterministic lexical retriever and reference answerer, so no Ollama service, cloud credentials, database, or browser installation is needed.

## Run the standard suite

From the repository root:

```bash
cd "chapter 6"
npm install
npm run typecheck
npm test
```

The suite checks precision@k, recall@k, reciprocal rank, required facts, citation IDs, and abstention. It attaches structured `rag-evidence` JSON to each question and generates HTML, JUnit, and JSON reports.

## Run the intentional failure

```bash
npm run test:learning-failure
```

This test is expected to fail: the first relevant document is at rank 2, so reciprocal rank is `0.5`, not `1.0`. It uses a separate Playwright configuration and is excluded from `npm test`.

## Evaluation boundaries

The retriever uses simple token overlap and filters documents whose status is not `current`. The reference answerer returns retrieved policy text and document IDs. Required-fact and citation checks are deterministic lexical/document-ID checks; they do not prove claim-level entailment, citation passage correctness, or production search quality. The five-question dataset is an instructional seed set, not a representative benchmark. Review labels independently before treating metrics as release evidence.