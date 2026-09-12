// src/services/websocket.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { initQueueData, getStoredQueue } from "./dataService.js";

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [queueData, setQueueData] = useState([]);

  useEffect(() => {
    // 1. Load initial data (backend or fallback 100 mock items)
    initQueueData().then((items) => {
      setQueueData(items || []);
    });

    // 2. Connect to WebSocket if host supports it (e.g. localhost)
    let ws = null;
    try {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocal) {
        ws = new WebSocket(`ws://${window.location.host}/ws/queue`);
        ws.onopen = () => console.log("WebSocket connected to backend");
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "queue_update") {
              setQueueData(message.data.items || []);
            }
          } catch (e) {
            console.error("WS parse error", e);
          }
        };
        ws.onerror = (err) => console.log("WS fallback to client mode", err);
        setSocket(ws);
      }
    } catch (e) {
      console.log("Running in static standalone mode");
    }

    // 3. Listen to local storage changes so simulator and table stay in sync
    const handleStorage = () => {
      const current = getStoredQueue();
      if (current) setQueueData(current);
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (ws) ws.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, queueData, setQueueData }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
