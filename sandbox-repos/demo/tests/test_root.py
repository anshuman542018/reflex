import pytest
from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_root():
    assert client.get("/").status_code == 200


@pytest.mark.parametrize("case", range(23))
def test_root_is_stable(case):
    assert client.get("/").status_code == 200
