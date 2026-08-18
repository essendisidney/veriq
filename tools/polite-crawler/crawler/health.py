"""Minimal asyncio health and metrics HTTP endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger("polite_crawler.health")

HealthPayload = Callable[[], Awaitable[dict[str, Any]]]


class HealthServer:
    """Serve GET /health, GET /ready, and GET /metrics on a local port.

    Bind ``127.0.0.1`` by default. Port ``0`` lets the OS pick a free port;
    read ``.port`` after ``start()``.
    """

    def __init__(
        self,
        payload: HealthPayload,
        *,
        host: str = "127.0.0.1",
        port: int = 0,
    ) -> None:
        self._payload = payload
        self.host = host
        self._requested_port = port
        self._server: asyncio.AbstractServer | None = None

    @property
    def port(self) -> int:
        """Bound TCP port, or 0 if the server is not started."""
        if not self._server or not self._server.sockets:
            return 0
        address = self._server.sockets[0].getsockname()
        return int(address[1])

    @property
    def url(self) -> str:
        """Base URL for the health listener."""
        return f"http://{self.host}:{self.port}"

    async def start(self) -> None:
        """Bind and start accepting connections."""
        self._server = await asyncio.start_server(self._handle, self.host, self._requested_port)
        logger.info("Health endpoints listening on %s", self.url)

    async def close(self) -> None:
        """Stop the listener."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

    async def _handle(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        try:
            raw = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=5)
        except (asyncio.IncompleteReadError, asyncio.TimeoutError, asyncio.LimitOverrunError):
            writer.close()
            await writer.wait_closed()
            return
        request_line = raw.split(b"\r\n", 1)[0].decode("ascii", errors="replace")
        parts = request_line.split(" ")
        method = parts[0] if parts else ""
        path = parts[1] if len(parts) > 1 else "/"
        path = path.split("?", 1)[0]
        try:
            status, body = await self._route(method, path)
        except Exception as exc:  # noqa: BLE001 — health must not crash the collector
            logger.exception("Health handler failed: %s", exc)
            status, body = 500, {"status": "error"}
        payload = json.dumps(body).encode("utf-8")
        header = (
            f"HTTP/1.1 {status} {'OK' if status == 200 else 'Error'}\r\n"
            "Content-Type: application/json\r\n"
            f"Content-Length: {len(payload)}\r\n"
            "Connection: close\r\n"
            "\r\n"
        )
        writer.write(header.encode("ascii") + payload)
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    async def _route(self, method: str, path: str) -> tuple[int, dict[str, Any]]:
        if method != "GET":
            return 405, {"status": "method_not_allowed"}
        data = await self._payload()
        if path == "/health":
            return 200, {"status": data.get("status", "ok"), **{k: data[k] for k in data if k != "metrics"}}
        if path == "/ready":
            ready = bool(data.get("browser_ready")) and data.get("status") == "ok"
            return (200 if ready else 503), {"ready": ready, "status": data.get("status")}
        if path == "/metrics":
            return 200, data.get("metrics") or {}
        return 404, {"status": "not_found"}
