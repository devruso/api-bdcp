# SIGAA Detail Signatures Fixtures

This folder stores curated HTML/JSON fixture pairs used by parser regression tests.

Why these files are committed:
- They are a minimal representative corpus for known SIGAA detail-page patterns.
- Tests and `manifest.json` rely on these files as reproducible evidence.
- Keeping them versioned prevents regressions from going unnoticed.

How to refresh fixtures:
1. Capture new detail samples while investigating a parser change.
2. Promote only representative samples to this folder.
3. Update `manifest.json` and related tests.
4. Run focused tests to validate the updated corpus.

Important:
- Raw debug captures under `tmp/` are temporary investigation artifacts.
- Do not commit bulk dumps from `tmp/`; keep only curated fixtures here.
