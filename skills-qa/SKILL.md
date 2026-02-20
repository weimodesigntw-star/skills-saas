---
name: skills-qa
description: "Comprehensive automated testing framework for all Cowork skills. Runs four tiers: unit tests, integration tests, stress tests (large files, concurrency, memory), and regression tests. Use whenever you need to validate skill functionality, benchmark performance, or detect regressions. Triggers on: test, QA, validate skills, run tests, stress test, regression test."
---

# Skills QA Testing Framework

## Quick Start

```bash
cd /path/to/skills-qa
python scripts/run_tests.py           # Run all tests
python scripts/run_tests.py --tier 1  # Unit tests only
python scripts/run_tests.py --tier 3  # Stress tests only
python scripts/run_tests.py --skill xlsx  # XLSX only
python scripts/run_tests.py -v        # Verbose
```

## Test Tiers

| Tier | Type | Count | Description |
|------|------|-------|-------------|
| 1 | Unit | ~45 | Individual functions in isolation |
| 2 | Integration | ~14 | End-to-end workflows |
| 3 | Stress | ~25 | Large files, concurrency, memory, edge cases |
| 4 | Regression | ~8 | Known bugs, previous failures |

## Output

Reports saved to `output/`:
- `results.json` — structured results with per-test metrics
- `results.xlsx` — Excel summary with pass/fail, timing, skill breakdown
