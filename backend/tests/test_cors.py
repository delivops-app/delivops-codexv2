from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_cors_allows_loopback_origins():
    response = client.options(
        "/clients/",
        headers={
            "origin": "http://127.0.0.1:5173",
            "access-control-request-method": "GET",
            "access-control-request-headers": "x-tenant-id",
        },
    )

    assert response.status_code == 200
    assert (
        response.headers.get("access-control-allow-origin")
        == "http://127.0.0.1:5173"
    )
