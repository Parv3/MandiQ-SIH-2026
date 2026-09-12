from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from .websocket_manager import manager as ws_manager
from .database import engine, Base
from . import parv_routes, voice_routes
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database tables on startup for the hackathon
    # In production, you would use Alembic migrations instead
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="MandiQ Backend", lifespan=lifespan)

# Setup CORS as per the 48-hour plan
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Since the UI runs on 5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Parv's routes (both direct and /api prefixed for proxy compatibility)
app.include_router(parv_routes.router, tags=["Parv - Backend Support"])
app.include_router(parv_routes.router, prefix="/api", tags=["Parv - Backend Support"])

# Include Voice routes
app.include_router(voice_routes.router, prefix="/api/voice", tags=["Voice & Indic AI (Sarvam & Bhashini)"])
app.include_router(voice_routes.router, prefix="/voice", tags=["Voice & Indic AI (Sarvam & Bhashini)"])

@app.get("/")
async def root():
    return {"message": "MandiQ API is running"}

# WebSocket endpoint for real-time queue updates
@app.websocket("/ws/queue")
async def websocket_queue_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)
