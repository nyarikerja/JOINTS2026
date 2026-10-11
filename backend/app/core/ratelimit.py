"""
app/core/ratelimit.py

Pembatas laju sederhana per alamat IP (jendela geser 60 detik, di memori proses).
Melindungi endpoint mahal: simulasi (CPU) dan ringkasan AI (kuota LLM).
Batas dapat diubah lewat RATE_LIMIT_SIMULATE, RATE_LIMIT_AI, RATE_LIMIT_SYNC (0 = nonaktif).
"""

import os
import threading
import time
from collections import defaultdict, deque

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

WINDOW_S = 60.0


def _rules():
    ai = int(os.getenv("RATE_LIMIT_AI", "12"))
    return [
        ("POST", "/simulate", int(os.getenv("RATE_LIMIT_SIMULATE", "6"))),
        ("GET", "/advice/nearby", ai),
        ("POST", "/api/v1/brief", ai),
        ("POST", "/layers/sync-live", int(os.getenv("RATE_LIMIT_SYNC", "4"))),
    ]


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()
        self._rules = _rules()

    async def dispatch(self, request, call_next):
        rule = next((r for r in self._rules if r[0] == request.method and request.url.path == r[1]), None)
        if rule and rule[2] > 0:
            fwd = request.headers.get("x-forwarded-for")
            ip = (fwd.split(",")[0] if fwd else (request.client.host if request.client else "?")).strip()
            key, now = (ip, rule[1]), time.time()
            with self._lock:
                q = self._hits[key]
                while q and now - q[0] > WINDOW_S:
                    q.popleft()
                if len(q) >= rule[2]:
                    retry = int(WINDOW_S - (now - q[0])) + 1
                    return JSONResponse(
                        {"detail": f"Terlalu banyak permintaan. Coba lagi dalam {retry} detik."},
                        status_code=429, headers={"Retry-After": str(retry)},
                    )
                q.append(now)
        return await call_next(request)
