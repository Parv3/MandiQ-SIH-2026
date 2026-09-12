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
const CANDIDATE_HOSTS = [
  "",                                     // 1. Relative path (Vite proxy)
  "http://127.0.0.1:8000",                // 2. Direct IPv4 local backend
  "http://localhost:8000",                // 3. Localhost fallback
  "https://mandiq-sih-2026.onrender.com"  // 4. Live Render Cloud backend
];

let workingVoiceHost = null;

export const getVoiceProviders = async () => {
  for (const host of CANDIDATE_HOSTS) {
    try {
      const res = await fetch(`${host}/api/voice/providers`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        workingVoiceHost = host;
        return await res.json();
      }
    } catch (e) {
      // Try next candidate
    }
  }
  return null;
};

export const synthesizeSpeech = async (text, provider = "auto", language = "hi-IN", speaker = "meera") => {
  const host = workingVoiceHost !== null ? workingVoiceHost : (CANDIDATE_HOSTS[0]);
  const tryHosts = [host, ...CANDIDATE_HOSTS.filter(h => h !== host)];

  for (const h of tryHosts) {
    try {
      const res = await fetch(`${h}/api/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, provider, language, speaker }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        workingVoiceHost = h;
        return await res.json();
      }
    } catch (e) {}
  }
  return null;
};

export const processFarmerSpeech = async (audioBase64 = null, transcript = null, language = "hi-IN") => {
  const host = workingVoiceHost !== null ? workingVoiceHost : (CANDIDATE_HOSTS[0]);
  const tryHosts = [host, ...CANDIDATE_HOSTS.filter(h => h !== host)];

  for (const h of tryHosts) {
    try {
      const res = await fetch(`${h}/api/voice/process-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: audioBase64, transcript, language }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        workingVoiceHost = h;
        return await res.json();
      }
    } catch (e) {}
  }
  return null;
};

// ================= Notifications & Dev Tools =================
import { getStoredNotifications, addStoredNotification, resetAndRandomizeAllData } from "./dataService.js";
export { resetAndRandomizeAllData };

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

