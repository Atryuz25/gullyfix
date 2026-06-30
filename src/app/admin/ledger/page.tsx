"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, limit, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Issue } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "@/components/CountUp";

function formatTimeAgo(ts: any): string {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
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
    pending_review:       { cls: "badge-amber",  label: "Flagged" },
  };
  const m = map[status] || { cls: "badge-gray", label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

function getCatIcon(category: string) {
  switch (category) {
    case "road_damage":   return "ti-road";
    case "water_leakage": return "ti-droplet";
    case "streetlight":   return "ti-bulb";
    case "waste":         return "ti-trash";
    default:              return "ti-alert-circle";
  }
}

export default function AdminLedgerPage() {
  const { showToast } = useAuth();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [resolutionBase64, setResolutionBase64] = useState<string | null>(null);

  useEffect(() => { fetchIssues(); }, [filterStatus]); // eslint-disable-line

  const fetchIssues = async () => {
    try {
      setFetching(true);
      let q;
      if (filterStatus === "all") {
        q = query(collection(db, "issues"), orderBy("createdAt", "desc"), limit(100));
      } else if (filterStatus === "quarantined") {
        q = query(collection(db, "issues"), where("quarantineStatus", "==", "flagged"), limit(100));
      } else {
        // Omitting orderBy to avoid Firestore composite index requirement. Sort in memory instead.
        q = query(collection(db, "issues"), where("status", "==", filterStatus), limit(100));
      }
      const snap = await getDocs(q);
      let fetchedIssues = snap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
      
      if (filterStatus !== "all") {
        fetchedIssues.sort((a, b) => {
          const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return t2 - t1;
        });
      }
      
      setIssues(fetchedIssues);
    } catch {
      showToast({ type: "error", message: "Failed to fetch issues" });
    } finally {
      setFetching(false);
    }
  };

  const handleUpdateStatus = async (issueId: string, newStatus: string, resolutionPhotoUrl?: string, jurisdictionDisputed?: boolean) => {
    try {
      setUpdating(issueId);
      setConfirmingId(null);
      setResolvingIssueId(null);

      if (jurisdictionDisputed) {
        const res = await fetch("/api/check-jurisdiction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueId })
        });
        const json = await res.json();
        
        if (json.error) {
          throw new Error(json.error);
        }

        if (!json.data.correct && json.data.actual_department) {
          showToast({ type: "success", message: `AI re-routed to ${json.data.actual_department}.` });
        } else {
          showToast({ type: "warning", message: "AI: Jurisdiction verified. You own this issue." });
        }
        fetchIssues();
        return;
      }

      const issueRef = doc(db, "issues", issueId);
      const payload: any = { status: newStatus };
      if (newStatus === "resolved" || newStatus === "pending_verification") {
        payload.resolvedAt = serverTimestamp();
      }
      if (resolutionPhotoUrl) {
        payload.resolutionPhotoUrl = resolutionPhotoUrl;
      }

      await updateDoc(issueRef, payload);
      setIssues(issues.map(i => i.id === issueId ? { ...i, status: newStatus as any } : i));
      showToast({ type: "success", message: `Status updated to "${newStatus}"` });
    } catch (error: any) {
      showToast({ type: "error", message: "Update failed: " + error.message });
    } finally {
      setUpdating(null);
      setPendingStatus(null);
    }
  };

  const flaggedIssues = issues.filter(i => i.status === "pending_review");
  const otherIssues = issues.filter(i => i.status !== "pending_review");
  const disputedCount = issues.filter(i => i.status === "disputed").length;
  const slaBreachedCount = issues.filter(i => i.slaBreached).length;
  const quarantinedCount = issues.filter(i => i.quarantineStatus === "flagged").length;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-page)" }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}
      >

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "4px" }}>
            Issue Ledger
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Manage, triage, and update civic issue statuses across your ward.
          </p>
        </div>

        {/* Stat bar */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          {[
            { label: "Total", value: otherIssues.length, color: "var(--text-primary)" },
            { label: "Open", value: otherIssues.filter(i => i.status === "open").length, color: "var(--amber)" },
            { label: "Disputed", value: disputedCount, color: "var(--red)" },
            { label: "SLA Breached", value: slaBreachedCount, color: "var(--red)" },
            { label: "Resolved", value: otherIssues.filter(i => i.status === "resolved").length, color: "var(--green)" },
          ].map(s => (
            <div key={s.label} className="stat-chip">
              <div className="stat-num" style={{ color: s.color }}><CountUp value={s.value} /></div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Flagged queue alert */}
        {flaggedIssues.length > 0 && (
          <div style={{ background: "var(--red-light)", border: "1px solid var(--red-mid)", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
            <div style={{ fontWeight: 700, color: "var(--red)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <i className="ti ti-alert-triangle" />
              {flaggedIssues.length} issue{flaggedIssues.length !== 1 ? "s" : ""} flagged by community
            </div>
            <AnimatePresence mode="popLayout">
              {flaggedIssues.map((issue, idx) => (
                <motion.div 
                  layout
                  key={issue.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{ display: "flex", alignItems: "center", gap: "12px", background: "#fff", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px" }}
                >
                  <i className={`ti ${getCatIcon(issue.category)}`} style={{ color: "var(--orange)", fontSize: "18px" }} />
                  <div style={{ flex: 1 }}>
                    <Link href={`/issue/${issue.id}`} style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)", textDecoration: "underline" }}>
                      {issue.aiReasoning?.split(".")[0] || "Flagged issue"}
                    </Link>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{issue.ward} · {issue.flagCount} flag{issue.flagCount !== 1 ? "s" : ""} · {issue.lastFlagReason}</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleUpdateStatus(issue.id, "open")}>Restore</button>
                    <button className="btn btn-danger btn-sm" onClick={() => showToast({ type: "warning", message: "Removal not implemented in demo" })}>Remove</button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In Progress" },
              { value: "disputed", label: "Disputed" },
              { value: "pending_verification", label: "Pending Verification" },
              { value: "resolved", label: "Resolved" },
              { value: "quarantined", label: "Quarantine" },
            ].map(f => (
              <button
                key={f.value}
                className={`filter-chip ${filterStatus === f.value ? "active" : ""}`}
                onClick={() => setFilterStatus(f.value)}
              >
                {f.label}
                {f.value === "disputed" && disputedCount > 0 && (
                  <span style={{ background: "var(--red)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "0 5px", borderRadius: "4px", marginLeft: "4px" }}>
                    {disputedCount}
                  </span>
                )}
                {f.value === "quarantined" && quarantinedCount > 0 && (
                  <span style={{ background: "var(--amber)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "0 5px", borderRadius: "4px", marginLeft: "4px" }}>
                    {quarantinedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto", flexShrink: 0 }} onClick={fetchIssues}>
            <i className="ti ti-refresh" /> Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Ward</th>
                <th>Priority</th>
                <th>Verification</th>
                <th>Reported</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
              {fetching && otherIssues.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: "20px", borderRadius: "4px" }} /></td>
                    ))}
                  </tr>
                ))
              ) : otherIssues.length === 0 ? (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px", color: "var(--text-tertiary)" }}>
                    No issues found.
                  </td>
                </motion.tr>
              ) : (
                otherIssues.map((issue, idx) => (
                  <motion.tr 
                    key={issue.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: idx * 0.03, type: "spring", stiffness: 300, damping: 30 }}
                    className={issue.slaBreached ? "sla-breach" : ""}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <i className={`ti ${getCatIcon(issue.category)}`} style={{ color: "var(--orange)", fontSize: "16px" }} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Link href={`/issue/${issue.id}`} style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                              {(issue.category || "unknown").replace("_", " ")}
                            </Link>
                            {issue.slaBreached && <span className="badge badge-red" style={{ fontSize: "9px", padding: "1px 6px" }}>SLA</span>}
                            {issue.status === "disputed" && <span className="badge badge-red" style={{ fontSize: "9px", padding: "1px 6px" }}>DISPUTED</span>}
                            {issue.quarantineStatus === "flagged" && <span className="badge badge-amber" style={{ fontSize: "9px", padding: "1px 6px" }}>QUARANTINED</span>}
                          </div>
                          <Link href={`/ward/${issue.department?.toLowerCase().replace(/\\s+/g, '_') || 'unknown'}`} style={{ fontSize: "11px", color: "var(--text-secondary)", textDecoration: "underline" }}>
                            {issue.department}
                          </Link>
                          {issue.quarantineStatus === "flagged" && (
                            <div style={{ fontSize: "10px", color: "var(--amber)", marginTop: "4px" }}>{issue.quarantineReason}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: "13px" }}>{issue.ward}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: issue.priorityScore >= 70 ? "var(--red)" : issue.priorityScore >= 40 ? "var(--amber)" : "var(--green)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: "13px" }}>{issue.priorityScore}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                        <i className="ti ti-eye" style={{ fontSize: "12px", color: "var(--orange)" }} />
                        {issue.verifyCount || 0}
                      </div>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{formatTimeAgo(issue.createdAt)}</td>
                    <td><StatusBadge status={issue.status} /></td>
                    <td>
                      {updating === issue.id ? (
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                          <i className="ti ti-loader animate-pulse" /> Updating...
                        </span>
                      ) : confirmingId === issue.id ? (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>→ {pendingStatus}?</span>
                          <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus(issue.id, pendingStatus!)}>Yes</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmingId(null); setPendingStatus(null); }}>No</button>
                        </div>
                      ) : (
                        <motion.select
                          whileTap={{ scale: 0.95 }}
                          whileFocus={{ scale: 1.05 }}
                          className="select"
                          style={{ padding: "5px 28px 5px 8px", fontSize: "12px", width: "auto", minWidth: "140px" }}
                          value={issue.status}
                          disabled={issue.status === "merged"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "resolved") {
                              setResolvingIssueId(issue.id);
                            } else if (val === "reject_jurisdiction") {
                              handleUpdateStatus(issue.id, issue.status, undefined, true);
                            } else if (val === "restore_quarantine") {
                              updateDoc(doc(db, "issues", issue.id), { quarantineStatus: "cleared" })
                                .then(() => fetchIssues());
                            } else if (val === "remove_quarantine") {
                              showToast({ type: "warning", message: "Removal not implemented in demo" });
                            } else {
                              setConfirmingId(issue.id);
                              setPendingStatus(val);
                            }
                          }}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved ↗</option>
                          <option value="pending_verification">Pending Verification</option>
                          <option value="disputed">Disputed</option>
                          <option value="reject_jurisdiction">Reject (Jurisdiction)</option>
                          {issue.quarantineStatus === "flagged" && (
                            <>
                              <option value="restore_quarantine">Restore (Clear Flag)</option>
                              <option value="remove_quarantine">Remove Issue</option>
                            </>
                          )}
                        </motion.select>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Resolution Evidence Modal */}
        {resolvingIssueId && (
          <div className="modal-backdrop" onClick={() => { setResolvingIssueId(null); setResolutionBase64(null); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">
                <i className="ti ti-camera" style={{ color: "var(--orange)" }} /> Submit Resolution Evidence
              </div>
              <div className="modal-sub">
                Admins must upload photographic proof of the repair. The reporter will then be notified to verify. Status will be set to "Pending Verification" — not "Resolved" — until the citizen confirms.
              </div>

              <label style={{ display: "block", marginBottom: "12px" }}>
                <div className="btn btn-secondary btn-full" style={{ cursor: "pointer", justifyContent: "center" }}>
                  <i className="ti ti-camera-upload" /> Choose photo
                </div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      const MAX_WIDTH = 800;
                      canvas.width = MAX_WIDTH;
                      canvas.height = img.height * (MAX_WIDTH / img.width);
                      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
                      setResolutionBase64(canvas.toDataURL("image/jpeg", 0.6));
                    };
                    img.src = event.target?.result as string;
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>

              {resolutionBase64 && (
                <img src={resolutionBase64} alt="Resolution preview" style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "10px", marginBottom: "16px" }} />
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => { setResolvingIssueId(null); setResolutionBase64(null); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={!resolutionBase64}
                  onClick={() => handleUpdateStatus(resolvingIssueId, "pending_verification", resolutionBase64!)}
                >
                  <i className="ti ti-check" /> Submit Resolution
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
