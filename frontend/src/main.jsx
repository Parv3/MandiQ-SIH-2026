// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { WebSocketProvider } from "./services/websocket.jsx";
import App from "./App.jsx";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <WebSocketProvider>
      <App />
    </WebSocketProvider>
  </React.StrictMode>
);
