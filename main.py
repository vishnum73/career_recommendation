"""Vercel entrypoint for the API and built React frontend."""

import os

# Vercel's deployment filesystem is read-only; /tmp is writable but ephemeral.
os.environ.setdefault("CAREER_HISTORY_DB", "/tmp/career_history.db")

from fastapi.staticfiles import StaticFiles

from backend.main import app

# Keep the API routes above this mount so they take precedence over the SPA.
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
