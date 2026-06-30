import React from "react";
import { IssueCategory, IssueStatus } from "@/lib/types";

export function CategoryBadge({ category }: { category: IssueCategory }) {
  const getProps = (cat: IssueCategory) => {
    switch (cat) {
      case "road_damage": return { label: "Road damage", className: "badge-terra" };
      case "water_leakage": return { label: "Water leakage", className: "badge-sky" };
      case "waste": return { label: "Waste", className: "badge-sage" };
      case "streetlight": return { label: "Streetlight", className: "badge-amber" };
      default: return { label: "Uncategorized", className: "badge-ghost" };
    }
  };
  const { label, className } = getProps(category);
  return <span className={`badge ${className}`}>{label}</span>;
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const getProps = (stat: IssueStatus) => {
    switch (stat) {
      case "open": return { label: "Open", className: "badge-ghost" };
      case "in_progress": return { label: "In progress", className: "badge-amber" };
      case "resolved": return { label: "Resolved", className: "badge-sage" };
      case "merged": return { label: "Merged", className: "badge-ghost" };
      case "pending_triage": return { label: "Pending", className: "badge-ghost" };
      default: return { label: "Unknown", className: "badge-ghost" };
    }
  };
  const { label, className } = getProps(status);
  return <span className={`badge ${className}`}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: number }) {
  let label = "Low priority";
  let className = "badge-sage";

  if (priority >= 75) {
    label = `Priority ${priority}`;
    className = "badge-red";
  } else if (priority >= 40) {
    label = `Priority ${priority}`;
    className = "badge-amber";
  } else {
    label = `Priority ${priority}`;
  }

  return <span className={`badge ${className}`}>{label}</span>;
}

export function StampBadge({ text, verifyCount }: { text?: string; verifyCount?: number }) {
  const label = text || (verifyCount ? `${verifyCount} verified` : "Verified");
  return (
    <div
      style={{
        display: "inline-block",
        border: "2px solid var(--terracotta)",
        color: "var(--terracotta)",
        padding: "4px 8px",
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        textTransform: "uppercase",
        fontSize: "10px",
        letterSpacing: "0.05em",
        transform: "rotate(-2deg)",
        background: "transparent",
        boxShadow: "inset 0 0 0 1px var(--terracotta)",
      }}
    >
      {label}
    </div>
  );
}
