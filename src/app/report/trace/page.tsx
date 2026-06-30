"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Issue } from "@/lib/types";
import Link from "next/link";
import { Suspense } from "react";

function getCategoryIcon(category: string) {
  switch (category) {
    case "road_damage": return "ti-road";
    case "water_leakage": return "ti-droplet";
    case "streetlight": return "ti-bulb";
    case "waste": return "ti-trash";
    default: return "ti-alert-circle";
  }
}

function AnimatedXP({ targetXP }: { targetXP: number }) {
  const [xp, setXp] = useState(0);
  
  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setXp(current);
      if (current >= targetXP) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [targetXP]);

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px", color: "var(--orange)", fontWeight: 700, fontSize: "16px", gap: "6px" }}>
      <i className="ti ti-star" /> +{xp} XP earned!
    </div>
  );
}

const STEPS = [
  {
    id: 1,
    label: "Reading your photo",
    icon: "ti-scan-eye",
    color: "var(--blue)",
    getResult: (issue: Issue) => issue.photoAltText || "Vision analysis complete",
  },
  {
    id: 2,
    label: "Classifying issue",
    icon: "ti-cpu",
    color: "var(--orange)",
    getResult: (issue: Issue) => `${issue.category?.replace("_", " ")} · Priority ${issue.priorityScore}/100`,
  },
  {
    id: 3,
    label: "Checking nearby reports",
    icon: "ti-map-search",
    color: "var(--amber)",
    getResult: (issue: Issue) => issue.mergedIntoId
      ? `Merged with #${issue.mergedIntoId.slice(-6).toUpperCase()}`
      : "No duplicates found within 100m",
  },
  {
    id: 4,
    label: "Routing to department",
    icon: "ti-file-invoice",
    color: "var(--green)",
    getResult: (issue: Issue) => issue.department || "Department routing complete",
  },
];

function TraceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issueId = searchParams.get("id");

  const [issue, setIssue] = useState<Issue | null>(null);
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [revealingDone, setRevealingDone] = useState(false);
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    if (!issueId) {
      router.push("/");
      return;
    }

    const unsub = onSnapshot(doc(db, "issues", issueId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Issue;
        setIssue(data);

        if (data.status !== "pending_triage" && !revealingDone) {
          setRevealingDone(true);
          // Staggered step reveal
          setTimeout(() => setVisibleSteps([1]), 400);
          setTimeout(() => setVisibleSteps([1, 2]), 1800);
          setTimeout(() => setVisibleSteps([1, 2, 3]), 3200);
          setTimeout(() => {
            setVisibleSteps([1, 2, 3, 4]);
            setTimeout(() => setDone(true), 800);
          }, 4600);
        }
      }
    });

    return () => unsub();
  }, [issueId, router, revealingDone]);

  // Typewriter for AI reasoning
  useEffect(() => {
    if (!done || !issue?.aiReasoning) return;
    let i = 0;
    const full = issue.aiReasoning;
    const interval = setInterval(() => {
      if (i <= full.length) {
        setTypedText(full.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 18);
    return () => clearInterval(interval);
  }, [done, issue?.aiReasoning]);

  if (!issue) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "40px", color: "var(--orange)", marginBottom: "16px" }}><i className="ti ti-loader animate-pulse" /></div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Connecting to agent...</div>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Your report is being queued for AI triage</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "24px", background: "var(--bg-page)" }}>
      <div style={{ maxWidth: "520px", margin: "40px auto 0", width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {!done ? "AI is analyzing your report" : "Analysis complete"}
          </div>
          {!done && (
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--orange)", animation: "pulse 1.5s infinite", flexShrink: 0 }} />
          )}
          {done && <i className="ti ti-check" style={{ fontSize: "28px", color: "var(--green)" }} />}
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "40px" }}>
          {STEPS.map((step, idx) => {
            const isVisible = visibleSteps.includes(step.id);
            const isLast = step.id === 4;
            return (
              <div
                key={step.id}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                  paddingBottom: isLast ? 0 : "24px",
                  position: "relative",
                }}
              >
                {!isLast && (
                  <div style={{ position: "absolute", left: "15px", top: "32px", width: "2px", height: "24px", background: "var(--border-light)" }} />
                )}

                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                  background: isVisible ? step.color : "var(--white)",
                  border: `2px solid ${isVisible ? step.color : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isVisible ? "#fff" : "var(--text-tertiary)",
                  transition: "all 0.4s", zIndex: 1
                }}>
                  {isVisible ? <i className="ti ti-check" style={{ fontSize: "16px" }} /> : <span style={{ fontSize: "12px", fontWeight: 700 }}>{step.id}</span>}
                </div>

                <div style={{ flex: 1, paddingTop: "4px" }}>
                  <div style={{ fontSize: "15px", fontWeight: isVisible ? 600 : 500, color: isVisible ? "var(--text-primary)" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <i className={`ti ${step.icon}`} style={{ color: isVisible ? step.color : "inherit", fontSize: "18px" }} /> {step.label}
                  </div>
                  {isVisible && issue && (
                    <div className="animate-fade-in" style={{ marginTop: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)", textTransform: "uppercase", background: "var(--white)", padding: "4px 8px", borderRadius: "6px", display: "inline-block", border: "1px solid var(--border)" }}>
                      {step.getResult(issue)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result Card */}
        {done && (
          <div className="card animate-fade-in" style={{ padding: "24px", marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--orange-light)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                  <i className={`ti ${getCategoryIcon(issue.category || "uncategorized")}`} />
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{(issue.category || "uncategorized").replace("_", " ")}</div>
              </div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {issue.aiConfidence !== undefined ? Math.round(issue.aiConfidence * 100) : "--"}% Confidence
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px" }}>
                  <span>Priority Score</span>
                  <span style={{ color: (issue.priorityScore || 0) >= 70 ? "var(--red)" : (issue.priorityScore || 0) >= 40 ? "var(--amber)" : "var(--green)" }}>{issue.priorityScore !== undefined ? issue.priorityScore : "--"}/100</span>
                </div>
                <div style={{ height: "6px", background: "var(--bg-page)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${issue.priorityScore || 0}%`, background: (issue.priorityScore || 0) >= 70 ? "var(--red)" : (issue.priorityScore || 0) >= 40 ? "var(--amber)" : "var(--green)" }} />
                </div>
            </div>

            {issue.mergedIntoId && (
              <div style={{ background: "var(--amber-light)", color: "var(--amber-dark)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textAlign: "center", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <i className="ti ti-link" /> Merged into existing report #{issue.mergedIntoId.slice(-6).toUpperCase()}
              </div>
            )}

            <div style={{ height: "1px", background: "var(--border-light)", margin: "0 -24px 20px" }} />

            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>AI Triage Reasoning</div>
            <div style={{
              marginBottom: "20px", fontSize: "13px", lineHeight: 1.6, color: "var(--orange)", fontFamily: "var(--font-mono, monospace)",
              background: "#111", padding: "16px", borderRadius: "12px", boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)"
            }}>
              {typedText}<span className="animate-pulse" style={{ display: typedText.length < (issue.aiReasoning?.length || 0) ? "inline" : "none" }}>|</span>
            </div>

            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Department Action Plan</div>
            <ul style={{ paddingLeft: "16px", color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
              {(issue.resolutionSteps || []).map((step, idx) => (
                <li key={idx} style={{ marginBottom: "6px" }}>{step}</li>
              ))}
            </ul>
          </div>
        )}

        {/* XP + CTAs */}
        {done && (
          <div className="animate-fade-in" style={{ textAlign: "center", paddingBottom: "40px" }}>
            <AnimatedXP targetXP={20} />
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Link href={`/issue/${issueId}`}>
                <button className="btn btn-primary btn-full btn-lg" style={{ height: "52px" }}>Track this issue <i className="ti ti-arrow-right" style={{ marginLeft: "4px" }} /></button>
              </Link>
              <div style={{ display: "flex", gap: "12px" }}>
                <Link href="/" style={{ flex: 1 }}>
                  <button className="btn btn-secondary btn-full">View on map</button>
                </Link>
                <Link href="/report" style={{ flex: 1 }}>
                  <button className="btn btn-ghost btn-full">Report another</button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TracePage() {
  return (
    <Suspense fallback={<div style={{ padding: "24px", textAlign: "center" }}>Loading trace...</div>}>
      <TraceContent />
    </Suspense>
  );
}
