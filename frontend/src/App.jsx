import React, { useState } from "react";
import QueueTable from "./components/QueueTable.jsx";
import BookingForm from "./components/BookingForm.jsx";
import PhoneSimulator from "./components/PhoneSimulator.jsx";
import AnalyticsView from "./components/AnalyticsView.jsx";
import SmsDrawer from "./components/SmsDrawer.jsx";

function App() {
  const [view, setView] = useState("dashboard");
  const [isSmsOpen, setIsSmsOpen] = useState(false);

  return (
    <div className="app-layout">
      <nav className="nav" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
          <button 
            className={`nav-btn ${view === "split" ? "active" : ""}`} 
            onClick={() => setView("split")}
            style={{ color: view === "split" ? "var(--accent-amber)" : "", fontWeight: view === "split" ? 600 : 400 }}
          >
            ⚡ Live Split View
          </button>
          <button 
            className={`nav-btn ${view === "analytics" ? "active" : ""}`} 
            onClick={() => setView("analytics")}
          >
            📊 Impact Analytics
          </button>
        </div>
        <div>
          <button 
            className="nav-btn"
            style={{ 
              background: "rgba(59, 130, 246, 0.15)", color: "var(--accent-blue)", 
              border: "1px solid rgba(59,130,246,0.3)", borderRadius: "var(--radius-sm)",
              padding: "0.3rem 0.75rem", fontSize: "0.85rem", fontWeight: 600
            }}
            onClick={() => setIsSmsOpen(true)}
          >
            📩 SMS Dispatch Log
          </button>
        </div>
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
        {view === "analytics" && (
          <AnalyticsView />
        )}
        {view === "split" && (
          <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "1.5rem", height: "100%", padding: "1rem" }}>
            <div style={{ overflowY: "auto", background: "var(--bg-card)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <PhoneSimulator isSplitView={true} />
            </div>
            <div style={{ overflowY: "auto" }}>
              <QueueTable />
            </div>
          </div>
        )}
      </main>

      <SmsDrawer isOpen={isSmsOpen} onClose={() => setIsSmsOpen(false)} />
    </div>
  );
}

export default App;
