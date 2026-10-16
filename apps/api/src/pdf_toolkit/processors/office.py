from pathlib import Path

from .common import run_command


def docx_to_pdf(source: Path, output_dir: Path, binary: str, timeout: int) -> Path:
    run_command(
        [
            binary,
            "--headless",
            "--nologo",
            "--nodefault",
            "--nofirststartwizard",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(source),
        ],
        timeout,
        output_dir,
    )
    output = output_dir / f"{source.stem}.pdf"
    if not output.is_file():
        raise RuntimeError("OFFICE_OUTPUT_MISSING")
    return output
