from pathlib import Path

import pikepdf
import pytest
from PIL import Image

from pdf_toolkit.processors.pdf import images_to_pdf, merge, split
from pdf_toolkit.tasks import output_name


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


def test_images_to_pdf_normalizes_transparent_png_on_a4(tmp_path):
    source = tmp_path / "chatgpt-transparent.png"
    image = Image.new("RGBA", (640, 480), (20, 120, 220, 0))
    image.paste((20, 120, 220, 255), (80, 60, 560, 420))
    image.save(source, "PNG")
    output = tmp_path / "nested" / "result.pdf"

    images_to_pdf([source], output, {"PageSize": "A4"}, 10)

    with pikepdf.open(output) as pdf:
        assert len(pdf.pages) == 1
        media_box = [float(value) for value in pdf.pages[0].MediaBox]
        assert sorted(media_box[2:]) == pytest.approx([595.28, 841.89], abs=0.1)


def test_output_name_preserves_uploaded_basename():
    assert output_name("image-to-pdf", "photo.png") == "photo.pdf"
    assert output_name("compress", "report.pdf") == "report.pdf"
    assert output_name("split", "report.pdf") == "report.zip"
    assert output_name("compress", "") == "document.pdf"
    assert output_name("split", "") == "document.zip"


def test_images_to_pdf_rejects_decompression_bomb(tmp_path, monkeypatch):
    source = tmp_path / "large.png"
    Image.new("RGB", (20, 20), "white").save(source)
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 10)

    with pytest.raises(Image.DecompressionBombError):
        images_to_pdf([source], tmp_path / "result.pdf", {"PageSize": "A4"}, 10)
