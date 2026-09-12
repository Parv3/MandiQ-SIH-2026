import React, { useState, useMemo } from "react";
import { useWebSocket } from "../services/websocket.jsx";
import { updateQueueStatus, haltQueueBooking, haltAllQueueBookings } from "../services/api.js";

const QueueTable = () => {
  const { queueData, setQueueData } = useWebSocket();
  const [sortField, setSortField] = useState("token_number");
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isHaltingAll, setIsHaltingAll] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const updateStatus = async (token, newStatus) => {
    try {
      await updateQueueStatus(token, newStatus);
      // Immediately reflect in state
      setQueueData((prev) =>
        prev.map((item) => (item.token_number === token ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update status.");
    }
  };

  const haltBooking = async (token) => {
    try {
      await haltQueueBooking(token);
      setQueueData((prev) =>
        prev.map((item) =>
          item.token_number === token
            ? { ...item, status: "halted", slot_date: "2026-09-14" }
            : item
        )
      );
    } catch (err) {
      console.error("Failed to halt booking", err);
      alert("Failed to halt booking.");
    }
  };

  const haltAll = async () => {
    const waitingCount = queueData ? queueData.filter(i => i.status === "waiting").length : 0;
    if (waitingCount === 0) {
      alert("There are no active waiting bookings to halt.");
      return;
    }

    const confirmHalt = window.confirm(
      `⚠️ EMERGENCY CONFIRMATION:\n\nAre you sure you want to HALT ALL ${waitingCount} active waiting bookings?\n\nThis will reschedule all waiting farmers to tomorrow and broadcast emergency SMS notifications.`
    );
    if (!confirmHalt) return;

    setIsHaltingAll(true);
    try {
      await haltAllQueueBookings();
      // Instantly update state
      setQueueData((prev) =>
        prev.map((item) =>
          item.status === "waiting"
            ? { ...item, status: "halted", slot_date: "2026-09-14" }
            : item
        )
      );
      alert(`🚨 Emergency Halt Executed: ${waitingCount} bookings halted and rescheduled to tomorrow.`);
    } catch (err) {
      console.error("Failed to halt all", err);
      alert("Failed to execute emergency halt.");
    } finally {
      setIsHaltingAll(false);
    }
  };

  const sortedAndFilteredData = useMemo(() => {
    if (!queueData) return [];

    let filtered = [...queueData];

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) =>
        (item.token_number && item.token_number.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.crop && item.crop.toLowerCase().includes(q)) ||
        (item.village && item.village.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle custom fields
      if (sortField === "time") {
        aVal = `${a.slot_date || ""} ${a.slot_start || a.slot_time || ""}`;
        bVal = `${b.slot_date || ""} ${b.slot_start || b.slot_time || ""}`;
      } else if (sortField === "farmer") {
        aVal = (a.name || "").toLowerCase();
        bVal = (b.name || "").toLowerCase();
      } else if (sortField === "token_number") {
        // Natural numeric sort if tokens look like TKN-20260912-001
        aVal = a.token_number || "";
        bVal = b.token_number || "";
      } else {
        aVal = (aVal || "").toString().toLowerCase();
        bVal = (bVal || "").toString().toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [queueData, sortField, sortOrder, statusFilter, searchQuery]);

  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <span style={{ opacity: 0.35, marginLeft: "4px" }}>⇅</span>;
    }
    return (
      <span style={{ color: "var(--accent-blue)", marginLeft: "4px", fontWeight: "bold" }}>
        {sortOrder === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="card-title">Real-time Queue</h2>
          <div className="card-subtitle">
            Showing {sortedAndFilteredData.length} of {queueData ? queueData.length : 0} bookings
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="🔍 Search token, farmer, crop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.45rem 0.75rem",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: "0.8rem",
              minWidth: "220px"
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "0.45rem 0.75rem",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: "0.8rem",
              cursor: "pointer"
            }}
          >
            <option value="all" style={{ background: "#1a1f2c" }}>All Statuses</option>
            <option value="waiting" style={{ background: "#1a1f2c" }}>Waiting</option>
            <option value="served" style={{ background: "#1a1f2c" }}>Served</option>
            <option value="halted" style={{ background: "#1a1f2c" }}>Halted</option>
            <option value="no_show" style={{ background: "#1a1f2c" }}>No-Show</option>
          </select>

          <button
            onClick={haltAll}
            disabled={isHaltingAll || (queueData && queueData.filter(i => i.status === "waiting").length === 0)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.85rem",
              background: queueData && queueData.filter(i => i.status === "waiting").length > 0
                ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                : "rgba(239, 68, 68, 0.2)",
              border: "1px solid #ef4444",
              borderRadius: "var(--radius-sm)",
              color: "#fff",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: queueData && queueData.filter(i => i.status === "waiting").length > 0 ? "pointer" : "not-allowed",
              boxShadow: queueData && queueData.filter(i => i.status === "waiting").length > 0 ? "0 2px 8px rgba(239, 68, 68, 0.4)" : "none",
              opacity: isHaltingAll ? 0.7 : 1,
              transition: "all 0.2s ease"
            }}
            title="Halt all active waiting bookings and reschedule them to tomorrow with SMS alerts"
          >
            {isHaltingAll ? "⏳ Halting..." : "🚨 Halt All"}
          </button>
        </div>
      </div>

      {/* Live Metrics Ribbon */}
      <div style={{
        display: "flex",
        gap: "1.25rem",
        flexWrap: "wrap",
        alignItems: "center",
        padding: "0.6rem 1.25rem",
        background: "rgba(255, 255, 255, 0.02)",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: "0.82rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Total Bookings:</span>
          <span style={{ fontWeight: 700, color: "var(--accent-blue)", fontSize: "0.95rem" }}>
            {queueData ? queueData.length : 0}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Waiting:</span>
          <span style={{ fontWeight: 700, color: "var(--accent-amber)", fontSize: "0.95rem" }}>
            {queueData ? queueData.filter((i) => i.status === "waiting").length : 0}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Served:</span>
          <span style={{ fontWeight: 700, color: "var(--accent-green)", fontSize: "0.95rem" }}>
            {queueData ? queueData.filter((i) => i.status === "served").length : 0}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Halted:</span>
          <span style={{ fontWeight: 700, color: "#f87171", fontSize: "0.95rem" }}>
            {queueData ? queueData.filter((i) => i.status === "halted").length : 0}
          </span>
        </div>
      </div>

      <table className="queue-table">
        <thead>
          <tr>
            <th onClick={() => handleSort("token_number")} style={{ cursor: "pointer", userSelect: "none" }}>
              Token {renderSortIndicator("token_number")}
            </th>
            <th onClick={() => handleSort("farmer")} style={{ cursor: "pointer", userSelect: "none" }}>
              Farmer {renderSortIndicator("farmer")}
            </th>
            <th onClick={() => handleSort("crop")} style={{ cursor: "pointer", userSelect: "none" }}>
              Crop {renderSortIndicator("crop")}
            </th>
            <th onClick={() => handleSort("time")} style={{ cursor: "pointer", userSelect: "none" }}>
              Date & Time {renderSortIndicator("time")}
            </th>
            <th onClick={() => handleSort("status")} style={{ cursor: "pointer", userSelect: "none" }}>
              Status {renderSortIndicator("status")}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedAndFilteredData && sortedAndFilteredData.length > 0 ? (
            sortedAndFilteredData.map((item) => (
              <tr key={item.token_number}>
                <td>{item.token_number}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.name || "Unknown"}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.village || ""}</div>
                </td>
                <td>{item.crop || "-"}</td>
                <td>
                  {item.slot_date && (
                    <div style={{ fontSize: "0.75rem", color: "var(--accent-amber)", fontWeight: 600 }}>
                      {item.slot_date}
                    </div>
                  )}
                  <div>
                    {item.slot_start ? `${item.slot_start.slice(0, 5)} - ${item.slot_end.slice(0, 5)}` : item.slot_time || "-"}
                  </div>
                </td>
                <td>
                  <span className={`badge badge-${item.status.toLowerCase()}`}>{item.status}</span>
                </td>
                <td>
                  {item.status === "waiting" && (
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="action-btn served" onClick={() => updateStatus(item.token_number, "served")}>
                        ✅ Served
                      </button>
                      <button className="action-btn noshow" onClick={() => updateStatus(item.token_number, "no_show")}>
                        ❌ No-Show
                      </button>
                      <button className="action-btn halt" style={{ backgroundColor: "#dc2626", color: "white" }} onClick={() => haltBooking(item.token_number)}>
                        ⏸ Halt
                      </button>
                    </div>
                  )}
                  {item.status === "halted" && (
                    <span style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: 500 }}>
                      Rescheduled (Next Day)
                    </span>
                  )}
                  {item.status === "served" && (
                    <span style={{ fontSize: "0.75rem", color: "var(--accent-green)" }}>Completed</span>
                  )}
                  {item.status === "no_show" && (
                    <span style={{ fontSize: "0.75rem", color: "var(--accent-red)" }}>Missed</span>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
                No matching tokens found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default QueueTable;
