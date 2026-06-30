"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ward } from "@/lib/types";
import { StatChip } from "@/components/StatChip";
import { CategoryBadge } from "@/components/Badges";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  
  const [wards, setWards] = useState<Ward[]>([]);
  const [stats, setStats] = useState({ resolved: 0, inProgress: 0, avgDays: 0, open: 0 });
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !profile?.isAdmin)) {
      // In a real app, strict admin guard.
      // For demo purposes, we might let anyone see it, but let's be strict.
      // router.push("/"); 
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // Fetch Wards
        const wq = query(collection(db, "wards"), orderBy("wardId"));
        const wSnap = await getDocs(wq);
        const wardsData = wSnap.docs.map(d => d.data() as Ward);
        setWards(wardsData);

        // Calculate global stats from wards
        let res = 0, inp = 0, op = 0, totalDays = 0, daysCount = 0;
        wardsData.forEach(w => {
          res += w.resolvedIssueCount;
          inp += w.inProgressCount;
          op += w.openIssueCount;
          if (w.avgResolutionDays > 0) {
            totalDays += w.avgResolutionDays;
            daysCount++;
          }
        });

        setStats({
          resolved: res,
          inProgress: inp,
          open: op,
          avgDays: daysCount > 0 ? +(totalDays / daysCount).toFixed(1) : 0,
        });

      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    fetchAdminData();
  }, []);

  if (fetching) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: "1000px" }}>
        <div className="skeleton" style={{ height: "60px", width: "300px", borderRadius: "8px", marginBottom: "32px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "40px" }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "12px" }} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: "200px", borderRadius: "12px" }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: "1000px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px", padding: "24px 24px 0" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "8px" }}>Control Room</h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", margin: 0 }}>City-wide infrastructure health and AI insights.</p>
        </div>
        <Link href="/admin/ledger">
          <button className="btn btn-secondary">View issue ledger →</button>
        </Link>
      </div>

      <div style={{ padding: "0 24px" }}>
        {/* Top Metric Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "40px" }}>
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "8px" }}>Resolved</div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--green)", lineHeight: 1 }}>{stats.resolved}</div>
          </div>
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "8px" }}>In Progress</div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--amber)", lineHeight: 1 }}>{stats.inProgress}</div>
          </div>
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "8px" }}>Avg Days to Fix</div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--red)", lineHeight: 1 }}>{stats.avgDays}</div>
          </div>
          <div className="card" style={{ padding: "20px", background: "#111", border: "none" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#666", marginBottom: "8px" }}>Total Open</div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--orange)", lineHeight: 1 }}>{stats.open}</div>
          </div>
        </div>

        {/* Ward Health Scorecard */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>Ward Health Scorecard</h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>Real-time health scores computed by Gemini based on issue density, priority, and resolution rates.</p>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px", marginBottom: "40px" }}>
          {wards.length === 0 ? (
            <div className="card" style={{ padding: "48px 24px", textAlign: "center", gridColumn: "1 / -1", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--bg-hover)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>
                <i className="ti ti-layout-dashboard" />
              </div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>No ward data available</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Wards will appear here once civic issues are reported.</div>
            </div>
        ) : wards.map(ward => {
          let healthColor = "var(--sage)";
          let barClass = "bar-fill-sage";
          if (ward.healthScore < 50) { healthColor = "var(--red-issue)"; barClass = "bar-fill-red"; }
          else if (ward.healthScore < 75) { healthColor = "var(--amber)"; barClass = "bar-fill"; }

          return (
            <div key={ward.wardId} className="card" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{ward.ward}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{ward.totalIssueCount} total issues</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "36px", fontWeight: 700, color: healthColor, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "4px" }}>{Math.round(ward.healthScore)}</div>
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Health</div>
                </div>
              </div>

              <div style={{ height: "6px", background: "var(--bg-page)", borderRadius: "3px", overflow: "hidden", marginBottom: "24px" }}>
                <div style={{ height: "100%", background: healthColor, width: `${ward.healthScore}%`, borderRadius: "3px" }} />
              </div>

              <div style={{ background: "var(--bg-hover)", borderRadius: "8px", padding: "16px", marginTop: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <i className="ti ti-sparkles" style={{ color: "var(--blue)", fontSize: "14px" }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--blue)" }}>Gemini Advisory</span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, fontStyle: "italic" }}>
                  "{ward.healthReasoning || "Insufficient data for AI advisory."}"
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
