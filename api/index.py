import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

from main import app
from mangum import Mangum

# Vercel's Python runtime can invoke this ASGI adapter reliably.
handler = Mangum(app, lifespan="off")
