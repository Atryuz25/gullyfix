"use client";

import React, { useEffect, useState, use } from "react";
import { doc, getDoc, collection, query, where, limit, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Department, Issue } from "@/lib/types";
import { TopNav, BottomTabs } from "@/components/Navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import CountUp from "@/components/CountUp";

import { useSearchParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";

export default function DepartmentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [dept, setDept] = useState<Department | null>(null);
  const [recentIssues, setRecentIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchDept = async () => {
      try {
        const docSnap = await getDoc(doc(db, "departments", id as string));
        let currentDept: Department;
        let deptName: string;

        if (docSnap.exists()) {
          currentDept = { id: docSnap.id, ...docSnap.data() } as Department;
          deptName = docSnap.data().name;
        } else {
          // Synthetic fallback for dynamically generated departments by Triage AI
          deptName = searchParams.get("name") || (id as string).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          currentDept = {
            id: id as string,
            name: deptName,
            city: "Demo City",
            reputationScore: Math.floor(Math.random() * 30) + 40, // Random score between 40-70 for unverified depts
            ghostResolutionCount: 1,
            slaBreachCount: 2,
            totalResolved: 5,
            blacklisted: false,
            blacklistedUntil: null,
            lastUpdated: Timestamp.now()
          };
        }
        
        setDept(currentDept);
        
        // Fetch recent issues (without orderBy to avoid composite index error)
        const issuesQ = query(
          collection(db, "issues"),
          where("department", "==", deptName),
          limit(30)
        );
        const issuesSnap = await getDocs(issuesQ);
        const issues = issuesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        
        // Sort in memory and take top 10
        issues.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setRecentIssues(issues.slice(0, 10));

      } catch (err) {
        console.error("Failed to load department", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDept();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
        <TopNav />
        <div style={{ padding: "32px 20px", maxWidth: "800px", margin: "40px auto", width: "100%" }}>
          <div className="skeleton" style={{ height: "160px", borderRadius: "16px", marginBottom: "32px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
            <div className="skeleton" style={{ height: "100px", borderRadius: "12px" }} />
            <div className="skeleton" style={{ height: "100px", borderRadius: "12px" }} />
            <div className="skeleton" style={{ height: "100px", borderRadius: "12px" }} />
          </div>
          <div className="skeleton" style={{ height: "300px", borderRadius: "12px" }} />
        </div>
      </div>
    );
  }

  if (!dept) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
        <TopNav />
        <div style={{ padding: "64px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
          <i className="ti ti-building" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }} />
          <div style={{ fontSize: "20px", fontWeight: 600 }}>Department not found</div>
          <div style={{ fontSize: "14px", marginTop: "8px" }}>The department profile you are looking for does not exist.</div>
        </div>
      </div>
    );
  }

  const scoreColor = dept.reputationScore >= 80 ? "var(--green)" : dept.reputationScore >= 50 ? "var(--amber)" : "var(--red)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <TopNav wardName={dept.name} />
      
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", paddingBottom: "80px" }}>
        {dept.blacklisted && (
          <motion.div animate={{ opacity: [1, 0.7, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ background: "var(--red-light)", color: "var(--red-dark)", padding: "16px", borderRadius: "12px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px", fontWeight: 600 }}>
            <i className="ti ti-ban text-xl" />
            <span>🚫 Department blacklisted — locked from new contracts until {dept.blacklistedUntil ? new Date(dept.blacklistedUntil.toMillis()).toLocaleDateString() : '180 days'}</span>
          </motion.div>
        )}

        <div className="card" style={{ padding: "32px", display: "flex", gap: "32px", alignItems: "center", marginBottom: "32px", flexWrap: "wrap" }}>
          {/* Reputation Ring */}
          <div style={{ width: "120px", height: "120px", position: "relative" }}>
            <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="10" />
              <circle cx="50" cy="50" r="45" fill="none" stroke={scoreColor} strokeWidth="10" strokeDasharray={`${dept.reputationScore * 2.83} 283`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)" }}><CountUp value={Math.round(dept.reputationScore)} /></span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--orange)", marginBottom: "4px" }}>
              Department Public Profile
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}>{dept.name}</h1>
            <div style={{ color: "var(--text-secondary)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <i className="ti ti-map-pin" /> {dept.city}
            </div>
            
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Ghost Resolutions</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: dept.ghostResolutionCount > 0 ? "var(--red)" : "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CountUp value={dept.ghostResolutionCount} /> {dept.ghostResolutionCount > 0 && <span className="badge badge-red" style={{ fontSize: "10px", padding: "2px 6px" }}>FLAGGED</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>SLA Breaches</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: dept.slaBreachCount > 0 ? "var(--amber)" : "var(--text-primary)" }}><CountUp value={dept.slaBreachCount} /></div>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total Resolved</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}><CountUp value={dept.totalResolved} /></div>
              </div>
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>Recent Assigned Issues</h2>
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--bg-wash)", borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ padding: "16px", fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>ID</th>
                <th style={{ padding: "16px", fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Category</th>
                <th style={{ padding: "16px", fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Priority</th>
                <th style={{ padding: "16px", fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentIssues.length === 0 && (
                <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>No recent issues found.</td></tr>
              )}
              {recentIssues.map(issue => (
                <tr key={issue.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "16px", fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--text-primary)" }}>
                    <Link href={`/issue/${issue.id}`} style={{ color: "var(--orange)", textDecoration: "none" }}>
                      #{issue.id.slice(-6).toUpperCase()}
                    </Link>
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-primary)" }}>{issue.category.replace("_", " ")}</td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-primary)" }}>{issue.priorityScore}</td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-primary)" }}>
                    <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, background: "var(--bg-wash)", textTransform: "capitalize" }}>
                      {issue.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <BottomTabs />
    </div>
  );
}
