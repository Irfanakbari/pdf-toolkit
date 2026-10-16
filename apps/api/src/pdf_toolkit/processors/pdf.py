import os
import tempfile
from pathlib import Path

import img2pdf
import pikepdf
from PIL import Image, ImageOps, UnidentifiedImageError

from ..ranges import parse_ranges
from .common import run_command


def merge(inputs: list[Path], output: Path, _: dict, __: int) -> None:
    target = pikepdf.Pdf.new()
    for source in inputs:
        with pikepdf.open(source) as pdf:
            target.pages.extend(pdf.pages)
    target.save(output)


def split(inputs: list[Path], output_dir: Path, options: dict, _: int) -> list[Path]:
    outputs = []
    with pikepdf.open(inputs[0]) as source:
        groups = parse_ranges(str(options.get("Ranges", "1-")), len(source.pages))
        for index, pages in enumerate(groups, 1):
            target = pikepdf.Pdf.new()
            for page in pages:
                target.pages.append(source.pages[page])
            destination = output_dir / f"bagian-{index}.pdf"
            target.save(destination)
            outputs.append(destination)
    return outputs


def images_to_pdf(inputs: list[Path], output: Path, options: dict, _: int) -> None:
    page_size = str(options.get("PageSize", "A4"))
    page_sizes = {
        "A4": (img2pdf.mm_to_pt(210), img2pdf.mm_to_pt(297)),
        "Letter": (img2pdf.in_to_pt(8.5), img2pdf.in_to_pt(11)),
    }
    if page_size not in page_sizes:
        raise ValueError("INVALID_PAGE_SIZE")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="image-to-pdf-", dir=output.parent) as work_dir:
        processed = [
            str(_normalize_image(source, Path(work_dir) / f"page-{index}.jpg"))
            for index, source in enumerate(inputs)
        ]
        layout = img2pdf.get_layout_fun(
            pagesize=page_sizes[page_size],
            fit=img2pdf.FitMode.into,
            auto_orient=True,
        )
        pdf_bytes = img2pdf.convert(processed, layout_fun=layout)
        fd, temporary_name = tempfile.mkstemp(prefix=".result-", suffix=".pdf", dir=output.parent)
        try:
            with os.fdopen(fd, "wb") as temporary:
                temporary.write(pdf_bytes)
                temporary.flush()
                os.fsync(temporary.fileno())
            os.replace(temporary_name, output)
        except BaseException:
            Path(temporary_name).unlink(missing_ok=True)
            raise


def _normalize_image(source: Path, destination: Path) -> Path:
    try:
        with Image.open(source) as image:
            image.load()
            image = ImageOps.exif_transpose(image)
            if image.width <= 0 or image.height <= 0:
                raise ValueError("INVALID_IMAGE")
            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                rgba = image.convert("RGBA")
                background = Image.new("RGB", rgba.size, "white")
                background.paste(rgba, mask=rgba.getchannel("A"))
                normalized = background
            else:
                normalized = image.convert("RGB")
            normalized.save(destination, "JPEG", quality=92, optimize=True, subsampling=0)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("INVALID_IMAGE") from exc
    return destination


def protect(inputs: list[Path], output: Path, options: dict, _: int) -> None:
    password = str(options.get("Password", ""))
    if len(password) < 8 or len(password) > 128:
        raise ValueError("Password harus 8-128 karakter")
    with pikepdf.open(inputs[0]) as pdf:
        pdf.save(
            output, encryption=pikepdf.Encryption(owner=password, user=password, R=6, aes=True)
        )


def compress(inputs: list[Path], output: Path, options: dict, timeout: int) -> None:
    preset = options.get("Preset", "balanced")
    profiles = {"screen": "/screen", "balanced": "/ebook", "print": "/printer"}
    if preset not in profiles:
        raise ValueError("Preset kompresi tidak valid")
    run_command(
        [
            options["GhostscriptBinary"],
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.6",
            f"-dPDFSETTINGS={profiles[preset]}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={output}",
            str(inputs[0]),
        ],
        timeout,
    )
