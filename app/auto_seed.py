import random
from datetime import date, datetime, timedelta, time
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from . import models

FIRST_NAMES = [
    "Ram", "Shyam", "Suresh", "Ramesh", "Mahesh", "Dinesh", "Mukesh", "Rajesh", "Santosh", "Anil",
    "Sunil", "Manoj", "Kamal", "Vinod", "Pawan", "Ashok", "Jagdish", "Harish", "Deepak", "Vijay",
    "Ajay", "Sanjay", "Balram", "Shiv", "Gopal", "Kishan", "Radhey", "Mohan", "Devendra", "Surendra",
    "Brijesh", "Pramod", "Satish", "Laxman", "Bharat", "Om", "Gajendra", "Hukam", "Dharmendra", "Fateh"
]

LAST_NAMES = [
    "Singh", "Kumar", "Sharma", "Yadav", "Patel", "Verma", "Choudhary", "Meena", "Jat", "Gupta",
    "Pandey", "Mishra", "Tiwari", "Saini", "Gurjar", "Thakur", "Rathore", "Chauhan", "Lodhi", "Parihar"
]

VILLAGES = [
    "Rampur", "Fatehpur", "Govindpur", "Kishanpur", "Shahpur", "Haripura", "Daulatpur", "Mohanpur",
    "Kalyanpur", "Chandpur", "Shivpuri", "Sundarpur", "Gopalpura", "Madhopur", "Sitapur", "Devipura",
    "Bhagwanpur", "Alampur", "Bishanpur", "Kotputli", "Rajgarh", "Behror", "Chaksu", "Dudu", "Phulera"
]

CROPS = [
    "Wheat", "Paddy", "Mustard", "Soybean", "Sugarcane", "Barley", "Moong", "Sunflower", "Gram"
]

async def auto_seed_database(db: AsyncSession, count: int = 100, wipe_first: bool = False):
    """
    Seeds the database with realistic farmers, slots, bookings, and notifications
    so that both backend and frontend are always loaded with rich data.
    """
    if wipe_first:
        await db.execute(delete(models.Notification))
        await db.execute(delete(models.Booking))
        await db.execute(delete(models.Slot))
        await db.execute(delete(models.Farmer))
        await db.commit()

    existing_count = await db.scalar(select(func.count(models.Booking.id)))
    if existing_count and existing_count >= 20 and not wipe_first:
        return

    today = date.today()
    curr_dt = datetime.combine(today, time(9, 0, 0))

    prefixes = ["6", "7", "8", "9"]
    phones_used = set()
    for i in range(1, count + 1):
        while True:
            p_pref = random.choice(prefixes)
            p_num = random.randint(100000000, 999999999)
            phone = f"{p_pref}{p_num}"
            if phone not in phones_used:
                phones_used.add(phone)
                break

        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        village = random.choice(VILLAGES)
        crop = random.choice(CROPS)

        farmer = models.Farmer(
            phone_number=phone,
            name=name,
            village=village,
            crop=crop
        )
        db.add(farmer)
        await db.flush()

        # 15-min slot
        start_t = curr_dt.time()
        end_dt = curr_dt + timedelta(minutes=15)
        end_t = end_dt.time()

        slot = models.Slot(
            date=curr_dt.date(),
            start_time=start_t,
            end_time=end_t,
            capacity=1,
            booked_count=1
        )
        db.add(slot)
        await db.flush()

        token_num = f"TKN-{today.strftime('%Y%m%d')}-{i:03d}"

        # Status distribution: ~65% waiting, ~25% served, ~10% halted
        rand = random.random()
        if rand < 0.25:
            status = models.BookingStatus.SERVED.value
        elif rand < 0.35:
            status = models.BookingStatus.HALTED.value
        else:
            status = models.BookingStatus.WAITING.value

        created_at = datetime.utcnow() - timedelta(minutes=(count - i) * 3)

        booking = models.Booking(
            token_number=token_num,
            farmer_id=farmer.id,
            slot_id=slot.id,
            status=status,
            created_at=created_at
        )
        db.add(booking)

        # Seed notification for first 12 farmers
        if i <= 12:
            notif = models.Notification(
                farmer_id=farmer.id,
                message=f"MandiQ Alert: Namaste {name}, aapka token {token_num} ({crop}) book ho gaya hai. Slot Samay: {slot.date} {start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}. Gate 1 par report karein.",
                status="sent",
                created_at=created_at
            )
            db.add(notif)

        curr_dt = end_dt

    await db.commit()
