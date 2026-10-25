# projects-testing-ai-applications

These are companion projects for the book "Testing AI Applications" by Naiomi Naidoo.

## Dependency Updates

[Dependabot](.github/dependabot.yml) checks every npm chapter project and the
chapter 13 and 14 GitHub Actions workflow examples weekly. Each project has its
own update entry, so dependency versions do not need to match across chapters.
Chapter 2 contains documentation only and has no dependencies to update.

For npm, `versioning-strategy: lockfile-only` updates each project's
`package-lock.json` within its existing `package.json` version requirements.
Dependabot does not widen those requirements or update exactly pinned direct
dependencies through scheduled version updates. Change a chapter's manifest
manually when it needs a new version range, then regenerate its lockfile and
run that chapter's tests before merging. New npm projects need their own entry
in the configuration.

The configuration takes effect once it is on the repository's default branch.
Enable Dependabot alerts and security updates separately in GitHub under
Settings > Advanced Security (or Code security). Security fixes that require
changing a declared version range should be reviewed against that chapter's
requirements. Updates are proposed as pull requests and are not auto-merged.

## Part I — Foundations of AI Quality Engineering
Understand the testing challenge and establish the project.

### [Chapter 1. Why Testing AI Applications Is Different](chapter%201/README.md)

Introduce nondeterminism, semantic correctness, hallucinations, reliability, evaluation uncertainty, and the limitations of exact-match assertions.

Practical exercise: Test the same prompt repeatedly, compare responses, and distinguish legitimate wording variations from incorrect results.

### [Chapter 2. Designing an AI Test Strategy](chapter%202/README.md)

Define risks, quality attributes, test levels, evaluation datasets, acceptance thresholds, and release criteria. Introduce the distinction between component, integration, system, and AI evaluation testing.

Practical exercise: Create a risk-based test strategy and traceable test matrix for the reference application.

### [Chapter 3. Building the AI Testing Framework](chapter%203/README.md)

Initialize the TypeScript project, configure Playwright, API clients, fixtures, model-provider adapters, test environments, and structured reporting.

Practical exercise: Execute the first automated API and model-response tests, including a deliberately failing test.


## Part II — Functional Testing and AI Evaluations
Build reliable tests for LLMs, prompts, retrieval, and agent behavior.

### [Chapter 4. Testing Prompts and LLM Responses](chapter%204/README.md)

Cover prompt templates, prompt versioning, output schemas, JSON validation, refusals, instruction compliance, and deterministic properties.

Practical exercise: Build a data-driven suite validating intent classification and structured responses.

### [Chapter 5. Evaluating AI Response Quality](chapter%205/README.md)

Introduce golden datasets, ground-truth design, exact and semantic assertions, LLM-as-judge, evaluation rubrics, calibration, sampling, and score aggregation.

Practical exercise: Implement a reusable evaluator interface and compare deterministic assertions with rubric-based evaluation.

### [Chapter 6. Testing Retrieval-Augmented Generation](chapter%206/README.md)

Separate retrieval quality from generation quality. Cover precision@k, recall@k, MRR, groundedness, factual consistency, source attribution, document freshness, and missing-context behavior.

Practical exercise: Build a RAG evaluation dataset and test the knowledge assistant against seeded documents.

### [Chapter 7. Testing AI Agents and Tool Execution](chapter%207/README.md)

Test tool selection, tool arguments, sequencing, workflow state, authorization, timeouts, retries, idempotency, and human approval requirements.

Practical exercise: Verify that an agent retrieves a ticket before requesting approval to update it, and never performs an unauthorized modification.

### [Chapter 8. End-to-End Testing of AI Applications](chapter%208/README.md)

Combine browser tests, API assertions, application state, model responses, and tool traces into business-level test scenarios.

Practical exercise: Automate a user journey that creates a support ticket, receives AI guidance, and resolves the ticket after the required approval.


## Part III — Security, Resilience, and Operational Quality
Test beyond correctness, including how the system behaves under adverse conditions.

### [Chapter 9. Security Testing for AI Applications](chapter%209/README.md)

Cover prompt injection, indirect prompt injection through retrieved documents, sensitive data exposure, tenant isolation, excessive tool permissions, and dangerous action requests.

Practical exercise: Build an adversarial dataset and validate that the support assistant refuses prohibited operations. Include optional Promptfoo-based testing.

### [Chapter 10. Testing Reliability and Failure Recovery](chapter%2010/README.md)

Introduce simulated LLM outages, malformed responses, tool failures, rate limiting, context-window constraints, fallback policies, and partial workflow failures.

Practical exercise: Use controllable test doubles and injected failures to verify recovery behavior.

### [Chapter 11. Testing Performance, Cost, and Observability](chapter%2011/README.md)

Test response latency, time to first token, throughput, token consumption, provider costs, and tracing. Explain how quality and performance interact.

Practical exercise: Record latency distributions, model usage, and traces for the same evaluation suite across different configurations.


## Part IV — Continuous AI Quality Engineering
Make AI testing repeatable and enforceable within delivery pipelines.

### [Chapter 12. Test Data, Reproducibility, and Evaluation Management](chapter%2012/README.md)

Manage datasets, version fixtures, seed databases, pin models where possible, record model configurations, and distinguish regressions from evaluation noise.

Practical exercise: Reproduce a failed evaluation from its recorded dataset, application revision, and model configuration.

### [Chapter 13. Continuous AI Testing with GitHub Actions](chapter%2013/README.md)

Implement pull-request checks, integration suites, scheduled evaluations, release gates, artifacts, failure annotations, and test evidence retention.

Practical exercise: Configure a pipeline that rejects a change when mandatory deterministic checks fail or statistically meaningful quality degradation is detected.

### [Chapter 14. Building a Production-Ready AI Quality Pipeline](chapter%2014/README.md)

Assemble the framework into one coherent solution. Review release criteria, regression analysis, evaluation reliability, and future extension points.

Practical exercise: Run the complete suite, inspect quality reports, and demonstrate a release decision with evidence.