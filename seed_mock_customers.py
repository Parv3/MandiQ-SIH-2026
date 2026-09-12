import asyncio
import json
import random
from datetime import date, time, timedelta, datetime
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app import models

FIRST_NAMES = [
    "Ram", "Shyam", "Suresh", "Ramesh", "Mukesh", "Rajesh", "Mahesh", "Dinesh", "Manoj", "Anil",
    "Sunil", "Vinod", "Pramod", "Santosh", "Ashok", "Jagdish", "Harish", "Brijesh", "Kamlesh", "Satish",
    "Gopal", "Madhav", "Kishan", "Radhey", "Shiv", "Bhole", "Kailash", "Omkar", "Bhagwan", "Narayan",
    "Devendra", "Surendra", "Narendra", "Ravindra", "Jitendra", "Dharmendra", "Gajendra", "Balwant", "Jaswant", "Kuldeep",
    "Sukhdev", "Gurmeet", "Manjit", "Baljit", "Harpreet", "Gurpreet", "Lakhwinder", "Amrik", "Balbir", "Tarsem"
]

LAST_NAMES = [
    "Kumar", "Singh", "Sharma", "Verma", "Yadav", "Patel", "Choudhary", "Jat", "Gupta", "Mishra",
    "Tiwari", "Pandey", "Shukla", "Thakur", "Rathore", "Chauhan", "Meena", "Gurjar", "Saini", "Maurya"
]

VILLAGES = [
    "Rampur", "Fatehpur", "Govindpur", "Kishanpur", "Shivpur", "Sundarpur", "Dharampur", "Daulatpur", "Shahpur", "Haripur",
    "Mohanpur", "Chandpur", "Bilaspur", "Manikpur", "Sultanpur", "Madhavpur", "Bhagwanpur", "Gopalpur", "Sitapur", "Lalpur"
]

CROPS = ["Wheat", "Paddy", "Mustard", "Cotton", "Maize", "Soybean", "Gram", "Sugarcane", "Barley", "Bajra"]

async def seed():
    async with AsyncSessionLocal() as session:
        # Check existing booking count
        res = await session.execute(select(models.Booking))
        existing_bookings = len(res.scalars().all())
        print(f"Existing bookings in DB: {existing_bookings}")
        
        today = date.today()
        base_time = datetime.combine(today, time(9, 0)) # Start at 09:00 AM
        
        mock_farmers_data = []
        
        for i in range(1, 101):
            phone = f"98{random.randint(10000000, 99999999)}"
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            village = random.choice(VILLAGES)
            crop = random.choice(CROPS)
            
            # 15 min slots
            slot_offset_minutes = (i - 1) * 15
            slot_start_dt = base_time + timedelta(minutes=slot_offset_minutes)
            slot_end_dt = slot_start_dt + timedelta(minutes=15)
            
            slot_date = slot_start_dt.date()
            slot_start_time = slot_start_dt.time()
            slot_end_time = slot_end_dt.time()
            
            # Check or create slot
            slot_res = await session.execute(
                select(models.Slot).where(
                    models.Slot.date == slot_date,
                    models.Slot.start_time == slot_start_time,
                    models.Slot.end_time == slot_end_time
                )
            )
            slot = slot_res.scalars().first()
            if not slot:
                slot = models.Slot(
                    date=slot_date,
                    start_time=slot_start_time,
                    end_time=slot_end_time,
                    capacity=1,
                    booked_count=1
                )
                session.add(slot)
                await session.flush()
            else:
                slot.booked_count += 1
                await session.flush()
                
            # Create Farmer
            farmer = models.Farmer(
                phone_number=phone,
                name=name,
                village=village,
                crop=crop
            )
            session.add(farmer)
            await session.flush()
            
            # Status distribution: mostly waiting, some served, a few no_show and halted
            if i <= 10:
                status = models.BookingStatus.SERVED.value
            elif i in [11, 12]:
                status = models.BookingStatus.NO_SHOW.value
            elif i in [13, 14]:
                status = models.BookingStatus.HALTED.value
            else:
                status = models.BookingStatus.WAITING.value
                
            token_num = f"TKN-{slot_date.strftime('%Y%m%d')}-{i+100:03d}"
            
            booking = models.Booking(
                token_number=token_num,
                farmer_id=farmer.id,
                slot_id=slot.id,
                status=status,
                created_at=datetime.utcnow()
            )
            session.add(booking)
            
            mock_farmers_data.append({
                "token_number": token_num,
                "name": name,
                "phone_number": phone,
                "village": village,
                "crop": crop,
                "slot_date": str(slot_date),
                "slot_start": slot_start_time.strftime("%H:%M:%S"),
                "slot_end": slot_end_time.strftime("%H:%M:%S"),
                "status": status
            })
            
        await session.commit()
        print("Successfully committed 100 mock farmers to the database!")
        
        with open("mock_customers_100.json", "w", encoding="utf-8") as f:
            json.dump(mock_farmers_data, f, indent=2, ensure_ascii=False)
        print("Saved 100 mock customers to mock_customers_100.json")

asyncio.run(seed())
