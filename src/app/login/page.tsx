"use client";

import React, { useState, useEffect } from "react";
import { signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, isOnboarded, loading: authLoading, showToast } = useAuth();
  const [loading, setLoading] = useState(false);

  // Handle redirects based on global auth state
  useEffect(() => {
    router.replace("/landing");
  }, [router]);

  return <div style={{ minHeight: "100vh", background: "var(--bg-page)" }} />;
}
