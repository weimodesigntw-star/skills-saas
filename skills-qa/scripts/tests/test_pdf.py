"""PDF Skill — Unit + Integration tests."""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fixtures import temp_dir, measure_perf, create_test_pdf, file_size_mb
from config import TIME_LIMITS


class TestPdfUnit(unittest.TestCase):
    """Tier 1: PDF unit tests."""

    def test_create_pdf(self):
        with temp_dir() as d:
            p = os.path.join(d, "test.pdf")
            with measure_perf() as m:
                create_test_pdf(p, pages=3)
            self.assertTrue(os.path.exists(p))
            self.assertGreater(os.path.getsize(p), 0)
            self.assertLess(m["duration_sec"], TIME_LIMITS["unit"])

    def test_text_extraction_pypdf(self):
        with temp_dir() as d:
            p = os.path.join(d, "text.pdf")
            create_test_pdf(p, pages=2, text_per_page="Extract this content page")
            from pypdf import PdfReader
            reader = PdfReader(p)
            text = reader.pages[0].extract_text()
            self.assertIn("Extract", text)

    def test_text_extraction_pdfplumber(self):
        with temp_dir() as d:
            p = os.path.join(d, "plumber.pdf")
            create_test_pdf(p, pages=1, text_per_page="Plumber test content")
            import pdfplumber
            with pdfplumber.open(p) as pdf:
                text = pdf.pages[0].extract_text()
                self.assertIn("Plumber", text)

    def test_page_count(self):
        with temp_dir() as d:
            p = os.path.join(d, "pages.pdf")
            create_test_pdf(p, pages=7)
            from pypdf import PdfReader
            self.assertEqual(len(PdfReader(p).pages), 7)

    def test_merge_pdfs(self):
        with temp_dir() as d:
            p1 = os.path.join(d, "a.pdf")
            p2 = os.path.join(d, "b.pdf")
            create_test_pdf(p1, pages=2)
            create_test_pdf(p2, pages=3)
            from pypdf import PdfReader, PdfWriter
            writer = PdfWriter()
            for f in [p1, p2]:
                for page in PdfReader(f).pages:
                    writer.add_page(page)
            merged = os.path.join(d, "merged.pdf")
            with open(merged, "wb") as out:
                writer.write(out)
            self.assertEqual(len(PdfReader(merged).pages), 5)

    def test_split_pdf(self):
        with temp_dir() as d:
            p = os.path.join(d, "full.pdf")
            create_test_pdf(p, pages=4)
            from pypdf import PdfReader, PdfWriter
            reader = PdfReader(p)
            for i, page in enumerate(reader.pages):
                w = PdfWriter()
                w.add_page(page)
                sp = os.path.join(d, f"page_{i}.pdf")
                with open(sp, "wb") as f:
                    w.write(f)
                self.assertTrue(os.path.exists(sp))

    def test_rotation(self):
        with temp_dir() as d:
            p = os.path.join(d, "rotate.pdf")
            create_test_pdf(p, pages=1)
            from pypdf import PdfReader, PdfWriter
            reader = PdfReader(p)
            page = reader.pages[0]
            page.rotate(90)
            w = PdfWriter()
            w.add_page(page)
            out = os.path.join(d, "rotated.pdf")
            with open(out, "wb") as f:
                w.write(f)
            self.assertTrue(os.path.exists(out))

    def test_qpdf_validation(self):
        with temp_dir() as d:
            p = os.path.join(d, "qpdf.pdf")
            create_test_pdf(p, pages=1)
            from fixtures import run_cmd
            code, _, _ = run_cmd(["qpdf", "--check", p])
            self.assertEqual(code, 0)


class TestPdfIntegration(unittest.TestCase):
    """Tier 2: PDF integration tests."""

    def test_create_split_merge_verify(self):
        with temp_dir() as d, measure_perf() as m:
            create_test_pdf(os.path.join(d, "a.pdf"), 3, "Doc A page")
            create_test_pdf(os.path.join(d, "b.pdf"), 4, "Doc B page")
            create_test_pdf(os.path.join(d, "c.pdf"), 2, "Doc C page")
            from pypdf import PdfReader, PdfWriter
            writer = PdfWriter()
            for name in ["a.pdf", "b.pdf", "c.pdf"]:
                for pg in PdfReader(os.path.join(d, name)).pages:
                    writer.add_page(pg)
            merged = os.path.join(d, "merged.pdf")
            with open(merged, "wb") as f:
                writer.write(f)
            self.assertEqual(len(PdfReader(merged).pages), 9)
            # Split back
            reader = PdfReader(merged)
            for i in range(9):
                w = PdfWriter()
                w.add_page(reader.pages[i])
                with open(os.path.join(d, f"split_{i}.pdf"), "wb") as f:
                    w.write(f)
            self.assertEqual(len([f for f in os.listdir(d) if f.startswith("split_")]), 9)
        self.assertLess(m["duration_sec"], TIME_LIMITS["integration"])


if __name__ == "__main__":
    unittest.main()
