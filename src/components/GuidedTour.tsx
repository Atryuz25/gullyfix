"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const TOUR_STEPS = [
  {
    target: "center",
    title: "Welcome to GullyFix",
    content: "The first agentic civic accountability platform. Let's take a quick tour of your new dashboard.",
    position: "center",
  },
  {
    target: ".lp-section:first-child",
    title: "Ward Health Score",
    content: "This live score updates based on how fast your local department is resolving issues. Keep it green!",
    position: "right",
  },
  {
    target: ".acc-block",
    title: "Accountability Index",
    content: "We track the truth. If a department fakes a resolution, the index drops and the issue is marked as a 'Ghost'.",
    position: "right",
  },
  {
    target: ".map-controls",
    title: "Interactive Layers",
    content: "Switch between standard pins, heatmaps, and the Ghost layer to spot disputed issues around you.",
    position: "bottom",
  },
  {
    target: ".right-panel",
    title: "AI Trace Terminal",
    content: "Select any issue to see exactly how our AI verified the photo, classified the priority, and routed it to the correct department.",
    position: "left",
  },
];

export function GuidedTour() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Only show if not previously completed
    if (!localStorage.getItem("gullyfix_tour_done")) {
      const timer = setTimeout(() => setShow(true), 1500); // Wait for dashboard to load
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setShow(false);
    localStorage.setItem("gullyfix_tour_done", "true");
  };

  if (!show) return null;

  const current = TOUR_STEPS[step];

  // Helper to position tooltip based on target
  // In a real app we'd use getBoundingClientRect, but for a simple overlay we can use fixed positioning 
  // or a full screen overlay with a highlight box. We'll do a simple centered modal for step 0 
  // and fixed floating cards for the rest, roughly positioned.

  const getStyleForStep = (idx: number): React.CSSProperties => {
    if (idx === 0) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    if (idx === 1) return { top: "140px", left: "340px" }; // Next to Ward Health
    if (idx === 2) return { top: "340px", left: "340px" }; // Next to Accountability
    if (idx === 3) return { top: "100px", left: "50%", transform: "translateX(-50%)" }; // Below map controls
    if (idx === 4) return { top: "200px", right: "300px" }; // Next to right panel
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
      {/* Semi-transparent backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", pointerEvents: "auto", transition: "opacity 0.3s" }} onClick={handleClose} />
      
      {/* Tooltip Card */}
      <div 
        className="card animate-fade-in"
        style={{ 
          position: "absolute", 
          ...getStyleForStep(step),
          width: "320px", 
          padding: "24px",
          pointerEvents: "auto",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
          border: "2px solid var(--orange)",
          zIndex: 10000,
          transition: "top 0.4s cubic-bezier(0.4, 0, 0.2, 1), left 0.4s cubic-bezier(0.4, 0, 0.2, 1), right 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--orange)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Step {step + 1} of {TOUR_STEPS.length}
          </div>
          <button onClick={handleClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
            <i className="ti ti-x" style={{ fontSize: "16px" }} />
          </button>
        </div>
        
        <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          {current.title}
        </h3>
        
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>
          {current.content}
        </p>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {TOUR_STEPS.map((_, i) => (
              <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: i === step ? "var(--orange)" : "var(--border-light)", transition: "background 0.3s" }} />
            ))}
          </div>
          
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleNext}
          >
            {step === TOUR_STEPS.length - 1 ? "Get Started" : "Next"} <i className={`ti ${step === TOUR_STEPS.length - 1 ? "ti-check" : "ti-arrow-right"}`} style={{ marginLeft: "4px" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
