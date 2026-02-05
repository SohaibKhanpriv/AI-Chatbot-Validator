from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import datasets, runs, progress, prompts, reports

app = FastAPI(title="AI Validation API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(datasets.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
