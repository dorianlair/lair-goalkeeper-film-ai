SPEC PARITY CHECKLIST
Lair Athletics Goalkeeper Film AI

Use this before every release or merge.

1) SPEC TO CODE COVERAGE
- List every acceptance criterion touched by this change.
- For each AC, identify code files changed.
- Confirm behavior matches spec language.

2) SPEC DRIFT CHECK
- If code adds behavior not in spec, update hq/app-spec.md.
- If spec lists behavior not yet implemented, mark it as planned, not complete.

3) RISK CHECK
- Did this change affect:
  - upload validation
  - AI analysis response handling
  - persistence (local/cloud)
  - dashboard rendering from model text
- If yes, add/adjust tests.

4) VERIFY COMMAND
- Run npm run verify.
- Do not ship if verify fails.

5) RELEASE NOTE SNAPSHOT
- Record changes in hq/decisions.md:
  - date
  - AC IDs
  - risk level
  - rollback plan (if needed)
