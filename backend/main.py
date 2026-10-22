from collections import defaultdict
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import sqlite3

import pandas as pd
import pymupdf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


BASE_DIR = Path(__file__).resolve().parent
CAREERS_FILE = Path(os.getenv("CAREERS_FILE", BASE_DIR / "data" / "AI-based Career Recommendation System.csv"))
DB_FILE = Path(os.getenv("CAREER_HISTORY_DB", BASE_DIR / "career_history.db"))
MAX_RESUME_BYTES = 5 * 1024 * 1024
MAX_PROFILE_ITEMS = 50


def split_values(value: object) -> list[str]:
    return [item.strip() for item in str(value or "").split(";") if item.strip()]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9+#. ]", " ", text.lower()).strip()


def load_careers(path: Path) -> pd.DataFrame:
    """Build privacy-safe career profiles from the supplied candidate examples."""
    if not path.is_file():
        raise RuntimeError(f"Career dataset not found: {path}")
    source = pd.read_csv(path).fillna("")
    required = {"Skills", "Interests", "Recommended_Career"}
    if not required.issubset(source.columns):
        raise RuntimeError(f"Career dataset must contain these columns: {', '.join(sorted(required))}")

    groups: dict[str, dict[str, set[str]]] = defaultdict(lambda: {"skills": set(), "interests": set()})
    for _, row in source.iterrows():
        career = str(row["Recommended_Career"]).strip()
        if not career:
            continue
        groups[career]["skills"].update(split_values(row["Skills"]))
        groups[career]["interests"].update(split_values(row["Interests"]))
    if not groups:
        raise RuntimeError("Career dataset does not contain any career profiles")

    profiles = []
    for career, terms in sorted(groups.items()):
        skills, interests = sorted(terms["skills"]), sorted(terms["interests"])
        focus = ", ".join(interests[:3]) or career
        profiles.append({
            "career": career,
            "description": f"Apply {focus.lower()} knowledge to plan, build, analyze, or improve work as a {career.lower()}.",
            "skills": ";".join(skills),
            "interests": ";".join(interests),
            "education": "",
            "projects": f"Build a small portfolio project related to {focus}; document your approach and results.",
            "learning": ";".join([f"Strengthen {skill}" for skill in skills[:4]] or [f"Explore the fundamentals of {career}"]),
        })
    return pd.DataFrame(profiles)


careers = load_careers(CAREERS_FILE)
career_documents = [" ".join(str(row[column]) for column in ("description", "skills", "interests", "education")) for _, row in careers.iterrows()]
career_vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
career_matrix = career_vectorizer.fit_transform(career_documents)

app = FastAPI(title="Career Recommendation API", version="1.1.0")
origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class StudentProfile(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    education: str = Field(default="Computer Science", max_length=120)
    year: str = Field(default="3rd Year", max_length=40)
    skills: list[str] = Field(default_factory=list, max_length=MAX_PROFILE_ITEMS)
    interests: list[str] = Field(default_factory=list, max_length=MAX_PROFILE_ITEMS)
    experience: str = Field(default="Beginner", max_length=40)


def init_db() -> None:
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS recommendation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            education TEXT,
            skills TEXT,
            interests TEXT,
            top_career TEXT
        )""")


init_db()


@app.get("/")
def home():
    return {"message": "Career Recommendation API is running", "careers": len(careers)}


@app.get("/health")
def health():
    return {"status": "ok", "careers": len(careers)}


@app.get("/api/options")
def get_options():
    skills = sorted({value for row in careers["skills"] for value in split_values(row)})
    interests = sorted({value for row in careers["interests"] for value in split_values(row)})
    return {"skills": skills, "interests": interests, "careers_count": len(careers)}


@app.post("/api/recommend")
def recommend(profile: StudentProfile):
    if not profile.skills and not profile.interests:
        raise HTTPException(status_code=400, detail="Choose at least one skill or interest.")
    if any(not value or len(value) > 100 for value in profile.skills + profile.interests):
        raise HTTPException(status_code=422, detail="Each skill and interest must contain 1 to 100 characters.")

    student_document = " ".join(profile.skills + profile.interests + [profile.education, profile.experience])
    try:
        student_vector = career_vectorizer.transform([student_document])
        similarities = cosine_similarity(student_vector, career_matrix).flatten()
    except ValueError:
        similarities = [0.0] * len(careers)

    selected_skills = {normalize(value) for value in profile.skills}
    selected_interests = {normalize(value) for value in profile.interests}
    results = []
    for index, (_, row) in enumerate(careers.iterrows()):
        required = split_values(row["skills"])
        career_interests = split_values(row["interests"])
        matched = [value for value in required if normalize(value) in selected_skills]
        missing = [value for value in required if normalize(value) not in selected_skills]
        matched_interests = [value for value in career_interests if normalize(value) in selected_interests]
        skill_overlap = len(matched) / max(len(required), 1)
        interest_overlap = len(matched_interests) / max(len(career_interests), 1)
        score = round((0.55 * float(similarities[index]) + 0.35 * skill_overlap + 0.10 * interest_overlap) * 100)
        results.append({
            "career": row["career"], "description": row["description"],
            "score": max(0, min(score, 100)), "required_skills": required,
            "matched_skills": matched, "missing_skills": missing,
            "matched_interests": matched_interests,
            "projects": split_values(row["projects"]),
            "learning": split_values(row["learning"]),
            "interests": career_interests,
        })
    results.sort(key=lambda item: (-item["score"], item["career"]))
    results = results[:5]

    with sqlite3.connect(DB_FILE) as conn:
        conn.execute(
            "INSERT INTO recommendation_history (created_at, top_career) VALUES (?, ?)",
            (datetime.now(timezone.utc).isoformat(), results[0]["career"]),
        )
    return {
        "recommendations": results,
        "note": "Ranking uses skill, interest, and text overlap. Education, study year, and experience are context only. Scores are relative signals, not probabilities of getting a job.",
    }


@app.post("/api/resume/skills")
async def resume_skills(file: UploadFile = File(...)):
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF resume.")
    data = await file.read(MAX_RESUME_BYTES + 1)
    await file.close()
    if len(data) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=413, detail="PDF must be smaller than 5 MB.")
    if b"%PDF-" not in data[:1024]:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")
    try:
        with pymupdf.open(stream=data, filetype="pdf") as pdf:
            if len(pdf) > 100:
                raise HTTPException(status_code=400, detail="PDF must contain 100 pages or fewer.")
            text = " ".join(page.get_text() for page in pdf)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read this PDF. Try another file.") from exc
    all_skills = sorted({value for row in careers["skills"] for value in split_values(row)}, key=len, reverse=True)
    found = [skill for skill in all_skills if re.search(r"(?<!\w)" + re.escape(skill) + r"(?!\w)", text, re.I)]
    return {"skills": found, "message": "Review the extracted skills before using them. Resume parsing may miss skills."}


@app.get("/api/history")
def history():
    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT id, created_at, top_career FROM recommendation_history ORDER BY id DESC LIMIT 20").fetchall()
    return {"history": [dict(row) for row in rows]}
