// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "/api", // proxied to FastAPI
});

export const fetchQueue = async () => {
  const response = await api.get("/queue");
  return response.data;
};

export const createBooking = async (booking) => {
  const response = await api.post("/book", booking);
  return response.data;
};
