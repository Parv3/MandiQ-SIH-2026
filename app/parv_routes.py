from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update
from sqlalchemy.orm import joinedload
from .websocket_manager import manager as ws_manager

from .database import get_db
from . import models, schemas
from pydantic import BaseModel  # added for simulation endpoints
router = APIRouter()

# ---------------- Simulation Models ----------------
class SimBookingReq(BaseModel):
    phone_number: str
    name: str
    crop: str
    village: str | None = None

# Assumed constants for wait-time calculation
AVG_PROCESSING_TIME_MINUTES = 5

@router.get("/status/{phone}", response_model=schemas.QueueStatusResp)
async def get_farmer_status(phone: str, db: AsyncSession = Depends(get_db)):
    # Find the farmer
    result = await db.execute(select(models.Farmer).where(models.Farmer.phone_number == phone))
    farmer = result.scalars().first()
    
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
        
    # Get active booking for this farmer
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
    
    # Calculate queue position: how many people are waiting in the same slot created before this farmer
    pos_result = await db.execute(
        select(func.count(models.Booking.id))
        .where(models.Booking.slot_id == slot.id)
        .where(models.Booking.status == models.BookingStatus.WAITING)
        .where(models.Booking.created_at < booking.created_at)
    )
    queue_position = pos_result.scalar() + 1 # 1-indexed
    
    estimated_wait_minutes = queue_position * AVG_PROCESSING_TIME_MINUTES
    
    # Simple formatting of slot time
    slot_time_str = f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"
    
    return schemas.QueueStatusResp(
        token_number=booking.token_number,
        queue_position=queue_position,
        estimated_wait_minutes=estimated_wait_minutes,
        slot_time=slot_time_str,
        status=booking.status
    )

@router.get("/queue", response_model=schemas.QueueListResp)
async def get_full_queue(db: AsyncSession = Depends(get_db)):
    # Get all active tokens for the dashboard
    result = await db.execute(
        select(models.Booking, models.Farmer, models.Slot)
        .join(models.Farmer, models.Booking.farmer_id == models.Farmer.id)
        .join(models.Slot, models.Booking.slot_id == models.Slot.id)
        .where(models.Booking.status.in_([models.BookingStatus.WAITING, models.BookingStatus.SERVED, models.BookingStatus.RESCHEDULED, models.BookingStatus.HALTED]))
        .order_by(models.Slot.date.asc(), models.Slot.start_time.asc(), models.Booking.created_at.asc())
    )
    
    records = result.all()
    
    items = []
    total_waiting = 0
    now_serving = 0
    
    for booking, farmer, slot in records:
        if booking.status == models.BookingStatus.WAITING.value:
            total_waiting += 1
        elif booking.status == models.BookingStatus.SERVED.value:
            # We can define "now_serving" as the latest served or if we have a specific state for it.
            pass
            
        items.append(schemas.QueueItem(
            token_number=booking.token_number,
            name=farmer.name,
            village=farmer.village,
            crop=farmer.crop,
            slot_date=slot.date,
            slot_start=slot.start_time,
            slot_end=slot.end_time,
            status=booking.status
        ))
        
    return schemas.QueueListResp(
        items=items,
        total_waiting=total_waiting,
        now_serving=now_serving # Might need refinement based on exact definition
    )

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
    
    # Broadcast updated queue to WS clients
    queue_payload = await get_full_queue(db)
    await ws_manager.broadcast({"type": "queue_update", "data": jsonable_encoder(queue_payload)})
    
    return {"message": f"Token {req.token_number} marked as {req.status}"}

@router.post("/queue/halt")
async def halt_booking(req: schemas.QueueUpdateReq, db: AsyncSession = Depends(get_db)):
    """Halt a booking and reschedule it to the next day.
    The booking status is set to HALTED, a new Slot is created for the next day,
    and a placeholder Notification (SMS) is stored for the farmer.
    """
    # Find existing booking with slot eagerly loaded
    result = await db.execute(
        select(models.Booking)
        .options(joinedload(models.Booking.slot))
        .where(models.Booking.token_number == req.token_number)
    )
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Token not found")
    
    from datetime import date, timedelta
    today = date.today()
    next_day = today + timedelta(days=1)
    
    orig_slot = booking.slot
    start_t = orig_slot.start_time
    end_t = orig_slot.end_time
    
    # Create a new slot for next day
    new_slot = models.Slot(
        date=next_day,
        start_time=start_t,
        end_time=end_t,
        capacity=orig_slot.capacity,
        booked_count=1,
    )
    db.add(new_slot)
    await db.flush()
    
    # Update booking
    booking.slot_id = new_slot.id
    booking.status = models.BookingStatus.HALTED.value
    
    # Create a notification (SMS placeholder)
    notif = models.Notification(
        farmer_id=booking.farmer_id,
        message=f"Your booking has been halted and rescheduled to {next_day} {start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}.",
        status="queued",
    )
    db.add(notif)
    await db.commit()
    
    # Broadcast updated queue
    queue_payload = await get_full_queue(db)
    await ws_manager.broadcast({"type": "queue_update", "data": jsonable_encoder(queue_payload)})
    return {"detail": "Booking halted", "new_date": str(next_day), "slot_time": f"{start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}"}

@router.post("/queue/reschedule")
async def reschedule_booking(req: schemas.QueueUpdateReq, db: AsyncSession = Depends(get_db)):
    """Reschedule a booking to the next day with same time slot length.
    The booking status is set to RESCHEDULED, a new Slot is created for the next day,
    and a Notification (SMS placeholder) is stored for the farmer.
    """
    # Find existing booking with slot eagerly loaded
    result = await db.execute(
        select(models.Booking)
        .options(joinedload(models.Booking.slot))
        .where(models.Booking.token_number == req.token_number)
    )
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Token not found")
        
    from datetime import date, timedelta
    today = date.today()
    next_day = today + timedelta(days=1)
    
    orig_slot = booking.slot
    start_t = orig_slot.start_time
    end_t = orig_slot.end_time
    
    new_slot = models.Slot(
        date=next_day,
        start_time=start_t,
        end_time=end_t,
        capacity=orig_slot.capacity,
        booked_count=1,
    )
    db.add(new_slot)
    await db.flush()
    
    booking.slot_id = new_slot.id
    booking.status = models.BookingStatus.RESCHEDULED.value
    
    notif = models.Notification(
        farmer_id=booking.farmer_id,
        message=f"Your booking has been rescheduled to {next_day} {start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}.",
        status="queued",
    )
    db.add(notif)
    await db.commit()
    
    queue_payload = await get_full_queue(db)
    await ws_manager.broadcast({"type": "queue_update", "data": jsonable_encoder(queue_payload)})
    return {"detail": "Booking rescheduled", "new_date": str(next_day), "slot_time": f"{start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}"}

# ---------------- Booking Endpoint ----------------
@router.post("/book")
async def create_booking(req: schemas.BookingRequest, db: AsyncSession = Depends(get_db)):
    # Find or create farmer
    result = await db.execute(select(models.Farmer).where(models.Farmer.phone_number == req.phone_number))
    farmer = result.scalars().first()
    if not farmer:
        farmer = models.Farmer(
            phone_number=req.phone_number,
            name=req.name,
            village=req.village,
            crop=req.crop,
        )
        db.add(farmer)
        await db.flush()
    # Prevent duplicate active bookings for this phone number
    existing_booking = await db.execute(
        select(models.Booking)
        .where(models.Booking.farmer_id == farmer.id)
        .where(models.Booking.status.in_([models.BookingStatus.WAITING, models.BookingStatus.RESCHEDULED]))
    )
    if existing_booking.scalars().first():
        raise HTTPException(status_code=400, detail="An active booking already exists for this phone number")
    # Find the latest slot across the system or for today
    from datetime import date, timedelta
    
    # Check the latest scheduled slot across dates
    result = await db.execute(
        select(models.Slot)
        .order_by(models.Slot.date.desc(), models.Slot.start_time.desc())
        .limit(1)
        .with_for_update()
    )
    latest_slot = result.scalars().first()
    
    today = date.today()
    if latest_slot:
        # If latest slot was at or after 23:45 or ended at 00:00, move to next day 09:00 AM
        if latest_slot.start_time >= datetime.strptime("23:45:00", "%H:%M:%S").time() or latest_slot.end_time == datetime.strptime("00:00:00", "%H:%M:%S").time():
            slot_date = latest_slot.date + timedelta(days=1)
            start_t = datetime.strptime("09:00:00", "%H:%M:%S").time()
        else:
            slot_date = latest_slot.date
            start_t = latest_slot.end_time
    else:
        slot_date = today
        start_t = datetime.strptime("09:00:00", "%H:%M:%S").time()
        
    start_dt = datetime.combine(slot_date, start_t)
    end_dt = start_dt + timedelta(minutes=15)
    end_t = end_dt.time()
    
    slot = models.Slot(
        date=slot_date,
        start_time=start_t,
        end_time=end_t,
        capacity=1,
        booked_count=1
    )
    db.add(slot)
    await db.flush()
    
    # Generate token
    token_seq = await db.scalar(select(func.count(models.Booking.id))) + 1
    token = f"TKN-{datetime.utcnow().strftime('%Y%m%d')}-{token_seq:03d}"
    booking = models.Booking(
        token_number=token,
        farmer_id=farmer.id,
        slot_id=slot.id,
        status=models.BookingStatus.WAITING,
    )
    db.add(booking)
    await db.commit()
    # Broadcast updated queue to WS clients
    queue_payload = await get_full_queue(db)
    await ws_manager.broadcast({"type": "queue_update", "data": jsonable_encoder(queue_payload)})
    return {"token": token, "slot_time": f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}", "message": f"Booking created for {req.name}"}


# ---------------- Simulation Endpoints ----------------
@router.post("/simulate/book")
async def simulate_book(req: SimBookingReq, db: AsyncSession = Depends(get_db)):
    # Find or create farmer
    result = await db.execute(select(models.Farmer).where(models.Farmer.phone_number == req.phone_number))
    farmer = result.scalars().first()
    if not farmer:
        farmer = models.Farmer(
            phone_number=req.phone_number,
            name=req.name,
            village=req.village,
            crop=req.crop,
        )
        db.add(farmer)
        await db.flush()
    # Find the latest slot across the system
    from datetime import date, timedelta
    
    result = await db.execute(
        select(models.Slot)
        .order_by(models.Slot.date.desc(), models.Slot.start_time.desc())
        .limit(1)
        .with_for_update()
    )
    latest_slot = result.scalars().first()
    
    today = date.today()
    if latest_slot:
        if latest_slot.start_time >= datetime.strptime("23:45:00", "%H:%M:%S").time() or latest_slot.end_time == datetime.strptime("00:00:00", "%H:%M:%S").time():
            slot_date = latest_slot.date + timedelta(days=1)
            start_t = datetime.strptime("09:00:00", "%H:%M:%S").time()
        else:
            slot_date = latest_slot.date
            start_t = latest_slot.end_time
    else:
        slot_date = today
        start_t = datetime.strptime("09:00:00", "%H:%M:%S").time()
        
    start_dt = datetime.combine(slot_date, start_t)
    end_dt = start_dt + timedelta(minutes=15)
    end_t = end_dt.time()
    
    slot = models.Slot(
        date=slot_date,
        start_time=start_t,
        end_time=end_t,
        capacity=1,
        booked_count=1
    )
    db.add(slot)
    await db.flush()
    
    # Generate token
    token_seq = await db.scalar(select(func.count(models.Booking.id))) + 1
    token = f"TKN-{datetime.utcnow().strftime('%Y%m%d')}-{token_seq:03d}"
    booking = models.Booking(
        token_number=token,
        farmer_id=farmer.id,
        slot_id=slot.id,
        status=models.BookingStatus.WAITING,
    )
    db.add(booking)
    await db.commit()
    slot_time = f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"
    return {"token": token, "slot_time": slot_time, "message": f"Booking created for {req.name}"}

@router.get("/simulate/status/{phone}")
async def simulate_status(phone: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Booking, models.Slot)
        .join(models.Slot)
        .join(models.Farmer, models.Booking.farmer_id == models.Farmer.id)
        .where(models.Farmer.phone_number == phone)
        .order_by(models.Booking.created_at.desc())
        .limit(1)
    )
    rec = result.first()
    if not rec:
        raise HTTPException(status_code=404, detail="No bookings for this phone")
    booking, slot = rec
    return {
        "phone": phone,
        "token": booking.token_number,
        "status": booking.status,
        "slot_time": f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"
    }
