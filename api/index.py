import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

from fastapi import FastAPI
app = FastAPI()

try:
    from main import app as workmate_app
    app = workmate_app
except Exception as exc:
    @app.get("/{path:path}")
    async def startup_fallback(path: str = ""):
        return {"error": "Workmate startup failed", "detail": str(exc)}

handler = app
application = app
