"use client";

import React, { useEffect, useState, useRef } from "react";
import { collection, query, onSnapshot, orderBy, limit, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Issue, Ward, Prediction } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { TopNav, BottomTabs } from "@/components/Navigation";
import MapWrapper from "@/components/Map";
import { GuidedTour } from "@/components/GuidedTour";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runTransaction, doc as firestoreDoc } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { CITIES_AND_WARDS } from "@/lib/ward-equity";
import { Group, Panel, Separator, PanelImperativeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "@/components/CountUp";
import { slideInLeft, slideInRight, staggerContainer, staggerItem, springScale, buttonPress, fadeUp } from "@/lib/animations";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: any): string {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function getCategoryMeta(category: string) {
  switch (category) {
    case "road_damage":  return { icon: "ti-road",    cls: "road",  label: "Road" };
    case "water_leakage": return { icon: "ti-droplet", cls: "water", label: "Water" };
    case "streetlight":   return { icon: "ti-bulb",   cls: "light", label: "Light" };
    case "waste":         return { icon: "ti-trash",   cls: "waste", label: "Waste" };
    default:              return { icon: "ti-alert-circle", cls: "default", label: "Issue" };
  }
}

function getStatusTag(status: string) {
  switch (status) {
    case "disputed":           return <span className="tag tag-disputed">Disputed</span>;
    case "pending_verification": return <span className="tag tag-pending">Pending verification</span>;
    case "open":               return <span className="tag tag-open">Open</span>;
    case "in_progress":        return <span className="tag tag-progress">In progress</span>;
    case "resolved":           return <span className="tag tag-resolved">Verified resolved</span>;
    default:                   return <span className="tag tag-open">{status}</span>;
  }
}

function getPriorityClass(score: number) {
  if (score >= 70) return "p-high";
  if (score >= 40) return "p-med";
  return "p-low";
}

// ─── Ward Health SVG Ring ─────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#34C759" : score >= 50 ? "#FF9F0A" : "#FF3B30";
  const label = score >= 75 ? "Good zone" : score >= 50 ? "Amber zone" : "Critical zone";

  return (
    <div className="health-score-row">
      <div className="hs-ring">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#F0F0F0" strokeWidth="5" />
          <motion.circle
            cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            strokeLinecap="round" transform="rotate(-90 32 32)"
          />
        </svg>
        <div className="hs-inner">
          <span className="hs-num">{Math.round(score)}</span>
          <span className="hs-of">/100</span>
        </div>
      </div>
      <div>
        <div className="hs-title">{label}</div>
        <div className="hs-sub">Ward health score</div>
      </div>
    </div>
  );
}

// ─── Accountability Index Card ────────────────────────────────────────────────

function AccountabilityCard({ issues }: { issues: Issue[] }) {
  const resolved = issues.filter(i => i.status === "resolved").length;
  const disputed = issues.filter(i => i.status === "disputed").length;
  const total = resolved + disputed;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 100;
  const isDown = disputed > 0;

  const bars = [14, 22, 30, 24, 18, 12, 8].map((h, i) => ({
    h,
    color: i === 6 ? (isDown ? "#FF3B30" : "#FF5B23") : i === 5 ? "#FF5B23" : "#333",
  }));

  return (
    <div className="acc-block">
      <div className="acc-eyebrow">Accountability index</div>
      <div className="acc-row">
        <div>
          <div className="acc-num"><CountUp value={pct} />%</div>
          {isDown ? (
            <div className="acc-change">
              <i className="ti ti-trending-down" aria-hidden="true" />
              {disputed} fake closure{disputed !== 1 ? "s" : ""}
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "#34C759", marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}>
              <i className="ti ti-trending-up" /> No disputes
            </div>
          )}
        </div>
        <div className="acc-bars">
          {bars.map((b, i) => (
            <div key={i} className="acc-bar" style={{ height: `${b.h}px`, background: b.color }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Right Panel — Issue Detail ───────────────────────────────────────────────

function RightPanel({ issue, onVerify, verifying, user }: {
  issue: Issue | null;
  onVerify: () => void;
  verifying: boolean;
  user: any;
}) {
  const [slaTime, setSlaTime] = useState("");
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  const [uploadingDispute, setUploadingDispute] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!issue?.slaDeadline || issue.slaBreached || issue.status === "resolved") {
      setSlaTime("");
      return;
    }
    const interval = setInterval(() => {
      if (!issue.slaDeadline) return;
      const ms = issue.slaDeadline.toDate().getTime() - Date.now();
      if (ms <= 0) {
        setSlaTime("SLA Breached");
        return;
      }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setSlaTime(`${String(d).padStart(2,'0')}d : ${String(h).padStart(2,'0')}h : ${String(m).padStart(2,'0')}m : ${String(s).padStart(2,'0')}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [issue]);

  const handleDisputeSubmit = async () => {
    if (!disputeFile || !issue || !user) return;
    setUploadingDispute(true);
    try {
      const downloadURL = await uploadToCloudinary(disputeFile);

      const issueRef = firestoreDoc(db, "issues", issue.id);
      await runTransaction(db, async (t) => {
        t.update(issueRef, {
          status: "disputed",
          disputePhotoUrl: downloadURL,
          disputeCount: (issue.disputeCount || 0) + 1
        });
      });
      setDisputeFile(null);

      // Trigger background 3-Way AI Audit
      fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: issue.id,
          after: {
            ...issue,
            status: "disputed",
            disputePhotoUrl: downloadURL,
          }
        }),
      }).catch(console.error);

    } catch (e) {
      console.error("Dispute upload failed", e);
    } finally {
      setUploadingDispute(false);
    }
  };
  if (!issue) {
    return (
      <AnimatePresence mode="wait">
        <motion.div 
          key="empty"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="right-panel" 
          style={{ alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", gap: "8px", height: "100%" }}
        >
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <i className="ti ti-map-pin" style={{ fontSize: "40px", color: "var(--border)", display: "block", marginBottom: "12px" }} />
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>Select an issue</div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>Click a pin on the map or an item in the list to see the AI trace and timeline.</div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const catMeta = getCategoryMeta(issue.category);
  const hasVerified = issue.verifiedBy?.includes(user?.uid || "");
  const isOwner = user?.uid === issue.reportedBy;
  const canVerify = user && !isOwner && !hasVerified && !["resolved", "merged"].includes(issue.status);

  // Build trace steps
  const traceSteps: { text: string; cls: "done" | "warn" | "err" | null; icon: string }[] = [
    { text: "Image scanned via Cloud Vision", cls: "done", icon: "ti-check" },
    { text: `Routed → ${issue.department || "dept."}`, cls: "done", icon: "ti-check" },
    issue.status === "pending_verification" || issue.status === "disputed" || issue.status === "resolved"
      ? { text: "Admin marked resolved", cls: "done", icon: "ti-check" }
      : { text: "Awaiting admin action", cls: null, icon: "ti-clock" },
    issue.status === "disputed"
      ? { text: `${issue.disputeCount || 1} citizen${(issue.disputeCount || 1) !== 1 ? "s" : ""} disputed`, cls: "err", icon: "ti-x" }
      : null,
    issue.status === "pending_verification"
      ? { text: "Awaiting citizen verification...", cls: "warn", icon: "ti-loader" }
      : null,
    issue.slaBreached ? { text: "SLA Breach — escalated to AEE", cls: "err", icon: "ti-alert-triangle" } : null,
  ].filter(Boolean) as any[];

  // Build timeline
  const tlSteps = [
    { label: "Reported", time: formatTimeAgo(issue.createdAt), status: "done" },
    { label: `AI triaged · P${issue.priorityScore}`, time: formatTimeAgo(issue.createdAt), status: issue.status !== "pending_triage" ? "done" : "wait" },
    { label: `Assigned to ${issue.department?.split(" ")[0] || "dept."}`, time: "auto-assigned", status: ["in_progress", "pending_verification", "disputed", "resolved"].includes(issue.status) ? "done" : "wait" },
    issue.status === "disputed"
      ? { label: "Resolution disputed", time: "Escalated to AEE", status: "error" }
      : { label: "Verified resolved", time: issue.resolvedAt ? formatTimeAgo(issue.resolvedAt) : "Pending", status: issue.status === "resolved" ? "done" : "wait" },
  ];

  return (
    <AnimatePresence mode="wait">
    <motion.div 
      className="right-panel"
      key={issue.id}
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="rp-header">
        <div className="rp-title">
          {issue.aiReasoning?.split(".")[0] || (issue.category || "uncategorized").replace("_", " ")}
        </div>
        <div className="rp-sub">
          {issue.department || "Unassigned"} · {issue.ward || "Unknown Ward"} · {formatTimeAgo(issue.createdAt)}
        </div>
      </div>

      {/* Photo + tags */}
      <div style={{ padding: "12px" }}>
        <div className="rp-photo">
          {issue.photoURL
            ? <img src={issue.photoURL} alt={issue.photoAltText || "Issue photo"} />
            : <i className="ti ti-photo" style={{ fontSize: "28px" }} />
          }
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {getStatusTag(issue.status)}
          <span className={`badge ${issue.priorityScore >= 70 ? "badge-red" : issue.priorityScore >= 40 ? "badge-amber" : "badge-green"}`}>
            Priority {issue.priorityScore}
          </span>
          {issue.slaBreached && <span className="badge badge-red">SLA Breached</span>}
          {slaTime && !issue.slaBreached && issue.status !== "resolved" && (
            <span style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 700, color: "var(--red)", background: "var(--red-light)", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--red-mid)" }}>
              <i className="ti ti-clock-exclamation" style={{ marginRight: "4px" }} />
              {slaTime}
            </span>
          )}
        </div>
      </div>

      {/* AI Trace Terminal */}
      <div style={{ padding: "0 12px 12px" }}>
        <div className="trace-card">
          <div className="trace-label">AI trace</div>
          {traceSteps.map((step, i) => (
            <div key={i} className={`trace-line ${step.cls || ""}`}>
              <i className={`ti ${step.icon}`} style={{ fontSize: "11px" }} aria-hidden="true" />
              {step.text}
              {step.cls === "warn" && <span className="trace-cursor" />}
            </div>
          ))}
        </div>
      </div>

      {/* Dispute Panel */}
      {(issue.status === "disputed" || issue.disputeReasoning) && (
        <div style={{ padding: "0 12px 12px" }}>
          <div className="dispute-panel">
            <div className="dp-title">
              <i className="ti ti-shield-x" aria-hidden="true" />
              Resolution rejected
            </div>
            <div className="dp-body">
              AI 3-way comparison: original, admin resolution photo, citizen dispute photo:
            </div>
            <div className="dp-analysis">
              <b>Damage pattern still visible.</b>{" "}
              {issue.disputeReasoning
                ? issue.disputeReasoning.split("[DISPUTE VERIFICATION]").pop()?.trim().slice(0, 160) + "..."
                : "Crack depth and surface area unchanged from original report. Resolution claim rejected. Escalated to AEE."}
            </div>
          </div>
        </div>
      )}

      {/* Resolution Evidence */}
      {issue.resolutionPhotoUrl && (
        <div style={{ padding: "0 12px 12px" }}>
          <div className="lp-label">Admin Resolution Evidence</div>
          <img src={issue.resolutionPhotoUrl} alt="Resolution" style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px" }} />
        </div>
      )}

      {/* Dispute Flow */}
      {issue.status === "pending_verification" && issue.reportedBy === user?.uid && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ background: "var(--red-light)", border: "1px solid var(--red-mid)", borderRadius: "8px", padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--red)", marginBottom: "4px" }}>
              <i className="ti ti-alert-triangle" /> Resolution claim pending
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              The department has marked this issue as resolved. Is the hazard still present? Upload a photo to dispute this claim.
            </div>
            
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setDisputeFile(e.target.files[0]);
                }
              }} 
            />

            {!disputeFile ? (
              <button className="btn btn-secondary btn-full btn-sm" onClick={() => fileInputRef.current?.click()}>
                <i className="ti ti-camera" /> Upload proof photo
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--white)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "4px", background: "var(--bg-page)", backgroundImage: `url(${URL.createObjectURL(disputeFile)})`, backgroundSize: "cover" }} />
                  <div style={{ flex: 1, fontSize: "11px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{disputeFile.name}</div>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }} onClick={() => setDisputeFile(null)}>
                    <i className="ti ti-x" />
                  </button>
                </div>
                <button className="btn btn-primary btn-full btn-sm" onClick={handleDisputeSubmit} disabled={uploadingDispute} style={{ background: "var(--red)", color: "var(--white)", border: "none" }}>
                  {uploadingDispute ? <span className="spinner" style={{ width: "14px", height: "14px", border: "2px solid #fff", borderTopColor: "transparent" }} /> : "Submit Dispute"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ padding: "0 16px 12px" }}>
        <div className="lp-label" style={{ marginBottom: "10px" }}>Issue timeline</div>
        <div className="timeline">
          {tlSteps.map((step, i) => (
            <div key={i} className="tl-item">
              <div className={`tl-dot ${step.status}`}>
                <i className={`ti ${step.status === "done" ? "ti-check" : step.status === "error" ? "ti-alert-triangle" : "ti-clock"}`} style={{ fontSize: "10px" }} aria-hidden="true" />
              </div>
              <div className="tl-body">
                <div className="tl-name" style={step.status === "error" ? { color: "var(--red)" } : step.status === "wait" ? { color: "var(--text-disabled)" } : {}}>
                  {step.label}
                </div>
                <div className="tl-time">{step.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community verify */}
      <div className="community-row" style={{ marginTop: "auto" }}>
        <div className="cr-label">Community</div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="verify-btn"
          onClick={onVerify}
          disabled={!canVerify || verifying}
        >
          <i className="ti ti-eye" aria-hidden="true" />
          {hasVerified ? "You confirmed this" : isOwner ? "Your report" : "I've seen this issue too"}
          {(issue.verifyCount || 0) > 0 && (
            <span className="verify-count">{issue.verifyCount} confirmed</span>
          )}
        </motion.button>
        <div style={{ marginTop: "8px" }}>
          <Link href={`/issue/${issue.id}`}>
            <motion.button {...buttonPress} className="btn btn-secondary btn-full btn-sm" style={{ justifyContent: "center" }}>
              <i className="ti ti-external-link" /> Full details
            </motion.button>
          </Link>
        </div>
      </div>
    </motion.div>
    </AnimatePresence>
  );
}

// ─── Resize Handle ────────────────────────────────────────────────────────────

function CustomResizeHandle({ isLeft, isCollapsed, onToggle }: { isLeft: boolean, isCollapsed: boolean, onToggle: () => void }) {
  return (
    <Separator className="custom-resize-handle">
      <div className="crh-inner">
        <button className="crh-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }} title={isCollapsed ? "Expand panel" : "Collapse panel"}>
          <i className={`ti ${isLeft ? (isCollapsed ? "ti-chevron-right" : "ti-chevron-left") : (isCollapsed ? "ti-chevron-left" : "ti-chevron-right")}`} />
        </button>
      </div>
    </Separator>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardMapPage() {
  const { user, profile, userDoc, isOnboarded, loading, showToast } = useAuth();
  const router = useRouter();
  const missionId = userDoc?.currentMission;

  const [layer, setLayer] = useState<"pins" | "heat" | "predict" | "ghost">("pins");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [wardData, setWardData] = useState<Ward | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [activeCity, setActiveCity] = useState<string>("all");
  const [activeWard, setActiveWard] = useState<string>("all");

  const handlePinClick = React.useCallback((issue: Issue | null) => {
    setSelectedIssue(issue);
  }, []);
  const [verifying, setVerifying] = useState(false);
  const [showDisputeToast, setShowDisputeToast] = useState(false);
  const [mapTypeId, setMapTypeId] = useState<string>("roadmap");

  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const rightPanelRef = useRef<PanelImperativeHandle>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const toggleLeft = () => {
    const p = leftPanelRef.current;
    if (p) {
      if (p.isCollapsed()) p.expand();
      else p.collapse();
    }
  };
  
  const toggleRight = () => {
    const p = rightPanelRef.current;
    if (p) {
      if (p.isCollapsed()) p.expand();
      else p.collapse();
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/landing");
      } else if (!isOnboarded) {
        router.push("/onboarding");
      }
    }
  }, [user, isOnboarded, loading, router]);

  // Live issue stream
  useEffect(() => {
    const q = query(collection(db, "issues"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
      setIssues(all);
      // Show dispute toast if there are disputed issues
      const disputed = all.filter(i => i.status === "disputed");
      setShowDisputeToast(disputed.length > 0);
      // Auto-select demo issue or top disputed if none selected
      if (!selectedIssue) {
        const demoIssue = all.find(i => i.id === "demo-issue-perfect");
        if (demoIssue) setSelectedIssue(demoIssue);
        else if (disputed.length > 0) setSelectedIssue(disputed[0]);
      }
    });
    return () => unsub();
  }, []); // eslint-disable-line

  // Ward health stream
  useEffect(() => {
    const wardId = profile?.wardId;
    if (!wardId) return;
    const unsub = onSnapshot(doc(db, "wards", wardId), (snap) => {
      if (snap.exists()) {
        setWardData(snap.data() as Ward);
      } else {
        // Fallback if ward doc isn't created yet
        setWardData({
          id: wardId,
          ward: wardId.replace("_", " ").toUpperCase(),
          healthScore: 85,
          urgencyLevel: "normal",
          healthReasoning: "No recent anomalies detected.",
          avgResolutionDays: 2.1
        } as unknown as Ward);
      }
    });
    return () => unsub();
  }, [profile?.wardId]);

  // Predictions stream
  useEffect(() => {
    const q = query(collection(db, "predictions"));
    const unsub = onSnapshot(q, (snap) => {
      setPredictions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prediction)).filter(p => p.status === "active"));
    });
    return () => unsub();
  }, []);

  const handleVerify = async () => {
    if (!selectedIssue || !user || verifying) return;
    setVerifying(true);
    try {
      await runTransaction(db, async (t) => {
        const issueRef = firestoreDoc(db, "issues", selectedIssue.id);
        const profileRef = firestoreDoc(db, "public_profiles", user.uid);
        const userRef = firestoreDoc(db, "users", user.uid);
        const [issueDoc, profDoc] = await Promise.all([t.get(issueRef), t.get(profileRef)]);
        if (!issueDoc.exists()) throw new Error("Issue not found");
        const verifiedBy = issueDoc.data()?.verifiedBy || [];
        if (!verifiedBy.includes(user.uid)) {
          t.update(issueRef, { verifyCount: (issueDoc.data()?.verifyCount || 0) + 1, verifiedBy: [...verifiedBy, user.uid] });
        }
        t.update(profileRef, { xpPoints: (profDoc.data()?.xpPoints || 0) + 10, verifyCount: (profDoc.data()?.verifyCount || 0) + 1 });
        t.update(userRef, { currentMission: null });
      });
      showToast({ type: "success", message: "Verification recorded! +10 XP", xp: 10 });
    } catch {
      showToast({ type: "error", message: "Verification failed. Try again." });
    } finally {
      setVerifying(false);
    }
  };

  const displayIssues = issues.filter(i => {
    if (i.status === "pending_review" || i.status === "merged") return false;
    if (filterCat !== "all" && i.category !== filterCat) return false;
    if (activeCity !== "all" && i.city && i.city !== activeCity) return false;
    if (activeWard !== "all" && i.ward !== activeWard) return false;
    return true;
  });

  const disputedIssues = issues.filter(i => i.status === "disputed");
  const slaBreached = issues.filter(i => i.slaBreached);
  const resolved = issues.filter(i => i.status === "resolved");
  const wardHealth = wardData?.healthScore ?? null;
  const wardUrgency = wardData?.urgencyLevel ?? "low";
  const avgDays = wardData?.avgResolutionDays?.toFixed(1) ?? "–";

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "var(--bg-page)" }} />;
  }
  
  if (!loading && !user) {
    // Return null to prevent dashboard flash while the useEffect redirect kicks in
    return null;
  }

  return (
    <div className="page">
      <TopNav wardName={wardData?.ward || profile?.wardName} xp={profile?.xpPoints} />

      {/* Mission banner */}
      {missionId && (
        <div style={{ background: "var(--orange)", color: "#fff", padding: "10px 24px", textAlign: "center", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexShrink: 0 }}>
          <i className="ti ti-target" />
          MISSION ACTIVE: Locate and verify the flagged issue on the map to earn 50 XP
        </div>
      )}

      <div className="page-body">
        <Group 
          orientation="horizontal" 
          onLayoutChange={() => { window.dispatchEvent(new Event('resize')); }}
        >
          {/* ── LEFT PANEL ── */}
          <Panel 
            panelRef={leftPanelRef}
            defaultSize="320px" 
            minSize="250px" 
            maxSize="450px"
            collapsible 
            collapsedSize={0}
            onResize={(size) => setLeftCollapsed(Number(size) === 0)}
            className="left-panel-container"
          >
            <motion.div 
              className="left-panel"
              variants={slideInLeft}
              initial="initial"
              animate="animate"
            >

              {/* City/Ward Filter */}
              <div className="lp-section" style={{ paddingBottom: "12px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select 
                    className="select" 
                    value={activeCity} 
                    onChange={(e) => {
                      setActiveCity(e.target.value);
                      setActiveWard("all");
                    }} 
                    style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
                  >
                    <option value="all">All Cities</option>
                    {Object.keys(CITIES_AND_WARDS).sort().map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select 
                    className="select" 
                    value={activeWard} 
                    onChange={(e) => setActiveWard(e.target.value)} 
                    disabled={activeCity === "all"} 
                    style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
                  >
                    <option value="all">All Wards</option>
                    {(CITIES_AND_WARDS[activeCity] || []).map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ward Health */}
          <div className="lp-section">
            <div className="lp-label">Ward health</div>
            {wardHealth !== null
              ? <HealthRing score={wardHealth} />
              : <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Loading ward data...</div>
            }
            {wardHealth !== null && (
              <div className="mini-stats">
                <div className="ms">
                  <div className="ms-val red">{issues.filter(i => ["open", "in_progress"].includes(i.status)).length}</div>
                  <div className="ms-lbl">Open</div>
                </div>
                <div className="ms">
                  <div className="ms-val green">{avgDays}d</div>
                  <div className="ms-lbl">Avg fix</div>
                </div>
              </div>
            )}
          </div>

          {/* Accountability Index */}
          <div className="lp-section">
            <AccountabilityCard issues={issues} />
          </div>

          {/* Gemini AI Advisory */}
          {wardData?.healthReasoning && (
            <div className="lp-section">
              <div className="ai-banner">
                <div className="ai-dot" />
                <div className="ai-text">{wardData.healthReasoning}</div>
              </div>
            </div>
          )}

          {/* SLA Breach Alert */}
          {slaBreached.length > 0 && (
            <div className="lp-section">
              <div style={{ background: "var(--red-light)", border: "1px solid var(--red-mid)", borderRadius: "10px", padding: "10px 12px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <i className="ti ti-clock-exclamation" style={{ color: "var(--red)", fontSize: "16px", marginTop: "2px" }} />
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--red)" }}>{slaBreached.length} SLA breach{slaBreached.length !== 1 ? "es" : ""}</div>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>Issues past their deadline — escalated automatically</div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="lp-section">
            <div className="lp-label">Filter</div>
            <div className="filter-chips">
              {[
                { value: "all", label: "All" },
                { value: "road_damage", label: "Roads" },
                { value: "water_leakage", label: "Water" },
                { value: "streetlight", label: "Lights" },
                { value: "waste", label: "Waste" },
              ].map(f => (
                <motion.button
                  key={f.value}
                  className={`filter-chip ${filterCat === f.value ? "active" : ""}`}
                  onClick={() => setFilterCat(f.value)}
                  {...buttonPress}
                >
                  {f.label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Issue list */}
          <div className="issue-list">
            {displayIssues.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
                No issues found
              </div>
            ) : (
              <motion.div variants={staggerContainer} initial="initial" animate="animate">
                <AnimatePresence>
                  {displayIssues.map((issue, i) => {
                    const cat = getCategoryMeta(issue.category);
                    const slaDay = issue.slaDeadline?.toDate
                      ? Math.ceil((issue.slaDeadline.toDate().getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <motion.div
                        key={issue.id}
                        layout
                        variants={staggerItem}
                        {...springScale}
                        className={`issue-row ${selectedIssue?.id === issue.id ? "selected" : ""} ${issue.status === "disputed" ? "disputed" : ""} ${issue.slaBreached ? "sla-breach" : ""}`}
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <div className={`ii-icon ${cat.cls}`}>
                          <i className={`ti ${cat.icon}`} aria-hidden="true" />
                        </div>
                        <div className="ii-body">
                          <div className="ii-title">
                            {cat.label} · {issue.address?.split(",")[0] || issue.ward}
                          </div>
                          <div className="ii-meta">
                            {issue.department?.split(" ")[0]} · {formatTimeAgo(issue.createdAt)}
                            {issue.verifyCount > 0 ? ` · ${issue.verifyCount} confirmations` : ""}
                          </div>
                          <div className="ii-tags">
                            {getStatusTag(issue.status)}
                            {issue.slaBreached && <span className="tag tag-sla">SLA breached</span>}
                            {slaDay !== null && slaDay > 0 && !issue.slaBreached && (
                              <span className="tag tag-open">SLA day {Math.abs(slaDay)}</span>
                            )}
                          </div>
                        </div>
                        <span className={`ii-priority ${getPriorityClass(issue.priorityScore)}`}>
                          P{issue.priorityScore}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </motion.div>
        </Panel>
        
        <CustomResizeHandle isLeft={true} isCollapsed={leftCollapsed} onToggle={toggleLeft} />

        {/* ── CENTER MAP ── */}
        <Panel minSize="300px" className="map-panel-container">
          <div className="map-area">
          <MapWrapper
            issues={displayIssues}
            predictions={predictions}
            onPinClick={handlePinClick}
            selectedIssueId={selectedIssue?.id}
            onPredictionClick={() => {}}
            showHeatmap={layer === "heat"}
            showGhostHeatmap={layer === "ghost"}
            showPredictions={layer === "predict"}
            missionId={missionId}
            mapTypeId={mapTypeId}
          />

          {/* Map controls */}
          <div className="map-controls">
            <motion.button {...buttonPress} className={`mc-btn ${layer === "pins" ? "active" : ""}`} onClick={() => setLayer("pins")}>
              <i className="ti ti-map-pin" aria-hidden="true" /> Pins
            </motion.button>
            <motion.button {...buttonPress} className={`mc-btn ${layer === "heat" ? "active" : ""}`} onClick={() => setLayer("heat")}>
              <i className="ti ti-flame" aria-hidden="true" /> Heatmap
            </motion.button>
            <div style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" }} />
            <motion.button {...buttonPress} className={`mc-btn ${layer === "ghost" ? "active" : ""} ${disputedIssues.length > 0 ? "danger" : ""}`} onClick={() => setLayer("ghost")}>
              <i className="ti ti-alert-triangle" aria-hidden="true" /> Disputed
              {disputedIssues.length > 0 && (
                <span style={{ background: "var(--red)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", marginLeft: "2px" }}>
                  {disputedIssues.length}
                </span>
              )}
            </motion.button>
            <motion.button {...buttonPress} className={`mc-btn ${layer === "predict" ? "active" : ""}`} onClick={() => setLayer("predict")}>
              <i className="ti ti-activity" aria-hidden="true" /> Risk horizon
            </motion.button>
            <div style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" }} />
            <motion.button {...buttonPress} className={`mc-btn ${mapTypeId === "satellite" ? "active" : ""}`} onClick={() => setMapTypeId(prev => prev === "roadmap" ? "satellite" : "roadmap")}>
              <i className="ti ti-satellite" aria-hidden="true" /> Satellite
            </motion.button>
          </div>

          {/* Map search */}
          <div className="map-search">
            <i className="ti ti-search" aria-hidden="true" />
            Search location...
          </div>

          {/* Dispute toast */}
          <AnimatePresence>
            {showDisputeToast && disputedIssues.length > 0 && layer !== "ghost" && (
              <motion.div 
                className="dispute-toast"
                initial={{ opacity: 0, y: 48, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <div className="dt-icon">
                  <i className="ti ti-alert-triangle" aria-hidden="true" />
                </div>
                <div className="dt-body">
                  <div className="dt-title">Ghost resolution detected · {disputedIssues[0].category?.replace("_", " ")}</div>
                  <div className="dt-sub">
                    {disputedIssues[0].disputeCount || 1} citizen{(disputedIssues[0].disputeCount || 1) !== 1 ? "s" : ""} say it's still broken. AI confirms damage persists.
                  </div>
                </div>
                <motion.button {...buttonPress} className="dt-btn" onClick={() => { setSelectedIssue(disputedIssues[0]); setLayer("ghost"); }}>
                  View dispute
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {displayIssues.length === 0 && layer === "pins" && (
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              background: "var(--white)", border: "1px solid var(--border)", borderRadius: "16px",
              padding: "32px", textAlign: "center", zIndex: 5, maxWidth: "280px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            }}>
              <i className="ti ti-building" style={{ fontSize: "40px", color: "var(--border)", marginBottom: "12px", display: "block" }} />
              <div style={{ fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>No issues yet</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>Your ward looks clean! Be the first to report an issue.</div>
              <Link href="/report">
                <button className="btn btn-primary btn-sm">Report an issue</button>
              </Link>
            </div>
          )}

          {/* FAB — mobile only */}
          <Link href="/report" style={{ display: "block" }}>
            <motion.div 
              className="fab" 
              style={{ bottom: "72px" }}
              whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(255,91,35,0.4)' }}
              whileTap={{ scale: 0.95 }}
              animate={{ boxShadow: ['0 4px 12px rgba(255,91,35,0.2)', '0 8px 24px rgba(255,91,35,0.4)', '0 4px 12px rgba(255,91,35,0.2)'] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <i className="ti ti-camera" /> Report issue
            </motion.div>
          </Link>
        </div>
        </Panel>

        <CustomResizeHandle isLeft={false} isCollapsed={rightCollapsed} onToggle={toggleRight} />

        {/* ── RIGHT PANEL ── */}
        <Panel 
          panelRef={rightPanelRef}
          defaultSize="280px" 
          minSize="250px" 
          maxSize="400px"
          collapsible 
          collapsedSize={0}
          onResize={(size) => setRightCollapsed(Number(size) === 0)}
          className="right-panel-container"
        >
          <RightPanel
            issue={selectedIssue}
            onVerify={handleVerify}
            verifying={verifying}
            user={user}
          />
        </Panel>
      </Group>
      </div>

      <BottomTabs />
      <GuidedTour />
    </div>
  );
}
