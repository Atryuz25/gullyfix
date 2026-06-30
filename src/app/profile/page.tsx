"use client";

import React, { useEffect, useState } from "react";
import { TopNav, BottomTabs } from "@/components/Navigation";
import { useAuth } from "@/lib/AuthContext";
import { collection, query, where, getDocs, orderBy, onSnapshot, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Issue, PublicProfile, Ward } from "@/lib/types";
import { IssueCard } from "@/components/IssueCard";
import { StatChip } from "@/components/StatChip";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { scaleIn, staggerContainer, staggerItem, fadeUp } from "@/lib/animations";

const TrustScoreRing = ({ score }: { score: number }) => {
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (score / 100) * circumference;
  const label = score >= 80 ? "Verified Citizen" : score >= 50 ? "Active Citizen" : "New Citizen";
  const color = score >= 80 ? "#34C759" : score >= 50 ? "#FF5B23" : "#8E8E93";

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width={64} height={64} viewBox="0 0 64 64" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx={32} cy={32} r={26} fill="none" stroke="#F0F0F0" strokeWidth={5} />
          <motion.circle
            cx={32} cy={32} r={26} fill="none"
            stroke={color} strokeWidth={5} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
          <i className="ti ti-user" style={{ color }} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{score}</div>
        <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
};

const BADGE_META: Record<string, { icon: string; label: string; description: string; color: string }> = {
  first_responder: { icon: "ti-alert-circle", label: "First Responder",   description: "Reported your first issue", color: "var(--red)" },
  sentinel:        { icon: "ti-shield-check", label: "Sentinel",          description: "10 community verifications", color: "var(--blue)" },
  road_warrior:    { icon: "ti-road", label: "Road Warrior",      description: "5 road damage reports", color: "var(--amber)" },
  water_guardian:  { icon: "ti-droplet", label: "Water Guardian",    description: "5 water leakage reports", color: "var(--cyan)" },
  level_5:         { icon: "ti-bolt", label: "Level 5 Hero",      description: "Reached Level 5 (750 XP)", color: "var(--yellow)" },
  civic_champion:  { icon: "ti-trophy", label: "Civic Champion",    description: "1000 XP earned", color: "var(--orange)" },
  first_login:     { icon: "ti-sparkles", label: "Newcomer",          description: "Joined GullyFix", color: "var(--green)" },
};

const LOCKED_BADGES = [
  { id: "sentinel",       icon: "ti-shield-check", label: "Sentinel",       description: "Complete 10 verifications" },
  { id: "road_warrior",   icon: "ti-road", label: "Road Warrior",   description: "Report 5 road damage issues" },
  { id: "water_guardian", icon: "ti-droplet", label: "Water Guardian", description: "Report 5 water leakage issues" },
  { id: "civic_champion", icon: "ti-trophy", label: "Civic Champion", description: "Earn 1000 XP" },
];

export default function ProfilePage() {
  const { user, profile, userDoc, loading } = useAuth();
  const router = useRouter();
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [wardData, setWardData] = useState<Ward | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [activeTab, setActiveTab] = useState<"reports" | "badges">("reports");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Live ward health
  useEffect(() => {
    if (!profile?.wardId) return;
    const unsub = onSnapshot(doc(db, "wards", profile.wardId), (snap) => {
      if (snap.exists()) setWardData(snap.data() as Ward);
    });
    return () => unsub();
  }, [profile?.wardId]);

  useEffect(() => {
    if (!user) return;
    const fetchIssues = async () => {
      try {
        const q = query(
          collection(db, "issues"),
          where("reportedBy", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setMyIssues(snap.docs.map(d => ({ id: d.id, ...d.data() } as Issue)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingIssues(false);
      }
    };
    fetchIssues();
  }, [user]);

  if (loading || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
        <TopNav />
        <div style={{ padding: "32px 20px", maxWidth: "680px", margin: "0 auto", width: "100%" }}>
          <div className="skeleton" style={{ height: "140px", borderRadius: "12px", marginBottom: "20px" }} />
          <div className="skeleton" style={{ height: "80px", borderRadius: "12px", marginBottom: "20px" }} />
          <div className="skeleton" style={{ height: "300px", borderRadius: "12px" }} />
        </div>
      </div>
    );
  }

  const xpPoints = profile.xpPoints || 0;
  const level = Math.floor(xpPoints / 150) + 1;
  const xpRequired = level * 150;
  const xpProgress = Math.min(100, Math.max(0, ((xpPoints - (level - 1) * 150) / 150) * 100));
  const earnedBadges: string[] = profile.badges || [];
  const resolvedCount = myIssues.filter(i => i.status === "resolved").length;

  // Impact & Watchlist computations
  const departmentWatchlist = myIssues.reduce((acc, issue) => {
    if (issue.status === 'disputed' && issue.department) {
      const key = issue.department;
      const existing = acc.find(d => d.departmentName === key);
      if (existing) {
        existing.count++;
      } else {
        acc.push({
          count: 1,
          departmentKey: key.toLowerCase().replace(/\s+/g, '_'),
          departmentName: key,
        });
      }
    }
    return acc;
  }, [] as { count: number; departmentKey: string; departmentName: string }[]);

  const ghostResolutionsCaught = departmentWatchlist.reduce((sum, d) => sum + d.count, 0);
  const reportsCount = profile.reportsCount || 0;
  const verifiedCount = profile.verifyCount || 0;

  const impactSummary = ghostResolutionsCaught > 0 
    ? `Your reports led to ${ghostResolutionsCaught} ghost resolution${ghostResolutionsCaught > 1 ? 's' : ''} being caught.`
    : verifiedCount > 0 
      ? `You've verified ${verifiedCount} civic issue${verifiedCount > 1 ? 's' : ''} for your community.`
      : reportsCount > 0
        ? `You've reported ${reportsCount} civic issue${reportsCount > 1 ? 's' : ''}. Every report makes your ward more accountable.`
        : `Your ward needs a hero. Report your first issue to start making an impact.`;
        
  const trustScore = userDoc?.trustScore ?? 50;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <TopNav />

      <div style={{ padding: "32px 20px 80px", maxWidth: "680px", margin: "0 auto", width: "100%", flex: 1 }}>

        {/* Profile Header */}
        <div className="card" style={{ marginBottom: "24px", display: "flex", gap: "20px", alignItems: "center", padding: "24px" }}>
          <motion.div variants={scaleIn} initial="initial" animate="animate" style={{ flexShrink: 0 }}>
            <TrustScoreRing score={trustScore} />
          </motion.div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px", letterSpacing: "-0.02em" }}>{profile.displayName}</div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>
              {wardData?.ward || profile.wardId?.replace("_", " ")}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span className="badge badge-orange" style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 700 }}>
                LEVEL {level}
              </span>
              {earnedBadges.slice(0, 3).map(b => (
                <span key={b} className="badge badge-ghost" style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }} title={BADGE_META[b]?.label}>
                  <i className={`ti ${BADGE_META[b]?.icon || "ti-medal"}`} style={{ color: BADGE_META[b]?.color || "var(--orange)" }} /> {BADGE_META[b]?.label || b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Impact Summary Line */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          style={{
            fontSize: 15,
            color: ghostResolutionsCaught > 0 ? '#FF3B30' : 'var(--text-primary)',
            fontWeight: ghostResolutionsCaught > 0 ? 600 : 400,
            marginTop: 8,
            marginBottom: 24,
            padding: "0 8px"
          }}
        >
          {impactSummary}
        </motion.div>

        {/* XP Progress */}
        <div className="card" style={{ marginBottom: "24px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            <span>Level {level} Progress</span>
            <span style={{ color: "var(--orange)" }}>{xpPoints - (level - 1) * 150} / 150 XP</span>
          </div>
          <div style={{ height: "8px", background: "var(--bg-page)", borderRadius: "4px", overflow: "hidden", marginBottom: "12px" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1, ease: "easeOut", delay: 0.2 }} style={{ height: "100%", background: "var(--orange)", borderRadius: "4px" }} />
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
            <span>{Math.ceil(xpRequired - xpPoints)} XP to Level {level + 1}</span>
            <span>Total: {xpPoints} XP</span>
          </div>
        </div>

        {/* Ward Health Context */}
        {wardData && (
          <div className="card" style={{ marginBottom: "24px", padding: "16px 20px", background: wardData.urgencyLevel === "critical" ? "var(--red-light)" : "var(--amber-light)", border: `1px solid ${wardData.urgencyLevel === "critical" ? "var(--red)" : "var(--amber-mid)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Your Ward — {wardData.ward}</span>
              <span className={`badge ${wardData.urgencyLevel === "critical" ? "badge-red" : "badge-amber"}`} style={{ fontSize: "10px" }}>
                Health {Math.round(wardData.healthScore)}/100
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{wardData.healthReasoning}</div>
          </div>
        )}

        {/* Stats Grid */}
        <motion.div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "32px" }} variants={staggerContainer} initial="initial" animate="animate">
          <motion.div variants={staggerItem}><StatChip num={profile.reportsCount || 0} label="Reports" /></motion.div>
          <motion.div variants={staggerItem}><StatChip num={profile.verifyCount || 0} label="Verified" /></motion.div>
          <motion.div variants={staggerItem}><StatChip num={resolvedCount} label="Resolved" valueColor="var(--green)" /></motion.div>
          <motion.div variants={staggerItem}><StatChip num={xpPoints} label="Total XP" valueColor="var(--orange)" /></motion.div>
        </motion.div>

        {/* Department Watchlist */}
        {departmentWatchlist.length > 0 && (
          <motion.div variants={fadeUp} initial="initial" animate="animate" style={{ marginBottom: "32px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: '#8E8E93', marginBottom: 12, textTransform: "uppercase" }}>
              Departments you've held accountable
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {departmentWatchlist.map((dept) => (
                <motion.a
                  key={dept.departmentKey}
                  href={`/ward/${dept.departmentKey}?name=${encodeURIComponent(dept.departmentName)}`}
                  whileHover={{ scale: 1.01, backgroundColor: 'var(--bg-hover)' }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12,
                    padding: '12px 16px', textDecoration: 'none'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{dept.departmentName}</div>
                    <div style={{ fontSize: 12, color: '#FF3B30', fontWeight: 500 }}>
                      <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
                      {dept.count} ghost resolution{dept.count > 1 ? 's' : ''} caught
                    </div>
                  </div>
                  <div style={{ fontSize: 16, color: 'var(--text-tertiary)' }}><i className="ti ti-chevron-right" /></div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tab Switch */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "var(--white)", border: "1px solid var(--border)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
          <button
            className="filter-chip"
            style={{ position: "relative", border: "none", background: "transparent", color: activeTab === "reports" ? "var(--text-primary)" : "var(--text-secondary)" }}
            onClick={() => setActiveTab("reports")}
          >
            {activeTab === "reports" && <motion.div layoutId="profileTab" style={{ position: "absolute", inset: 0, background: "var(--bg-page)", borderRadius: "6px", border: "1px solid var(--border-light)", zIndex: 0 }} transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "6px" }}><i className="ti ti-file-report" /> My Reports</span>
          </button>
          <button
            className="filter-chip"
            style={{ position: "relative", border: "none", background: "transparent", color: activeTab === "badges" ? "var(--text-primary)" : "var(--text-secondary)" }}
            onClick={() => setActiveTab("badges")}
          >
            {activeTab === "badges" && <motion.div layoutId="profileTab" style={{ position: "absolute", inset: 0, background: "var(--bg-page)", borderRadius: "6px", border: "1px solid var(--border-light)", zIndex: 0 }} transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
              <i className="ti ti-medal" /> Badges 
              {earnedBadges.length > 0 && <span style={{ background: activeTab === "badges" ? "var(--white)" : "var(--bg-page)", color: activeTab === "badges" ? "var(--text-primary)" : "var(--text-secondary)", borderRadius: "10px", padding: "0 6px", fontSize: "11px", fontWeight: 700, marginLeft: "6px" }}>{earnedBadges.length}</span>}
            </span>
          </button>
        </div>

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="animate-fade-in">
            {loadingIssues ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "140px", borderRadius: "12px" }} />)}
              </div>
            ) : myIssues.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--orange-light)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 16px" }}>
                  <i className="ti ti-building-community" />
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Your ward needs a hero</div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px", maxWidth: "320px", margin: "0 auto 24px" }}>
                  Report your first infrastructure issue to earn 20 XP and your First Responder badge.
                </div>
                <button className="btn btn-primary" onClick={() => router.push("/report")}>Report an issue <i className="ti ti-arrow-right" style={{ marginLeft: "4px" }} /></button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {myIssues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === "badges" && (
          <div className="animate-fade-in">
            {/* Earned */}
            {earnedBadges.length > 0 && (
              <>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "12px" }}>Earned</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px", marginBottom: "32px" }}>
                  {earnedBadges.map(b => {
                    const meta = BADGE_META[b] || { icon: "ti-medal", label: b, description: "Achievement unlocked", color: "var(--orange)" };
                    return (
                      <div key={b} className="card" style={{ padding: "20px 16px", textAlign: "center", background: "var(--white)", border: `1px solid ${meta.color}40`, boxShadow: `0 4px 12px ${meta.color}15` }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: `${meta.color}15`, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 12px" }}>
                          <i className={`ti ${meta.icon}`} />
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{meta.label}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{meta.description}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Locked */}
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "12px" }}>Locked</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px" }}>
              {LOCKED_BADGES.filter(b => !earnedBadges.includes(b.id)).map(b => (
                <div key={b.id} className="card" style={{ padding: "20px 16px", textAlign: "center", background: "var(--bg-page)", opacity: 0.6 }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--border-light)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 12px" }}>
                    <i className={`ti ${b.icon}`} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>{b.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.4 }}>{b.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: "48px", textAlign: "center" }}>
          <button className="btn btn-ghost" onClick={() => auth.signOut()} style={{ color: "var(--red)" }}>
            <i className="ti ti-logout" /> Sign out
          </button>
        </div>
      </div>

      <BottomTabs />
    </div>
  );
}
