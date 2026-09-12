import React, { useState, useEffect } from "react";
import { createBooking, fetchFarmerStatus } from "../services/api.js";

// Dictionary for Hindi and English translations
const i18n = {
  en: {
    welcome: "Welcome {name} to Mandi-Q. Press 1 to book a slot. Press 2 to check your status.",
    selectCrop: "Please select your crop. Press 1 for Wheat. Press 2 for Sugarcane. And press 3 for Paddy.",
    invalidChoice: "Invalid choice. Press 1 for Wheat, 2 for Sugarcane, or 3 for Paddy.",
    confirmed: "Your booking is confirmed. Your token number is {token}. We have sent an SMS with your details.",
    failed: "Sorry, we could not book your slot. Please try again later.",
    alreadyBooked: "You already have an active booking. Press 2 to check your status.",
    fetchingStatus: "Fetching your status, please wait.",
    statusResult: "Your token is {token}, your slot time is {slot_time}, and your status is {status}.",
    statusNotFound: "We could not find an active booking for your number.",
  },
  hi: {
    welcome: "Mandi Q mein aapka swagat hai, {name}. Slot book karne ke liye 1 dabaye. Apna status check karne ke liye 2 dabaye.",
    selectCrop: "Kripya apni fasal chune. Gehu ke liye 1, Ganna ke liye 2, aur Dhan ke liye 3 dabaye.",
    invalidChoice: "Galat chunav. Gehu ke liye 1, Ganna ke liye 2, ya Dhan ke liye 3 dabaye.",
    confirmed: "Aapka booking confirm ho gaya hai. Aapka token number hai {token}. Humne aapko details ke saath ek SMS bhej diya hai.",
    failed: "Maaf kijiye, hum aapka slot book nahi kar sake. Kripya baad mein prayas kare.",
    alreadyBooked: "Aapki booking pehle se active hai. Status check karne ke liye 2 dabaye.",
    fetchingStatus: "Aapka status check ho raha hai, kripya pratiksha kare.",
    statusResult: "Aapka token number {token} hai, aur aapka status {status} hai.",
    statusNotFound: "Aapke number par koi booking nahi mili.",
  }
};

const PhoneSimulator = () => {
  // Config
  const [callerName, setCallerName] = useState("Parv");
  const [callerPhone, setCallerPhone] = useState("9876543210");
  const [lang, setLang] = useState("en"); // 'en' or 'hi'
  const [sms, setSms] = useState(null); // { name, token, date, time }

  // Phone State
  // steps: idle -> calling -> connected_menu -> crop_selection -> status_fetch
  const [step, setStep] = useState("idle");
  const [screenLines, setScreenLines] = useState(["MandiQ Network", "", "Press CALL to start"]);

  const t = (key, params = {}) => {
    let str = i18n[lang][key] || key;
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  };

  const speak = (text, langCode = "en-US", onEnd = null) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose voice language based on user selection
    utterance.lang = lang === "hi" ? "hi-IN" : "en-US";
    
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeak = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  useEffect(() => {
    return () => stopSpeak(); 
  }, []);

  const handleCall = () => {
    if (step === "idle") {
      setStep("calling");
      setScreenLines([lang === 'hi' ? "Calling..." : "Dialing...", "MandiQ IVR"]);
      setSms(null);
      setTimeout(() => {
        setStep("connected_menu");
        setScreenLines(["Connected", "1: Book Slot", "2: Check Status"]);
        speak(t("welcome", { name: callerName }));
      }, 2000);
    }
  };

  const handleEnd = () => {
    stopSpeak();
    setStep("idle");
    setScreenLines(["Call Ended.", "", "MandiQ Network", "Press CALL"]);
  };

  const handleKey = (key) => {
    if (step === "connected_menu") {
      if (key === '1') {
        stopSpeak();
        setStep("crop_selection");
        setScreenLines(["Select Crop:", "1: Wheat", "2: Sugarcane", "3: Paddy"]);
        speak(t("selectCrop"));
      } else if (key === '2') {
        stopSpeak();
        setStep("status_fetch");
        setScreenLines(["Checking...", "Please wait"]);
        speak(t("fetchingStatus"));
        fetchStatus();
      }
    } else if (step === "crop_selection") {
       let crop = "";
       if (key === '1') crop = "Wheat";
       if (key === '2') crop = "Sugarcane";
       if (key === '3') crop = "Paddy";

       if (crop) {
         submitBooking(crop);
       } else {
         speak(t("invalidChoice"));
       }
    } else if (step === "idle" && key.match(/[0-9]/)) {
       setScreenLines(["MandiQ Network", "Ready.", `Num: ${key}`]);
    }
  };

  const submitBooking = async (crop) => {
    stopSpeak();
    setScreenLines(["Booking slot...", "Please wait"]);
    try {
      const res = await createBooking({ 
        phone_number: callerPhone, 
        name: callerName, 
        crop: crop, 
        village: "Simulation" 
      });
      setScreenLines(["Confirmed!", `TKN: ${res.token}`]);
      speak(t("confirmed", { token: res.token }));
      
      const today = new Date().toLocaleDateString();
      setSms({
        name: callerName,
        token: res.token,
        phone: callerPhone,
        time: res.slot_time
      });

    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data && err.response.data.detail && err.response.data.detail.includes("already exists")) {
        setScreenLines(["Already Booked!", "Press 2 for status"]);
        speak(t("alreadyBooked"));
      } else {
        setScreenLines(["Booking Failed", "Try again"]);
        speak(t("failed"));
      }
    }
  };

   const fetchStatus = async () => {
      try {
         const data = await fetchFarmerStatus(callerPhone);
         // Show token, slot time, status and phone in the UI
         setScreenLines([
           `TKN: ${data.token}`,
           `Slot: ${data.slot_time}`,
           `Phone: ${data.phone}`,
           `${data.status}`
         ]);
         // Speak the result including token and slot time
         const safeStatus = data.status.replace('_', ' ');
         speak(t("statusResult", { token: data.token, slot_time: data.slot_time, status: safeStatus }));
      } catch (e) {
         setScreenLines(["Not found", "No active booking"]);
         speak(t("statusNotFound"));
      }
   };

  const renderKey = (num, letters) => (
    <button className="nokia-key" onClick={() => handleKey(num)}>
      <span className="key-num">{num}</span>
      <span className="key-letters">{letters}</span>
    </button>
  );

  return (
    <div style={{ display: "flex", gap: "3rem", width: "100%", justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
      
      {/* Simulation Setup Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%", maxWidth: "320px" }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h2 className="card-title">Caller ID Setup</h2>
            <div className="card-subtitle">Set before calling</div>
          </div>
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label className="form-label">Language / Bhasha</label>
            <select 
              className="form-input" 
              value={lang} 
              onChange={e => setLang(e.target.value)}
              disabled={step !== "idle"}
            >
              <option value="en">English</option>
              <option value="hi">Hindi (हिंदी)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label className="form-label">Phone Number</label>
            <input 
              className="form-input" 
              value={callerPhone} 
              onChange={e => setCallerPhone(e.target.value)} 
              disabled={step !== "idle"}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Caller Name</label>
            <input 
              className="form-input" 
              value={callerName} 
              onChange={e => setCallerName(e.target.value)} 
              disabled={step !== "idle"}
            />
          </div>
        </div>

        {/* Mock SMS Popup Box */}
        {sms && (
          <div className="card fade-in" style={{ margin: 0, border: "1px solid var(--accent-green)", boxShadow: "var(--shadow-glow)" }}>
            <div className="card-header" style={{ marginBottom: "0.5rem" }}>
              <h2 className="card-title" style={{ color: "var(--accent-green)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>💬</span> {lang === 'hi' ? 'Naya SMS' : 'New SMS Received'}
              </h2>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", borderLeft: "3px solid var(--accent-green)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              {lang === 'hi' ? 'Namaste' : 'Hello'} <strong>{sms.name}</strong>,<br/>
              {lang === 'hi' ? 'Aapka MandiQ slot book ho gaya hai.' : 'Your MandiQ slot is booked successfully.'}<br/><br/>
              <span style={{ color: "var(--text-muted)" }}>Token No:</span> <strong style={{ color: "var(--text-primary)" }}>{sms.token}</strong><br/>
              <span style={{ color: "var(--text-muted)" }}>{lang === 'hi' ? 'Tarik' : 'Date'}:</span> {sms.date}<br/>
              <span style={{ color: "var(--text-muted)" }}>{lang === 'hi' ? 'Aane ka Samay' : 'Time to come'}:</span> <strong>{sms.time}</strong><br/><br/>
              <em>{lang === 'hi' ? 'MandiQ istemal karne ke liye dhanyawad!' : 'Thank you for using MandiQ!'}</em>
            </div>
          </div>
        )}
      </div>

      {/* Nokia Phone Simulator */}
      <div className="nokia-phone fade-in">
        <div className="nokia-brand">NOKIA</div>
        
        <div className="nokia-screen-bezel">
          <div className="nokia-screen">
            {screenLines.map((l, i) => (
              <div key={i} className={`screen-line ${i === screenLines.length-1 ? 'highlight' : ''}`}>{l}</div>
            ))}
            {(step === "connected_menu" || step === "crop_selection") && <span className="speaking-indicator">🔊</span>}
          </div>
        </div>
        
        <div className="nokia-nav">
          <button className="nokia-nav-btn call" onClick={handleCall}>Call</button>
          <div className="nokia-dpad">
            <div className="dpad-ring"><div className="dpad-center"></div></div>
          </div>
          <button className="nokia-nav-btn end" onClick={handleEnd}>End</button>
        </div>
        
        <div className="nokia-keypad">
          {renderKey('1', '')}
          {renderKey('2', 'abc')}
          {renderKey('3', 'def')}
          {renderKey('4', 'ghi')}
          {renderKey('5', 'jkl')}
          {renderKey('6', 'mno')}
          {renderKey('7', 'pqrs')}
          {renderKey('8', 'tuv')}
          {renderKey('9', 'wxyz')}
          {renderKey('*', '+')}
          {renderKey('0', '␣')}
          {renderKey('#', '')}
        </div>
      </div>
    </div>
  );
};

export default PhoneSimulator;
