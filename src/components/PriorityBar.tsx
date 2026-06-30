import React from "react";

export function PriorityBar({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score));
  
  let fillClass = "bar-fill-sage";
  if (safeScore >= 75) fillClass = "bar-fill-red";
  else if (safeScore >= 40) fillClass = "bar-fill"; // amber

  return (
    <div className="priority-row">
      <span style={{ minWidth: 52 }}>Priority</span>
      <div className="priority-track">
        <div className={fillClass} style={{ width: `${safeScore}%` }} />
      </div>
      <span>{safeScore}/100</span>
    </div>
  );
}
