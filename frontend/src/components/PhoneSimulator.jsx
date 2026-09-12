import React, { useState, useEffect, useRef } from "react";
import { createBooking, fetchFarmerStatus, synthesizeSpeech, getVoiceProviders, processFarmerSpeech } from "../services/api.js";

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
  },
  pa: {
    welcome: "Mandi Q vich tuhada swagat hai, {name}. Slot book karan layi 1 dabao. Apna status check karan layi 2 dabao.",
    selectCrop: "Kripa karke apni fasal chuno. Kanak layi 1, Ganne layi 2, ate Jhone layi 3 dabao.",
    invalidChoice: "Galat chunav. Kanak layi 1, Ganne layi 2, ya Jhone layi 3 dabao.",
    confirmed: "Tuhadi booking confirm ho gayi hai. Tuhada token number hai {token}. Asi SMS bhej ditta hai.",
    failed: "Maaf karna, asi tuhada slot book nahi kar sake. Kripa karke baad vich koshish karo.",
    alreadyBooked: "Tuhadi booking pehla hi active hai. Status check karan layi 2 dabao.",
    fetchingStatus: "Tuhada status check ho reha hai, kripa pratiksha karo.",
    statusResult: "Tuhada token number {token} hai, ate tuhada status {status} hai.",
    statusNotFound: "Tuhade number te koi booking nahi mili.",
  },
  bho: {
    welcome: "Mandi Q me raua sab ke bahut-bahut swagat ba, {name} ji. Slot book kare khatir 1 dabai. Apan status jaanche khatir 2 dabai.",
    selectCrop: "Kripa kaike apan fasal chuni. Gohun khatir 1, Eekh chahe Ganna khatir 2, aa Dhan khatir 3 dabai.",
    invalidChoice: "Galat chunav. Gohun khatir 1, Ganna khatir 2, ya Dhan khatir 3 dabai.",
    confirmed: "Raua booking pakka ho gail ba. Raua token number {token} ba. Hamni SMS bhej dele bani.",
    failed: "Maaf kari, raua slot book na ho paawal. Kripa kaike baad me koshish kari.",
    alreadyBooked: "Raua booking pahile se chalu ba. Status dekhe khatir 2 dabai.",
    fetchingStatus: "Raua status ke jaanch ho rahal ba, tani dheeraj rakhi.",
    statusResult: "Raua token number {token} ba, aaur status {status} ba.",
    statusNotFound: "Raua number par kawno booking naikhe milal.",
  }
};

const PhoneSimulator = () => {
  // Config
  const [callerName, setCallerName] = useState("Parv");
  const [callerPhone, setCallerPhone] = useState("9876543210");
  const [lang, setLang] = useState("hi"); // Default to Hindi for authentic IVR
  const [sms, setSms] = useState(null); // { name, token, date, time }
  const [voiceEngine, setVoiceEngine] = useState("sarvam"); // 'sarvam', 'bhashini', or 'browser'
  const [providers, setProviders] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [customVoiceInput, setCustomVoiceInput] = useState("");
  const audioPlayerRef = useRef(null);

  // Phone State
  // steps: idle -> calling -> connected_menu -> crop_selection -> status_fetch
  const [step, setStep] = useState("idle");
  const [screenLines, setScreenLines] = useState(["MandiQ Network", "", "Press CALL to start"]);

  // Check backend voice providers status on mount
  useEffect(() => {
    getVoiceProviders().then(data => {
      if (data) setProviders(data);
    });
  }, []);

  const t = (key, params = {}) => {
    let str = i18n[lang][key] || key;
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  };

  const stopSpeak = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const speak = async (text, langCode = "en-US", onEnd = null) => {
    stopSpeak();

    // 1. Try Sarvam AI or Bhashini if selected
    if (voiceEngine === "sarvam" || voiceEngine === "bhashini") {
      try {
        const langParam = (lang === "hi" || lang === "bho") ? "hi-IN" : (lang === "pa" ? "pa-IN" : "en-IN");
        const ttsRes = await synthesizeSpeech(text, voiceEngine, langParam);
        if (ttsRes && ttsRes.success && ttsRes.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${ttsRes.audio_base64}`);
          audioPlayerRef.current = audio;
          if (onEnd) audio.onended = onEnd;
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("Neural TTS playback failed, falling back to browser synthesis", err);
      }
    }

    // 2. Fallback to Browser SpeechSynthesis
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = (lang === "hi" || lang === "bho") ? "hi-IN" : (lang === "pa" ? "pa-IN" : "en-US");
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
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

  const handleVoiceBooking = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome/Edge or keypad buttons.");
      return;
    }

    stopSpeak();
    setIsListening(true);
    setScreenLines(["Listening...", "Speak your crop", "e.g. Gehu, Dhan, Sarson"]);
    
    const recognition = new SpeechRecognition();
    recognition.lang = (lang === "hi" || lang === "bho") ? "hi-IN" : (lang === "pa" ? "pa-IN" : "en-IN");
    recognition.interimResults = false;

    recognition.onresult = async (event) => {
      setIsListening(false);
      const transcript = event.results[0][0].transcript;
      setScreenLines(["Heard:", `"${transcript}"`, "Processing AI..."]);
      await handleVoiceText(transcript);
    };

    recognition.onerror = (err) => {
      setIsListening(false);
      console.warn("Speech recognition error:", err.error, err);
      if (err.error === "not-allowed" || err.error === "permission-denied") {
        setScreenLines(["Mic Blocked 🔒", "Click lock in URL bar", "Allow Microphone"]);
        alert("Microphone permission was blocked by your browser. Please click the lock 🔒 or site settings icon next to the URL in your address bar and set Microphone to 'Allow', then refresh.");
      } else if (err.error === "no-speech") {
        setScreenLines(["No speech heard", "Click mic & speak", "e.g. Gehu, Dhan"]);
      } else if (err.error === "network") {
        setScreenLines(["Network Error", "Use Quick Voice chips", "Below phone"]);
      } else {
        setScreenLines([`Mic: ${err.error}`, "Use Quick Voice chips", "Or dial keypad"]);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
      console.warn("Recognition start error", e);
      setScreenLines(["Mic Busy", "Try again in a sec"]);
    }
  };

  const handleVoiceText = async (text) => {
    stopSpeak();
    setScreenLines(["Processing Voice:", `"${text.substring(0, 18)}..."`, "Detecting crop..."]);
    const targetLang = (lang === "hi" || lang === "bho") ? "hi-IN" : (lang === "pa" ? "pa-IN" : "en-IN");
    const nlpResult = await processFarmerSpeech(null, text, targetLang);
    if (nlpResult && nlpResult.extracted_crop) {
      setScreenLines(["AI Detected:", nlpResult.extracted_crop, "Booking slot..."]);
      submitBooking(nlpResult.extracted_crop);
    } else {
      setScreenLines(["Crop not found", "Try: Gehu, Dhan", "Or press keypad"]);
      speak(t("invalidChoice"));
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
            <label className="form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Voice AI Engine</span>
              <span style={{ fontSize: "0.75rem", color: providers?.sarvam?.configured ? "var(--accent-green)" : "#eab308" }}>
                {providers?.sarvam?.configured ? "🟢 Sarvam Active" : "🟡 Local Mode"}
              </span>
            </label>
            <select 
              className="form-input" 
              value={voiceEngine} 
              onChange={e => setVoiceEngine(e.target.value)}
              disabled={step !== "idle"}
            >
              <option value="sarvam">Sarvam AI (Bulbul Neural Voice)</option>
              <option value="bhashini">Bhashini (National Indic Voice)</option>
              <option value="browser">Browser Speech (Offline)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label className="form-label">Language / Bhasha</label>
            <select 
              className="form-input" 
              value={lang} 
              onChange={e => setLang(e.target.value)}
              disabled={step !== "idle"}
            >
              <option value="hi">Hindi (हिंदी)</option>
              <option value="bho">Bhojpuri (भोजपुरी)</option>
              <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
              <option value="en">English</option>
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
                <span>💬</span> {lang === 'pa' ? 'ਨਵਾਂ SMS' : (lang === 'bho' ? 'नया SMS (भोजपुरी)' : (lang === 'hi' ? 'Naya SMS' : 'New SMS Received'))}
              </h2>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", borderLeft: "3px solid var(--accent-green)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              {lang === 'bho' ? 'Pranam' : (lang === 'pa' ? 'Sat Sri Akal' : (lang === 'hi' ? 'Namaste' : 'Hello'))} <strong>{sms.name}</strong>,<br/>
              {lang === 'bho' ? 'Raua MandiQ slot book ho gail ba.' : (lang === 'pa' ? 'Tuhada MandiQ slot book ho gaya hai.' : (lang === 'hi' ? 'Aapka MandiQ slot book ho gaya hai.' : 'Your MandiQ slot is booked successfully.'))}<br/><br/>
              <span style={{ color: "var(--text-muted)" }}>Token No:</span> <strong style={{ color: "var(--text-primary)" }}>{sms.token}</strong><br/>
              <span style={{ color: "var(--text-muted)" }}>{lang === 'bho' ? 'Tarikh' : (lang === 'pa' ? 'Miti (Date)' : (lang === 'hi' ? 'Tarik' : 'Date'))}:</span> {sms.date}<br/>
              <span style={{ color: "var(--text-muted)" }}>{lang === 'bho' ? 'Aawe ke Samay' : (lang === 'pa' ? 'Aun da Samay' : (lang === 'hi' ? 'Aane ka Samay' : 'Time to come'))}:</span> <strong>{sms.time}</strong><br/><br/>
              <em>{lang === 'bho' ? 'MandiQ istemal kare khatir bahut-bahut dhanyawad!' : (lang === 'pa' ? 'MandiQ vartan layi dhanvaad!' : (lang === 'hi' ? 'MandiQ istemal karne ke liye dhanyawad!' : 'Thank you for using MandiQ!'))}</em>
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

        {/* Voice AI Direct Booking Button */}
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button 
            onClick={handleVoiceBooking}
            disabled={isListening}
            style={{
              background: isListening ? "#ef4444" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              border: "none",
              padding: "0.6rem 1.1rem",
              borderRadius: "20px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.85rem",
              boxShadow: isListening ? "0 0 15px rgba(239, 68, 68, 0.6)" : "0 4px 12px rgba(16, 185, 129, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "all 0.2s ease"
            }}
          >
            <span>{isListening ? "🎙️ Listening..." : "🎙️ Speak to Book (Voice AI)"}</span>
          </button>
        </div>

        {/* Quick Voice Simulation Chips & Input */}
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "500" }}>
            🌾 Quick Voice Test (Click to simulate speech):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", justifyContent: "center", maxWidth: "280px" }}>
            <button
              onClick={() => handleVoiceText("Main Gehun bechna chahta hoon")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "var(--text-secondary)", fontSize: "0.72rem", padding: "0.25rem 0.55rem", cursor: "pointer" }}
            >
              "Gehun lana hai" (Hindi)
            </button>
            <button
              onClick={() => handleVoiceText("Hamra gohun beche ke ba")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "var(--text-secondary)", fontSize: "0.72rem", padding: "0.25rem 0.55rem", cursor: "pointer" }}
            >
              "Gohun beche ke ba" (Bhojpuri)
            </button>
            <button
              onClick={() => handleVoiceText("Main kanak le ke aana hai")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "var(--text-secondary)", fontSize: "0.72rem", padding: "0.25rem 0.55rem", cursor: "pointer" }}
            >
              "Kanak aana hai" (Punjabi)
            </button>
            <button
              onClick={() => handleVoiceText("30 quintal Sarson lana hai")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "var(--text-secondary)", fontSize: "0.72rem", padding: "0.25rem 0.55rem", cursor: "pointer" }}
            >
              "Sarson lana hai"
            </button>
          </div>

          <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.35rem", width: "100%", maxWidth: "270px" }}>
            <input
              type="text"
              placeholder="Or type phrase (e.g. Gehu, Dhan)..."
              value={customVoiceInput}
              onChange={(e) => setCustomVoiceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customVoiceInput.trim()) {
                  handleVoiceText(customVoiceInput);
                  setCustomVoiceInput("");
                }
              }}
              style={{
                flex: 1,
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "6px",
                padding: "0.3rem 0.5rem",
                fontSize: "0.75rem",
                color: "#fff"
              }}
            />
            <button
              onClick={() => {
                if (customVoiceInput.trim()) {
                  handleVoiceText(customVoiceInput);
                  setCustomVoiceInput("");
                }
              }}
              style={{
                background: "var(--accent-green)",
                color: "#000",
                fontWeight: "600",
                border: "none",
                borderRadius: "6px",
                padding: "0.3rem 0.6rem",
                fontSize: "0.75rem",
                cursor: "pointer"
              }}
            >
              Say
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneSimulator;
