from pathlib import Path

import img2pdf
import pikepdf
from PIL import Image

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
    processed = []
    for _index, source in enumerate(inputs):
        with Image.open(source) as image:
            image.verify()
        processed.append(str(source))
    layout = img2pdf.get_layout_fun(
        pagesize=img2pdf.parse_pagesize(options.get("PageSize", "A4")),
        fit=img2pdf.FitMode.into,
        auto_orient=True,
    )
    output.write_bytes(img2pdf.convert(processed, layout_fun=layout))


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
