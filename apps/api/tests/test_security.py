from pdf_toolkit.security import create_capability, hash_capability, verify_capability


def test_capability_hash():
    token, digest = create_capability()
    assert token not in digest
    assert digest == hash_capability(token)
    assert verify_capability(token, digest)
    assert not verify_capability(token + "x", digest)
