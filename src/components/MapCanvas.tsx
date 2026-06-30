"use client";

import React, { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { Issue } from "@/lib/types";
import { getCategoryIcon } from "@/lib/icons";

const CENTER = { lat: 17.4239, lng: 78.4062 };

// Heatmap component that uses the visualization library
function Heatmap({ issues, showHeatmap, showGhostHeatmap }: { issues: Issue[], showHeatmap: boolean, showGhostHeatmap?: boolean }) {
  const map = useMap();
  const visualization = useMapsLibrary('visualization');
  const [heatmapLayer, setHeatmapLayer] = useState<any>(null);

  useEffect(() => {
    if (!map || !visualization) return;

    if (!heatmapLayer) {
      const newHeatmap = new (visualization as any).HeatmapLayer({
        radius: 25,
        opacity: 0.8,
        // Optional: define a custom gradient here if desired
        gradient: [
          'rgba(0, 255, 255, 0)',
          'rgba(0, 255, 255, 1)',
          'rgba(0, 191, 255, 1)',
          'rgba(0, 127, 255, 1)',
          'rgba(0, 63, 255, 1)',
          'rgba(0, 0, 255, 1)',
          'rgba(0, 0, 223, 1)',
          'rgba(0, 0, 191, 1)',
          'rgba(0, 0, 159, 1)',
          'rgba(0, 0, 127, 1)',
          'rgba(63, 0, 91, 1)',
          'rgba(127, 0, 63, 1)',
          'rgba(191, 0, 31, 1)',
          'rgba(255, 0, 0, 1)'
        ]
      });
      setHeatmapLayer(newHeatmap);
    }
  }, [map, visualization, heatmapLayer]);

  useEffect(() => {
    if (!heatmapLayer) return;
    
    if (showHeatmap || showGhostHeatmap) {
      let data = [];
      if (showGhostHeatmap) {
         // Ghost heatmap: only disputed issues
         data = issues
           .filter(i => i.location && i.status === "disputed")
           .map(i => ({
             location: new google.maps.LatLng(i.location.latitude, i.location.longitude),
             weight: 1
           }));
         
         // Red gradient for ghost heatmap
         heatmapLayer.setOptions({
           gradient: [
             'rgba(255, 0, 0, 0)',
             'rgba(255, 0, 0, 0.5)',
             'rgba(255, 0, 0, 1)'
           ]
         });
      } else {
         // Standard heatmap: all valid issues
         data = issues
           .filter(i => i.location)
           .map(i => ({
             location: new google.maps.LatLng(i.location.latitude, i.location.longitude),
             weight: i.priorityScore / 100
           }));
           
         // Standard gradient
         heatmapLayer.setOptions({
           gradient: [
             'rgba(0, 255, 255, 0)', 'rgba(0, 255, 255, 1)', 'rgba(0, 191, 255, 1)', 'rgba(0, 127, 255, 1)',
             'rgba(0, 63, 255, 1)', 'rgba(0, 0, 255, 1)', 'rgba(0, 0, 223, 1)', 'rgba(0, 0, 191, 1)',
             'rgba(0, 0, 159, 1)', 'rgba(0, 0, 127, 1)', 'rgba(63, 0, 91, 1)', 'rgba(127, 0, 63, 1)',
             'rgba(191, 0, 31, 1)', 'rgba(255, 0, 0, 1)'
           ]
         });
      }

      heatmapLayer.setData(data);
      heatmapLayer.setMap(map);
    } else {
      heatmapLayer.setMap(null);
    }
  }, [heatmapLayer, issues, showHeatmap, showGhostHeatmap, map]);

  return null;
}

export default function MapCanvas({ 
  issues, 
  predictions = [],
  onPinClick,
  onPredictionClick,
  showHeatmap = false,
  showGhostHeatmap = false,
  showPredictions = false,
  missionId = null,
  mapTypeId = "roadmap",
  selectedIssueId = null,
}: { 
  issues: Issue[];
  predictions?: any[];
  onPinClick?: (issue: Issue | null) => void;
  onPredictionClick?: (prediction: any) => void;
  showHeatmap?: boolean;
  showGhostHeatmap?: boolean;
  showPredictions?: boolean;
  missionId?: string | null;
  mapTypeId?: string;
  selectedIssueId?: string | null;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  
  // Use a fallback div if no API key is set so the app doesn't crash during dev
  if (!apiKey) {
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "var(--cream-dark)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 0 }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗺️</div>
          <div className="t-subheading">Google Maps Requires API Key</div>
          <div className="t-body-sm" style={{ marginTop: "8px" }}>Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
      <APIProvider apiKey={apiKey} version="3.64">
        <MapContent 
          issues={issues}
          predictions={predictions}
          onPinClick={onPinClick}
          onPredictionClick={onPredictionClick}
          showHeatmap={showHeatmap}
          showGhostHeatmap={showGhostHeatmap}
          showPredictions={showPredictions}
          missionId={missionId}
          mapTypeId={mapTypeId || "roadmap"}
          selectedIssueId={selectedIssueId}
        />
      </APIProvider>
    </div>
  );
}

// MapContent is separated so we can use useMap hooks safely inside APIProvider
function MapContent({ 
  issues, 
  predictions = [],
  onPinClick,
  onPredictionClick,
  showHeatmap = false,
  showGhostHeatmap = false,
  showPredictions = false,
  missionId = null,
  mapTypeId = "roadmap",
  selectedIssueId = null,
}: any) {
  const map = useMap();
  const markerLibrary = useMapsLibrary("marker");
  const clusterer = React.useRef<MarkerClusterer | null>(null);
  const markersRef = React.useRef<{[key: string]: any}>({});

  useEffect(() => {
    if (!map || !markerLibrary) return;
    if (!clusterer.current) {
      const renderer = {
        render: ({ count, position }: any) => {
          const div = document.createElement("div");
          div.style.width = "48px";
          div.style.height = "48px";
          div.style.backgroundColor = "var(--bg-page)";
          div.style.color = "var(--text-primary)";
          div.style.borderRadius = "50%";
          div.style.display = "flex";
          div.style.alignItems = "center";
          div.style.justifyContent = "center";
          div.style.fontSize = "16px";
          div.style.fontWeight = "bold";
          div.style.boxShadow = "var(--pixel-shadow)";
          div.style.border = "3px solid var(--orange)";
          div.style.transition = "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";
          
          div.innerHTML = `<span style="position:relative; z-index:2;">${count}</span>`;
          
          div.onmouseenter = () => { div.style.transform = "scale(1.15)"; };
          div.onmouseleave = () => { div.style.transform = "scale(1)"; };

          return new markerLibrary.AdvancedMarkerElement({
            position,
            content: div,
          });
        }
      };

      const onClusterClick = (event: any, cluster: any, map: google.maps.Map) => {
        event.preventDefault?.();
        const bounds = new window.google.maps.LatLngBounds();
        cluster.markers.forEach((m: any) => bounds.extend(m.position));
        map.fitBounds(bounds, { bottom: 400, left: 320, right: 400, top: 100 });
      };

      clusterer.current = new MarkerClusterer({ map, renderer, onClusterClick });
    }
  }, [map, markerLibrary]);

  const renderTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const setMarkerRef = React.useCallback((marker: any, key: string) => {
    if (marker) {
      if (!markersRef.current[key]) {
        markersRef.current[key] = marker;
        if (clusterer.current) clusterer.current.addMarker(marker, true);
      }
    } else {
      if (markersRef.current[key]) {
        if (clusterer.current) clusterer.current.removeMarker(markersRef.current[key], true);
        delete markersRef.current[key];
      }
    }
    
    // Debounce the redraw to prevent layout thrashing and blinking
    if (renderTimeout.current) clearTimeout(renderTimeout.current);
    renderTimeout.current = setTimeout(() => {
      if (clusterer.current) {
        clusterer.current.render();
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (selectedIssueId && map) {
      const issue = issues.find((i: any) => i.id === selectedIssueId);
      if (issue?.location) {
        map.panTo({ lat: issue.location.latitude, lng: issue.location.longitude });
      }
    }
  }, [selectedIssueId, map, issues]);

  return (
    <>
      <Map
          defaultCenter={CENTER}
          defaultZoom={13}
          mapId="GULLYFIX_MAP"
          disableDefaultUI={true}
          zoomControl={true}
          gestureHandling="greedy"
          mapTypeId={mapTypeId}
          onClick={() => onPinClick?.(null)}
        >
          <Heatmap issues={issues} showHeatmap={showHeatmap} showGhostHeatmap={showGhostHeatmap} />
          
          {!showHeatmap && !showGhostHeatmap && issues.map((issue: any) => (
            <IssueMarker 
              key={issue.id} 
              issue={issue} 
              isMission={missionId === issue.id}
              isSelected={selectedIssueId === issue.id}
              onPinClick={onPinClick}
              setMarkerRef={setMarkerRef}
            />
          ))}

          {showPredictions && predictions.map((prediction: any) => {
            if (!prediction.location) return null;
            return (
              <AdvancedMarker
                key={prediction.id}
                position={{ lat: prediction.location.latitude, lng: prediction.location.longitude }}
                onClick={() => onPredictionClick?.(prediction)}
                zIndex={50}
              >
                <div style={{
                  backgroundColor: "var(--amber)",
                  color: "var(--brown-deep)",
                  width: "34px", height: "34px",
                  borderRadius: "50%",
                  border: "2px dashed var(--brown-deep)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--pixel-shadow)",
                  fontSize: "16px",
                  animation: "btn-pulse 2s infinite",
                  position: "relative",
                  transform: "translateY(-50%)",
                }}>
                  ⚠️
                  <div style={{
                    position: "absolute",
                    bottom: "-10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0, height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "10px solid var(--brown-deep)",
                  }} />
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
    </>
  );
}

const IssueMarker = React.memo(({ issue, isMission, isSelected, onPinClick, setMarkerRef }: any) => {
  const refCallback = React.useCallback((m: any) => setMarkerRef(m, issue.id), [setMarkerRef, issue.id]);

  if (!issue.location) return null;

  let bgColor = "var(--cream-dark)";
  if (isSelected) {
    bgColor = "var(--orange)";
  } else {
    if (issue.category === "road_damage") bgColor = "var(--terra-light)";
    else if (issue.category === "water_leakage") bgColor = "var(--sky-light)";
    else if (issue.category === "waste") bgColor = "var(--sage-light)";
    else if (issue.category === "streetlight") bgColor = "var(--amber-light)";
  }

  return (
    <AdvancedMarker
      ref={refCallback}
      position={{ lat: issue.location.latitude, lng: issue.location.longitude }}
      onClick={() => onPinClick?.(issue)}
      zIndex={isSelected ? 1000 : (isMission ? 100 : 1)}
    >
      <div style={{ position: "relative" }}>
        <div style={{
          backgroundColor: bgColor,
          color: isSelected ? "var(--white)" : "inherit",
          width: "40px", height: "40px",
          borderRadius: "50%",
          border: isSelected ? "3px solid var(--text-primary)" : "2px solid var(--brown-deep)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isSelected ? "0 8px 16px rgba(0,0,0,0.3)" : "var(--pixel-shadow)",
          position: "relative",
          transform: `translateY(-50%) ${isSelected ? 'scale(1.2)' : 'scale(1)'}`,
          transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }} className={isMission ? 'pulse-mission-marker' : ''}>
          <span style={{ fontSize: "20px" }}>{getCategoryIcon(issue.category)}</span>
          {isMission && <div className="pulse-ring"></div>}
          
          {/* Pin tail */}
          <div style={{
            position: "absolute",
            bottom: "-10px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: `10px solid ${isSelected ? 'var(--text-primary)' : 'var(--brown-deep)'}`,
          }} />
        </div>
      </div>
    </AdvancedMarker>
  );
});
