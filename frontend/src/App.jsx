import React, { useState } from "react";
import QueueTable from "./components/QueueTable.jsx";
import BookingForm from "./components/BookingForm.jsx";
import PhoneSimulator from "./components/PhoneSimulator.jsx";

function App() {
  const [view, setView] = useState("dashboard");

  return (
    <div className="app-layout">
      <nav className="nav">
        <div className="nav-brand">MandiQ Admin</div>
        <button 
          className={`nav-btn ${view === "dashboard" ? "active" : ""}`} 
          onClick={() => setView("dashboard")}
        >
          Dashboard
        </button>
        <button 
          className={`nav-btn ${view === "phone" ? "active" : ""}`} 
          onClick={() => setView("phone")}
        >
          IVR Simulator
        </button>
      </nav>
      
      <main className="main-content">
        {view === "dashboard" && (
          <div className="dashboard-grid">
            <QueueTable />
            <BookingForm />
          </div>
        )}
        {view === "phone" && (
          <div className="phone-page">
            <PhoneSimulator />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
