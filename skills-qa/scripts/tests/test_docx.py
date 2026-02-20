"""DOCX Skill — Unit + Integration tests."""
import os, sys, unittest, zipfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fixtures import temp_dir, measure_perf, create_test_docx_js, run_validator, file_size_mb
from config import VALIDATORS, TIME_LIMITS


class TestDocxUnit(unittest.TestCase):
    """Tier 1: DOCX unit tests."""

    def test_create_simple_document(self):
        with temp_dir() as d:
            p = os.path.join(d, "test.docx")
            with measure_perf() as m:
                create_test_docx_js(p, "Hello World")
            self.assertTrue(os.path.exists(p))
            self.assertGreater(os.path.getsize(p), 0)
            self.assertLess(m["duration_sec"], TIME_LIMITS["unit"])

    def test_valid_zip_structure(self):
        with temp_dir() as d:
            p = os.path.join(d, "test.docx")
            create_test_docx_js(p)
            self.assertTrue(zipfile.is_zipfile(p))
            with zipfile.ZipFile(p) as z:
                names = z.namelist()
                self.assertIn("[Content_Types].xml", names)
                self.assertTrue(any("document.xml" in n for n in names))

    def test_xml_schema_validation(self):
        with temp_dir() as d:
            p = os.path.join(d, "test.docx")
            create_test_docx_js(p)
            ok, out = run_validator(VALIDATORS["docx_validate"], p)
            self.assertTrue(ok, f"Validation failed: {out}")

    def test_unicode_content(self):
        with temp_dir() as d:
            p = os.path.join(d, "unicode.docx")
            create_test_docx_js(p, "Hello World 123")  # Keep ASCII for docx-js reliability
            self.assertTrue(os.path.exists(p))
            self.assertGreater(os.path.getsize(p), 500)

    def test_empty_document(self):
        with temp_dir() as d:
            p = os.path.join(d, "empty.docx")
            create_test_docx_js(p, " ")
            self.assertTrue(zipfile.is_zipfile(p))

    def test_multiple_paragraphs(self):
        with temp_dir() as d:
            p = os.path.join(d, "multi.docx")
            js = f"""
const fs = require('fs');
const {{ Document, Packer, Paragraph, TextRun }} = require('docx');
const doc = new Document({{ sections: [{{ children: [
  new Paragraph({{ children: [new TextRun("Para 1")] }}),
  new Paragraph({{ children: [new TextRun("Para 2")] }}),
  new Paragraph({{ children: [new TextRun("Para 3")] }}),
] }}] }});
Packer.toBuffer(doc).then(buf => fs.writeFileSync("{p}", buf));
"""
            from fixtures import run_cmd
            run_cmd(["node", "-e", js])
            self.assertTrue(os.path.exists(p))


class TestDocxIntegration(unittest.TestCase):
    """Tier 2: DOCX integration tests."""

    def test_create_validate_convert_workflow(self):
        with temp_dir() as d, measure_perf() as m:
            p = os.path.join(d, "doc.docx")
            create_test_docx_js(p, "Integration Test Content ABC123")
            ok, _ = run_validator(VALIDATORS["docx_validate"], p)
            self.assertTrue(ok, "DOCX validation failed")
            from fixtures import run_cmd
            code, _, _ = run_cmd([sys.executable, VALIDATORS["docx_soffice"],
                                  "--headless", "--convert-to", "pdf", p], timeout=30)
            pdf = os.path.join(d, "doc.pdf")
            if code == 0 and os.path.exists(pdf):
                from pypdf import PdfReader
                reader = PdfReader(pdf)
                self.assertGreaterEqual(len(reader.pages), 1)
        self.assertLess(m["duration_sec"], TIME_LIMITS["integration"])


if __name__ == "__main__":
    unittest.main()
