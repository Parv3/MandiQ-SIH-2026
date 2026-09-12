// src/services/dataService.js
// Universal Data Service: Uses backend API when available, and smoothly falls back
// to an embedded in-memory/localStorage engine on GitHub Pages.

const STORAGE_KEY = "mandiq_queue_data";

// Initial fallback mock data seed if fetching local JSON fails
const FALLBACK_SEED = [
  { token_number: "TKN-20260913-001", name: "Ramesh Kumar", phone_number: "9876543210", village: "Rampur", crop: "Wheat", slot_date: "2026-09-13", slot_start: "09:00:00", slot_end: "09:15:00", status: "waiting" },
  { token_number: "TKN-20260913-002", name: "Suresh Singh", phone_number: "9812345678", village: "Fatehpur", crop: "Sugarcane", slot_date: "2026-09-13", slot_start: "09:15:00", slot_end: "09:30:00", status: "waiting" },
  { token_number: "TKN-20260913-003", name: "Mukesh Yadav", phone_number: "9823456789", village: "Govindpur", crop: "Paddy", slot_date: "2026-09-13", slot_start: "09:30:00", slot_end: "09:45:00", status: "served" },
  { token_number: "TKN-20260913-004", name: "Rajesh Patel", phone_number: "9834567890", village: "Kishanpur", crop: "Mustard", slot_date: "2026-09-13", slot_start: "09:45:00", slot_end: "10:00:00", status: "halted" }
];

export const getStoredQueue = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read localStorage", e);
  }
  return null;
};

export const saveStoredQueue = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Immediately dispatch in-window custom event so all components update in real-time!
    window.dispatchEvent(new CustomEvent("mandiq_queue_updated", { detail: data }));
  } catch (e) {
    console.warn("Could not save to localStorage", e);
  }
};

export const initQueueData = async () => {
  // 1. Attempt to fetch freshest live queue from backend first
  try {
    const res = await fetch("/api/queue");
    if (res.ok) {
      const data = await res.json();
      if (data && data.items && data.items.length > 0) {
        saveStoredQueue(data.items);
        return data.items;
      }
    }
  } catch (e) {
    // Expected when running offline
  }

  // 2. Check localStorage next
  const existing = getStoredQueue();
  if (existing && existing.length > 0) {
    return existing;
  }

  // 3. Load 100 mock customers from public/mock_customers_100.json
  try {
    const basePath = import.meta.env.BASE_URL || "/";
    const res = await fetch(`${basePath}mock_customers_100.json`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        saveStoredQueue(data);
        return data;
      }
    }
  } catch (e) {
    console.warn("Failed to load mock_customers_100.json, using fallback", e);
  }

  // 4. Default fallback seed
  saveStoredQueue(FALLBACK_SEED);
  return FALLBACK_SEED;
};

// Update status (Served / No-Show)
export const updateItemStatus = async (token, newStatus) => {
  // Try backend first
  try {
    const res = await fetch("/api/queue/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_number: token, status: newStatus })
    });
    if (res.ok) return true;
  } catch (e) {}

  // Fallback to local state
  const list = getStoredQueue() || [];
  const updated = list.map((item) => {
    if (item.token_number === token) {
      return { ...item, status: newStatus };
    }
    return item;
  });
  saveStoredQueue(updated);
  return true;
};

// Halt and reschedule item
export const haltItem = async (token) => {
  // Try backend first
  try {
    const res = await fetch("/api/queue/halt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_number: token })
    });
    if (res.ok) return await res.json();
  } catch (e) {}

  // Fallback to local state
  const list = getStoredQueue() || [];
  let rescheduledInfo = null;

  const updated = list.map((item) => {
    if (item.token_number === token) {
      const nextDate = "2026-09-14";
      rescheduledInfo = {
        token: item.token_number,
        new_date: nextDate,
        slot_time: item.slot_start ? `${item.slot_start.slice(0, 5)} - ${item.slot_end.slice(0, 5)}` : "10:00 - 10:15"
      };
      return {
        ...item,
        status: "halted",
        slot_date: nextDate
      };
    }
    return item;
  });

  saveStoredQueue(updated);
  return rescheduledInfo || { detail: "Booking halted" };
};

// Emergency Halt All Items
export const haltAllItems = async () => {
  // Try backend first
  try {
    const res = await fetch("/api/queue/halt-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (res.ok) {
      const result = await res.json();
      try {
        const qRes = await fetch("/api/queue");
        if (qRes.ok) {
          const qData = await qRes.json();
          if (qData && qData.items) saveStoredQueue(qData.items);
        }
      } catch (e) {}
      return result;
    }
  } catch (e) {}

  // Fallback to local state
  const list = getStoredQueue() || [];
  const nextDate = "2026-09-14";
  let count = 0;
  const updated = list.map((item) => {
    if (item.status === "waiting") {
      count++;
      return {
        ...item,
        status: "halted",
        slot_date: nextDate
      };
    }
    return item;
  });

  saveStoredQueue(updated);
  return { detail: `Halted ${count} bookings`, count };
};

// Create a new booking
export const bookSlot = async ({ phone_number, name, crop, village }) => {
  // Try backend first
  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number, name, crop, village })
    });
    if (res.ok) {
      const data = await res.json();
      // Immediately refresh queue from backend so count updates live!
      try {
        const qRes = await fetch("/api/queue");
        if (qRes.ok) {
          const qData = await qRes.json();
          if (qData && qData.items) {
            saveStoredQueue(qData.items);
          }
        }
      } catch (e) {}
      return data;
    }
    if (res.status === 400) {
      const errData = await res.json();
      throw { response: { status: 400, data: errData } };
    }
  } catch (e) {
    if (e.response && e.response.status === 400) throw e;
  }

  // Fallback in-memory booking
  const list = getStoredQueue() || [];
  
  // Guard: duplicate phone number
  const existing = list.find(
    (item) => item.phone_number === phone_number && (item.status === "waiting" || item.status === "rescheduled")
  );
  if (existing) {
    throw { response: { status: 400, data: { detail: "An active booking already exists for this phone number" } } };
  }

  // Calculate new slot
  const tokenSeq = list.length + 1;
  const token = `TKN-20260913-${String(tokenSeq).padStart(3, "0")}`;
  const slotDate = "2026-09-13";
  
  // Find latest slot
  const baseMinutes = 9 * 60 + (list.length % 50) * 15;
  const startH = String(Math.floor(baseMinutes / 60)).padStart(2, "0");
  const startM = String(baseMinutes % 60).padStart(2, "0");
  const endMinutes = baseMinutes + 15;
  const endH = String(Math.floor(endMinutes / 60)).padStart(2, "0");
  const endM = String(endMinutes % 60).padStart(2, "0");

  const newBooking = {
    token_number: token,
    name,
    phone_number,
    village: village || "Simulation",
    crop,
    slot_date: slotDate,
    slot_start: `${startH}:${startM}:00`,
    slot_end: `${endH}:${endM}:00`,
    status: "waiting"
  };

  const updated = [newBooking, ...list];
  saveStoredQueue(updated);

  return {
    token,
    slot_time: `${startH}:${startM} - ${endH}:${endM}`,
    message: `Booking created for ${name}`
  };
};

// Check status by phone
export const getStatusByPhone = async (phone) => {
  // Try backend first
  try {
    const res = await fetch(`/api/simulate/status/${phone}`);
    if (res.ok) return await res.json();
  } catch (e) {}

  // Fallback to local search
  const list = getStoredQueue() || [];
  const found = list.find((item) => item.phone_number === phone);
  if (!found) {
    throw { response: { status: 404, data: { detail: "No bookings for this phone" } } };
  }

  return {
    phone: found.phone_number,
    token: found.token_number,
    status: found.status,
    slot_time: found.slot_start ? `${found.slot_start.slice(0, 5)} - ${found.slot_end.slice(0, 5)}` : "10:00 - 10:15"
  };
};
