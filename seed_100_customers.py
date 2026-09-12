import sqlite3
import random
from datetime import date, datetime, timedelta

# Realistic Indian rural names, villages, crops
first_names = [
    "Ram", "Shyam", "Suresh", "Ramesh", "Mahesh", "Dinesh", "Mukesh", "Rajesh", "Santosh", "Anil",
    "Sunil", "Manoj", "Kamal", "Vinod", "Pawan", "Ashok", "Jagdish", "Harish", "Deepak", "Vijay",
    "Ajay", "Sanjay", "Balram", "Shiv", "Gopal", "Kishan", "Radhey", "Mohan", "Devendra", "Surendra",
    "Brijesh", "Pramod", "Satish", "Laxman", "Bharat", "Om", "Gajendra", "Hukam", "Dharmendra", "Fateh"
]
last_names = [
    "Singh", "Kumar", "Sharma", "Yadav", "Patel", "Verma", "Choudhary", "Meena", "Jat", "Gupta",
    "Pandey", "Mishra", "Tiwari", "Saini", "Gurjar", "Thakur", "Rathore", "Chauhan", "Lodhi", "Parihar"
]
villages = [
    "Rampur", "Fatehpur", "Govindpur", "Kishanpur", "Shahpur", "Haripura", "Daulatpur", "Mohanpur",
    "Kalyanpur", "Chandpur", "Shivpuri", "Sundarpur", "Gopalpura", "Madhopur", "Sitapur", "Devipura",
    "Bhagwanpur", "Alampur", "Bishanpur", "Kotputli", "Rajgarh", "Behror", "Chaksu", "Dudu", "Phulera"
]
crops = [
    "Wheat", "Paddy (Rice)", "Mustard", "Soybean", "Maize", "Cotton", "Barley", "Gram (Chana)",
    "Bajra", "Jowar", "Sugarcane", "Moong", "Urad", "Groundnut", "Sunflower"
]

con = sqlite3.connect("mandiq.db")
cur = con.cursor()

# Get starting sequence for tokens
cur.execute("SELECT count(*) FROM bookings")
start_booking_count = cur.fetchone()[0]

cur.execute("SELECT max(id) FROM farmers")
max_f_id = cur.fetchone()[0] or 0

# Check existing phone numbers to guarantee uniqueness
cur.execute("SELECT phone_number FROM farmers")
existing_phones = set(row[0] for row in cur.fetchall())

today = date.today()

# Get the latest slot time for today
cur.execute("SELECT end_time FROM slots WHERE date = ? ORDER BY end_time DESC LIMIT 1", (today.isoformat(),))
latest_row = cur.fetchone()

if latest_row and latest_row[0]:
    # e.g. "12:15:00" or "12:15:00.000000"
    t_str = latest_row[0].split('.')[0]
    curr_time = datetime.strptime(f"{today.isoformat()} {t_str}", "%Y-%m-%d %H:%M:%S")
else:
    curr_time = datetime.combine(today, datetime.strptime("09:00:00", "%H:%M:%S").time())

new_farmers = []
new_slots = []
new_bookings = []

generated_phones = set()

for i in range(1, 101):
    # Unique 10-digit Indian mobile number
    while True:
        phone = f"{random.choice(['6', '7', '8', '9'])}{random.randint(100000000, 999999999)}"
        if phone not in existing_phones and phone not in generated_phones:
            generated_phones.add(phone)
            break
            
    name = f"{random.choice(first_names)} {random.choice(last_names)}"
    village = random.choice(villages)
    crop = random.choice(crops)
    
    # Farmer
    cur.execute(
        "INSERT INTO farmers (phone_number, name, village, crop) VALUES (?, ?, ?, ?)",
        (phone, name, village, crop)
    )
    farmer_id = cur.lastrowid
    
    # 15-min Slot
    start_t_str = curr_time.strftime("%H:%M:%S")
    end_time = curr_time + timedelta(minutes=15)
    end_t_str = end_time.strftime("%H:%M:%S")
    
    cur.execute(
        "INSERT INTO slots (date, start_time, end_time, capacity, booked_count) VALUES (?, ?, ?, ?, ?)",
        (curr_time.date().isoformat(), start_t_str, end_t_str, 1, 1)
    )
    slot_id = cur.lastrowid
    
    # Token
    token_num = f"TKN-{today.strftime('%Y%m%d')}-{(start_booking_count + i):03d}"
    
    # Distribution of status: mostly waiting, some served, a few no_show, a few halted
    if i <= 80:
        status = "waiting"
    elif i <= 90:
        status = "served"
    elif i <= 95:
        status = "no_show"
    else:
        status = "halted"
        
    created_at = (datetime.utcnow() - timedelta(minutes=(101 - i)*3)).strftime("%Y-%m-%d %H:%M:%S")
    
    cur.execute(
        "INSERT INTO bookings (token_number, farmer_id, slot_id, status, created_at) VALUES (?, ?, ?, ?, ?)",
        (token_num, farmer_id, slot_id, status, created_at)
    )
    
    # Advance time for next slot
    curr_time = end_time

con.commit()

# Report final stats
for table in ['farmers', 'slots', 'bookings', 'notifications']:
    cur.execute(f"SELECT count(*) FROM {table}")
    print(f"Table '{table}' total count: {cur.fetchone()[0]}")

con.close()
print("Successfully inserted 100 mock customers, non-overlapping slots, and bookings!")
