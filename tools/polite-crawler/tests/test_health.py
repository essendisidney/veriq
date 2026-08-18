"""Health HTTP endpoint tests."""

from __future__ import annotations

import asyncio
import json

import pytest

from crawler.health import HealthServer


async def _get(host: str, port: int, path: str) -> tuple[int, dict[str, object]]:
    reader, writer = await asyncio.open_connection(host, port)
    writer.write(f"GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n".encode())
    await writer.drain()
    raw = await reader.read()
    writer.close()
    await writer.wait_closed()
    header, _, body = raw.partition(b"\r\n\r\n")
    status = int(header.split(b" ")[1])
    return status, json.loads(body.decode() or "{}")


@pytest.mark.asyncio
async def test_health_ready_metrics_and_404() -> None:
    async def payload() -> dict[str, object]:
        return {
            "status": "ok",
            "browser_ready": True,
            "circuit_open": False,
            "pages_fetched": 0,
            "metrics": {"requests": 0},
        }

    server = HealthServer(payload, host="127.0.0.1", port=0)
    await server.start()
    try:
        health_status, health_body = await _get("127.0.0.1", server.port, "/health")
        assert health_status == 200
        assert health_body["status"] == "ok"
        ready_status, ready_body = await _get("127.0.0.1", server.port, "/ready")
        assert ready_status == 200
        assert ready_body["ready"] is True
        metrics_status, metrics_body = await _get("127.0.0.1", server.port, "/metrics")
        assert metrics_status == 200
        assert metrics_body == {"requests": 0}
        missing_status, _ = await _get("127.0.0.1", server.port, "/nope")
        assert missing_status == 404
    finally:
        await server.close()


@pytest.mark.asyncio
async def test_ready_is_503_when_browser_down() -> None:
    async def payload() -> dict[str, object]:
        return {"status": "starting", "browser_ready": False, "metrics": {}}

    server = HealthServer(payload, host="127.0.0.1", port=0)
    await server.start()
    try:
        status, body = await _get("127.0.0.1", server.port, "/ready")
        assert status == 503
        assert body["ready"] is False
    finally:
        await server.close()
