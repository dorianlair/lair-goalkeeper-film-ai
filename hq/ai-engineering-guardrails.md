AI ENGINEERING GUARDRAILS
Lair Athletics Goalkeeper Film AI
Version: 1.0
Last updated: 2026-07-27
Owner: Dorian Lair

Purpose
This document defines how AI-assisted coding is used in this repository so speed does not create hidden technical debt.

Core Principle
AI is a copilot, not an autopilot.

If a change cannot be explained, tested, and owned by the human maintainer, it does not ship.

--------------------------------------------------
1) CHANGE WORKFLOW (SPEC -> CODE -> VERIFY -> SHIP)

Step 1: Start from spec
- Update hq/app-spec.md first when behavior, scope, or constraints change.
- Every code task must reference specific acceptance criteria IDs.

Step 2: Keep changes small
- Target small diffs and focused commits.
- Avoid bundling unrelated refactors with feature work.

Step 3: Verify before merge/release
- Run: npm run verify
- Required result: all checks and tests pass.

Step 4: Record decisions
- Log major tradeoffs and risk decisions in hq/decisions.md.

--------------------------------------------------
2) REQUIRED QUALITY GATES

Gate A: Syntax and runtime sanity
- npm run check must pass.

Gate B: Baseline tests
- npm test must pass.
- Add tests whenever fixing bugs or changing behavior in:
  - report parsing
  - prompt contract
  - config/rate-limit behavior

Gate C: Spec parity check
- Verify each implemented change maps to app-spec acceptance criteria.
- If spec says feature exists but code does not, mark spec as planned (not done).

--------------------------------------------------
3) FRONT-END MODULARITY RULES

Current module boundaries
- public/modules/format.js: date/time/duration formatting
- public/modules/utils.js: parsing, scoring, escaping, safe links
- public/modules/api.js: API payload decoding
- public/modules/analysis.js: report normalization
- public/modules/svg.js: chart/SVG primitives
- public/modules/analysis-ui.js: analysis output rendering
- public/modules/athlete-history.js: athlete profile and history rendering
- public/modules/dashboard-viz.js: dashboard KPI + infographic rendering
- public/app.js: orchestration and event wiring only

Rules
- New pure helpers go into modules, not app.js.
- app.js should coordinate behavior, not accumulate utility logic.
- Any new model/user text rendered via HTML must be escaped.

--------------------------------------------------
4) SECURITY AND RELIABILITY MINIMUMS

Security minimums
- Do not trust AI/model text as safe HTML.
- Escape dynamic text before template insertion.
- Keep secrets in env only; never commit secrets.

Reliability minimums
- Keep atomic writes for local persistence.
- Keep health endpoint stable.
- Keep analyze endpoint protected by upload size/type validation and rate limiting.

Cloud minimums
- Local and cloud storage paths must preserve behavioral parity.
- Any cloud persistence change requires parity test of:
  1) create review
  2) update review status
  3) report retrieval
  4) video retrieval

--------------------------------------------------
5) AI USAGE RULES (PRACTICAL)

Allowed high-ROI AI tasks
- boilerplate generation
- refactor scaffolding
- test generation drafts
- doc generation drafts

Human-required tasks
- architecture decisions
- security-sensitive flows
- persistence behavior changes
- any production incident remediation

Prompt discipline
- ask for one change at a time
- require acceptance criteria references
- require explicit edge-case handling notes

--------------------------------------------------
6) SCALABILITY READINESS CHECKLIST

Before scaling usage or adding users:
- Add authentication and authorization model.
- Add persistent audit trail for analysis requests.
- Add stronger server-side observability (structured logs, failure metrics).
- Add integration tests for local and cloud modes.
- Add CI to enforce npm run verify on every PR.

--------------------------------------------------
7) EASY UPDATE PROTOCOL

When updating this guardrails doc:
1) Increase version number.
2) Update date and reason in hq/decisions.md.
3) Keep rules short and operational.
4) Remove rules that are no longer actionable.

Change log format
- YYYY-MM-DD | version | what changed | why

Initial entry
- 2026-07-27 | v1.0 | established baseline guardrails for AI-assisted engineering | reduce vibe-coding risk while preserving speed
