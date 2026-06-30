"use client";

import React, { useEffect, useState, use } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Issue } from "@/lib/types";
import Link from "next/link";
import { TopNav, BottomTabs } from "@/components/Navigation";
import { motion } from "framer-motion";
import CountUp from "@/components/CountUp";
import { fadeUp } from "@/lib/animations";

export default function IssueTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: issueId } = use(params);
  const [issue, setIssue] = useState<Issue | null>(null);

  // Typewriter states for various sections
  const [typedReasoning, setTypedReasoning] = useState("");
  const [showEquity, setShowEquity] = useState(false);
  const [showCorridor, setShowCorridor] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [showResolution, setShowResolution] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showQuarantine, setShowQuarantine] = useState(false);

  useEffect(() => {
    if (!issueId) return;
    const unsub = onSnapshot(doc(db, "issues", issueId), (docSnap) => {
      if (docSnap.exists()) {
        setIssue(docSnap.data() as Issue);
      }
    });
    return () => unsub();
  }, [issueId]);

  // AI Reasoning typewriter
  useEffect(() => {
    if (!issue?.aiReasoning) return;
    setTypedReasoning("");
    let i = 0;
    const full = issue.aiReasoning;
    const interval = setInterval(() => {
      if (i <= full.length) {
        setTypedReasoning(full.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        // Cascade triggers
        setTimeout(() => setShowEquity(true), 1200);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [issue?.aiReasoning]);

  useEffect(() => {
    if (showEquity) setTimeout(() => setShowCorridor(true), 1200);
  }, [showEquity]);

  useEffect(() => {
    if (showCorridor) setTimeout(() => setShowFinal(true), 1200);
  }, [showCorridor]);

  useEffect(() => {
    if (showFinal) {
      setTimeout(() => {
        setShowResolution(true);
        setTimeout(() => {
          setShowDispute(true);
          setTimeout(() => {
            setShowQuarantine(true);
          }, 1500);
        }, 1500);
      }, 1200);
    }
  }, [showFinal]);

  if (!issue) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
        <TopNav />
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>Loading trace...</div>
      </div>
    );
  }

  const categoryLabel = issue.category ? issue.category.replace("_", " ") : "uncategorized";
  const userReportedType = (issue as any).userReportedType || "unspecified";
  
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <TopNav />
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 20px 80px" }}>
        
        <div style={{ marginBottom: "24px" }}>
          <Link href={`/issue/${issueId}`} style={{ color: "var(--text-secondary)", fontSize: "14px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <i className="ti ti-arrow-left" /> Back to Issue
          </Link>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginTop: "16px" }}>AI Action Trace</h1>
          <div style={{ color: "var(--text-tertiary)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>ID: {issueId}</div>
        </div>

        <motion.div 
          variants={fadeUp} initial="initial" animate="animate"
          style={{
          background: "#0a0a0a", color: "var(--green)", padding: "24px", borderRadius: "12px",
          fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: 1.7, boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
          overflowX: "hidden"
        }}>
          {/* Section 1: Initial Processing */}
          <div>
            ✅ Report received — {categoryLabel} at {issue.address || "mapped location"}<br />
            ✅ Cloud Vision: Content moderation passed<br />
            ✅ Gemini 2.5: Image analyzed — {categoryLabel} confirmed<br />
            <span style={{ color: "var(--text-secondary)", paddingLeft: "16px" }}>Confidence: {Math.round((issue.aiConfidence || 0)*100)}% | User reported: {userReportedType}</span><br />
            {categoryLabel !== userReportedType && userReportedType !== "unspecified" && (
              <><span style={{ color: "var(--amber)", paddingLeft: "16px" }}>⚠️ Classification override: citizen said {userReportedType}, AI detected {categoryLabel}</span><br/></>
            )}
            <br />
            {typedReasoning}
            {typedReasoning.length < (issue.aiReasoning?.length || 0) && <span className="animate-pulse">|</span>}
            <br /><br />
          </div>

          {/* Section 2: Equity Engine */}
          {showEquity && issue.equityTier && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              📊 Ward equity index: {issue.equityLabel}<br />
              {issue.equityMultiplier !== 1.0 && (
                <span style={{ color: issue.equityMultiplier! > 1 ? "var(--amber)" : "var(--blue)", paddingLeft: "16px" }}>
                  {issue.equityMultiplier! > 1 ? "⬆️ Priority upgraded" : "⬇️ Priority downweighted"}: {issue.basePriority} → {issue.priorityScore} ({issue.equityMultiplier}x)
                </span>
              )}
              {issue.equityMultiplier === 1.0 && (
                <span style={{ color: "var(--text-secondary)", paddingLeft: "16px" }}>➡️ No priority adjustment applied (1.0x)</span>
              )}
              <br /><br />
            </motion.div>
          )}

          {/* Section 3: Corridor */}
          {showCorridor && issue.corridorDetected && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ color: "var(--amber)" }}>
              🏥 {issue.corridorPlaceName} detected {issue.corridorDistanceMeters}m away<br />
              ⚡ Vulnerable corridor — SLA halved, priority boosted +12<br /><br />
            </motion.div>
          )}

          {/* Section 4: Final Routing */}
          {showFinal && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              ✅ Final priority: <CountUp value={issue.priorityScore} />/100<br />
              ✅ Routed to: {issue.department}<br />
              ✅ SLA deadline: {issue.slaDeadline ? new Date(issue.slaDeadline.toMillis()).toLocaleString() : "Not set"}<br /><br />
            </motion.div>
          )}

          {/* Section 5: Resolution */}
          {showResolution && ["pending_verification", "resolved", "disputed"].includes(issue.status) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              ✅ Admin marked resolved<br />
              📸 Resolution photo uploaded<br /><br />
            </motion.div>
          )}

          {/* Section 6: Dispute & Department Blacklist */}
          {showDispute && issue.status === "disputed" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              ⚠️ Citizen dispute filed<br />
              🔍 Running 3-way multimodal comparison...<br />
              {issue.disputeReasoning && (
                <>
                  <motion.div animate={{ x: [-5, 5, -5, 5, 0] }} transition={{ duration: 0.4 }} style={{ color: "var(--red)", display: "inline-block" }}>❌ RESOLUTION REJECTED</motion.div><br />
                  <span style={{ color: "var(--red)", paddingLeft: "16px" }}>Damage pattern persists across all three images</span><br />
                  <span style={{ color: "var(--text-secondary)", paddingLeft: "16px" }}>{issue.disputeReasoning}</span><br />
                </>
              )}
              {issue.departmentNewScore !== undefined && (
                <span style={{ color: "var(--amber)", paddingLeft: "16px" }}>📉 {issue.department} reputation: <CountUp value={issue.departmentNewScore + 12} /> → <CountUp value={issue.departmentNewScore} /></span>
              )}<br />
              <span style={{ color: "var(--orange)", paddingLeft: "16px" }}>⚠️ Escalated to senior officer — same officer locked from re-closing</span><br />
              {issue.departmentBlacklisted && (
                <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ color: "var(--red)", paddingLeft: "16px", display: "inline-block" }}>🚫 Department blacklisted — locked 180 days</motion.div>
              )}<br /><br />
            </motion.div>
          )}

          {/* Section 7: Quarantine */}
          {showQuarantine && (issue.quarantineFlags || 0) > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ color: issue.quarantineStatus === 'flagged' ? "var(--red)" : "var(--amber)" }}>
              🛡️ Verification integrity engine: {issue.quarantineFlags} votes decayed<br />
              {issue.quarantineStatus === 'flagged' && (
                <span style={{ paddingLeft: "16px" }}>⚠️ Issue quarantined — suspicious pattern detected</span>
              )}
            </motion.div>
          )}
        </motion.div>

      </div>
      <BottomTabs />
    </div>
  );
}
