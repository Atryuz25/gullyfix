"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buttonPress } from "@/lib/animations";
import { CITIES_AND_WARDS, getWardId } from "@/lib/ward-equity";

const MotionLink = motion.create ? motion.create(Link) : (motion as any)(Link);

export function TopNav({ wardName, xp }: { wardName?: string; xp?: number }) {
  const { user, profile } = useAuth();
  const pathname = usePathname();

  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const initials = profile?.displayName
    ? profile.displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : user?.displayName?.slice(0, 2).toUpperCase() || "?";

  const xpDisplay = xp !== undefined ? xp : (profile?.xpPoints ?? 0);
  const wardDisplay = wardName || profile?.wardName || profile?.wardId?.replace("ward_", "Ward ") || "Ward";

  const userCity = profile?.city || "Mumbai";
  const DEMO_WARDS = (CITIES_AND_WARDS[userCity] || []).map(w => ({
    id: getWardId(userCity, w),
    name: w
  }));

  const handleWardSelect = async (wId: string, wName: string) => {
    setDropdownOpen(false);
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { wardId: wId, wardName: wName });
      await updateDoc(doc(db, "public_profiles", user.uid), { wardId: wId, wardName: wName });
      // The local AuthContext profile will update via onSnapshot automatically!
    } catch (e) {
      console.error("Failed to update ward", e);
    }
  };

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/stats", label: "Stats" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/admin/ledger", label: "Ledger" },
    { href: "/guide", label: "Guide" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="topnav">
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        <Link href="/" className="topnav-logo">
          Gully<span>Fix</span>
        </Link>
        <nav className="nav-links" style={{ display: "flex", gap: "4px" }}>
          {navLinks.map(link => {
            const active = isActive(link.href);
            return (
              <MotionLink
                key={link.href}
                href={link.href}
                className={`nav-link ${active ? "active" : ""}`}
                style={{ position: "relative" }}
                whileHover="hover"
                initial="rest"
                animate={active ? "hover" : "rest"}
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 2, background: "var(--orange)", borderRadius: 1, zIndex: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {!active && (
                  <motion.div
                    variants={{
                      hover: { scaleX: 1, opacity: 1 },
                      rest: { scaleX: 0, opacity: 0 }
                    }}
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: 'var(--orange)',
                      borderRadius: 1,
                      originX: 0
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{link.label}</span>
              </MotionLink>
            );
          })}
        </nav>
      </div>

      <div className="topnav-right">
        {/* Ward chip Dropdown */}
        <div style={{ position: "relative" }}>
          <div 
            className="ward-chip" 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ cursor: "pointer", background: dropdownOpen ? "var(--bg-hover)" : "var(--white)" }}
          >
            <i className="ti ti-map-pin" aria-hidden="true" />
            {wardDisplay}
            <i className={`ti ti-chevron-${dropdownOpen ? 'up' : 'down'}`} style={{ fontSize: "11px", color: "#999", transition: "transform 0.2s" }} aria-hidden="true" />
          </div>
          
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "200px",
                  background: "var(--white)",
                  borderRadius: "12px",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div style={{ padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light)" }}>
                  Change Ward Context
                </div>
                <div style={{ maxHeight: "240px", overflowY: "auto", padding: "4px" }}>
                  {DEMO_WARDS.map((w) => (
                    <div 
                      key={w.id}
                      onClick={() => handleWardSelect(w.id, w.name)}
                      style={{
                        padding: "10px 12px",
                        fontSize: "13px",
                        fontWeight: profile?.wardId === w.id ? 700 : 500,
                        color: profile?.wardId === w.id ? "var(--orange)" : "var(--text-primary)",
                        cursor: "pointer",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {w.name}
                      {profile?.wardId === w.id && <i className="ti ti-check" style={{ fontSize: "14px" }} />}
                    </div>
                  ))}
                </div>
                {/* Link to ward profile instead */}
                {profile?.wardId && (
                  <Link href={`/ward/${profile.wardId}`} onClick={() => setDropdownOpen(false)} style={{ display: "block", padding: "12px 16px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", borderTop: "1px solid var(--border-light)", textAlign: "center", background: "var(--bg-page)" }}>
                    View Ward Profile <i className="ti ti-arrow-right" style={{ fontSize: "11px", marginLeft: 4 }} />
                  </Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* XP pill */}
        <Link href="/profile" style={{ textDecoration: "none" }}>
          <div style={{
            background: "var(--orange-light)",
            color: "var(--orange)",
            borderRadius: "8px",
            padding: "5px 10px",
            fontSize: "12px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}>
            <i className="ti ti-star" style={{ fontSize: "13px" }} />
            {xpDisplay} XP
          </div>
        </Link>

        {/* Report button */}
        <Link href="/report">
          <motion.button 
            className="report-btn"
            whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(255,91,35,0.4)' }}
            whileTap={{ scale: 0.95 }}
            animate={{ boxShadow: ['0 4px 12px rgba(255,91,35,0.2)', '0 8px 24px rgba(255,91,35,0.4)', '0 4px 12px rgba(255,91,35,0.2)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <i className="ti ti-camera" aria-hidden="true" />
            Report issue
          </motion.button>
        </Link>

        {/* Avatar */}
        <Link href="/profile">
          <div className="user-avatar" title="Profile">
            {initials}
          </div>
        </Link>
      </div>
    </div>
  );
}

export function BottomTabs() {
  const pathname = usePathname();

  const tabs = [
    { href: "/", icon: "ti-map", label: "Map" },
    { href: "/stats", icon: "ti-chart-bar", label: "Stats" },
    { href: "/report", icon: "ti-camera", label: "Report" },
    { href: "/leaderboard", icon: "ti-trophy", label: "Ranks" },
    { href: "/profile", icon: "ti-user", label: "Profile" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="bottom-tabs" aria-label="Main navigation">
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href} style={{ flex: 1, display: "flex" }}>
          <motion.button 
            className={`bottom-tab ${isActive(tab.href) ? "active" : ""}`}
            {...buttonPress}
            style={{ flex: 1 }}
          >
            <span className="bottom-tab-icon">
              <i className={`ti ${tab.icon}`} aria-hidden="true" />
            </span>
            {tab.label}
          </motion.button>
        </Link>
      ))}
    </nav>
  );
}
