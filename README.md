# Career Compass AI

A React and FastAPI career discovery demo. It groups the included candidate examples by their recommended career, then ranks paths using skills, interests, and TF-IDF text similarity. It also provides skill gap suggestions, PDF skill extraction, and an anonymized career choice history in SQLite.

## Deploy with Docker Compose

Requirements: Docker Engine with the Compose plugin.

From this directory, run:

```bash
docker compose up --build -d
```

Open `http://localhost:8080` (or the port set with `PORT`, for example `PORT=80`). The frontend container serves the built app and forwards `/api/*` and `/health` requests to FastAPI. Recommendation history is stored in the `career_history` Docker volume and survives container rebuilds.

## Deploy to Vercel

Import this repository into Vercel with the project root set to the directory containing this README. Vercel uses `main.py` as the FastAPI entrypoint, installs the root `requirements.txt`, and builds the React app from `frontend/` using the build command in `pyproject.toml`. The FastAPI app serves the built frontend and API from the same origin, so no `VITE_API_URL` or CORS setting is needed.

Vercel's filesystem is read-only except for `/tmp`. Career history therefore uses a temporary SQLite database on Vercel and can be reset when a function instance is replaced. Use a managed database if history must persist across deployments or instances. Docker Compose remains available for deployments that need persistent local SQLite storage.

To inspect service status and logs:

```bash
docker compose ps
docker compose logs -f
```

For a public deployment, terminate HTTPS at a reverse proxy or hosting platform. This demo has no user accounts, authorization, or rate limiting. New history records contain only the recommended career and timestamp; profile details and resume files are not saved. The dataset is a small demonstration sample, not a validated labor-market source. Scores are relative ranking signals, not probabilities of getting a job.

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
```

Activate the environment (`.venv\\Scripts\\Activate.ps1` on Windows PowerShell, `.venv/bin/activate` on Linux/macOS), then:

```bash
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: <http://127.0.0.1:8000/docs>. Health check: <http://127.0.0.1:8000/health>.

### Frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL Vite prints, usually <http://localhost:5173>. For a separate frontend/backend deployment, set `VITE_API_URL` at frontend build time to the public API base URL and set `CORS_ORIGINS` on the backend to the frontend origin(s), separated by commas. Leave `VITE_API_URL` empty when serving the frontend and API under the same origin.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Host port used by Docker Compose |
| `CAREER_HISTORY_DB` | `backend/career_history.db` locally | SQLite database path; use persistent storage in deployment |
| `CAREERS_FILE` | Included CSV under `backend/data` | Path to the candidate examples CSV |
| `CORS_ORIGINS` | Local Vite origins | Comma-separated allowed browser origins |
| `VITE_API_URL` | Empty (same origin) | API base URL embedded in the frontend build |

Resume files are size-limited and processed in memory for skill extraction; the app does not save the uploaded PDF. Extraction only recognizes listed skills in selectable PDF text. Scanned PDFs need OCR, which is not included.
