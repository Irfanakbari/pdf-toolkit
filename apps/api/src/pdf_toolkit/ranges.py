import re

RANGE = re.compile(r"^(\d+)(?:-(\d*))?$")


def parse_ranges(value: str, page_count: int) -> list[list[int]]:
    if not value or page_count < 1:
        raise ValueError("Range halaman tidak valid")
    groups: list[list[int]] = []
    for raw in value.split(","):
        part = raw.strip()
        match = RANGE.fullmatch(part)
        if not match:
            raise ValueError(f"Range tidak valid: {part}")
        start = int(match.group(1))
        end_text = match.group(2)
        end = page_count if end_text == "" else int(end_text or start)
        if start < 1 or end < start or end > page_count:
            raise ValueError(f"Range di luar halaman: {part}")
        groups.append(list(range(start - 1, end)))
    return groups
