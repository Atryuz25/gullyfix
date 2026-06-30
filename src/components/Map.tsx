"use client";

import dynamic from "next/dynamic";
import { Issue } from "@/lib/types";

// Leaflet requires window, so we must dynamically import it with ssr: false
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", background: "var(--cream-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="t-body animate-pulse">Loading map...</div>
    </div>
  ),
});

export default function MapWrapper({ 
  issues, 
  onPinClick,
  showHeatmap = false,
  showGhostHeatmap = false,
  showPredictions = false,
  predictions,
  onPredictionClick,
  missionId,
  mapTypeId = "roadmap",
  selectedIssueId,
}: { 
  issues: Issue[];
  onPinClick?: (issue: Issue | null) => void;
  showHeatmap?: boolean;
  showGhostHeatmap?: boolean;
  showPredictions?: boolean;
  predictions?: any[];
  onPredictionClick?: (prediction: any) => void;
  missionId?: string | null;
  mapTypeId?: string;
  selectedIssueId?: string;
}) {
  return (
    <MapCanvas 
      issues={issues} 
      onPinClick={onPinClick} 
      showHeatmap={showHeatmap} 
      showGhostHeatmap={showGhostHeatmap}
      showPredictions={showPredictions} 
      predictions={predictions}
      onPredictionClick={onPredictionClick}
      missionId={missionId}
      mapTypeId={mapTypeId}
      selectedIssueId={selectedIssueId}
    />
  );
}
