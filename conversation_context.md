# Full Conversation Context & Project Snapshot

## Project Overview
- **Name:** MandiQ (BookMyShow for mandi slots via phone calls)
- **Tech Stack:** FastAPI, SQLAlchemy (async), SQLite (default), PostgreSQL (optional), Python, Vite/React for dashboard (handled by Pushkar).
- **Key Backend Endpoints (Parv's track):**
  - `GET /status/{phone}` – returns token, queue position, wait time, slot time, status.
  - `GET /queue` – returns live list of all active bookings for dashboard.
  - `POST /queue/update` – mark a token as `served` or `no_show`.
  - Notification pipeline (`queue_sms_notification`, `process_queued_notifications`).
- **Voice/NLP Integration:** `app/nlp_matcher.py` using `thefuzz` to fuzzy‑match village and crop names.
- **Data Seeding:** `seed.py` now reads a CSV (`seed_data.csv`) containing 30 farmers, slot times, token numbers, and status, creates dynamic slots, farmers, bookings, and updates `booked_count`.
- **CORS:** Enabled in `app/main.py` to allow Pushkar's React UI to call the API.

---

## File Tree (relative to `MandiQ/`)
```
MandiQ/
│   requirements.txt
│   run_server.py
│   seed.py
│   seed_data.csv
│
└───app/
    │   main.py
    │   database.py
    │   models.py
    │   schemas.py
    │   parv_routes.py
    │   notifications.py
    │   nlp_matcher.py
```
---

## File Contents
### `requirements.txt`
```text
fastapi
uvicorn
sqlalchemy
asyncpg
python-dotenv
pydantic
thefuzz
python-Levenshtein
```
---
### `run_server.py`
```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
```
---
### `app/database.py`
```python
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Use PostgreSQL if DATABASE_URL defined, otherwise fallback to SQLite for fast prototyping
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./mandiq.db")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```
---
### `app/models.py`
```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Time, Enum
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime
import enum

class BookingStatus(str, enum.Enum):
    WAITING = "waiting"
    SERVED = "served"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"

class Farmer(Base):
    __tablename__ = "farmers"
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    village = Column(String, nullable=True)
    crop = Column(String, nullable=True)
    bookings = relationship("Booking", back_populates="farmer")
    notifications = relationship("Notification", back_populates="farmer")

class Slot(Base):
    __tablename__ = "slots"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    capacity = Column(Integer, nullable=False)
    booked_count = Column(Integer, default=0, nullable=False)
    bookings = relationship("Booking", back_populates="slot")

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(String, unique=True, index=True, nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("slots.id"), nullable=False)
    status = Column(String, default=BookingStatus.WAITING.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    farmer = relationship("Farmer", back_populates="bookings")
    slot = relationship("Slot", back_populates="bookings")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, default="queued")
    created_at = Column(DateTime, default=datetime.utcnow)
    farmer = relationship("Farmer", back_populates="notifications")
```
---
### `app/schemas.py`
```python
from pydantic import BaseModel
from typing import List, Optional
from datetime import time

class QueueUpdateReq(BaseModel):
    token_number: str
    status: str  # "served" or "no_show"

class QueueStatusResp(BaseModel):
    token_number: str
    queue_position: int
    estimated_wait_minutes: int
    slot_time: str
    status: str

class QueueItem(BaseModel):
    token_number: str
    name: Optional[str]
    village: Optional[str]
    crop: Optional[str]
    slot_start: time
    slot_end: time
    status: str

class QueueListResp(BaseModel):
    items: List[QueueItem]
    total_waiting: int
    now_serving: int
```
---
### `app/parv_routes.py`
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from .database import get_db
from . import models, schemas

router = APIRouter()

AVG_PROCESSING_TIME_MINUTES = 5

@router.get("/status/{phone}", response_model=schemas.QueueStatusResp)
async def get_farmer_status(phone: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Farmer).where(models.Farmer.phone_number == phone))
    farmer = result.scalars().first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    result = await db.execute(
        select(models.Booking, models.Slot)
        .join(models.Slot)
        .where(models.Booking.farmer_id == farmer.id)
        .where(models.Booking.status.in_([models.BookingStatus.WAITING, models.BookingStatus.RESCHEDULED]))
        .order_by(models.Booking.created_at.desc())
    )
    booking_record = result.first()
    if not booking_record:
        raise HTTPException(status_code=404, detail="No active booking found for this farmer")
    booking, slot = booking_record
    pos_result = await db.execute(
        select(func.count(models.Booking.id))
        .where(models.Booking.slot_id == slot.id)
        .where(models.Booking.status == models.BookingStatus.WAITING)
        .where(models.Booking.created_at < booking.created_at)
    )
    queue_position = pos_result.scalar() + 1
    estimated_wait_minutes = queue_position * AVG_PROCESSING_TIME_MINUTES
    slot_time_str = f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"
    return schemas.QueueStatusResp(
        token_number=booking.token_number,
        queue_position=queue_position,
        estimated_wait_minutes=estimated_wait_minutes,
        slot_time=slot_time_str,
        status=booking.status,
    )

@router.get("/queue", response_model=schemas.QueueListResp)
async def get_full_queue(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Booking, models.Farmer, models.Slot)
        .join(models.Farmer, models.Booking.farmer_id == models.Farmer.id)
        .join(models.Slot, models.Booking.slot_id == models.Slot.id)
        .where(models.Booking.status.in_([models.BookingStatus.WAITING, models.BookingStatus.SERVED, models.BookingStatus.RESCHEDULED]))
        .order_by(models.Slot.start_time.asc(), models.Booking.created_at.asc())
    )
    records = result.all()
    items = []
    total_waiting = 0
    now_serving = 0
    for booking, farmer, slot in records:
        if booking.status == models.BookingStatus.WAITING.value:
            total_waiting += 1
        items.append(schemas.QueueItem(
            token_number=booking.token_number,
            name=farmer.name,
            village=farmer.village,
            crop=farmer.crop,
            slot_start=slot.start_time,
            slot_end=slot.end_time,
            status=booking.status,
        ))
    return schemas.QueueListResp(items=items, total_waiting=total_waiting, now_serving=now_serving)

@router.post("/queue/update")
async def update_queue_status(req: schemas.QueueUpdateReq, db: AsyncSession = Depends(get_db)):
    if req.status not in [models.BookingStatus.SERVED, models.BookingStatus.NO_SHOW]:
        raise HTTPException(status_code=400, detail="Invalid status update")
    result = await db.execute(select(models.Booking).where(models.Booking.token_number == req.token_number))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Token not found")
    booking.status = req.status
    await db.commit()
    return {"message": f"Token {req.token_number} marked as {req.status}"}
```
---
### `app/notifications.py`
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from . import models

async def queue_sms_notification(db: AsyncSession, farmer_id: int, message: str):
    """Insert a row into the notifications table; real sending will be done by a background worker."""
    notification = models.Notification(farmer_id=farmer_id, message=message, status="queued")
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification

async def process_queued_notifications(db: AsyncSession):
    """Placeholder for a background job (Celery / APScheduler) that would send SMS via Twilio/Exotel."""
    result = await db.execute(select(models.Notification).where(models.Notification.status == "queued"))
    notifications = result.scalars().all()
    for notif in notifications:
        # Simulate send ...
        notif.status = "sent"
    if notifications:
        await db.commit()
```
---
### `app/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from . import parv_routes
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="MandiQ Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(parv_routes.router, tags=["Parv - Backend Support"])

@app.get("/")
async def root():
    return {"message": "MandiQ API is running"}
```
---
### `app/nlp_matcher.py`
```python
from thefuzz import process
from typing import Optional, Tuple

VILLAGES = [
    "Nangal", "Taraori", "Nilokheri", "Indri", "Assandh",
    "Nissing", "Gharaunda", "Nabha", "Rajpura", "Samana",
    "Patran", "Sanaur", "Ghagga", "Karnal", "Patiala"
]

CROPS = {
    "Wheat": ["गेहूँ", "gehun", "wheat"],
    "Rice": ["धान", "चावल", "dhan", "chawal", "rice"],
    "Sugarcane": ["गन्ना", "ganna", "sugarcane"],
    "Mustard": ["सरसों", "sarson", "mustard"]
}

# flatten for fuzzy matching
CROP_ALIASES = []
CROP_MAPPING = {}
for canonical, aliases in CROPS.items():
    for alias in aliases:
        CROP_ALIASES.append(alias)
        CROP_MAPPING[alias] = canonical

def extract_village(spoken_text: str) -> Optional[str]:
    words = spoken_text.split()
    best, score = None, 0
    for w in words:
        match, s = process.extractOne(w, VILLAGES)
        if s > score and s >= 80:
            best, score = match, s
    return best

def extract_crop(spoken_text: str) -> Optional[str]:
    words = spoken_text.split()
    best, score = None, 0
    for w in words:
        match, s = process.extractOne(w, CROP_ALIASES)
        if s > score and s >= 80:
            best, score = match, s
    return CROP_MAPPING.get(best) if best else None

def parse_farmer_intent(spoken_text: str) -> Tuple[Optional[str], Optional[str]]:
    return extract_village(spoken_text), extract_crop(spoken_text)
```
---
### `seed_data.csv` (converted to plain CSV; original was `.xls` but renamed)
```csv
phone_number,name,village,crop,quantity_quintals,slot_time,token_no,status
+919812012301,Ram Singh,Gharaunda,Wheat,45.0,06:00 AM - 08:00 AM,TKN-20260911-001,SERVED
+919812012302,Harpreet Singh,Samana,Paddy,60.0,06:00 AM - 08:00 AM,TKN-20260911-002,SERVED
+919812012303,Baldev Raj,Indri,Wheat,50.0,06:00 AM - 08:00 AM,TKN-20260911-003,SERVED
+919812012304,Gurpreet Singh,Nabha,Mustard,35.0,06:00 AM - 08:00 AM,TKN-20260911-004,SERVED
+919812012305,Ramesh Kumar,Nilokheri,Wheat,55.0,06:00 AM - 08:00 AM,TKN-20260911-005,SERVED
+919812012306,Suresh Chand,Taraori,Wheat,40.0,06:00 AM - 08:00 AM,TKN-20260911-006,NO_SHOW
+919812012307,Satpal Sharma,Assandh,Wheat,70.0,08:00 AM - 10:00 AM,TKN-20260911-007,BOOKED
+919812012308,Jagdish Singh,Nissing,Paddy,65.0,08:00 AM - 10:00 AM,TKN-20260911-008,BOOKED
+919812012309,Kuldeep Kaur,Rajpura,Wheat,30.0,08:00 AM - 10:00 AM,TKN-20260911-009,BOOKED
+919812012310,Devinder Singh,Pehowa,Mustard,40.0,08:00 AM - 10:00 AM,TKN-20260911-010,BOOKED
+919812012311,Lakhwinder Singh,Cheeka,Paddy,80.0,08:00 AM - 10:00 AM,TKN-20260911-011,BOOKED
+919812012312,Manjit Singh,Shahbad,Wheat,50.0,08:00 AM - 10:00 AM,TKN-20260911-012,BOOKED
+919812012313,Surinder Kumar,Babain,Cotton,25.0,08:00 AM - 10:00 AM,TKN-20260911-013,BOOKED
+919812012314,Rajender Prasad,Amin,Wheat,45.0,08:00 AM - 10:00 AM,TKN-20260911-014,BOOKED
+919812012315,Vikram Singh,Pundri,Wheat,60.0,10:00 AM - 12:00 PM,TKN-20260911-015,BOOKED
+919812012316,Jasbir Singh,Samana,Paddy,75.0,10:00 AM - 12:00 PM,TKN-20260911-016,BOOKED
+919812012317,Naresh Kumar,Gharaunda,Mustard,35.0,10:00 AM - 12:00 PM,TKN-20260911-017,BOOKED
+919812012318,Om Prakash,Indri,Wheat,50.0,10:00 AM - 12:00 PM,TKN-20260911-018,BOOKED
+919812012319,Dharamvir,Nilokheri,Cotton,30.0,10:00 AM - 12:00 PM,TKN-20260911-019,BOOKED
+919812012320,Gian Chand,Taraori,Wheat,55.0,10:00 AM - 12:00 PM,TKN-20260911-020,BOOKED
+919812012321,Amarjeet Singh,Nabha,Paddy,70.0,10:00 AM - 12:00 PM,TKN-20260911-021,BOOKED
+919812012322,Mahipal Sharma,Assandh,Wheat,40.0,12:00 PM - 02:00 PM,TKN-20260911-022,BOOKED
+919812012323,Balwant Singh,Nissing,Paddy,65.0,12:00 PM - 02:00 PM,TKN-20260911-023,BOOKED
+919812012324,Sukhwinder Singh,Rajpura,Wheat,50.0,12:00 PM - 02:00 PM,TKN-20260911-024,BOOKED
+919812012325,Tek Chand,Pehowa,Mustard,45.0,12:00 PM - 02:00 PM,TKN-20260911-025,BOOKED
+919812012326,Krishan Lal,Cheeka,Wheat,55.0,12:00 PM - 02:00 PM,TKN-20260911-026,BOOKED
+919812012327,Shamsher Singh,Shahbad,Paddy,80.0,02:00 PM - 04:00 PM,TKN-20260911-027,BOOKED
+919812012328,Mohinder Pal,Babain,Wheat,35.0,02:00 PM - 04:00 PM,TKN-20260911-028,BOOKED
+919812012329,Rohtash Kumar,Amin,Cotton,28.0,02:00 PM - 04:00 PM,TKN-20260911-029,BOOKED
+919812012330,Mahender Singh,Pundri,Wheat,60.0,02:00 PM - 04:00 PM,TKN-20260911-030,BOOKED
```
---
### `seed.py` (updated to auto‑parse the CSV and create dynamic slots)
```python
import asyncio
import csv
from datetime import date, datetime
from app.database import engine, Base, AsyncSessionLocal
from app.models import Farmer, Slot, Booking, BookingStatus

async def seed_data():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # If data already exists, skip (you can delete mandiq.db to start fresh)
        from sqlalchemy import select
        result = await session.execute(select(Farmer).limit(1))
        if result.scalar() is not None:
            print("Database already seeded! Delete mandiq.db to reseed.")
            return

        # --- Parse CSV ---------------------------------------------------
        slots_map = {}
        bookings_to_create = []

        with open("seed_data.csv", "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Create or reuse Slot based on slot_time string
                slot_key = row["slot_time"]
                if slot_key not in slots_map:
                    start_str, end_str = [s.strip() for s in slot_key.split("-")]
                    start_t = datetime.strptime(start_str, "%I:%M %p").time()
                    end_t = datetime.strptime(end_str, "%I:%M %p").time()
                    slot = Slot(date=date.today(), start_time=start_t, end_time=end_t, capacity=50, booked_count=0)
                    session.add(slot)
                    slots_map[slot_key] = slot
                # Farmer record
                farmer = Farmer(
                    phone_number=row["phone_number"],
                    name=row["name"],
                    village=row["village"],
                    crop=row["crop"],
                )
                session.add(farmer)
                # Save info for booking creation after farmer gets an id
                bookings_to_create.append({
                    "farmer": farmer,
                    "slot_key": slot_key,
                    "token": row["token_no"],
                    "status_raw": row.get("status", "BOOKED").upper()
                })
        await session.commit()
        # Refresh slots to get ids
        for s in slots_map.values():
            await session.refresh(s)
        # Create bookings now that farmer ids are available
        for entry in bookings_to_create:
            await session.refresh(entry["farmer"])
            slot = slots_map[entry["slot_key"]]
            # Map status strings to enum values
            status = BookingStatus.WAITING
            if entry["status_raw"] == "SERVED":
                status = BookingStatus.SERVED
            elif entry["status_raw"] == "NO_SHOW":
                status = BookingStatus.NO_SHOW
            booking = Booking(
                token_number=entry["token"],
                farmer_id=entry["farmer"].id,
                slot_id=slot.id,
                status=status,
            )
            session.add(booking)
            slot.booked_count += 1
        await session.commit()
        print(f"Database seeded successfully with {len(bookings_to_create)} farmers and {len(slots_map)} slots!")

if __name__ == "__main__":
    asyncio.run(seed_data())
```
---
## Tasks & Progress (as of now)
- **Parv (Backend Support):** All endpoints (`/status`, `/queue`, `/queue/update`) built and tested via Swagger UI.
- **Voice Integration:** `nlp_matcher.py` ready; can be plugged into a `/speak` endpoint later.
- **Data Seeding:** CSV from Bhawana imported; database contains 30 farmers across 5 slots.
- **CORS:** Enabled, so Pushkar can fetch `/queue` directly from his React dashboard.
- **Notification Pipeline:** Basic queue function implemented.

## Next Steps (choose one)
1. **Dashboard UI (Pushkar):** Use the `GET /queue` endpoint to render a live table. Add a periodic `setInterval` (e.g., every 5 s) to refresh.
2. **Booking Engine (Abhishek):** Implement `POST /book` with atomic `SELECT … FOR UPDATE` to prevent double‑booking.
3. **HALT Feature:** Build `/admin/halt` that frees up seats, creates new tokens, and pushes notifications.
4. **Voice Webhook:** Wire `nlp_matcher` into a Twilio webhook (`/telephony/twilio`) that receives transcriptions and calls `parse_farmer_intent`.

---

**How to hand this off to Claude:**
- Zip the entire `MandiQ/` folder.
- Include this `conversation_context.md` file (the content you see above) in the zip.
- Claude will have the full code, data, and a clear list of next actions.

Feel free to ask for any additional files or clarifications!
