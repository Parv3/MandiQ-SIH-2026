// src/services/websocket.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { initQueueData, getStoredQueue } from "./dataService.js";

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [queueData, setQueueData] = useState(() => getStoredQueue() || []);

  useEffect(() => {
    // 1. Load initial data (backend or fallback 100 mock items)
    initQueueData().then((items) => {
      setQueueData(items || []);
    });

    // 2. Connect to WebSocket
    let ws = null;
    try {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const wsUrl = isLocal 
        ? "ws://127.0.0.1:8000/ws/queue" 
        : "wss://mandiq-sih-2026.onrender.com/ws/queue";

      ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log("WebSocket connected to MandiQ backend:", wsUrl);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "queue_update" && message.data && message.data.items) {
            setQueueData(message.data.items);
            try {
              localStorage.setItem("mandiq_queue_data", JSON.stringify(message.data.items));
            } catch (e) {}
          }
        } catch (e) {
          console.error("WS parse error", e);
        }
      };
      ws.onerror = () => console.log("WS fallback to local sync mode");
      setSocket(ws);
    } catch (e) {
      console.log("Running in static standalone mode");
    }

    // 3. Listen to both custom event (same tab) and storage event (other tabs)
    const handleQueueUpdate = (e) => {
      if (e && e.detail) {
        setQueueData(e.detail);
      } else {
        const current = getStoredQueue();
        if (current) setQueueData(current);
      }
    };
    window.addEventListener("mandiq_queue_updated", handleQueueUpdate);
    window.addEventListener("storage", handleQueueUpdate);

    // 4. Periodic sync every 3 seconds to guarantee 100% live consistency
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/queue");
        if (res.ok) {
          const data = await res.json();
          if (data && data.items && data.items.length > 0) {
            setQueueData(data.items);
            try {
              localStorage.setItem("mandiq_queue_data", JSON.stringify(data.items));
            } catch (e) {}
          }
        }
      } catch (e) {}
    }, 3000);

    return () => {
      if (ws) ws.close();
      window.removeEventListener("mandiq_queue_updated", handleQueueUpdate);
      window.removeEventListener("storage", handleQueueUpdate);
      clearInterval(pollInterval);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, queueData, setQueueData }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
