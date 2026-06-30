"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, animate } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";

// ─── Reusable Components ────────────────────────────────────────────────────────

const ScrollFadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
};

const StatCounter = ({ to, suffix = "", duration = 2 }: { to: number; suffix?: string; duration?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const count = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, to, {
        duration,
        ease: "easeOut",
        onUpdate: (v) => setDisplay(Math.round(v).toLocaleString())
      });
      return controls.stop;
    }
  }, [isInView, count, to, duration]);

  return <span ref={ref}>{display}{suffix}</span>;
};

const Typewriter = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  if (!isInView) return <span ref={ref} style={{ opacity: 0 }}>{text}</span>;
  
  return (
    <span ref={ref}>
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.05, delay: delay + index * 0.03 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
};

const AuthButton = ({ className, text = "Sign in with Google", ghost = false }: { className?: string, text?: string, ghost?: boolean }) => {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      showToast({ type: "error", message: err.message || "Failed to login" });
      setLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleAuth}
      disabled={loading}
      className={className}
      style={ghost ? {
        background: "transparent",
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
        padding: "16px 32px",
        borderRadius: "8px",
        fontSize: "16px",
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      } : {
        background: "var(--orange)",
        color: "var(--white)",
        border: "none",
        padding: "16px 32px",
        borderRadius: "8px",
        fontSize: "16px",
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 4px 14px rgba(255,91,35,0.3)"
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {loading ? (
        <span style={{ opacity: 0.8 }}>Authenticating...</span>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: ghost ? "none" : "block", background: "white", borderRadius: "50%", padding: "2px" }}>
            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.78 15.68 17.55V20.34H19.25C21.34 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
            <path d="M12 23C14.97 23 17.46 22.02 19.25 20.34L15.68 17.55C14.71 18.2 13.46 18.59 12 18.59C9.17 18.59 6.78 16.68 5.88 14.12H2.21V16.97C4.01 20.54 7.7 23 12 23Z" fill="#34A853"/>
            <path d="M5.88 14.12C5.65 13.44 5.52 12.73 5.52 12C5.52 11.27 5.65 10.56 5.88 9.88V7.03H2.21C1.47 8.5 1.05 10.2 1.05 12C1.05 13.8 1.47 15.5 2.21 16.97L5.88 14.12Z" fill="#FBBC05"/>
            <path d="M12 5.41C13.62 5.41 15.07 5.96 16.21 7.05L19.33 3.93C17.45 2.18 14.97 1.1 12 1.1C7.7 1.1 4.01 3.46 2.21 7.03L5.88 9.88C6.78 7.32 9.17 5.41 12 5.41Z" fill="#EA4335"/>
          </svg>
          {text}
        </>
      )}
    </motion.button>
  );
};

// ─── Sections ───────────────────────────────────────────────────────────────

const Hero = () => {
  const scrollToNext = () => {
    document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", overflow: "hidden" }}>
      {/* Background Blob */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "800px", height: "800px", background: "radial-gradient(circle, rgba(255,91,35,0.08) 0%, rgba(255,255,255,0) 70%)", zIndex: -1, pointerEvents: "none" }} />
      
      <div style={{ maxWidth: "720px", width: "100%", textAlign: "center" }}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ fontSize: "28px", fontWeight: 800, marginBottom: "40px", letterSpacing: "-0.02em" }}
        >
          Gully<span style={{ color: "var(--orange)" }}>Fix</span>
        </motion.div>

        <ScrollFadeIn delay={0.1}>
          <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "24px" }}>
            Civic Accountability Infrastructure
          </div>
        </ScrollFadeIn>

        <motion.h1 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ duration: 0.8, staggerChildren: 0.2 }}
          style={{ fontSize: "clamp(48px, 8vw, 72px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "32px" }}
        >
          <motion.span initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ display: "block" }}>Civic reporting is solved.</motion.span>
          <motion.span initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} style={{ display: "block", color: "var(--text-secondary)" }}>The fraud happens after.</motion.span>
        </motion.h1>

        <ScrollFadeIn delay={0.6}>
          <p style={{ fontSize: "18px", lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: "560px", margin: "0 auto 48px" }}>
            Ward offices in Indian cities mark tickets &apos;Resolved&apos; without fixing them — just to hit KPI targets. Citizens have no recourse. GullyFix makes that impossible.
          </p>
        </ScrollFadeIn>

        <ScrollFadeIn delay={0.8}>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginBottom: "64px" }}>
            <AuthButton />
            <motion.button
              onClick={scrollToNext}
              style={{
                background: "transparent",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                padding: "16px 32px",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Watch how it works ↓
            </motion.button>
          </div>
        </ScrollFadeIn>

        <ScrollFadeIn delay={1.0}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", fontSize: "14px", color: "var(--text-tertiary)", flexWrap: "wrap", fontWeight: 500 }}>
            <span><StatCounter to={1200} suffix="+" /> issues tracked</span>
            <span style={{ opacity: 0.3 }}>•</span>
            <span><StatCounter to={18} /> cities</span>
            <span style={{ opacity: 0.3 }}>•</span>
            <span><StatCounter to={22} suffix="%" /> ghost resolution rate caught</span>
          </div>
        </ScrollFadeIn>
      </div>
    </section>
  );
};

const TheProblem = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20%" });

  return (
    <section id="problem" style={{ padding: "120px 20px", background: "#F9FAFB" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "64px", alignItems: "center" }}>
        
        {/* Left Column */}
        <div>
          <ScrollFadeIn>
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "16px" }}>
              The Problem
            </div>
            <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: "32px", lineHeight: 1.1 }}>
              The &apos;Ghost Resolution&apos; epidemic
            </h2>
          </ScrollFadeIn>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontSize: "17px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
            <ScrollFadeIn delay={0.2}>
              <p>Urban Local Bodies face pressure to show high closure rates. Junior engineers mark complaints &apos;fixed&apos; without deploying a work crew — just to satisfy internal KPIs.</p>
            </ScrollFadeIn>
            <ScrollFadeIn delay={0.3}>
              <p>Citizens reopen the ticket. It gets reassigned to the same officer who closed it. The cycle repeats until people give up.</p>
            </ScrollFadeIn>
            <ScrollFadeIn delay={0.4}>
              <p>The digitization of reporting was the easy part. The absence of real accountability turned civic reporting into a dead end.</p>
            </ScrollFadeIn>
          </div>
        </div>

        {/* Right Column - SVG Diagram */}
        <div ref={ref} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", background: "var(--white)", borderRadius: "24px", border: "1px solid var(--border)", boxShadow: "0 20px 40px rgba(0,0,0,0.03)" }}>
          <svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path 
              d="M120 40 A80 80 0 1 1 40 120" 
              stroke="var(--border-dark)" strokeWidth="4" strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={isInView ? { pathLength: 1 } : {}}
              transition={{ duration: 1, ease: "easeInOut" }}
            />
            <motion.path 
              d="M40 120 A80 80 0 0 1 120 40" 
              stroke="var(--border-dark)" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 6"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 0.5 } : {}}
              transition={{ duration: 0.5, delay: 1 }}
            />
            <motion.path 
              d="M110 30 L120 40 L110 50" 
              stroke="var(--border-dark)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.3, delay: 1 }}
            />
            
            {/* The Red X */}
            <motion.g 
              initial={{ opacity: 0, scale: 0, rotate: -45 }}
              animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : {}}
              transition={{ type: "spring", stiffness: 300, damping: 15, delay: 1.5 }}
            >
              <circle cx="120" cy="120" r="24" fill="var(--red-light)" />
              <path d="M112 112 L128 128 M128 112 L112 128" stroke="var(--red)" strokeWidth="4" strokeLinecap="round" />
            </motion.g>
          </svg>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={isInView ? { opacity: 1 } : {}} 
            transition={{ duration: 0.5, delay: 1.8 }}
            style={{ marginTop: "24px", fontSize: "14px", fontWeight: 600, color: "var(--text-tertiary)", textAlign: "center" }}
          >
            This loop runs indefinitely.<br/>GullyFix breaks it.
          </motion.div>
        </div>

      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    {
      icon: "ti-camera", title: "Citizen reports, AI triages instantly",
      desc: "A photo and location are all it takes. Cloud Vision checks for safety, Gemini 2.5 classifies the issue, scores priority, and routes it to the right department — in under 5 seconds.",
      trace: ["✅ Image analyzed — road damage confirmed", "✅ Gemini: Priority 84 — Routed to BBMP Roads"]
    },
    {
      icon: "ti-scale", title: "Underserved wards get heard, not just the loudest ones",
      desc: "Affluent neighborhoods over-report minor issues. Under-resourced wards go unmapped. GullyFix cross-references every report against a ward equity index and automatically boosts urgency in historically under-invested areas.",
      trace: ["📊 Ward equity index: Kurla (underserved)", "⬆️ Priority upgraded: 62 → 84 (1.35x multiplier)"]
    },
    {
      icon: "ti-map-pin", title: "A pothole near a hospital isn't the same as one in a cul-de-sac",
      desc: "Google Places API scans for schools, hospitals, and transit hubs within 150 meters of every reported hazard. If found, the resolution deadline is automatically cut in half.",
      trace: ["🏥 KEM Hospital detected 67m away", "⚡ SLA reduced: 7 days → 3 days"]
    },
    {
      icon: "ti-shield-check", title: "When officials say 'fixed,' citizens get the final word",
      desc: "A resolution claim doesn't close the ticket — it opens a verification window. Nearby citizens are notified to confirm. If disputed with photo evidence, Gemini runs a 3-way visual comparison against the original report and the resolution claim.",
      trace: ["❌ RESOLUTION REJECTED", "Damage pattern persists across all three images."]
    },
    {
      icon: "ti-gavel", title: "Fraud has consequences, automatically",
      desc: "Every confirmed ghost resolution deducts reputation points from the responsible department. Below a threshold, they're publicly flagged and locked from new contracts for 180 days.",
      trace: ["📉 MCGM Roads reputation: 86 → 74", "🚫 Approaching blacklist threshold"]
    }
  ];

  return (
    <section style={{ padding: "120px 20px", background: "var(--white)" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", marginBottom: "80px" }}>
        <ScrollFadeIn>
          <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "16px" }}>
            How It Works
          </div>
          <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: "24px", lineHeight: 1.1 }}>
            Five autonomous agents.<br/>One closed loop.
          </h2>
          <p style={{ fontSize: "18px", color: "var(--text-secondary)" }}>
            Every report triggers a chain of AI decisions —<br/>no human has to click through a single one.
          </p>
        </ScrollFadeIn>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "64px" }}>
        {steps.map((step, idx) => {
          const isEven = idx % 2 === 0;
          return (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "40px", alignItems: "center" }}>
              
              <div style={{ order: isEven ? 1 : 2 }}>
                <ScrollFadeIn>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--orange-light)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800 }}>
                      {idx + 1}
                    </div>
                    <i className={`ti ${step.icon}`} style={{ fontSize: "24px", color: "var(--orange)" }} />
                  </div>
                  <h3 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)", marginBottom: "16px" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "16px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                    {step.desc}
                  </p>
                </ScrollFadeIn>
              </div>

              <div style={{ order: isEven ? 2 : 1 }}>
                <ScrollFadeIn delay={0.2}>
                  <div style={{ background: "#111111", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.1)", border: "1px solid #333", color: "#00FF41", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6 }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF5F56" }} />
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFBD2E" }} />
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#27C93F" }} />
                    </div>
                    <div>
                      <Typewriter text={step.trace[0]} delay={0.4} /><br/>
                      <Typewriter text={step.trace[1]} delay={1.4} />
                    </div>
                  </div>
                </ScrollFadeIn>
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
};

const LiveImpact = () => {
  return (
    <section style={{ padding: "120px 20px", background: "#111111", color: "var(--white)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ textAlign: "center", marginBottom: "80px" }}>
          <ScrollFadeIn>
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.15em", color: "#888", textTransform: "uppercase", marginBottom: "16px" }}>
              Real-Time Accountability
            </div>
            <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--white)", marginBottom: "24px", lineHeight: 1.1 }}>
              This isn't a mockup.<br/>This is live data.
            </h2>
          </ScrollFadeIn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "40px", marginBottom: "80px", textAlign: "center" }}>
          <ScrollFadeIn delay={0.1}>
            <div style={{ fontSize: "64px", fontWeight: 800, color: "var(--orange)", letterSpacing: "-0.03em", marginBottom: "12px", lineHeight: 1 }}>
              <StatCounter to={78} suffix="%" />
            </div>
            <div style={{ fontSize: "15px", color: "#888", maxWidth: "200px", margin: "0 auto" }}>Avg Accountability Index across wards</div>
          </ScrollFadeIn>
          
          <ScrollFadeIn delay={0.2}>
            <div style={{ fontSize: "64px", fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", marginBottom: "12px", lineHeight: 1 }}>
              <StatCounter to={22} />
            </div>
            <div style={{ fontSize: "15px", color: "#888", maxWidth: "200px", margin: "0 auto" }}>Ghost resolutions caught and corrected</div>
          </ScrollFadeIn>

          <ScrollFadeIn delay={0.3}>
            <div style={{ fontSize: "64px", fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", marginBottom: "12px", lineHeight: 1 }}>
              <StatCounter to={1200} suffix="+" />
            </div>
            <div style={{ fontSize: "15px", color: "#888", maxWidth: "200px", margin: "0 auto" }}>Issues tracked across 18 cities</div>
          </ScrollFadeIn>
        </div>

        {/* Live Feed Simulator using actual seed ward names */}
        <ScrollFadeIn delay={0.5}>
          <div style={{ maxWidth: "600px", margin: "0 auto", background: "#1A1A1A", borderRadius: "16px", padding: "24px", border: "1px solid #333" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#666", textTransform: "uppercase", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
              <span>Live System Feed</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#27C93F", boxShadow: "0 0 8px #27C93F", animation: "pulse 2s infinite" }} />
                Connected
              </span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "14px" }}>
                <div style={{ color: "#FF5F56", marginTop: "2px" }}>🔴</div>
                <div>
                  <div style={{ color: "#FFF" }}>Ghost resolution caught — <span style={{ color: "#888" }}>Kurla, Mumbai</span></div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>2 hours ago</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "14px" }}>
                <div style={{ color: "#27C93F", marginTop: "2px" }}>🟢</div>
                <div>
                  <div style={{ color: "#FFF" }}>Issue verified resolved — <span style={{ color: "#888" }}>Madhapur, Hyderabad</span></div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>4 hours ago</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "14px" }}>
                <div style={{ color: "#FF5F56", marginTop: "2px" }}>🔴</div>
                <div>
                  <div style={{ color: "#FFF" }}>Ghost resolution caught — <span style={{ color: "#888" }}>Gajuwaka, Visakhapatnam</span></div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>6 hours ago</div>
                </div>
              </div>
            </div>
          </div>
        </ScrollFadeIn>
        
      </div>
    </section>
  );
};

const TechStack = () => {
  const stack = [
    { title: "Gemini 2.5", desc: "Multimodal triage & fraud detection" },
    { title: "Cloud Vision", desc: "Safe search moderation" },
    { title: "Maps Platform", desc: "Heatmaps & clustering" },
    { title: "Places API", desc: "Vulnerable corridor detection" },
    { title: "Firestore", desc: "Real-time sync across the platform" },
    { title: "Firebase Auth", desc: "Google Sign-In" },
    { title: "Cloud Run", desc: "Production deployment" },
    { title: "Cloud Scheduler", desc: "Nightly risk prediction" },
  ];

  return (
    <section style={{ padding: "120px 20px", background: "#F9FAFB" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
          <ScrollFadeIn>
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "16px" }}>
              Built on Google Cloud
            </div>
            <h2 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              Real infrastructure, not a prototype
            </h2>
          </ScrollFadeIn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {stack.map((item, idx) => (
            <ScrollFadeIn key={idx} delay={idx * 0.1}>
              <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", height: "100%", transition: "box-shadow 0.2s", cursor: "default" }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.05)"} onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>{item.title}</div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </ScrollFadeIn>
          ))}
        </div>

      </div>
    </section>
  );
};

const FinalCTA = () => {
  return (
    <section style={{ padding: "120px 20px", background: "var(--white)", textAlign: "center" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <ScrollFadeIn>
          <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: "40px", lineHeight: 1.1 }}>
            Stop reporting.<br/>Start holding accountable.
          </h2>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <AuthButton />
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-tertiary)" }}>
            Free to use. No app download required.
          </div>
        </ScrollFadeIn>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer style={{ padding: "32px 20px", background: "#F9FAFB", borderTop: "1px solid var(--border-light)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ fontSize: "16px", fontWeight: 800 }}>
          Gully<span style={{ color: "var(--orange)" }}>Fix</span>
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
          Built for Google Gen AI Hackathon · 2026
        </div>
        <div>
          <a href="#" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}><i className="ti ti-brand-github" style={{ fontSize: "20px" }} /></a>
        </div>
      </div>
    </footer>
  );
};

// ─── Main Page Export ───────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "var(--white)" }} />;
  }

  // Prevent flash of landing page if redirecting to dashboard
  if (user) {
    return null;
  }

  return (
    <main style={{ background: "var(--white)", color: "var(--text-primary)", overflowX: "hidden" }}>
      <Hero />
      <TheProblem />
      <HowItWorks />
      <LiveImpact />
      <TechStack />
      <FinalCTA />
      <Footer />
    </main>
  );
}
