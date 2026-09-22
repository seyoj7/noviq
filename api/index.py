from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is in sys.path so `import backend` works in Vercel serverless functions
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from starlette.types import ASGIApp, Scope, Receive, Send
from backend.main import app as _backend_app


class PathRewriteMiddleware:
    """
    Normalizes request paths from Vercel rewrites or Next.js proxies.
    Automatically handles endpoints prefixed with '/api/index/' or '/api/'
    by stripping the prefix so they route directly to backend endpoints.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/api/index/"):
                scope["path"] = path[10:]
            elif path == "/api/index":
                scope["path"] = "/"
            elif path.startswith("/api/"):
                scope["path"] = path[4:]
            elif path == "/api":
                scope["path"] = "/"
        await self.app(scope, receive, send)


# Add path normalization middleware
_backend_app.add_middleware(PathRewriteMiddleware)

# Root fallback route
if not any(getattr(route, "path", None) == "/" for route in _backend_app.routes):
    @_backend_app.get("/", tags=["Meta"])
    async def root_status():
        return {
            "status": "ok",
            "service": "Noviq API",
            "version": "0.3.0",
            "docs": "/docs",
            "health": "/health",
        }

# Expose app for Vercel Python runtime
app = _backend_app
