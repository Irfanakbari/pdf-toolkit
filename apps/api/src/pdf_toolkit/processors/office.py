import tempfile
from pathlib import Path

from .common import run_command


def office_to_pdf(source: Path, output_dir: Path, binary: str, timeout: int) -> Path:
    ext = source.suffix.lower()
    if ext in {".xlsx", ".xls", ".ods", ".csv"}:
        export_filter = "pdf:calc_pdf_Export"
    elif ext in {".pptx", ".ppt", ".odp"}:
        export_filter = "pdf:impress_pdf_Export"
    else:
        export_filter = "pdf:writer_pdf_Export"

    with tempfile.TemporaryDirectory(prefix="libreoffice-profile-") as profile:
        run_command(
            [
                binary,
                f"-env:UserInstallation={Path(profile).resolve().as_uri()}",
                "--headless",
                "--nologo",
                "--nodefault",
                "--nofirststartwizard",
                "--convert-to",
                export_filter,
                "--outdir",
                str(output_dir),
                str(source),
            ],
            timeout,
            output_dir,
        )
    output = output_dir / f"{source.stem}.pdf"
    if not output.is_file():
        pdfs = sorted(output_dir.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
        if pdfs:
            output = pdfs[0]
        else:
            raise RuntimeError("OFFICE_OUTPUT_MISSING")
    return output
