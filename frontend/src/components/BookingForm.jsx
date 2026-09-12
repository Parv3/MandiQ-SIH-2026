import React, { useState } from "react";
import { createBooking } from "../services/api.js";
import { useWebSocket } from "../services/websocket.jsx";

const BookingForm = () => {
  const [form, setForm] = useState({
    phone_number: "",
    name: "",
    crop: "",
    village: "",
  });
  const [msg, setMsg] = useState(null);
  const { setQueueData } = useWebSocket();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await createBooking(form);
      setMsg({ type: "success", text: `Token ${data.token} generated for ${data.slot_time}` });
      setForm({ phone_number: "", name: "", crop: "", village: "" });
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "Booking failed: " + (err.response?.data?.detail || err.message) });
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Manual Booking</h2>
        <div className="card-subtitle">Walk-in requests</div>
      </div>
      <form className="booking-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input className="form-input" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="e.g. 9876543210" required />
        </div>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="Farmer Name" required />
        </div>
        <div className="form-group">
          <label className="form-label">Crop</label>
          <input className="form-input" name="crop" value={form.crop} onChange={handleChange} placeholder="e.g. Wheat, Rice" required />
        </div>
        <div className="form-group">
          <label className="form-label">Village (optional)</label>
          <input className="form-input" name="village" value={form.village} onChange={handleChange} placeholder="Village Name" />
        </div>
        <button type="submit" className="submit-btn">Book Slot</button>
      </form>
      {msg && (
        <div className={`form-message ${msg.type}`} style={{marginTop: "1rem"}}>
          {msg.text}
        </div>
      )}
    </div>
  );
};

export default BookingForm;
