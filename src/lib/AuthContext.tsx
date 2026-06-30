"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ToastMessage } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  profile: any | null; // PublicProfile
  userDoc: any | null; // Private user doc
  isOnboarded: boolean;
  loading: boolean;
  // Toast system
  toasts: ToastMessage[];
  showToast: (msg: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  userDoc: null,
  isOnboarded: false,
  loading: true,
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [userDoc, setUserDoc] = useState<any | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((msg: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...msg, id }]);
    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const unsubscribeProfile = onSnapshot(doc(db, "public_profiles", firebaseUser.uid), (doc) => {
          if (doc.exists()) {
            setProfile(doc.data());
          } else {
            setProfile(null);
          }
        });

        const unsubscribeUserDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserDoc(data);
            setIsOnboarded(data.onboardingStatus?.includes('ai_briefed') || false);
          } else {
            setUserDoc(null);
            setIsOnboarded(false);
          }
          setLoading(false);
        });
        
        return () => {
          unsubscribeProfile();
          unsubscribeUserDoc();
        };
      } else {
        setProfile(null);
        setUserDoc(null);
        setIsOnboarded(false);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, userDoc, isOnboarded, loading, toasts, showToast, dismissToast }}>
      {children}
      {/* Global Toast Renderer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AuthContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  const iconMap: Record<string, string> = {
    success: "ti-circle-check",
    error: "ti-circle-x",
    warning: "ti-alert-triangle",
    info: "ti-info-circle",
  };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          onClick={() => onDismiss(t.id)}
          style={{ cursor: "pointer" }}
        >
          <i className={`ti ${iconMap[t.type] || "ti-info-circle"} toast-icon`} aria-hidden="true" />
          <div className="toast-body">
            <div className="toast-msg">{t.message}</div>
            {t.xp && <div className="toast-xp">+{t.xp} XP</div>}
          </div>
          <i className="ti ti-x" style={{ fontSize: "14px", color: "var(--text-tertiary)", flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export const useAuth = () => useContext(AuthContext);
