import { initQueueData, updateItemStatus, haltItem, haltAllItems, bookSlot, getStatusByPhone } from "./dataService.js";

export const fetchQueue = async () => {
  const items = await initQueueData();
  return { items, total_waiting: items.filter(i => i.status === "waiting").length, now_serving: 0 };
};

export const createBooking = async (booking) => {
  return await bookSlot(booking);
};

export const updateQueueStatus = async (token, status) => {
  return await updateItemStatus(token, status);
};

export const haltQueueBooking = async (token) => {
  return await haltItem(token);
};

export const haltAllQueueBookings = async () => {
  return await haltAllItems();
};

export const fetchFarmerStatus = async (phone) => {
  return await getStatusByPhone(phone);
};

// ---------------- Voice & Indic AI (Sarvam & Bhashini) ----------------
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const getVoiceProviders = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/voice/providers`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Could not fetch voice providers", e);
  }
  return null;
};

export const synthesizeSpeech = async (text, provider = "auto", language = "hi-IN", speaker = "meera") => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, provider, language, speaker })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("TTS API call failed", e);
  }
  return null;
};

export const processFarmerSpeech = async (audioBase64 = null, transcript = null, language = "hi-IN") => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/voice/process-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_base64: audioBase64, transcript, language })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Process speech failed", e);
  }
  return null;
};

// ================= Notifications =================
import { getStoredNotifications, addStoredNotification } from "./dataService.js";

export const getNotifications = async (limit = 50) => {
  try {
    const res = await fetch(`/api/notifications?limit=${limit}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.notifications && data.notifications.length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.warn("Backend notifications unreachable, using local store", e);
  }
  const localList = getStoredNotifications();
  return { notifications: localList.slice(0, limit), total: localList.length };
};

export const sendTestSms = (farmerName = "Demo Farmer", phone = "9876599999", crop = "Wheat") => {
  const token = `TKN-TEST-${Math.floor(100 + Math.random() * 900)}`;
  return addStoredNotification({
    farmer_name: farmerName,
    phone_number: phone,
    message: `MandiQ Live Test: Namaste ${farmerName}, aapka token ${token} (${crop}) book ho gaya hai. SMS Gateway status: Active.`,
    status: "sent"
  });
};

