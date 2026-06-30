"use client";

import React from "react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

export default function MiniMap({ lat, lng, onLocationChange }: { lat: number; lng: number, onLocationChange?: (lat: number, lng: number) => void }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  if (!apiKey) {
    return <div style={{ width: "100%", height: "220px", background: "var(--cream-dark)" }} />;
  }

  return (
    <div style={{ width: "100%", height: "220px" }}>
      <APIProvider apiKey={apiKey} version="3.64">
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={16}
          mapId="GULLYFIX_MINIMAP"
          disableDefaultUI={true}
          gestureHandling="greedy"
        >
          <AdvancedMarker 
            position={{ lat, lng }} 
            draggable={!!onLocationChange}
            onDragEnd={(e) => {
              if (onLocationChange && e.latLng) {
                onLocationChange(e.latLng.lat(), e.latLng.lng());
              }
            }}
          >
            <div style={{
              width:"36px", height:"36px", borderRadius:"50%",
              background:"var(--terracotta)", border:"3px solid var(--brown-deep)",
              boxShadow: "3px 3px 0 var(--brown-deep)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"18px"
            }}>📍</div>
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  );
}
