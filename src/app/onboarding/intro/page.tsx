"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OperatorsManual from "@/components/OperatorsManual";
import { useAuth } from "@/lib/AuthContext";
import { doc, setDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function IntroPage() {
  const router = useRouter();
  const { user, userDoc } = useAuth();
  
  const [isBriefing, setIsBriefing] = useState(false);
  const [briefingText, setBriefingText] = useState("");

  const handleStartMission = async () => {
    if (!user || !userDoc) return;
    
    const hasBriefing = userDoc.onboardingStatus?.includes("ai_briefed");
    
    if (hasBriefing) {
      // User already briefed, execute validation test
      router.push("/");
    } else {
      // Run briefing sequence
      setIsBriefing(true);
      
      const fullText = `Network synchronized.\nInitializing Civic-Link Agent for your sector...\nCalibrating sensors...`;
      
      let currentText = "";
      const chars = fullText.split("");
      for (let i = 0; i < chars.length; i++) {
        currentText += chars[i];
        setBriefingText(currentText);
        await new Promise(r => setTimeout(r, 40));
      }

      // Fetch First Mission
      let missionId = "";
      try {
        const q = query(
          collection(db, "issues"), 
          where("wardId", "==", userDoc.wardId || "w1"), 
          where("status", "==", "open"), 
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          missionId = snap.docs[0].id;
          
          await setDoc(doc(db, "public_profiles", user.uid), {
            currentMission: missionId
          }, { merge: true });
        }
      } catch (err) {
        console.error("Failed to fetch mission", err);
      }

      // Update onboarding status
      await setDoc(doc(db, "users", user.uid), {
        onboardingStatus: [...(userDoc.onboardingStatus || []), "ai_briefed"]
      }, { merge: true });

      await new Promise(r => setTimeout(r, 1000));
      setIsBriefing(false);
    }
  };

  return (
    <OperatorsManual 
      isGuideMode={false} 
      onboardingStatus={userDoc?.onboardingStatus || []}
      onStartMission={handleStartMission}
      isBriefing={isBriefing}
      briefingText={briefingText}
    />
  );
}
