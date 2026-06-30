"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { collection, addDoc, serverTimestamp, GeoPoint, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { buttonPress } from "@/lib/animations";
import { CITIES_AND_WARDS, getWardId } from "@/lib/ward-equity";
const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });


export default function ReportPage() {
  const router = useRouter();
  const { user, profile, showToast } = useAuth();

  const [step, setStep] = useState(1);
  const [prevStep, setPrevStep] = useState(1);
  const handleSetStep = (newStep: number) => {
    setPrevStep(step);
    setStep(newStep);
  };
  const direction = step > prevStep ? 1 : -1;

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [userReportedType, setUserReportedType] = useState<string | null>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>({ lat: 17.4239, lng: 78.4062 }); // Default location for map picking
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(profile?.city || "");
  const [ward, setWard] = useState(profile?.wardName || "");
  const [showWardDropdown, setShowWardDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    if (isListening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast({ type: "error", message: "Voice reporting not supported in this browser." });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription(prev => {
        const newVal = prev + (prev.endsWith(" ") || prev.length === 0 ? "" : " ") + transcript;
        return newVal.slice(0, 500);
      });
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  // When city changes, reset ward
  useEffect(() => {
    if (city !== profile?.city) {
      setWard("");
    }
  }, [city, profile?.city]);



  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!location) return;
    const fetchGeocode = async () => {
      try {
        const res = await fetch(`/api/geocode?lat=${location.lat}&lng=${location.lng}`);
        const data = await res.json();
        setAddress(data.address);
        
        let matchedCity = Object.keys(CITIES_AND_WARDS).find(c => 
          data.city && (c.toLowerCase() === data.city.toLowerCase() || data.city.toLowerCase().includes(c.toLowerCase()))
        );
        
        // Demo fallback: if clicked in the middle of nowhere, just default to Mumbai
        if (!matchedCity) {
          matchedCity = "Mumbai";
        }
        
        setCity(matchedCity);
        const wards = CITIES_AND_WARDS[matchedCity];
        
        if (data.neighborhood) {
          const hash = data.neighborhood.split("").reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
          setWard(wards[hash % wards.length]);
        } else {
          // Generate a pseudo-random ward based on the lat/lng coordinates
          const hash = Math.floor(Math.abs(location.lat * location.lng * 10000));
          setWard(wards[hash % wards.length]);
        }
      } catch (err) {
        console.error("Geocode failed:", err);
      }
    };
    
    const timeoutId = setTimeout(fetchGeocode, 800);
    return () => clearTimeout(timeoutId);
  }, [location]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        showToast({ type: "error", message: "Photo must be under 10MB" });
        return;
      }
      setPhotoFile(file);
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      showToast({ type: "error", message: "Geolocation not supported by your browser" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      () => {
        showToast({ type: "error", message: "Unable to get your location. Please enable location access." });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    if (!photoFile || !location || !user || !city || !ward) return;

    try {
      setSubmitting(true);
      const downloadURL = await uploadToCloudinary(photoFile);
      const computedWardId = getWardId(city, ward);

      const docRef = await addDoc(collection(db, "issues"), {
        photoURL: downloadURL,
        location: location ? new GeoPoint(location.lat, location.lng) : null,
        address,
        wardId: computedWardId,
        ward: ward,
        city: city,
        description: description.trim(),
        userReportedType,
        status: "pending_triage",
        reportedBy: user.uid,
        reporterName: profile?.displayName || "Citizen",
        verifyCount: 0,
        verifiedBy: [],
        flagCount: 0,
        flaggedBy: [],
        triageAttempts: 0,
        lastTriageAttempt: null,
        mergedIntoId: null,
        createdAt: serverTimestamp(),
        resolvedAt: null,
      });

      // Instantly award XP and increment reports count for the user
      const { doc, updateDoc, increment } = await import("firebase/firestore");
      const profileRef = doc(db, "public_profiles", user.uid);
      await updateDoc(profileRef, {
        xpPoints: increment(20),
        reportsCount: increment(1)
      }).catch(err => console.error("Failed to update profile XP:", err));
      
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        xpPoints: increment(20),
        reportsCount: increment(1)
      }).catch(err => console.error("Failed to update user XP:", err));

      // Trigger background AI triage
      fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: docRef.id,
          data: {
            location: { latitude: location.lat, longitude: location.lng },
            photoURL: downloadURL,
            description: description.trim(),
            userReportedType,
            ward: ward,
            city: city,
          },
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error("Triage API returned " + res.status);
        const data = await res.json();
        if (data.success && data.triageResult) {
          const { isMerge, mergeTargetId, slaDays, ...rest } = data.triageResult;
          const { doc, updateDoc, increment } = await import("firebase/firestore");
          
          if (isMerge && mergeTargetId) {
            updateDoc(doc(db, "issues", mergeTargetId), { verifyCount: increment(1) });
            updateDoc(doc(db, "issues", docRef.id), { ...rest, mergedIntoId: mergeTargetId });
          } else {
            const slaDeadline = new Date(Date.now() + (slaDays || 7) * 24 * 60 * 60 * 1000);
            updateDoc(doc(db, "issues", docRef.id), { ...rest, slaDeadline });
          }
        }
      }).catch(err => {
        console.error("Triage failed from frontend", err);
        import("firebase/firestore").then(({ doc, updateDoc }) => {
          updateDoc(doc(db, "issues", docRef.id), {
            status: "open",
            category: "uncategorized",
            priorityScore: 50,
            aiReasoning: "Automatic triage failed. Issue queued for manual review.",
          });
        });
      });

      router.push(`/report/trace?id=${docRef.id}`);
    } catch (error) {
      console.error("Error submitting issue:", error);
      showToast({ type: "error", message: "Failed to submit. Please try again." });
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: "14px", left: "0", right: "0", height: "2px", background: "var(--border-light)", zIndex: 0 }} />
        {[
          { id: 1, label: "PHOTO" },
          { id: 2, label: "LOCATION" },
          { id: 3, label: "SUBMIT" }
        ].map(s => {
          const isActive = step === s.id;
          const isComplete = step > s.id;
          return (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, gap: "8px" }}>
              <motion.div 
                animate={{
                  scale: isActive ? 1.2 : 1,
                  backgroundColor: isActive || isComplete ? "var(--orange)" : "var(--white)",
                  borderColor: isActive || isComplete ? "var(--orange)" : "var(--border)",
                  color: isActive || isComplete ? "var(--white)" : "var(--text-tertiary)"
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                style={{ 
                width: "30px", height: "30px", borderRadius: "50%", 
                border: "2px solid",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700
              }}>
                {isComplete ? <i className="ti ti-check" style={{ fontSize: "16px" }} /> : s.id}
              </motion.div>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", color: isActive ? "var(--orange)" : "var(--text-tertiary)" }}>
                {s.label}
              </span>
            </div>
          );
        })}
        {/* Active Line Fill */}
        <div style={{ position: "absolute", top: "14px", left: "0", width: step === 1 ? "0%" : step === 2 ? "50%" : "100%", height: "2px", background: "var(--orange)", zIndex: 0, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column", padding: "24px" }}>
      <div style={{ marginBottom: "24px", position: "relative", maxWidth: "520px", width: "100%", margin: "0 auto 24px" }}>
        <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => step > 1 ? handleSetStep(step - 1) : router.push("/")}>
          <i className="ti ti-arrow-left" style={{ fontSize: "20px", marginRight: "6px" }} /> Back
        </button>
      </div>

      <div style={{ maxWidth: "520px", margin: "0 auto", width: "100%", flex: 1 }}>
        <div style={{ marginBottom: "8px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {step === 1 && "What's the issue?"}
            {step === 2 && "Where is it?"}
            {step === 3 && "Review & submit"}
          </h1>
        </div>
        <p style={{ fontSize: "15px", color: "var(--text-secondary)", marginBottom: "32px" }}>
          {step === 1 && "Take or upload a clear photo of the problem."}
          {step === 2 && "We'll use your GPS to pinpoint the location."}
          {step === 3 && "Your report triggers AI triage automatically."}
        </p>

        {renderStepIndicator()}

        <div style={{ position: "relative" }}>
            <AnimatePresence mode="wait" custom={direction}>
              {/* ── Step 1: Category & Photo ── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={{
                    initial: (d) => ({ opacity: 0, x: d * 40 }),
                    animate: { opacity: 1, x: 0 },
                    exit: (d) => ({ opacity: 0, x: d * -40 })
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>Photo evidence</div>
            <motion.div
              onClick={() => fileInputRef.current?.click()}
              animate={!photoUrl ? { borderColor: ['#E5E5EA', '#FF5B23', '#E5E5EA'] } : { borderColor: 'var(--border)' }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ 
                minHeight: "220px", background: "var(--white)", border: "2px dashed var(--border)", 
                borderRadius: "16px", overflow: "hidden", cursor: "pointer", position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
              }}
            >
              <input type="file" accept="image/*" capture="environment" hidden ref={fileInputRef} onChange={handleFileChange} />
              <AnimatePresence>
              {photoUrl ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{ width: "100%", height: "240px", backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                >
                  <div style={{ position: "absolute", top: "12px", right: "12px", background: "var(--green)", color: "#fff", padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, display: "flex", gap: "4px", alignItems: "center" }}>
                    <i className="ti ti-check" /> Photo ready
                  </div>
                  <div style={{ position: "absolute", bottom: "12px", left: "12px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "6px 12px", borderRadius: "100px", fontSize: "11px", fontWeight: 600 }}>
                    Tap to change
                  </div>
                </motion.div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--orange-light)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 16px" }}>
                    <i className="ti ti-camera" />
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Take a photo or upload</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>On mobile, camera opens automatically</div>
                </div>
              )}
              </AnimatePresence>
            </motion.div>

            <div style={{ marginTop: "24px", marginBottom: "8px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              What type of issue is this? <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(optional — AI will verify)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
              {[
                { id: "road_damage", label: "Roads" },
                { id: "water_leakage", label: "Water" },
                { id: "streetlight", label: "Lights" },
                { id: "waste", label: "Waste" },
                { id: "other", label: "Other" }
              ].map(type => (
                <motion.button
                  key={type.id}
                  onClick={() => setUserReportedType(type.id === userReportedType ? null : type.id)}
                  className={`btn`}
                  animate={{
                    backgroundColor: userReportedType === type.id ? 'var(--orange)' : 'var(--white)',
                    color: userReportedType === type.id ? 'var(--white)' : 'var(--text-primary)',
                    borderColor: userReportedType === type.id ? 'var(--orange)' : 'var(--border)'
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  style={{ borderRadius: "100px", padding: "6px 16px", fontSize: "13px", border: "1px solid" }}
                >
                  {type.label}
                </motion.button>
              ))}
            </div>

            <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                Description <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(optional — AI will analyze the photo)</span>
              </div>
              <motion.button 
                onClick={startListening}
                whileTap={{ scale: 0.9 }}
                animate={{ color: isListening ? "var(--red)" : "var(--text-secondary)" }}
                style={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: "100px", padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}
              >
                {isListening ? (
                  <><motion.i animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="ti ti-microphone" style={{ fontSize: "16px", color: "var(--red)" }} /> Listening...</>
                ) : (
                  <><i className="ti ti-microphone" style={{ fontSize: "16px" }} /> Voice type</>
                )}
              </motion.button>
            </div>
            <textarea
              className="textarea"
              placeholder="Any details that might help the repair crew?"
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setDescription(e.target.value);
                }
              }}
              style={{ minHeight: "120px" }}
            />
            <div style={{ textAlign: "right", marginTop: "6px", fontSize: "12px", color: "var(--text-tertiary)" }}>{description.length}/500</div>

            <motion.button
              {...buttonPress}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: "32px", height: "52px", fontSize: "16px" }}
              onClick={() => handleSetStep(2)}
              disabled={!photoUrl}
            >
                  Next: Add Location <i className="ti ti-arrow-right" style={{ marginLeft: "4px" }} />
                </motion.button>
              </motion.div>
            )}

            {/* ── Step 2: Location ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={{
                  initial: (d) => ({ opacity: 0, x: d * 40 }),
                  animate: { opacity: 1, x: 0 },
                  exit: (d) => ({ opacity: 0, x: d * -40 })
                }}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>GPS Location</div>

            <div style={{ border: "1px solid var(--border)", borderRadius: "16px", marginBottom: "20px", overflow: "hidden", height: "240px", position: "relative" }}>
              <MiniMap 
                lat={location!.lat} 
                lng={location!.lng} 
                onLocationChange={(lat, lng) => setLocation({ lat, lng })}
              />
            </div>

            <div className="card" style={{ marginBottom: "16px", padding: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "8px" }}>Address</div>
              <input 
                className="input" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="Type street address..."
                style={{ width: "100%", marginBottom: "16px" }}
              />
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button className="btn btn-secondary btn-sm" onClick={handleGetLocation} disabled={locating} style={{ flex: 1 }}>
                  {locating ? <><i className="ti ti-loader animate-pulse" /> Updating...</> : <><i className="ti ti-current-location" /> Use GPS</>}
                </button>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", flex: 1, textAlign: "center" }}>or drag pin on map 👆</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: "24px", padding: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>Select City & Ward</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "8px" }}>City</label>
                  <select className="select" value={city} onChange={(e) => setCity(e.target.value)} style={{ width: "100%" }}>
                    <option value="" disabled>Select city</option>
                    {Object.keys(CITIES_AND_WARDS).sort().map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "8px" }}>Ward</label>
                  <select className="select" value={ward} onChange={(e) => setWard(e.target.value)} disabled={!city} style={{ width: "100%" }}>
                    <option value="" disabled>{city ? "Select ward" : "Select city first"}</option>
                    {(CITIES_AND_WARDS[city] || []).map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <motion.button
              {...buttonPress}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: "16px", height: "52px", fontSize: "16px" }}
              onClick={() => handleSetStep(3)}
              disabled={!location || !city || !ward}
            >
                  Next: Review <i className="ti ti-arrow-right" style={{ marginLeft: "4px" }} />
                </motion.button>
              </motion.div>
            )}

            {/* ── Step 3: Review & Submit ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={{
                  initial: (d) => ({ opacity: 0, x: d * 40 }),
                  animate: { opacity: 1, x: 0 },
                  exit: (d) => ({ opacity: 0, x: d * -40 })
                }}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
            <div className="card" style={{ display: "flex", gap: "20px", marginBottom: "24px", padding: "20px" }}>
              {photoUrl && (
                <div style={{
                  width: "100px", height: "100px", borderRadius: "12px",
                  backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0
                }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "4px" }}>Location</div>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: "12px" }}>{address}</div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "4px" }}>City & Ward</div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>{city}, {ward}</div>
                {description && (
                  <>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "4px" }}>Description</div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {description}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* AI pipeline preview */}
            <div style={{ background: "#111", borderRadius: "16px", padding: "24px", marginBottom: "32px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#666", textTransform: "uppercase", marginBottom: "20px" }}>WHAT HAPPENS NEXT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { icon: "ti-scan-eye", text: "Cloud Vision analyzes your photo", color: "var(--blue)" },
                  { icon: "ti-cpu", text: "Gemini AI classifies & prioritizes", color: "var(--orange)" },
                  { icon: "ti-map-search", text: "Duplicate check within 100m radius", color: "var(--amber)" },
                  { icon: "ti-file-invoice", text: "Auto-generates department work order", color: "var(--green)" },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ color: s.color, fontSize: "20px" }}><i className={`ti ${s.icon}`} /></div>
                    <span style={{ fontSize: "14px", color: "#ddd" }}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px", color: "var(--orange)", fontWeight: 700, fontSize: "15px", gap: "6px" }}>
              <i className="ti ti-star" /> +20 XP for reporting
            </div>

            <motion.button
              {...buttonPress}
              className="btn btn-primary btn-full btn-lg"
              style={{ height: "56px", fontSize: "16px" }}
              onClick={handleSubmit}
              disabled={submitting}
              animate={{ opacity: submitting ? 0.7 : 1 }}
            >
              <AnimatePresence mode="wait">
                {submitting ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <i className="ti ti-loader" />
                    </motion.div>
                    Uploading...
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Submit Report <i className="ti ti-arrow-right" style={{ marginLeft: "4px" }} />
                  </motion.span>
                )}
              </AnimatePresence>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
