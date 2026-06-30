"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { CITIES_AND_WARDS, getWardId } from "@/lib/ward-equity";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, userDoc, isOnboarded, loading: authLoading } = useAuth();
  
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [ward, setWard] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user) {
      if (isOnboarded) {
        router.push("/");
      } else if (userDoc?.onboardingStatus?.includes("profile_set")) {
        router.push("/onboarding/intro");
      }
    }
  }, [user, isOnboarded, userDoc, authLoading, router]);

  // Set default display name from Google
  useEffect(() => {
    if (user && user.displayName && !displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]); // eslint-disable-line

  useEffect(() => {
    setWard("");
  }, [city]);

  const availableWards = useMemo(() => {
    return city ? CITIES_AND_WARDS[city] || [] : [];
  }, [city]);

  const handleSetup = async () => {
    if (!user || !displayName || !city || !ward) return;
    
    try {
      setIsSubmitting(true);
      
      const wId = getWardId(city, ward);
      
      // 1. Write Data
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        isAdmin: false,
        city: city,
        wardId: wId,
        wardName: ward,
        badges: ["first_login"],
        lastVerifyAt: null,
        onboardingStatus: ["profile_set"],
        createdAt: serverTimestamp()
      });
      
      await setDoc(doc(db, "public_profiles", user.uid), {
        uid: user.uid,
        displayName: displayName,
        photoURL: user.photoURL || "",
        xpPoints: 20,
        level: 1,
        reportsCount: 0,
        verifyCount: 0,
        resolvedCount: 0,
        city: city,
        wardId: wId,
        wardName: ward
      });

      // State transition is handled by useEffect when userDoc updates
      
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center", background: "var(--bg-page)" }}>
        <div style={{ color: "var(--orange)", fontSize: "24px" }}><i className="ti ti-loader animate-pulse" /></div>
      </div>
    );
  }

  return (
    <div className="page" style={{ alignItems: "center", justifyContent: "center", padding: "20px", background: "var(--bg-page)" }}>
      
      <div className="card animate-fade-in" style={{ maxWidth: "440px", width: "100%", padding: "32px", boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}>
          <div style={{ width: "48px", height: "48px", background: "var(--orange-light)", color: "var(--orange)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "20px" }}>
            <i className="ti ti-user-circle" />
          </div>
          
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "8px" }}>
            Create Your Profile
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "32px", lineHeight: 1.5 }}>
            Tell us a little bit about yourself so we can tailor the civic grid to your neighborhood.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "32px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>What should we call you?</label>
              <input 
                type="text" 
                className="input" 
                placeholder="Enter display name" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Which city do you live in?</label>
              <select className="select" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="" disabled>Select your city</option>
                {Object.keys(CITIES_AND_WARDS).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Which ward?</label>
              <select className="select" value={ward} onChange={(e) => setWard(e.target.value)} disabled={!city}>
                <option value="" disabled>{city ? "Select your ward" : "Select a city first"}</option>
                {availableWards.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            className="btn btn-primary btn-full btn-lg" 
            disabled={!displayName || !city || !ward || isSubmitting}
            onClick={handleSetup}
          >
            {isSubmitting ? <><i className="ti ti-loader animate-pulse" /> Saving...</> : "Complete Profile"}
          </button>
      </div>
    </div>
  );
}
