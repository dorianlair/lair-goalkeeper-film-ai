SPECIFICATION
Lair Athletics Goalkeeper Film AI Platform

SPEC TYPE
Product/feature

LOAD-BEARING FRAMEWORKS
F1 Outcome-First
F2 Acceptance Criteria
F3 Scope Boundary
F4 Executor Context

SUPPORTING FRAMEWORKS
F5 Failure Conditions
F6 Ambiguity Audit

DATE
2026-07-27

AUTHOR
Dorian Lair + Lair Athletics using GitHub Copilot

DECISION OWNER
Dorian Lair

ZERO-QUESTION SCORE
0 (for current scoped version)

--------------------------------------------------
HOW TO READ THIS SPEC

If you are executing solo, treat this as the source-of-truth contract.

Build order:
1) Outcome
2) Scope
3) Acceptance Criteria
4) AIDLC Plan

Weekly planning:
- Milestones
- Revision Triggers

Risk checks before shipping:
- Failure Conditions
- Adversarial Self-Critique

--------------------------------------------------
NOTATION KEY

[Validated] = confirmed by repo reality or explicit decision
[Assumed: verify] = likely true but needs explicit validation
[Unknown: TBD] = unresolved; cannot ship that portion without decision
Confidence levels:
H = high
M = medium
L = low

--------------------------------------------------
1) OUTCOME STATEMENT

After execution of this spec, a coach can upload goalkeeper game film, receive structured AI coaching feedback, and track athlete progress over time from one dashboard with stable local-first persistence and optional cloud scale-up.

Verification method:
1) Upload a valid match clip from the UI.
2) Receive a JSON-backed report with summary, strengths, improvements, key moments, training plan, and next steps.
3) Re-open athlete profile and confirm historical reviews/video/report links persist.
4) Optionally run with Postgres + S3 and confirm the same flow works.

Outcome score:
3 (binary-testable)

--------------------------------------------------
2) SCOPE

IN SCOPE (CURRENT TRUTH)

S-1
Capability: Video intake + validation
Description: Upload one clip with MIME + size checks and clear errors
AC references: AC-1, AC-2, AC-10

S-2
Capability: AI analysis pipeline
Description: Build goalkeeper-focused prompt and run Gemini analysis
AC references: AC-3, AC-4

S-3
Capability: Structured report output
Description: Persist and render normalized report fields for coaching review
AC references: AC-5, AC-6

S-4
Capability: Athlete lifecycle
Description: Create/load athlete profiles and attach sequential reviews
AC references: AC-7, AC-8

S-5
Capability: Dashboard visibility
Description: Show athlete history + infographic coaching views
AC references: AC-9

S-6
Capability: Local-first reliability
Description: Atomic writes, graceful shutdown, health endpoint
AC references: AC-11, AC-12

S-7
Capability: Optional cloud persistence
Description: Postgres + Supabase Storage mode parity with local mode
AC references: AC-13

S-8
Capability: Modular front-end architecture
Description: Reusable modules under public/modules for formatting, parsing, API payload handling, report normalization, analysis rendering, athlete history rendering, and dashboard visualization
AC references: AC-16

S-9
Capability: Baseline quality gate
Description: Test + syntax validation available through a single verify command
AC references: AC-17

S-10
Capability: Parent-friendly export
Description: Generate a visually polished shareable report that hides coach-only notes, raw analysis text, and confidence values
AC references: AC-18

OUT OF SCOPE (EXPLICIT)

X-1
Excluded capability: Team multi-user auth + roles
Why excluded: Current build is single-operator workflow
When addressed: Phase 3+

X-2
Excluded capability: Mobile-native apps (iOS/Android)
Why excluded: Web-first velocity for solo team
When addressed: Phase 4+

X-3
Excluded capability: Automated billing/subscriptions
Why excluded: Product validity first, monetization second
When addressed: Phase 3

X-4
Excluded capability: Real-time collaborative film markup
Why excluded: High complexity not required for MVP learning
When addressed: Future expansion

X-5
Excluded capability: Auto-generated highlight clips from video
Why excluded: Requires additional media processing pipeline
When addressed: Future expansion

Scope dependencies:
- Gemini API key is required for analysis path. [Validated]
- Cloud mode requires DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BUCKET. [Validated]

--------------------------------------------------
3) ACCEPTANCE CRITERIA

AC-1
Type: Behavioral
Criterion: User can submit analysis only with required intake fields + a video file.
Score: 3
Annotation: [Validated]

AC-2
Type: Edge case
Criterion: Unsupported MIME or oversized file returns user-readable 400 error.
Score: 3
Annotation: [Validated]

AC-3
Type: Behavioral
Criterion: System constructs goalkeeper-specific prompt with context fields and focus areas.
Score: 3
Annotation: [Validated]

AC-4
Type: Dependency
Criterion: With valid Gemini credentials, analysis returns parsable response and no server crash.
Score: 2
Annotation: [Assumed: verify in prod-like run]

AC-5
Type: Behavioral
Criterion: Report includes summary, overall assessment, strengths, improvements, key moments, training plan, next steps.
Score: 3
Annotation: [Validated]

AC-6
Type: Negative
Criterion: Output rendering does not require perfect JSON-only response; parser handles fenced/raw variants gracefully.
Score: 3
Annotation: [Validated]

AC-7
Type: Behavioral
Criterion: Athlete profile is created/resolved by athlete + team context and updated on each review.
Score: 3
Annotation: [Validated]

AC-8
Type: Behavioral
Criterion: Review status transitions processing -> completed/failed and persists error message on failure.
Score: 3
Annotation: [Validated]

AC-9
Type: Behavioral
Criterion: Athlete dashboard displays history, latest metrics, trend/focus visual sections, and review links.
Score: 2
Annotation: [Assumed: verify UX fit with target coaches]

AC-10
Type: Non-behavioral
Criterion: Upload limit enforced at configured MAX_UPLOAD_BYTES without process instability.
Score: 3
Annotation: [Validated]

AC-11
Type: Non-behavioral
Criterion: Local persistence writes are atomic (temp file + rename).
Score: 3
Annotation: [Validated]

AC-12
Type: Non-behavioral
Criterion: App exposes GET /healthz with uptime + persistence mode.
Score: 3
Annotation: [Validated]

AC-13
Type: Dependency
Criterion: Cloud persistence mode supports list/load/create/update/report asset retrieval parity with local mode.
Score: 2
Annotation: [Assumed: verify full parity test matrix]

AC-14
Type: Negative
Criterion: App does not accept non-video media through analysis endpoint.
Score: 3
Annotation: [Validated]

AC-15
Type: Edge case
Criterion: If analysis fails mid-run, draft review is marked failed and temp upload is cleaned up.
Score: 3
Annotation: [Validated]

AC-16
Type: Non-behavioral
Criterion: Front-end concerns are separated into modules (format, utils, api, analysis, analysis-ui, athlete-history, dashboard-viz) to reduce coupling and simplify updates.
Score: 3
Annotation: [Validated]

AC-17
Type: Dependency
Criterion: A baseline verify workflow exists and runs syntax + tests before release commits.
Score: 3
Annotation: [Validated]

AC-18
Type: Behavioral
Criterion: Coach can export a parent-friendly HTML report that presents the analysis in a positive, easy-to-read format while hiding coach-only notes, raw responses, and confidence values.
Score: 3
Annotation: [Validated]

Complexity:
Medium-High

Definition of done for current release line:
AC-1 through AC-18 all passing, with AC-4, AC-9, and AC-13 assumptions validated.

--------------------------------------------------
4) CONTEXT AND DECISIONS

Executor profile:
- Executor type: Solo founder-developer (business analyst + builder)
- Codebase familiarity: High
- Product domain familiarity: High (youth/soccer coaching context)
- Availability for questions: N/A (self-execution)

Product goals (current):
1) Ship an end-to-end usable film analysis workflow for goalkeeper coaching.
2) Build trust via reliable persistence and replayable athlete history.
3) Keep architecture simple enough for one-person operation.

Key decisions:
D-1
Decision: Local-first with optional cloud mode
Rationale: Fast development + lower early ops overhead
Annotation: [Validated]

D-2
Decision: Coach-friendly structured JSON output
Rationale: Enables deterministic rendering + future analytics
Annotation: [Validated]

D-3
Decision: Single Node service for API + static UI
Rationale: Simpler deploy/debug path for solo team
Annotation: [Validated]

D-4
Decision: Goalkeeper-specific prompting strategy
Rationale: Domain quality over generic sports analysis
Annotation: [Validated]

D-5
Decision: One-clip-per-run workflow
Rationale: Keeps UX and failure handling predictable
Annotation: [Validated]

Dependencies:
DEP-1
Dependency: Gemini API access/key
Type: External API
Status: Ready (if key present)
Owner: Dorian
Blocker: Yes

DEP-2
Dependency: Postgres (optional)
Type: Infra
Status: Optional
Owner: Dorian
Blocker: No (unless cloud mode required)

DEP-3
Dependency: Supabase Storage bucket (optional)
Type: Infra
Status: Optional
Owner: Dorian
Blocker: No (unless cloud mode required)

Constraints:
C-1
Constraint: Solo-dev bandwidth
Type: Resource
Source: One-man team reality

C-2
Constraint: Keep operational complexity low
Type: Technical/Business
Source: Need consistent execution while working full-time

C-3
Constraint: Fast iteration with measurable progress
Type: Process
Source: AIDLC-driven build discipline

C-4
Constraint: Every release should pass verify workflow (npm run verify)
Type: Process/Quality
Source: Guardrail for AI-assisted changes

--------------------------------------------------
5) FAILURE CONDITIONS

FC-1
Type: External API
Assumption at risk: Gemini response remains usable for parser
Deviation signal: Empty/invalid response repeatedly
Escalation action: Freeze feature work; add contract tests + fallback parser updates
Severity: Critical

FC-2
Type: Infra
Assumption at risk: Cloud storage parity holds with local semantics
Deviation signal: Review assets missing or broken links in cloud mode
Escalation action: Stop cloud rollout; run parity regression suite
Severity: Major

FC-3
Type: Process
Assumption at risk: Solo roadmap remains feasible per milestone
Deviation signal: Missed 2+ milestone targets consecutively
Escalation action: Reduce scope by cutting lowest ROI feature set
Severity: Major

FC-4
Type: Product
Assumption at risk: Coaches derive actionable value from report UX
Deviation signal: Low repeat usage or poor qualitative feedback
Escalation action: Rework report UX before adding new advanced features
Severity: Critical

--------------------------------------------------
6) AMBIGUITY AUDIT

AMB-1
Ambiguity: Is this a consumer app or coaching operations tool?
Resolution: Coaching operations tool first, consumer later.
Confidence: H

AMB-2
Ambiguity: Is cloud mandatory now?
Resolution: No. Cloud is optional scale path; local remains first-class.
Confidence: H

AMB-3
Ambiguity: What is MVP success?
Resolution: Reliable end-to-end workflow + repeat athlete review visibility.
Confidence: H

AMB-4
Ambiguity: Should we prioritize multi-sport now?
Resolution: No. Stay goalkeeper-first until repeatable value signal.
Confidence: M

Zero-question score:
0 for current scope.

--------------------------------------------------
7) AIDLC IMPLEMENTATION PLAN (SOURCE-OF-TRUTH WORKFLOW)

PHASE A - ALIGN
- Lock problem statement and ICP:
  - Primary user: goalkeeper coach/trainer
  - Core job: convert raw match film into practical coaching action
- Output artifact: weekly one-page decision note in hq/decisions.md

PHASE I - IDEATE
- Maintain feature candidate list by ROI:
  - Report quality improvements
  - Dashboard clarity improvements
  - Workflow automation
- Strict rule: no feature enters build unless mapped to AC impact

PHASE D - DESIGN
- For each feature, create mini-spec with:
  - outcome
  - scope IN/OUT
  - acceptance criteria
  - risk
- UI changes must preserve coaching-first language and fast glanceability

PHASE L - LAUNCH
- Launch cadence: weekly internal release, monthly external-ready checkpoint
- Release gate:
  1) No blocker errors
  2) Acceptance criteria for target milestone pass
  3) Manual UX walkthrough complete

PHASE C - LEARN
- Metrics to capture each cycle:
  - analysis success rate
  - median turnaround time
  - repeat-athlete review rate
  - qualitative coach usefulness score (1-5)
- Convert insights into prioritized spec deltas (not random backlog growth)

--------------------------------------------------
8) MILESTONES

MILESTONE 1 (0-30 days): MVP HARDENING
- Validate AC-4, AC-9, AC-13 assumptions
- Add simple regression checklist for local + cloud parity
- Outcome: trustworthy baseline for real coach usage

MILESTONE 2 (31-60 days): COACHING QUALITY UPLIFT
- Improve prompt/report usefulness with clearer key-moment coaching notes
- Add optional report quality scoring rubric
- Outcome: stronger repeat usage

MILESTONE 3 (61-90 days): PRODUCTIZATION READINESS
- Introduce lightweight account model and data boundaries (if needed)
- Prepare monetization decision brief (not implementation)
- Outcome: clear go/no-go for paid pilot

--------------------------------------------------
9) OPEN TENSIONS

OPEN TENSION 1
Conflict: maximizing report depth vs keeping turnaround fast
Proposed resolution: set a target median turnaround SLA and optimize prompt granularity within that bound
Decision owner: Dorian
Deadline: before Milestone 2 scope lock

OPEN TENSION 2
Conflict: local simplicity vs cloud-first commercialization pressure
Proposed resolution: keep local as default until cloud parity tests are green and repeat usage signal is positive
Decision owner: Dorian
Deadline: before any paid pilot commitment

--------------------------------------------------
10) ASSUMPTION REGISTRY

A-1
Assumption: Target users value structured AI feedback over raw transcript dumps
Section: 1, 3, 8
Confidence: M
Evidence: Existing UX/report shape direction
Invalidated when: Coaches ignore structured sections

A-2
Assumption: Solo maintenance burden remains manageable with current architecture
Section: 4, 8
Confidence: M
Evidence: Small codebase, simple runtime
Invalidated when: Frequent outages or high fix toil

A-3
Assumption: Optional cloud mode is sufficient for near-term scaling
Section: 2, 5, 8
Confidence: M
Evidence: Current dual data layer exists
Invalidated when: Data loss/latency/parity issues persist

A-4
Assumption: Goalkeeper-first vertical focus is best initial wedge
Section: 2, 6
Confidence: H
Evidence: Product naming + prompts + specialized UX
Invalidated when: Strong demand appears outside this niche first

--------------------------------------------------
11) ADVERSARIAL SELF-CRITIQUE

WEAKNESS 1: Product signal still assumption-heavy
- Assumption: current UX and report quality are truly useful for real coaches
- If wrong: technical progress will not convert to adoption
- Watch indicator: low repeat-athlete analyses after pilots

WEAKNESS 2: Cloud parity can hide subtle data edge failures
- Assumption: local and cloud behavior are functionally equivalent
- If wrong: trust erosion from missing report/video assets
- Watch indicator: mismatch between local and cloud review retrieval

WEAKNESS 3: Scope can drift under solo pressure
- Assumption: roadmap discipline will hold despite idea influx
- If wrong: incomplete features accumulate and velocity collapses
- Watch indicator: more than 3 half-finished features without AC completion

--------------------------------------------------
12) DEFINITION OF PRODUCT SUCCESS

The product is on-track when all are true for a full review window:

1) Analysis success rate is at least 95%
2) Median turnaround stays within acceptable coaching session workflow window (set in Milestone 2 lock)
3) Repeat-athlete review rate trends upward over 4 consecutive weeks
4) At least 70% of qualitative coach feedback rates report usefulness at 4/5 or higher

--------------------------------------------------
13) REVISION TRIGGERS

Revise this spec when any of the following occurs:

1) Gemini API response contract materially changes
2) Cloud parity regression reveals repeatable asset/data inconsistency
3) ICP changes away from goalkeeper/coaching workflows
4) You decide to move from solo-dev to multi-user/team product operating model

--------------------------------------------------
14) NEXT EXECUTION ACTIONS (IMMEDIATE)

1) Add this spec to weekly review workflow in hq/weekly-review.md as the single planning reference
2) Define milestone-1 validation checklist for AC-4, AC-9, AC-13
3) Add one metrics capture doc at hq/metrics.md for the four success metrics in Section 12
4) Run one pilot cycle and log decisions in hq/decisions.md

--------------------------------------------------
15) ENGINEERING GUARDRAILS REFERENCE

Authoritative guardrails document:
hq/ai-engineering-guardrails.md

This guardrails file defines:
- change workflow for AI-assisted coding
- required pre-merge quality checks
- security and reliability minimums
- module ownership and extension rules
