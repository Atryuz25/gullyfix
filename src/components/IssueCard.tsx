"use client";

import React, { useState } from "react";
import { Issue } from "@/lib/types";
import { CategoryBadge, StampBadge } from "./Badges";
import { PriorityBar } from "./PriorityBar";
import { getCategoryIcon } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export function IssueCard({ issue }: { issue: Issue }) {
  const router = useRouter();
  const { user, showToast } = useAuth();
  const [verifying, setVerifying] = useState(false);

  let cardClass = "issue-card";
  let headerStyle = { background: "var(--brown-deep)" };

  if (issue.status === "resolved") {
    headerStyle = { background: "var(--sage)" };
  } else if (issue.priorityScore >= 75) {
    headerStyle = { background: "var(--terracotta)" };
  }

  const safeCategory = issue.category || "uncategorized";
  const title = issue.aiReasoning?.split(".")[0] || `${safeCategory.replace("_", " ")} issue`;
  const hasVerified = issue.verifiedBy?.includes(user?.uid || "");
  const isOwner = user?.uid === issue.reportedBy;
  const canVerify = user && !isOwner && !hasVerified && !["resolved", "merged"].includes(issue.status);

  const handleVerify = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return router.push("/login");
    try {
      setVerifying(true);
      await fetch("/api/award-xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_issue", userId: user.uid, issueId: issue.id })
      });
      showToast({ type: "success", message: "Verification recorded! Thank you.", xp: 10 });
    } catch (error: any) {
      showToast({ type: "error", message: error.message || "Could not verify. Try again." });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Link href={`/issue/${issue.id}`} style={{ display: "block", textDecoration: "none" }}>
      <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--orange-light)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", border: "1px solid rgba(255, 91, 35, 0.2)" }}>
              <i className={`ti ${getCategoryIcon(safeCategory)}`} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", textTransform: "capitalize", lineHeight: 1.2 }}>
                {safeCategory.replace("_", " ")}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {issue.ward} · {formatTimeAgo(issue.createdAt)}
              </div>
            </div>
          </div>
          {issue.aiConfidence && (
            <span className="badge badge-orange t-mono" style={{ fontSize: "9px", padding: "2px 6px" }}>
              {Math.round(issue.aiConfidence * 100)}% CONF
            </span>
          )}
        </div>
        
        <div className="t-body-sm" style={{ marginBottom: "14px", color: "var(--text-primary)" }}>
          {title}
        </div>
        
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="badge badge-ghost" style={{ fontSize: "10px" }}>{issue.department || "Routing..."}</span>
          {issue.verifyCount > 0 && (
            <span className="badge badge-ghost" style={{ fontSize: "10px", background: "rgba(0,0,0,0.05)", borderColor: "transparent" }}>
              <i className="ti ti-eye" style={{ marginRight: "4px" }}/> {issue.verifyCount} verified
            </span>
          )}
          {issue.status === "resolved" && (
            <div style={{ marginLeft: "auto" }}>
              <StampBadge text="RESOLVED" />
            </div>
          )}
        </div>
        
        <PriorityBar score={issue.priorityScore} />

        <div className="row" style={{ marginTop: "16px" }}>
            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); router.push(`/issue/${issue.id}`); }} style={{ flex: 1 }}>View details</button>
            {issue.status !== "resolved" && (
              <button 
                className={`btn ${canVerify ? "btn-primary" : "btn-secondary"} btn-sm`} 
                onClick={handleVerify}
                disabled={!canVerify || verifying}
                style={{ flex: 1 }}
              >
                {verifying ? "Verifying..." : hasVerified ? "✓ Verified" : isOwner ? "Your report" : "I've seen this"}
              </button>
            )}
        </div>

      </div>
    </Link>
  );
}
