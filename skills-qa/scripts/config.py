"""Test configuration: thresholds, paths, and limits."""
import os

# Skills root (read-only)
SKILLS_ROOT = "/sessions/eager-beautiful-rubin/mnt/.skills/skills"

# Existing validation scripts
VALIDATORS = {
    "docx_validate": f"{SKILLS_ROOT}/docx/scripts/office/validate.py",
    "docx_unpack": f"{SKILLS_ROOT}/docx/scripts/office/unpack.py",
    "docx_pack": f"{SKILLS_ROOT}/docx/scripts/office/pack.py",
    "docx_soffice": f"{SKILLS_ROOT}/docx/scripts/office/soffice.py",
    "xlsx_validate": f"{SKILLS_ROOT}/xlsx/scripts/office/validate.py",
    "xlsx_recalc": f"{SKILLS_ROOT}/xlsx/scripts/recalc.py",
    "pptx_validate": f"{SKILLS_ROOT}/pptx/scripts/office/validate.py",
    "pptx_soffice": f"{SKILLS_ROOT}/pptx/scripts/office/soffice.py",
    "pdf_check_fields": f"{SKILLS_ROOT}/pdf/scripts/check_fillable_fields.py",
    "pdf_check_bbox": f"{SKILLS_ROOT}/pdf/scripts/check_bounding_boxes.py",
    "sc_init_skill": f"{SKILLS_ROOT}/skill-creator/scripts/init_skill.py",
    "sc_init_json": f"{SKILLS_ROOT}/skill-creator/scripts/init_json.py",
    "sc_validate_json": f"{SKILLS_ROOT}/skill-creator/scripts/validate_json.py",
    "sc_quick_validate": f"{SKILLS_ROOT}/skill-creator/scripts/quick_validate.py",
    "sc_copy_skill": f"{SKILLS_ROOT}/skill-creator/scripts/copy_skill.py",
}

# Performance thresholds (seconds)
TIME_LIMITS = {
    "unit": 2.0,
    "integration": 30.0,
    "stress_large_file": 90.0,
    "stress_concurrent": 60.0,
}

# Memory limits (MB)
MEMORY_LIMITS = {
    "unit": 200,
    "integration": 500,
    "stress": 1500,
}

# Stress test parameters
STRESS = {
    "docx_pages": 100,
    "xlsx_rows": 10000,
    "xlsx_cols": 20,
    "pptx_slides": 50,
    "pdf_pages": 100,
    "concurrent_workers": 4,
    "memory_leak_iterations": 20,
}

# Output
QA_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(QA_ROOT, "output")
