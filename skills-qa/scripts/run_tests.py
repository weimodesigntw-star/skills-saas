#!/usr/bin/env python3
"""
Skills QA Test Runner — Professional automated testing framework.

Usage:
    python run_tests.py                    # Run all tests
    python run_tests.py --tier 1           # Unit tests only
    python run_tests.py --tier 3           # Stress tests only
    python run_tests.py --skill docx       # DOCX tests only
    python run_tests.py --quick            # Skip slow tests
    python run_tests.py -v                 # Verbose output
"""
import sys, os, argparse, time, json, unittest

# Ensure imports work
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from config import OUTPUT_DIR
from report import generate_json_report, generate_xlsx_report, print_console_summary


# Tier → module mapping
TIER_MAP = {
    "1": ["test_docx", "test_xlsx", "test_pptx", "test_pdf", "test_skill_creator"],
    "2": ["test_docx", "test_xlsx", "test_pptx", "test_pdf", "test_skill_creator"],
    "3": ["test_stress"],
    "4": ["test_regression"],
}

# Skill → module mapping
SKILL_MAP = {
    "docx": ["test_docx"],
    "xlsx": ["test_xlsx"],
    "pptx": ["test_pptx"],
    "pdf": ["test_pdf"],
    "skill-creator": ["test_skill_creator"],
    "stress": ["test_stress"],
    "regression": ["test_regression"],
}

# Tier → class name pattern
TIER_CLASS = {
    "1": "Unit",
    "2": "Integration",
    "3": "Stress",
    "4": "Regression",
}


class ResultCollector(unittest.TestResult):
    """Collects test results with timing for each test."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.results = []
        self._test_start = None

    def startTest(self, test):
        super().startTest(test)
        self._test_start = time.perf_counter()

    def _record(self, test, status, error=None):
        duration = time.perf_counter() - self._test_start if self._test_start else 0
        module = test.__class__.__module__.split(".")[-1]
        # Determine tier and skill from module/class name
        cls_name = test.__class__.__name__
        tier = "unknown"
        for t, pattern in TIER_CLASS.items():
            if pattern in cls_name:
                tier = t
                break
        skill = module.replace("test_", "")
        self.results.append({
            "name": str(test).split()[0],
            "class": cls_name,
            "module": module,
            "status": status,
            "duration_sec": round(duration, 3),
            "tier": tier,
            "skill": skill,
            "error": error,
        })

    def addSuccess(self, test):
        super().addSuccess(test)
        self._record(test, "passed")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self._record(test, "failed", str(err[1]))

    def addError(self, test, err):
        super().addError(test, err)
        self._record(test, "error", str(err[1]))

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self._record(test, "skipped", reason)


def discover_tests(tier=None, skill=None):
    """Build test suite based on filters."""
    test_dir = os.path.join(SCRIPT_DIR, "tests")
    loader = unittest.TestLoader()

    if tier and skill:
        modules = set(TIER_MAP.get(tier, [])) & set(SKILL_MAP.get(skill, []))
    elif tier:
        modules = set(TIER_MAP.get(tier, []))
    elif skill:
        modules = set(SKILL_MAP.get(skill, []))
    else:
        modules = None  # All

    suite = unittest.TestSuite()

    if modules is not None:
        for mod in modules:
            try:
                s = loader.loadTestsFromName(f"tests.{mod}")
                if tier:
                    # Filter by class name pattern
                    pattern = TIER_CLASS.get(tier, "")
                    filtered = unittest.TestSuite()
                    for test_group in s:
                        if hasattr(test_group, '__iter__'):
                            for test in test_group:
                                if pattern in test.__class__.__name__:
                                    filtered.addTest(test)
                        elif pattern in test_group.__class__.__name__:
                            filtered.addTest(test_group)
                    suite.addTests(filtered)
                else:
                    suite.addTests(s)
            except Exception as e:
                print(f"Warning: Could not load {mod}: {e}")
    else:
        suite = loader.discover(test_dir, pattern="test_*.py")

    return suite


def main():
    parser = argparse.ArgumentParser(description="Skills QA Test Runner")
    parser.add_argument("--tier", choices=["1", "2", "3", "4"], help="Test tier to run")
    parser.add_argument("--skill", choices=list(SKILL_MAP.keys()), help="Skill to test")
    parser.add_argument("--quick", action="store_true", help="Skip slow tests")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    if args.quick:
        os.environ["SKILLS_QA_QUICK"] = "1"

    # Banner
    print("\n" + "=" * 60)
    print("  Skills QA — Professional Automated Testing Framework")
    print("=" * 60)
    tier_label = f"Tier {args.tier}" if args.tier else "All Tiers"
    skill_label = args.skill or "All Skills"
    print(f"  Scope: {tier_label} | {skill_label}")
    print("=" * 60 + "\n")

    # Discover and run
    suite = discover_tests(tier=args.tier, skill=args.skill)
    verbosity = 2 if args.verbose else 1
    collector = ResultCollector()

    start_time = time.perf_counter()
    suite(collector)
    total_time = time.perf_counter() - start_time

    # Generate reports
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    report = generate_json_report(collector.results, total_time)
    json_path = os.path.join(OUTPUT_DIR, "results.json")
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    xlsx_path = os.path.join(OUTPUT_DIR, "results.xlsx")
    generate_xlsx_report(report, xlsx_path)

    print_console_summary(report)

    print(f"\n  Reports saved:")
    print(f"    JSON: {json_path}")
    print(f"    XLSX: {xlsx_path}")
    print()

    # Exit code
    failed = report["summary"]["failed"] + report["summary"]["errors"]
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
