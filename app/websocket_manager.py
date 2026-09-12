import asyncio
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect

class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active_connections.add(websocket)
        await websocket.send_json({"type": "connected"})

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        async with self.lock:
            to_remove = []
            for connection in self.active_connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    to_remove.append(connection)
            for conn in to_remove:
                self.active_connections.discard(conn)

# Export a singleton for the app to use
manager = WebSocketManager()
