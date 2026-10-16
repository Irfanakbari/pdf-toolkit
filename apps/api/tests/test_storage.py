from datetime import UTC, datetime
from uuid import uuid4

import pytest

from pdf_toolkit.storage import Storage, secure_name


def test_safe_storage(tmp_path):
    storage = Storage(tmp_path)
    job_id = uuid4()
    path = storage.file(job_id, datetime.now(UTC), "input", "../../evil.pdf")
    assert tmp_path.resolve() in path.parents
    assert path.name == "evil.pdf"


def test_reject_invalid_directory(tmp_path):
    with pytest.raises(ValueError):
        Storage(tmp_path).directory(uuid4(), datetime.now(UTC), "../outside")


def test_secure_name():
    assert secure_name("invoice (1).pdf") == "invoice_1_.pdf"
