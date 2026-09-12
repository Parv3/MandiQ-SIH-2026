// src/services/websocket.jsx
import { createContext, useContext, useEffect, useState } from "react";

// Create a context to share the WebSocket connection and latest queue data
const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [queueData, setQueueData] = useState([]);

  useEffect(() => {
    // Fetch initial queue data
    fetch("/api/queue")
      .then(res => res.json())
      .then(data => setQueueData(data.items || []))
      .catch(err => console.error("Initial fetch error:", err));

    // Connect to the backend WS endpoint
    const ws = new WebSocket(`ws://${window.location.host}/ws/queue`);
    ws.onopen = () => console.log("WebSocket connected");
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
    ws.onclose = () => console.log("WebSocket closed");
    ws.onerror = (err) => console.error("WebSocket error", err);
    setSocket(ws);
    // Cleanup on unmount
    return () => ws.close();
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, queueData, setQueueData }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
