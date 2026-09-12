# 🌾 MandiQ - Voice-First Smart Mandi Queue & Procurement Management System
> **Smart India Hackathon (SIH 2026)** | **Team RootCause** | **Problem Statement:** AI & Voice-Enabled Transparent Agricultural Procurement

---

## 📌 Executive Summary
**MandiQ** is an automated, voice-first mandi slot booking and queue management system designed to eliminate middleman exploitation, bribery, and queue manipulation at agricultural procurement centers. 

According to government survey data (Census & NSS 77th Round), **over 25% of agrarian household heads in India are illiterate**, and **fewer than 20% utilize mobile applications for agriculture**. By replacing complex smartphone apps with an **Interactive Voice Response (IVR) phone system in native regional dialects**, MandiQ makes transparent slot scheduling accessible to over **80% of Indian farmers** using any basic feature phone.

---

## ⚡ Core Problem & How MandiQ Solves It

| Traditional Procurement Pain Point | The Corruption & Exploitation | MandiQ Automated Solution |
| :--- | :--- | :--- |
| **Manual Token Assignment** | Procurement operators take bribes or favor middlemen to issue early queue slots. | **Algorithmic Fair-Share Slots**: Slots are generated automatically by non-overlapping scheduling logic. |
| **Information Asymmetry** | Farmers wait days at the mandi without knowing when their crop will be weighed. | **Dial-in Status Check**: Farmers dial the toll-free IVR to hear their live queue position, token, and slot time. |
| **Middleman Arbitrage** | Intermediaries exploit illiterate farmers by buying low and taking their mandi slots. | **Anti-Duplicate Guard**: Strictly one active token per verified mobile number. |
| **Unilateral Delays & Cancellations** | Mandis halt operations without notice, leaving perishable crops rotting. | **Audited 1-Click Halt & Reschedule**: Mandi admin can halt a slot, automatically moving the farmer to the next business day with an SMS audit trail. |

---

## 🚀 Key Features

### 1. 📞 Voice-First IVR Phone Simulator (Dial 1 / 2)
- **Zero App Required**: Works on basic keypad phones (e.g. Nokia 3310) and smartphones alike.
- **Multilingual Voice Prompts**: Available in Hindi (`hi-IN`) and English (`en-US`) with browser speech synthesis.
- **Press 1**: Book a procurement slot for Wheat, Sugarcane, or Paddy.
- **Press 2**: Check live booking status, token number, and scheduled arrival time.
- **Instant Confirmation**: Displays a simulated SMS receipt with token number and entry window.

### 2. 🖥️ Real-Time Admin Dashboard
- **Live WebSocket Feed**: Real-time queue updates broadcast instantaneously to mandi officials without page reloads.
- **Interactive Sorting & Filtering**:
  - Sort by **Token Number**, **Farmer Name**, **Crop**, **Date & Time**, or **Status**.
  - Instant text search across tokens, names, villages, and crop types.
  - Quick filter dropdown for `Waiting`, `Served`, `Halted`, or `No-Show`.
- **Status Lifecycle Control**:
  - `✅ Served`: Mark farmer transaction as completed.
  - `❌ No-Show`: Flag unattended slot allocations.
  - `⏸ Halt`: Reschedules farmer to the next business day at the same time window, logging a placeholder SMS alert.

### 3. 🛡️ Robust Backend & Anti-Corruption Guard
- **Concurrency & Transaction Safety**: SQLite/PostgreSQL with async SQLAlchemy and row-level locking.
- **Unique Slot Enforcer**: Strictly prevents overlapping 15-minute intervals.
- **Eager-Loaded ORM Relationships**: High-performance async joined loading preventing database IO bottlenecks.

---

## 🏗️ System Architecture

```mermaid
graph TD
    A[Farmer Keypad Phone / Mobile] -->|Telephony / Audio Prompts| B[IVR Service / Phone Simulator]
    B -->|REST API Calls| C[FastAPI Backend Engine]
    C -->|Transactions & Constraints| D[(SQLite / PostgreSQL Database)]
    C -->|WebSocket Broadcasts| E[Mandi Admin Dashboard - React]
    E -->|Status Actions: Served / Halt| C
    C -->|Automated Rescheduling| D
    C -->|Queued SMS Notifications| F[SMS Gateway]
```

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0 (AsyncIO + Aiosqlite)
- **Frontend**: React 18, Vite, Modern Responsive Glassmorphic CSS
- **Real-Time Communication**: Native WebSockets (`/ws/queue`)
- **Speech Synthesis**: Web Speech API (`SpeechSynthesisUtterance`)
- **Documentation & Reporting**: ReportLab PDF Engine, Swagger / OpenAPI

---

## 📂 Project Structure

```
MandiQ/
├── app/
│   ├── main.py                  # FastAPI entrypoint, lifespan, CORS, and routing
│   ├── database.py              # Async database connection and session maker
│   ├── models.py                # Database models (Farmer, Slot, Booking, Notification)
│   ├── schemas.py               # Pydantic validation schemas
│   ├── parv_routes.py           # Core queue, IVR, booking, halt, and status endpoints
│   └── websocket_manager.py     # Real-time WebSocket connection manager
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PhoneSimulator.jsx # Interactive Nokia keypad IVR simulator with speech
│   │   │   └── QueueTable.jsx     # Live real-time dashboard with search & sorting
│   │   ├── services/
│   │   │   ├── api.js             # Axios client for backend communication
│   │   │   └── websocket.jsx      # React WebSocket context & listener hook
│   │   ├── App.jsx                # Main layout with tab navigation
│   │   └── index.css              # Custom styling, dark mode & badge colors
│   ├── package.json
│   └── vite.config.js             # Vite dev server config with proxy
├── MandiQ_Farmer_Demographics_Report.pdf # Field data & feasibility study
├── mock_customers_100.json      # 100 realistic customer records for testing
├── requirements.txt             # Python dependencies
└── README.md
```

---

## 🚦 Getting Started & Local Setup

### Prerequisites
- Python 3.10+ installed
- Node.js 18+ and npm installed

### 1. Clone the Repository
```bash
git clone https://github.com/abhishekgoswami0720/Team-RootCause----MandiQ----SIH-2026.git
cd Team-RootCause----MandiQ----SIH-2026
```

### 2. Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run FastAPI backend with Uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Documentation available at: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
# Navigate to frontend folder
cd frontend

# Install node packages
npm install

# Start Vite development server
npm run dev
```
- Dashboard UI available at: `http://localhost:5173`

---

## 🧪 Testing the Solution

1. **Open the Dashboard**: Go to `http://localhost:5173` to view the **Real-time Queue**.
2. **Launch the Phone Simulator**: Switch to the **Phone Simulator** tab.
3. **Book via Voice**: Click **CALL**, listen to the audio prompt, and press `1` to book a crop slot.
4. **Inspect Live Updates**: Switch back to the dashboard to see the newly issued token appear via WebSocket without refreshing.
5. **Test the Halt Feature**: Click the red **⏸ Halt** button on any waiting farmer. The slot is rescheduled to the next day, flagged as `HALTED`, and an SMS notification is queued.

---

## 👥 Team RootCause (SIH 2026)
Developed for **Smart India Hackathon 2026** by Team RootCause.
