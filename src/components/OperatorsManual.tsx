"use client";

import React, { useState } from "react";
import { TopNav } from "@/components/Navigation";

interface OperatorsManualProps {
  isGuideMode: boolean; // if false, shows onboarding steps
  onboardingStatus?: string[];
  onStartMission?: () => void;
  isBriefing?: boolean;
  briefingText?: string;
}

function Accordion({ title, icon, children }: { title: string, icon: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "16px", overflow: "hidden" }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: "100%", textAlign: "left", padding: "16px 20px", 
          display: "flex", justifyContent: "space-between", 
          alignItems: "center", background: isOpen ? "var(--bg-hover)" : "var(--white)", border: "none", 
          cursor: "pointer", transition: "background 0.15s"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
          <i className={`ti ${icon}`} style={{ color: "var(--orange)", fontSize: "20px" }} />
          {title}
        </div>
        <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ color: "var(--text-tertiary)" }} />
      </button>
      {isOpen && (
        <div className="animate-fade-in" style={{ padding: "0 20px 20px", color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "14px" }}>
          <div style={{ height: "1px", background: "var(--border-light)", margin: "0 0 16px 0" }} />
          {children}
        </div>
      )}
    </div>
  );
}

export default function OperatorsManual({ 
  isGuideMode, 
  onboardingStatus = [], 
  onStartMission,
  isBriefing = false,
  briefingText = ""
}: OperatorsManualProps) {
  
  const hasProfile = onboardingStatus.includes("profile_set");
  const hasBriefing = onboardingStatus.includes("ai_briefed");
  const hasMission = onboardingStatus.includes("mission_complete");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      {isGuideMode && <TopNav />}
      
      <div style={{ maxWidth: "680px", margin: "0 auto", width: "100%", padding: "40px 20px 140px" }}>
        
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--orange-light)", color: "var(--orange)", padding: "4px 12px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "16px" }}>
            <i className="ti ti-book" /> Document Ref: GF-001
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "8px" }}>
            How it works
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", marginBottom: "32px" }}>
            Report issues, earn XP, and hold the city accountable. Here's a quick guide to understanding the GullyFix platform.
          </p>
        </div>

        {/* Onboarding Tracker */}
        {!isGuideMode && (
          <div className="card" style={{ marginBottom: "32px", padding: "24px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "20px" }}>
              Initialization Protocol
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { id: "profile", label: "Local Sensor Calibration", done: hasProfile },
                { id: "briefing", label: "Network Synchronization", done: hasBriefing },
                { id: "mission", label: "Validation Test", done: hasMission }
              ].map((step, i) => (
                <div key={step.id} style={{ display: "flex", gap: "14px", alignItems: "center", opacity: step.done ? 1 : 0.6 }}>
                  <div style={{ 
                    width: "28px", height: "28px", borderRadius: "50%", 
                    background: step.done ? "var(--green)" : "var(--bg-page)", 
                    border: step.done ? "none" : "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    transition: "all 0.3s"
                  }}>
                    {step.done ? <i className="ti ti-check" style={{ fontSize: "16px" }} /> : <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: 600 }}>{i + 1}</span>}
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: step.done ? 600 : 500, color: step.done ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Content */}
        <Accordion title="The Distributed Sensor Network" icon="ti-network">
          GullyFix is not just an issue reporting app. It is a Municipal Evidence Generation Platform. Citizens act as active sensor nodes in the grid, capturing hyper-local infrastructure data to hold departments accountable.
        </Accordion>

        <Accordion title="Agentic Verification Pipeline" icon="ti-cpu">
          <p style={{ marginBottom: "16px" }}>When data is captured, it passes through our autonomous multi-modal verification pipeline.</p>
          
          <div style={{ background: "var(--bg-page)", padding: "20px", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { id: 1, text: "Sensor Node (You) uploads raw visual data", icon: "ti-camera", color: "var(--blue)" },
              { id: 2, text: "Cloud Vision identifies visual defects", icon: "ti-scan-eye", color: "var(--orange)" },
              { id: 3, text: "Gemini AI cross-references jurisdictions", icon: "ti-map-pin", color: "var(--amber)" },
              { id: 4, text: "Autonomous Work-Order is generated", icon: "ti-file-invoice", color: "var(--green)" }
            ].map((step, i) => (
              <React.Fragment key={step.id}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--white)", border: `1px solid var(--border)`, display: "flex", alignItems: "center", justifyContent: "center", color: step.color }}>
                    <i className={`ti ${step.icon}`} style={{ fontSize: "18px" }} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{step.text}</div>
                </div>
                {i < 3 && <div style={{ borderLeft: "2px dashed var(--border)", height: "20px", marginLeft: "17px" }} />}
              </React.Fragment>
            ))}
          </div>
        </Accordion>

        <Accordion title="Civic Impact Score" icon="ti-star">
          Nodes are evaluated based on their Data Auditor Accuracy. High-accuracy nodes are granted "Trusted" status, bypassing manual peer-review loops.
          <br/><br/>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="badge badge-orange">+20 XP</span> per verified anomaly
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="badge badge-orange">+50 XP</span> per peer audit
            </div>
          </div>
        </Accordion>

      </div>

      {/* Sticky Bottom CTA for Onboarding */}
      {!isGuideMode && (
        <div style={{ 
          position: "fixed", bottom: 0, left: 0, right: 0, 
          background: "var(--white)", padding: "24px", 
          borderTop: "1px solid var(--border)", 
          boxShadow: "0 -8px 32px rgba(0,0,0,0.05)",
          display: "flex", flexDirection: "column", alignItems: "center", zIndex: 100
        }}>
          {isBriefing ? (
            <div style={{ width: "100%", maxWidth: "640px" }}>
              <div style={{ 
                fontFamily: "var(--font-mono, monospace)", 
                color: "var(--orange)", 
                fontSize: "13px", 
                whiteSpace: "pre-wrap", 
                lineHeight: 1.6,
                background: "#111",
                padding: "20px",
                borderRadius: "12px",
                textAlign: "left",
                minHeight: "100px",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)"
              }}>
                {briefingText}
                <span className="animate-pulse" style={{ display: "inline-block", width: "6px", height: "14px", background: "var(--orange)", marginLeft: "4px", verticalAlign: "middle" }} />
              </div>
            </div>
          ) : (
            <button 
              className={`btn ${hasBriefing ? "btn-primary btn-pulse" : "btn-primary"} btn-lg`}
              style={{ width: "100%", maxWidth: "480px", height: "52px", fontSize: "15px" }}
              onClick={onStartMission}
            >
              {hasBriefing ? (
                <><i className="ti ti-rocket" /> EXECUTE VALIDATION TEST</>
              ) : (
                <><i className="ti ti-satellite" /> SYNCHRONIZE NETWORK</>
              )}
            </button>
          )}
        </div>
      )}

    </div>
  );
}
