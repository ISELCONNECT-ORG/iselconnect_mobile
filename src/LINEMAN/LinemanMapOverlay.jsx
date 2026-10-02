import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft } from "lucide-react";

const FullScreenWrapper = ({ title, onBack, isDark, children }) => (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isDark ? "#000" : "#f8fafc",
      zIndex: 99999,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      overscrollBehavior: "none",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 15px",
        paddingTop: "calc(20px + env(safe-area-inset-top))",
        background: isDark ? "#000" : "#1b0b8c",
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <ChevronLeft size={32} color="#fff" />
      </button>
      <span
        style={{
          color: "#fff",
          fontWeight: "900",
          letterSpacing: "1px",
          textTransform: "uppercase",
          fontSize: "1rem",
        }}
      >
        {title}
      </span>
      <div style={{ width: 32 }}></div>
    </div>
    {children}
  </div>
);

export default function LinemanMapOverlay({
  report,
  onBack,
  linemanLocation,
  activeStatus,
  t,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const linemanMarkerRef = useRef(null);
  const lineRef = useRef(null);

  // 1. Initialize Map & Report (Issue) Marker safely
  useEffect(() => {
    const lat = report.latitude ? parseFloat(report.latitude) : 16.7805;
    const lon = report.longitude ? parseFloat(report.longitude) : 121.6508;

    const initMap = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const targetIcon = L.divIcon({
        className: "marker", // Overrides default Leaflet square box
        html: `<div style="background-color: #ea4335; width: 22px; height: 22px; border-radius: 50%; border: 4px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
        }).setView([lat, lon], 16);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(mapRef.current);
      } else {
        mapRef.current.setView([lat, lon], 16);
      }

      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lon], { icon: targetIcon }).addTo(
        mapRef.current,
      );
    }, 100);

    return () => clearTimeout(initMap);
  }, [report.latitude, report.longitude]);

  // 2. Handle Lineman Tracking & Route Drawing
  useEffect(() => {
    if (!report.latitude || !report.longitude || !linemanLocation) return;

    let isDrawing = true;

    const drawMapElements = async () => {
      if (!isDrawing) return;

      if (!mapRef.current) {
        setTimeout(drawMapElements, 100);
        return;
      }

      const reportLat = parseFloat(report.latitude);
      const reportLon = parseFloat(report.longitude);
      const linemanLat = parseFloat(linemanLocation.lat);
      const linemanLon = parseFloat(linemanLocation.lon);

      const lIcon = L.divIcon({
        className: "live-tracker-icon", // 🌟 FIXED: This removes the default white box
        html: `<div style="background-color:#10b981;width:26px;height:26px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 15px rgba(16,185,129,0.8);display:flex;align-items:center;justify-content:center;font-size:14px;animation:pulse-ring 2s infinite;">⚡</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      if (!linemanMarkerRef.current) {
        linemanMarkerRef.current = L.marker([linemanLat, linemanLon], {
          icon: lIcon,
          zIndexOffset: 1000,
        }).addTo(mapRef.current);
      } else {
        linemanMarkerRef.current.setLatLng([linemanLat, linemanLon]);
      }

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${linemanLon},${linemanLat};${reportLon},${reportLat}?overview=full&geometries=geojson`,
        );
        const data = await response.json();

        if (!isDrawing) return;

        let routePoints = [];
        if (data.routes && data.routes[0]) {
          routePoints = data.routes[0].geometry.coordinates.map((c) => [
            c[1],
            c[0],
          ]);
        } else {
          routePoints = [
            [linemanLat, linemanLon],
            [reportLat, reportLon],
          ];
        }

        if (!lineRef.current) {
          lineRef.current = L.polyline(routePoints, {
            color: "#1b0b8c",
            weight: 5,
            opacity: 0.8,
          }).addTo(mapRef.current);
          mapRef.current.fitBounds(lineRef.current.getBounds(), {
            padding: [50, 50],
            maxZoom: 18,
          });
        } else {
          lineRef.current.setLatLngs(routePoints);
        }
      } catch (error) {
        console.error("Routing failed:", error);
        if (!isDrawing) return;
        const fallback = [
          [linemanLat, linemanLon],
          [reportLat, reportLon],
        ];
        if (!lineRef.current) {
          lineRef.current = L.polyline(fallback, {
            color: "#1b0b8c",
            weight: 5,
            dashArray: "10,10",
            opacity: 0.8,
          }).addTo(mapRef.current);
          mapRef.current.fitBounds(lineRef.current.getBounds(), {
            padding: [50, 50],
            maxZoom: 18,
          });
        } else {
          lineRef.current.setLatLngs(fallback);
        }
      }
    };

    drawMapElements();

    return () => {
      isDrawing = false;
    };
  }, [linemanLocation, report.latitude, report.longitude]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <FullScreenWrapper title={t.locationMap || "Location Map"} onBack={onBack}>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
      <div
        style={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            bottom: "calc(30px + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(255,255,255,0.95)",
            padding: "10px 15px",
            borderRadius: "30px",
            boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
            display: "flex",
            gap: "15px",
            fontWeight: "bold",
            fontSize: "0.8rem",
            color: "#334155",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                background: "#ea4335",
                borderRadius: "50%",
                border: "2px solid #fff",
              }}
            />{" "}
            Issue
          </div>
          {activeStatus === "IN PROGRESS" && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#10b981",
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  boxShadow: "0 0 5px rgba(16,185,129,0.5)",
                }}
              />{" "}
              Lineman
            </div>
          )}
        </div>
        <div
          ref={mapContainerRef}
          style={{ position: "absolute", top: 0, bottom: 0, width: "100%" }}
        />
      </div>
    </FullScreenWrapper>
  );
}
