"""Skill Creator — Unit tests."""
import os, sys, unittest, json, yaml
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fixtures import temp_dir, run_cmd, run_validator
from config import VALIDATORS


class TestSkillCreatorUnit(unittest.TestCase):
    """Tier 1: Skill Creator unit tests."""

    def test_init_skill(self):
        with temp_dir() as d:
            code, out, err = run_cmd([sys.executable, VALIDATORS["sc_init_skill"],
                                      "test-skill", "--path", d])
            self.assertEqual(code, 0, f"init_skill failed: {err}")
            skill_dir = os.path.join(d, "test-skill")
            self.assertTrue(os.path.isdir(skill_dir))
            self.assertTrue(os.path.exists(os.path.join(skill_dir, "SKILL.md")))

    def test_init_json_evals(self):
        with temp_dir() as d:
            out_path = os.path.join(d, "evals.json")
            code, out, err = run_cmd([sys.executable, VALIDATORS["sc_init_json"],
                                      "evals", out_path])
            self.assertEqual(code, 0, f"init_json evals failed: {err}")
            self.assertTrue(os.path.exists(out_path))
            data = json.load(open(out_path))
            self.assertIn("skill_name", data)
            self.assertIn("evals", data)

    def test_init_json_history(self):
        with temp_dir() as d:
            out_path = os.path.join(d, "history.json")
            code, _, err = run_cmd([sys.executable, VALIDATORS["sc_init_json"],
                                    "history", out_path])
            self.assertEqual(code, 0, f"init_json history failed: {err}")
            data = json.load(open(out_path))
            self.assertIn("started_at", data)
            self.assertIn("current_best", data)

    def test_validate_json(self):
        with temp_dir() as d:
            evals_path = os.path.join(d, "evals.json")
            run_cmd([sys.executable, VALIDATORS["sc_init_json"], "evals", evals_path])
            code, out, err = run_cmd([sys.executable, VALIDATORS["sc_validate_json"], evals_path])
            self.assertEqual(code, 0, f"validate_json failed: {out}{err}")

    def test_copy_skill(self):
        with temp_dir() as d:
            # Create source skill
            run_cmd([sys.executable, VALIDATORS["sc_init_skill"], "src-skill", "--path", d])
            src = os.path.join(d, "src-skill")
            dst = os.path.join(d, "dst-v1")
            code, _, err = run_cmd([sys.executable, VALIDATORS["sc_copy_skill"],
                                    src, dst, "--iteration", "1"])
            self.assertEqual(code, 0, f"copy_skill failed: {err}")
            self.assertTrue(os.path.isdir(os.path.join(dst, "skill")))

    def test_kebab_case_naming(self):
        with temp_dir() as d:
            # Valid kebab-case should work
            code, _, _ = run_cmd([sys.executable, VALIDATORS["sc_init_skill"],
                                  "valid-name", "--path", d])
            self.assertEqual(code, 0)

    def test_skill_md_has_frontmatter(self):
        with temp_dir() as d:
            run_cmd([sys.executable, VALIDATORS["sc_init_skill"], "fm-test", "--path", d])
            skill_md = os.path.join(d, "fm-test", "SKILL.md")
            content = open(skill_md).read()
            self.assertTrue(content.startswith("---"))
            # Extract frontmatter
            parts = content.split("---", 2)
            self.assertGreaterEqual(len(parts), 3)
            fm = yaml.safe_load(parts[1])
            self.assertIn("name", fm)
            self.assertEqual(fm["name"], "fm-test")


if __name__ == "__main__":
    unittest.main()
