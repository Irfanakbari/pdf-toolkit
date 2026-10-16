from pathlib import Path

import pikepdf

from pdf_toolkit.processors.pdf import merge, split


def create_pdf(path: Path, pages: int):
    pdf = pikepdf.Pdf.new()
    for _ in range(pages):
        pdf.add_blank_page(page_size=(100, 100))
    pdf.save(path)


def test_merge_and_split(tmp_path):
    first, second = tmp_path / "a.pdf", tmp_path / "b.pdf"
    create_pdf(first, 1)
    create_pdf(second, 2)
    merged = tmp_path / "merged.pdf"
    merge([first, second], merged, {}, 1)
    with pikepdf.open(merged) as pdf:
        assert len(pdf.pages) == 3
    parts = split([merged], tmp_path, {"Ranges": "1,2-3"}, 1)
    assert len(parts) == 2
