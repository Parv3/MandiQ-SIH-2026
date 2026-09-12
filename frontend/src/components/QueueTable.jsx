import React, { useState, useMemo } from "react";
import { useWebSocket } from "../services/websocket.jsx";
import axios from "axios";

const QueueTable = () => {
  const { queueData, setQueueData } = useWebSocket();
  const [sortField, setSortField] = useState("token_number");
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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
      await axios.post("/api/queue/update", { token_number: token, status: newStatus });
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update status.");
    }
  };

  const haltBooking = async (token) => {
    try {
      await axios.post("/api/queue/halt", { token_number: token });
    } catch (err) {
      console.error("Failed to halt booking", err);
      alert("Failed to halt booking.");
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
