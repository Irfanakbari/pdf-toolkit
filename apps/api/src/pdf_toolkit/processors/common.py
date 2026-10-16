import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def run_command(args: list[str], timeout: int, cwd: Path | None = None) -> None:
    try:
        subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        logger.error("Subprocess timed out", extra={"command": Path(args[0]).name})
        raise RuntimeError("PROCESS_TIMEOUT") from exc
    except subprocess.CalledProcessError as exc:
        logger.error(
            "Subprocess failed: %s",
            (exc.stderr or exc.stdout or "No diagnostic output")[-2000:],
            extra={"command": Path(args[0]).name, "return_code": exc.returncode},
        )
        raise RuntimeError("PROCESS_FAILED") from exc
