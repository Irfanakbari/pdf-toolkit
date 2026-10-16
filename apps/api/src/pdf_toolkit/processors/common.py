import subprocess
from pathlib import Path


def run_command(args: list[str], timeout: int, cwd: Path | None = None) -> None:
    try:
        subprocess.run(args, cwd=cwd, check=True, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("PROCESS_TIMEOUT") from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError("PROCESS_FAILED") from exc
