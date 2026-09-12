import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import engine, Base, AsyncSessionLocal
from app.models import Farmer, Slot, Booking, BookingStatus
from datetime import date, time, datetime

async def seed_data():
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from sqlalchemy import select
        result = await session.execute(select(Farmer).limit(1))
        if result.scalar() is not None:
            print("Database already seeded!")
            return

        print("Seeding database...")
        
        # 1. Parse CSV and build objects
        import csv
        from collections import defaultdict
        
        # We will create slots dynamically based on 'slot_time'
        slots_data = {}
        farmers_to_insert = []
        bookings_data = []
        
        try:
            with open("seed_data.csv", "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # e.g., "06:00 AM - 08:00 AM" -> start: "06:00:00", end: "08:00:00"
                    slot_str = row.get("slot_time", "09:00 AM - 10:00 AM")
                    
                    if slot_str not in slots_data:
                        start_str = slot_str.split(" - ")[0].strip()
                        end_str = slot_str.split(" - ")[1].strip()
                        start_t = datetime.strptime(start_str, "%I:%M %p").time()
                        end_t = datetime.strptime(end_str, "%I:%M %p").time()
                        
                        slot = Slot(
                            date=date.today(),
                            start_time=start_t,
                            end_time=end_t,
                            capacity=50,
                            booked_count=0
                        )
                        session.add(slot)
                        slots_data[slot_str] = slot
                        
                await session.commit()
                
                # Refresh slots
                for s in slots_data.values():
                    await session.refresh(s)
                    
                # Re-read to insert farmers and bookings
                f.seek(0)
                reader = csv.DictReader(f)
                for row in reader:
                    farmer = Farmer(
                        phone_number=row["phone_number"],
                        name=row["name"],
                        village=row["village"],
                        crop=row["crop"]
                    )
                    session.add(farmer)
                    
                    # map status
                    status_raw = row.get("status", "BOOKED").upper()
                    status_val = BookingStatus.WAITING
                    if status_raw == "SERVED": status_val = BookingStatus.SERVED
                    elif status_raw == "NO_SHOW": status_val = BookingStatus.NO_SHOW
                    
                    slot_str = row.get("slot_time", "09:00 AM - 10:00 AM")
                    bookings_data.append({
                        "farmer": farmer,
                        "slot": slots_data[slot_str],
                        "token": row.get("token_no", f"TKN-{row['phone_number']}"),
                        "status": status_val
                    })
                    
        except FileNotFoundError:
            print("seed_data.csv not found.")
            return
            
        await session.commit()
        
        for data in bookings_data:
            await session.refresh(data["farmer"])
            
            booking = Booking(
                token_number=data["token"],
                farmer_id=data["farmer"].id,
                slot_id=data["slot"].id,
                status=data["status"]
            )
            session.add(booking)
            
            # Update booked count
            data["slot"].booked_count += 1
            
        await session.commit()
        
        print(f"Database seeded successfully with {len(bookings_data)} farmers and {len(slots_data)} slots!")

if __name__ == "__main__":
    asyncio.run(seed_data())
