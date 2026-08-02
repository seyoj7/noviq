"""
Vercel serverless function entry point.
Exposes the FastAPI app from backend/main.py for Vercel's Python runtime.
"""
import sys
from pathlib import Path

# Ensure the project root is on sys.path so `from backend import ...` works
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.main import app  # noqa: E402, F401
