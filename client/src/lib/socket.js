// client/src/lib/socket.js
import { io } from "socket.io-client";

export function createSocket() {
  // Use same-origin by default so Vite proxy handles /socket.io -> 3001
  const SERVER_HTTP = import.meta.env.VITE_SERVER_HTTP || "";

  const s = io(SERVER_HTTP, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 300,
    reconnectionDelayMax: 1500,
    timeout: 8000,
    withCredentials: false,
  });

  return s;
}