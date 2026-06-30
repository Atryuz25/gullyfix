"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Issue, Ward } from "@/lib/types";
import { TopNav, BottomTabs } from "@/components/Navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/animations";
import CountUp from "@/components/CountUp";

function getCategoryColor(cat: string) {
  switch (cat) {
    case "road_damage":   return "var(--orange)";
    case "water_leakage": return "var(--blue)";
    case "streetlight":   return "var(--amber)";
    case "waste":         return "var(--green)";
    default:              return "var(--text-secondary)";
  }
}

function getCategoryLabel(cat: string) {
  switch (cat) {
    case "road_damage":   return "Roads";
    case "water_leakage": return "Water";
    case "streetlight":   return "Lights";
    case "waste":         return "Waste";
    default:              return "Other";
  }
}

export default function StatsPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [iSnap, wSnap] = await Promise.all([
          getDocs(query(collection(db, "issues"), orderBy("createdAt", "desc"))),
          getDocs(collection(db, "wards"))
        ]);
        setIssues(iSnap.docs.map(d => ({ id: d.id, ...d.data() } as Issue)));
        setWards(wSnap.docs.map(d => ({ wardId: d.id, ...d.data() } as Ward)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
        <TopNav />
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 20px" }}>
          <div className="skeleton" style={{ height: "140px", borderRadius: "12px", marginBottom: "24px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div className="skeleton" style={{ height: "240px", borderRadius: "12px" }} />
            <div className="skeleton" style={{ height: "240px", borderRadius: "12px" }} />
          </div>
        </div>
      </div>
    );
  }

  // Derived metrics
  const resolved = issues.filter(i => i.status === "resolved");
  const disputed = issues.filter(i => i.status === "disputed");
  const slaBreached = issues.filter(i => i.slaBreached);
  const openCount = issues.filter(i => !["resolved", "merged", "disputed"].includes(i.status)).length;
  
  const totalAttempts = resolved.length + disputed.length;
  const accountabilityIndex = totalAttempts > 0 ? Math.round((resolved.length / totalAttempts) * 100) : 100;

  // Category Breakdown
  const catCounts = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const maxCatCount = Math.max(...Object.values(catCounts), 1);

  // Ward performance derived purely from issues
  const wardsMap: Record<string, { id: string, name: string, disputes: number, slas: number }> = {};
  
  issues.forEach(i => {
    const wId = i.wardId || "unknown";
    if (!wardsMap[wId]) {
      wardsMap[wId] = {
        id: wId,
        name: i.ward || wId.replace("_", " ").toUpperCase(),
        disputes: 0,
        slas: 0
      };
    }
    if (i.status === "disputed") wardsMap[wId].disputes += 1;
    if (i.slaBreached) wardsMap[wId].slas += 1;
  });

  const wardStats = Object.values(wardsMap)
    .sort((a, b) => b.disputes - a.disputes || b.slas - a.slas)
    .slice(0, 5);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <TopNav />

      <div style={{ flex: 1, maxWidth: "960px", margin: "0 auto", padding: "32px 20px 80px", width: "100%" }}>
        
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "8px" }}>
            Citywide Analytics
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
            Real-time performance and accountability metrics across all municipal wards.
          </p>
        </div>

        {/* Top level stats */}
        <motion.div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }} variants={staggerContainer} initial="initial" animate="animate">
          <motion.div className="card" style={{ padding: "24px", background: "#111", border: "none" }} variants={staggerItem}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#666", marginBottom: "8px" }}>
              Global Accountability
            </div>
            <div style={{ fontSize: "48px", fontWeight: 700, color: "var(--orange)", lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "8px" }}>
              <CountUp value={accountabilityIndex} />%
            </div>
            <div style={{ fontSize: "13px", color: "#999" }}>
              Resolutions confirmed without citizen dispute
            </div>
          </motion.div>
          
          <motion.div className="card" style={{ padding: "24px" }} variants={staggerItem}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "8px" }}>
              Total Ghost Resolutions
            </div>
            <div style={{ fontSize: "40px", fontWeight: 700, color: disputed.length > 0 ? "var(--red)" : "var(--green)", lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "8px" }}>
              <CountUp value={disputed.length} />
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Admin closures rejected by citizens
            </div>
          </motion.div>

          <motion.div className="card" style={{ padding: "24px" }} variants={staggerItem}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "8px" }}>
              SLA Breaches
            </div>
            <div style={{ fontSize: "40px", fontWeight: 700, color: slaBreached.length > 0 ? "var(--red)" : "var(--green)", lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "8px" }}>
              <CountUp value={slaBreached.length} />
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Issues past departmental deadlines
            </div>
          </motion.div>
        </motion.div>

        {/* Charts Grid */}
        <motion.div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }} variants={staggerContainer} initial="initial" animate="animate">
          
          {/* Categories */}
          <motion.div className="card" style={{ padding: "24px" }} variants={staggerItem}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>
              Issue Distribution
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {Object.keys(catCounts).length === 0 ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No issues reported yet</div>
              ) : Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    <span>{getCategoryLabel(cat)}</span>
                    <span><CountUp value={count} /></span>
                  </div>
                  <div style={{ height: "8px", background: "var(--bg-page)", borderRadius: "4px", overflow: "hidden" }}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxCatCount) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                      style={{ height: "100%", background: getCategoryColor(cat), borderRadius: "4px" }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Worst Performing Wards */}
          <motion.div className="card" style={{ padding: "24px" }} variants={staggerItem}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>
              Ward Risk Watchlist
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {wardStats.length === 0 ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No ward data available</div>
              ) : wardStats.map((w, i) => (
                <Link key={w.id} href={`/ward/${w.id}?name=${encodeURIComponent(w.name)}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--orange-light)"; e.currentTarget.style.borderColor = "var(--orange-mid)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-page)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: i < 2 ? "var(--red-light)" : "var(--white)", color: i < 2 ? "var(--red)" : "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{w.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Derived from recent activity</div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {w.disputes > 0 && <span className="badge badge-red">{w.disputes} Disputed</span>}
                      {w.slas > 0 && <span className="badge badge-amber">{w.slas} SLA</span>}
                    </div>
                    <i className="ti ti-chevron-right" style={{ color: "var(--text-tertiary)", fontSize: "14px" }} />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
          
        </motion.div>
      </div>
      <BottomTabs />
    </div>
  );
}
