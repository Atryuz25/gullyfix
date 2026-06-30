"use client";

import React, { useEffect, useState } from "react";
import { TopNav, BottomTabs } from "@/components/Navigation";
import { collection, query, orderBy, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { PublicProfile, Ward } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer, staggerItem, buttonPress } from "@/lib/animations";
import CountUp from "@/components/CountUp";

import { CITIES_AND_WARDS, getWardId } from "@/lib/ward-equity";

const BADGE_META: Record<string, { icon: string; label: string; color: string }> = {
  first_responder: { icon: "ti-alert-circle", label: "First Responder", color: "var(--red)" },
  sentinel:        { icon: "ti-shield-check", label: "Sentinel", color: "var(--blue)" },
  road_warrior:    { icon: "ti-road", label: "Road Warrior", color: "var(--amber)" },
  water_guardian:  { icon: "ti-droplet", label: "Water Guardian", color: "var(--cyan)" },
  level_5:         { icon: "ti-bolt", label: "Level 5 Hero", color: "var(--yellow)" },
  civic_champion:  { icon: "ti-trophy", label: "Civic Champion", color: "var(--orange)" },
  first_login:     { icon: "ti-sparkles", label: "Newcomer", color: "var(--green)" },
};

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const [leaders, setLeaders] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(profile?.wardId || "global"); // "global" means city-wide here
  const [activeCity, setActiveCity] = useState(profile?.city || "Mumbai");
  const [wardHealth, setWardHealth] = useState<Record<string, Ward>>({});
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // When city changes, reset tab to 'global' (city-wide)
  useEffect(() => {
    if (activeCity !== profile?.city) {
      setActiveTab("global");
    } else {
      setActiveTab(profile?.wardId || "global");
    }
  }, [activeCity, profile]);

  useEffect(() => {
    const fetchLeaders = async () => {
      setLoading(true);
      try {
        let q;
        if (activeTab === "global") {
          q = query(collection(db, "public_profiles"), where("city", "==", activeCity), orderBy("xpPoints", "desc"), limit(50));
        } else {
          q = query(collection(db, "public_profiles"), where("wardId", "==", activeTab), orderBy("xpPoints", "desc"), limit(50));
        }

        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as PublicProfile));
        setLeaders(data);

        // Fetch ward health for context
        const wardIds = [...new Set(data.map(p => p.wardId).filter(Boolean))];
        const healthMap: Record<string, Ward> = {};
        await Promise.all(wardIds.map(async (wid) => {
          const wSnap = await getDoc(doc(db, "wards", wid));
          if (wSnap.exists()) healthMap[wid] = wSnap.data() as Ward;
        }));
        setWardHealth(healthMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaders();
  }, [activeTab]);

  const myRank = leaders.findIndex(l => l.uid === profile?.uid) + 1;
  const myProfile = leaders.find(l => l.uid === profile?.uid);
  const xpToNext = myProfile ? (Math.ceil((myProfile.xpPoints + 1) / 150) * 150 - myProfile.xpPoints) : 0;

  if (!isMounted) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
        <TopNav />
        <div style={{ flex: 1, padding: "32px 20px" }}>
           {/* Empty div for hydration pass */}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <TopNav />

      <div style={{ flex: 1, padding: "32px 20px 80px", maxWidth: "680px", margin: "0 auto", width: "100%" }}>
        
        {/* Header */}
        <motion.div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }} variants={fadeUp} initial="initial" animate="animate">
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "8px" }}>
              Leaderboard
            </h1>
            <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
              Top civic contributors ranked by XP earned through reporting and verifying issues.
            </p>
          </div>
          <div>
            <select 
              className="select" 
              value={activeCity} 
              onChange={(e) => setActiveCity(e.target.value)}
              style={{ padding: "8px 16px", borderRadius: "100px", fontWeight: 600, background: "var(--cream-dark)", border: "1px solid var(--border)" }}
            >
              {Object.keys(CITIES_AND_WARDS).sort().map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Ward filter tabs */}
        <div style={{ display: "flex", overflowX: "auto", gap: "8px", marginBottom: "24px", paddingBottom: "8px", msOverflowStyle: "none", scrollbarWidth: "none" }}>
          {[ { id: "global", name: "City Overall" }, ...(CITIES_AND_WARDS[activeCity] || []).map(w => ({ id: getWardId(activeCity, w), name: w })) ].map(w => {
            const isActive = activeTab === w.id;
            return (
              <motion.button
                key={w.id}
                {...buttonPress}
                className="filter-chip"
                style={{ padding: "8px 16px", borderRadius: "100px", flexShrink: 0, position: "relative", border: isActive ? "1px solid transparent" : undefined }}
                onClick={() => setActiveTab(w.id)}
              >
                {isActive && (
                  <motion.div 
                    layoutId="leaderboard-tab" 
                    style={{ position: "absolute", inset: 0, borderRadius: "100px", background: "var(--text-primary)", zIndex: 0 }} 
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", color: isActive ? "var(--bg-page)" : "inherit", whiteSpace: "nowrap" }}>
                  {w.id === "global" && <i className="ti ti-world" style={{ marginRight: "6px" }} />}
                  {w.name}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* My rank strip (if in top 50) */}
        {myRank > 0 && myProfile && (
          <motion.div 
            className="card" 
            style={{ padding: "16px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "16px", background: "var(--orange-light)", border: "1px solid var(--orange-mid)" }}
            animate={{ boxShadow: ['0 4px 12px rgba(255,91,35,0.1)', '0 8px 24px rgba(255,91,35,0.25)', '0 4px 12px rgba(255,91,35,0.1)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--orange)", width: "40px", textAlign: "center" }}>
              #{myRank}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--orange-dark)", marginBottom: "2px" }}>You</div>
              <div style={{ fontSize: "13px", color: "var(--orange)", fontWeight: 500 }}>{myProfile.xpPoints} XP · {xpToNext} XP to next level</div>
            </div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 10px", background: "var(--white)", borderRadius: "6px" }}>
              Level {Math.floor((myProfile.xpPoints || 0) / 150) + 1}
            </div>
          </motion.div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "12px" }} />
            ))}
          </div>
        ) : leaders.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--orange-light)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 16px" }}>
              <i className="ti ti-trophy" />
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>No heroes yet</div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Be the first to report an issue in this area!</div>
          </div>
        ) : (
          <motion.div className="card" style={{ padding: 0, overflow: "hidden" }} variants={staggerContainer} initial="initial" animate="animate">
            {leaders.map((leader, idx) => {
              const isMe = profile?.uid === leader.uid;
              const level = Math.floor((leader.xpPoints || 0) / 150) + 1;
              const rankDisplay = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

              return (
                <motion.div
                  key={leader.uid || leader.displayName || idx}
                  variants={staggerItem}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "16px",
                    borderBottom: idx < leaders.length - 1 ? "1px solid var(--border-light)" : "none",
                    background: isMe ? "var(--bg-hover)" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <motion.div 
                    initial={idx < 3 ? { scale: 0, y: -20 } : {}}
                    animate={idx < 3 ? { scale: 1, y: 0 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 15, delay: idx * 0.1 + 0.3 }}
                    style={{ width: "40px", textAlign: "center", fontWeight: 700, fontSize: idx < 3 ? "24px" : "15px", color: idx < 3 ? "inherit" : "var(--text-tertiary)", flexShrink: 0 }}
                  >
                    {rankDisplay}
                  </motion.div>

                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: idx * 0.05 + 0.2 }}
                    style={{
                    width: "44px", height: "44px", borderRadius: "50%",
                    background: leader.photoURL ? "transparent" : "var(--bg-page)",
                    border: isMe ? "2px solid var(--orange)" : "1px solid var(--border)",
                    marginLeft: "12px", marginRight: "16px",
                    backgroundImage: leader.photoURL ? `url(${leader.photoURL})` : "none",
                    backgroundSize: "cover", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "20px", color: "var(--text-tertiary)"
                  }}>
                    {!leader.photoURL && <i className="ti ti-user" />}
                  </motion.div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      {leader.displayName}
                      {isMe && <span className="badge badge-orange" style={{ fontSize: "9px", padding: "2px 6px" }}>YOU</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px", color: "var(--text-secondary)" }}>
                      <span style={{ fontWeight: 600 }}>Lvl {level}</span>
                      <span style={{ opacity: 0.4 }}>•</span>
                      <span>{leader.reportsCount || 0} reports</span>
                      {(leader.badges || []).length > 0 && <span style={{ opacity: 0.4 }}>•</span>}
                      {/* Show badges */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        {(leader.badges || []).slice(0, 3).map(b => (
                          <i key={b} className={`ti ${BADGE_META[b]?.icon || "ti-medal"}`} title={BADGE_META[b]?.label || b} style={{ color: BADGE_META[b]?.color || "var(--orange)", fontSize: "14px" }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "18px", color: "var(--orange)", lineHeight: 1 }}>
                      <CountUp value={leader.xpPoints} />
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", marginTop: "4px", letterSpacing: "0.05em" }}>XP</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Motivation strip */}
        {myProfile && (
          <div style={{ marginTop: "24px", textAlign: "center", padding: "16px", borderRadius: "12px", background: "var(--bg-hover)" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              {xpToNext} XP to Level {Math.floor((myProfile.xpPoints || 0) / 150) + 2}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Report or verify issues to climb the ranks</div>
          </div>
        )}
      </div>

      <BottomTabs />
    </div>
  );
}
