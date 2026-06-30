import React from "react";
import CountUp from "@/components/CountUp";

export function StatChip({ num, label, valueColor = "var(--text-primary)", sublabel }: { num: string | number; label: string; valueColor?: string; sublabel?: string }) {
  return (
    <div className="stat-chip">
      <span className="stat-num" style={{ color: valueColor }}>
        {typeof num === 'number' ? <CountUp value={num} /> : num}
      </span>
      <span className="stat-label">{label}</span>
      {sublabel && (
        <span className="stat-sub">{sublabel}</span>
      )}
    </div>
  );
}

