from pdf_toolkit.ranges import parse_ranges


def test_ranges():
    assert parse_ranges("1-2, 4, 6-", 7) == [[0, 1], [3], [5, 6]]


def test_invalid_ranges():
    import pytest

    with pytest.raises(ValueError):
        parse_ranges("0-2", 4)
    with pytest.raises(ValueError):
        parse_ranges("4-2", 4)
