// src/services/api.js
import { initQueueData, updateItemStatus, haltItem, bookSlot, getStatusByPhone } from "./dataService.js";

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

export const fetchFarmerStatus = async (phone) => {
  return await getStatusByPhone(phone);
};
