"use client";

import React, { useEffect, useState, use } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { Issue } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { TopNav, BottomTabs } from "@/components/Navigation";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem, buttonPress } from "@/lib/animations";

function formatTimeAgo(ts: any): string {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "road_damage":   return "ti-road";
    case "water_leakage": return "ti-droplet";
    case "streetlight":   return "ti-bulb";
    case "waste":         return "ti-trash";
    default:              return "ti-alert-circle";
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    open:                 { cls: "badge-gray",   label: "Open" },
    in_progress:          { cls: "badge-blue",   label: "In Progress" },
    pending_verification: { cls: "badge-orange", label: "Pending Verification" },
    disputed:             { cls: "badge-red",    label: "Disputed" },
    resolved:             { cls: "badge-green",  label: "Resolved" },
    merged:               { cls: "badge-gray",   label: "Merged" },
    pending_triage:       { cls: "badge-gray",   label: "Triaging..." },
  };
  const m = map[status] || { cls: "badge-gray", label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: issueId } = use(params);
  const { user, showToast } = useAuth();
  const router = useRouter();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [disputePhotoBase64, setDisputePhotoBase64] = useState<string | null>(null);
  const [isDisputing, setIsDisputing] = useState(false);

  useEffect(() => {
    if (!issueId) return;
    const unsub = onSnapshot(doc(db, "issues", issueId), (snap) => {
      if (snap.exists()) {
        setIssue({ id: snap.id, ...snap.data() } as Issue);
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [issueId, router]);

  const handleVerify = async () => {
    if (!user || !issue) return router.push("/login");
    try {
      setVerifying(true);
      const { doc, updateDoc, increment, arrayUnion } = await import("firebase/firestore");
      
      const issueRef = doc(db, "issues", issue.id);
      await updateDoc(issueRef, {
        verifyCount: increment(1),
        verifiedBy: arrayUnion(user.uid)
      });

      const profileRef = doc(db, "public_profiles", user.uid);
      await updateDoc(profileRef, {
        xpPoints: increment(10),
        verifyCount: increment(1)
      }).catch(err => console.error("Failed to update profile XP:", err));

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        xpPoints: increment(10),
        verifyCount: increment(1)
      }).catch(err => console.error("Failed to update user XP:", err));

      showToast({ type: "success", message: "Verification recorded! +10 XP", xp: 10 });
    } catch (e: any) {
      showToast({ type: "error", message: e.message || "Could not verify." });
    } finally {
      setVerifying(false);
    }
  };

  const handleFlag = async (reason: string) => {
    if (!user || !issue) return;
    try {
      setFlagging(true);
      const { doc, updateDoc, arrayUnion, increment } = await import("firebase/firestore");
      const issueRef = doc(db, "issues", issue.id);
      
      const newFlagCount = (issue.flagCount || 0) + 1;
      await updateDoc(issueRef, {
        flagCount: increment(1),
        flaggedBy: arrayUnion(user.uid),
        lastFlagReason: reason || "Not specified",
        ...(newFlagCount >= 3 ? { status: "pending_review" } : {})
      });
      
      showToast({ type: "warning", message: "Issue flagged for review." });
      setShowFlagModal(false);
    } catch (e: any) {
      showToast({ type: "error", message: e.message || "Could not flag." });
    } finally {
      setFlagging(false);
    }
  };

  const handleDispute = async () => {
    if (!user || !issue || !disputePhotoBase64) return;
    try {
      setIsDisputing(true);
      showToast({ type: "warning", message: "Disputes are currently in manual review queue." });
      setShowFlagModal(false);
    } catch (e: any) {
      showToast({ type: "error", message: e.message || "Could not file dispute." });
    } finally {
      setIsDisputing(false);
      setDisputePhotoBase64(null);
    }
  };

  const compressToBase64 = (file: File): Promise<string> => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        const scale = MAX / img.width;
        canvas.width = MAX;
        canvas.height = img.height * scale;
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  if (loading) return (
    <div className="narrow-page">
      <TopNav />
      <div className="narrow-content">
        <div className="skeleton" style={{ height: "240px", borderRadius: "12px", marginBottom: "16px" }} />
        <div className="skeleton" style={{ height: "28px", width: "60%", marginBottom: "8px" }} />
        <div className="skeleton" style={{ height: "16px", width: "40%", marginBottom: "24px" }} />
        <div className="skeleton" style={{ height: "120px" }} />
      </div>
    </div>
  );

  if (!issue) return null;

  const isOwner = user?.uid === issue.reportedBy;
  const hasVerified = issue.verifiedBy?.includes(user?.uid || "");
  const canVerify = user && !isOwner && !hasVerified && !["resolved", "merged"].includes(issue.status);
  const catIcon = getCategoryIcon(issue.category);

  // SLA Countdown
  let slaLabel = null;
  let slaIsBreached = issue.slaBreached;
  if (issue.slaDeadline && !["resolved", "merged"].includes(issue.status)) {
    const deadline = issue.slaDeadline.toDate ? issue.slaDeadline.toDate() : new Date();
    const remainMs = deadline.getTime() - Date.now();
    const days = Math.ceil(Math.abs(remainMs) / 86400000);
    slaLabel = remainMs < 0 || slaIsBreached
      ? { text: `${issue.department?.split(" ")[0]} overdue by ${days} days`, isBreached: true }
      : { text: `${issue.department?.split(" ")[0]} has ${days} day${days !== 1 ? "s" : ""} to fix this`, isBreached: false };
  }

  return (
    <div className="narrow-page">
      <TopNav />

      {/* Hero Photo */}
      <motion.div style={{ position: "relative" }} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <div style={{
          width: "100%", height: "260px",
          backgroundColor: issue.photoURL ? "transparent" : "var(--border)",
          backgroundImage: issue.photoURL ? `url("${issue.photoURL}")` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }} role="img" aria-label={issue.photoAltText || "Issue photo"} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />

        <Link href="/" style={{ position: "absolute", top: "12px", left: "12px" }}>
          <button className="btn btn-secondary btn-sm" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}>
            <i className="ti ti-arrow-left" /> Back
          </button>
        </Link>

        <button
          className="btn btn-secondary btn-sm"
          style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}
          onClick={() => { navigator.clipboard.writeText(window.location.href); showToast({ type: "success", message: "Link copied!" }); }}
        >
          <i className="ti ti-share" /> Share
        </button>

        <div style={{ position: "absolute", bottom: "16px", left: "16px", display: "flex", gap: "8px" }}>
          <StatusBadge status={issue.status} />
          {issue.slaBreached && <span className="badge badge-red"><i className="ti ti-clock-exclamation" /> SLA Breached</span>}
        </div>
      </motion.div>

      <motion.div className="narrow-content" style={{ paddingTop: "20px" }} variants={staggerContainer} initial="initial" animate="animate">

        {/* Title */}
        <motion.div style={{ marginBottom: "16px" }} variants={staggerItem}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <i className={`ti ${catIcon}`} style={{ fontSize: "20px", color: "var(--orange)" }} />
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
              {issue.aiReasoning?.split(".")[0] || issue.category.replace("_", " ")}
            </h1>
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span>{issue.ward}</span>
            <span>·</span>
            <span>{formatTimeAgo(issue.createdAt)}</span>
            <span>·</span>
            <span>By {issue.reporterName || "Anonymous"}</span>
          </div>
        </motion.div>

        {/* Priority Bar */}
        <motion.div className="card" style={{ marginBottom: "16px", padding: "14px 16px" }} variants={staggerItem}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Priority Score</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: issue.priorityScore >= 70 ? "var(--red)" : issue.priorityScore >= 40 ? "var(--amber)" : "var(--green)" }}>
              {issue.priorityScore}/100
            </span>
          </div>
          <div className="priority-bar-track">
            <div className="priority-bar-fill" style={{
              width: `${issue.priorityScore}%`,
              background: issue.priorityScore >= 70 ? "var(--red)" : issue.priorityScore >= 40 ? "var(--amber)" : "var(--green)",
            }} />
          </div>
        </motion.div>

        {/* SLA Countdown */}
        {slaLabel && (
          <motion.div className="card" style={{ marginBottom: "16px", padding: "12px 16px", background: slaLabel.isBreached ? "var(--red-light)" : "var(--amber-light)", border: `1px solid ${slaLabel.isBreached ? "var(--red-mid)" : "#FFDDA0"}`, display: "flex", alignItems: "center", gap: "10px" }} variants={staggerItem}>
            <i className={`ti ${slaLabel.isBreached ? "ti-clock-exclamation" : "ti-clock"}`} style={{ fontSize: "20px", color: slaLabel.isBreached ? "var(--red)" : "var(--amber)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: slaLabel.isBreached ? "var(--red)" : "var(--amber)", marginBottom: "2px" }}>
                {slaLabel.isBreached ? "SLA BREACHED" : "SLA DEADLINE"}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{slaLabel.text}</div>
            </div>
          </motion.div>
        )}

        {/* Dispute UI — only shown to the reporter when pending_verification */}
        {issue.status === "pending_verification" && isOwner && (
          <motion.div className="card" style={{ marginBottom: "16px", background: "var(--red-light)", border: "1px solid var(--red-mid)", padding: "16px" }} variants={staggerItem}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--red)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <i className="ti ti-shield-question" />
              Ward says it's fixed. Still broken?
            </div>
            <p style={{ fontSize: "13px", color: "#444", marginBottom: "16px", lineHeight: 1.5 }}>
              The admin has uploaded resolution evidence. If the issue persists, upload a new photo to trigger AI verification.
            </p>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <div className="btn btn-secondary btn-sm" style={{ display: "inline-flex", cursor: "pointer" }}>
                <i className="ti ti-camera-upload" /> Upload dispute photo
              </div>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setDisputePhotoBase64(await compressToBase64(file));
              }} />
            </label>
            {disputePhotoBase64 && (
              <img src={disputePhotoBase64} alt="Dispute preview" style={{ width: "100%", height: "160px", objectFit: "cover", borderRadius: "8px", marginBottom: "12px" }} />
            )}
            <button
              className="btn btn-danger btn-full"
              disabled={!disputePhotoBase64 || isDisputing}
              onClick={handleDispute}
              style={{ justifyContent: "center" }}
            >
              {isDisputing ? "Analyzing 3-way photo diff..." : "File Dispute"}
            </button>
          </motion.div>
        )}

        {/* Resolution Photo */}
        {issue.resolutionPhotoUrl && (
          <motion.div style={{ marginBottom: "16px" }} variants={staggerItem}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "8px" }}>Admin Resolution Evidence</div>
            <img src={issue.resolutionPhotoUrl} alt="Resolution" style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "10px" }} />
          </motion.div>
        )}

        {/* Dispute Analysis */}
        {issue.disputeReasoning && (
          <motion.div className="card" style={{ marginBottom: "16px", background: "var(--red-light)", border: "1px solid var(--red-mid)", padding: "14px" }} variants={staggerItem}>
            <div className="dp-title">
              <i className="ti ti-shield-x" /> Resolution rejected
            </div>
            <div className="dp-analysis">
              <b>AI Multimodal Analysis:</b><br />
              {issue.disputeReasoning.split("[DISPUTE VERIFICATION]").pop()?.trim() || issue.disputeReasoning}
            </div>
          </motion.div>
        )}

        {/* Community verification */}
        <motion.div className="card" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px", position: "relative" }} variants={staggerItem}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
              {(issue.verifyCount || 0) > 0 ? `${issue.verifyCount} neighbour${issue.verifyCount !== 1 ? "s" : ""} confirmed this` : "Be the first to confirm"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Verifications help departments prioritize dispatch.</div>
          </div>
          {canVerify ? (
            <div style={{ position: "relative" }}>
              <motion.button {...buttonPress} className="btn btn-primary btn-sm" onClick={handleVerify} disabled={verifying}>
                {verifying ? "..." : "✓ I've seen this"}
              </motion.button>
              <AnimatePresence>
                {verifying && (
                  <motion.div 
                    initial={{ opacity: 0, y: 0 }} 
                    animate={{ opacity: 1, y: -24 }} 
                    exit={{ opacity: 0 }} 
                    style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", color: "var(--orange)", fontWeight: 700, fontSize: "12px", pointerEvents: "none" }}
                  >
                    +10 XP
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" disabled>
              {hasVerified ? "✓ Verified" : isOwner ? "Your report" : "Resolved"}
            </button>
          )}
        </motion.div>

        {/* AI Work Order */}
        <motion.div className="card" style={{ marginBottom: "16px", background: "#111", border: "none", color: "#ccc" }} variants={staggerItem}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#555", marginBottom: "12px", borderBottom: "1px dashed #333", paddingBottom: "8px", display: "flex", justifyContent: "space-between" }}>
            <span>AUTONOMOUS DRAFT WORK-ORDER</span>
            <span>CASE {issue.id.slice(0, 6).toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "2px" }}>DISPATCHED DEPT.</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{issue.department}</div>
            </div>
            <span style={{ background: "#222", color: "var(--orange)", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px" }}>
              {Math.round((issue.aiConfidence || 0) * 100)}% CONF
            </span>
          </div>
          <div style={{ fontStyle: "italic", fontSize: "12px", background: "#1a1a1a", padding: "10px", borderRadius: "6px", borderLeft: "3px solid var(--orange)", marginBottom: "12px", lineHeight: 1.6 }}>
            {issue.aiReasoning}
          </div>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#555", letterSpacing: "0.05em", marginBottom: "8px" }}>RECOMMENDED ACTION PLAN:</div>
          <ul style={{ paddingLeft: "18px", color: "#aaa", fontSize: "12px", fontFamily: "var(--font-mono, monospace)", lineHeight: 2 }}>
            {(issue.resolutionSteps || ["Inspect site", "Assess damage", "Deploy repair crew"]).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </motion.div>

        {/* AI Vision Labels */}
        {issue.visionLabels && issue.visionLabels.length > 0 && (
          <motion.div style={{ marginBottom: "16px" }} variants={staggerItem}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "8px" }}>AI Vision Labels</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {issue.visionLabels.map((label, i) => (
                <span key={i} className="badge badge-gray">{label}</span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Issue Timeline */}
        <motion.div className="card" style={{ marginBottom: "16px" }} variants={staggerItem}>
          <div style={{ fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>Issue Timeline</div>
          <div className="timeline">
            {[
              { label: "Reported", time: formatTimeAgo(issue.createdAt), s: "done" },
              { label: "AI Triaged", time: `P${issue.priorityScore} · ${issue.department?.split(" ")[0]}`, s: issue.status !== "pending_triage" ? "done" : "wait" },
              { label: "Department Assigned", time: "Auto-assigned", s: ["in_progress","pending_verification","disputed","resolved"].includes(issue.status) ? "done" : "wait" },
              { label: issue.status === "disputed" ? "Resolution Disputed" : "Pending Verification", time: issue.status === "disputed" ? "Escalated to AEE" : "Awaiting citizen review", s: issue.status === "disputed" ? "error" : issue.status === "pending_verification" ? "active" : "wait" },
              { label: "Verified Resolved", time: issue.resolvedAt ? formatTimeAgo(issue.resolvedAt) : "Pending", s: issue.status === "resolved" ? "done" : "wait" },
            ].map((step, i) => (
              <motion.div key={i} className="tl-item" variants={staggerItem}>
                <div className={`tl-dot ${step.s}`}>
                  <i className={`ti ${step.s === "done" ? "ti-check" : step.s === "error" ? "ti-alert-triangle" : step.s === "active" ? "ti-loader" : "ti-clock"}`} style={{ fontSize: "10px" }} />
                </div>
                <div>
                  <div className="tl-name" style={step.s === "error" ? { color: "var(--red)" } : step.s === "wait" ? { color: "var(--text-disabled)" } : {}}>{step.label}</div>
                  <div className="tl-time">{step.time}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div style={{ display: "flex", gap: "10px", paddingBottom: "80px", flexWrap: "wrap" }} variants={staggerItem}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ flex: 1 }}
            onClick={() => { navigator.clipboard.writeText(window.location.href); showToast({ type: "success", message: "Link copied!" }); }}
          >
            <i className="ti ti-share" /> Share
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--text-tertiary)", flex: 1 }}
            onClick={() => setShowFlagModal(true)}
          >
            <i className="ti ti-flag" /> Flag as invalid
          </button>
          
          {isOwner && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--red)", flex: 1, minWidth: "100%" }}
              onClick={async () => {
                if (confirm("Are you sure you want to delete this report?")) {
                  try {
                    const { doc, deleteDoc } = await import("firebase/firestore");
                    await deleteDoc(doc(db, "issues", issue.id));
                    showToast({ type: "success", message: "Report deleted." });
                    router.push("/profile");
                  } catch (e: any) {
                    showToast({ type: "error", message: e.message || "Failed to delete report." });
                  }
                }
              }}
            >
              <i className="ti ti-trash" /> Delete Report
            </button>
          )}
        </motion.div>

        {/* Flag Modal */}
        {showFlagModal && (
          <div className="modal-backdrop" onClick={() => setShowFlagModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Flag this issue</div>
              <div className="modal-sub">Select a reason to help our moderators review this report.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {["Fake or spam report", "Already resolved", "Wrong location", "Duplicate issue", "Inappropriate content"].map(reason => (
                  <button
                    key={reason}
                    className="btn btn-secondary"
                    style={{ justifyContent: "flex-start" }}
                    onClick={() => handleFlag(reason)}
                    disabled={flagging}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: "12px", width: "100%" }} onClick={() => setShowFlagModal(false)}>Cancel</button>
            </div>
          </div>
        )}
      </motion.div>

      <BottomTabs />
    </div>
  );
}
