"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopNav } from "@/components/Navigation";

const NAV = [
  { href: "/admin", label: "Control Room", icon: "ti-layout-dashboard" },
  { href: "/admin/ledger", label: "Issue Ledger", icon: "ti-list-check" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <div style={{
      width: "220px", background: "var(--white)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
    }}>
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border-light)" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          Admin Panel
        </div>
      </div>
      <div style={{ padding: "8px" }}>
        {NAV.map(item => (
          <Link key={item.href} href={item.href}>
            <div className={`admin-nav-item ${pathname === item.href ? "active" : ""}`}>
              <i className={`ti ${item.icon}`} style={{ fontSize: "16px" }} />
              {item.label}
            </div>
          </Link>
        ))}
        <div style={{ borderTop: "1px solid var(--border-light)", margin: "8px 0" }} />
        <Link href="/">
          <div className="admin-nav-item">
            <i className="ti ti-arrow-left" style={{ fontSize: "16px" }} />
            Back to Map
          </div>
        </Link>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-page)" }}>
      <TopNav />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <AdminSidebar />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
