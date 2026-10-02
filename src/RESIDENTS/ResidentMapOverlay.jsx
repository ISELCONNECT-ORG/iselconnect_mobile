import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft } from "lucide-react";

export default function ResidentMapOverlay({
  report,
  onBack,
  linemanLocation,
  timelineData,
  activeStatus,
  t,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const linemanMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const startMarkerRef = useRef(null);
  const resolvedMarkerRef = useRef(null);

  const isResolved = ["RESOLVED", "APPROVED", "ADMIN VERIFIED"].includes(
    activeStatus,
  );
  const isInProgress = activeStatus === "IN PROGRESS";

  // 1. Initialize Map & Report Marker
  useEffect(() => {
    const lat = report.latitude ? parseFloat(report.latitude) : 16.7805;
    const lon = report.longitude ? parseFloat(report.longitude) : 121.6508;

    const initMap = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `<div style="background-color: #facc15; width: 22px; height: 22px; border-radius: 50%; border: 4px solid #1b0b8c; box-shadow: 0 4px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
        }).setView([lat, lon], 16);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapRef.current);
      } else {
        mapRef.current.setView([lat, lon], 16);
      }

      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lon], { icon: customIcon }).addTo(
        mapRef.current,
      );
    }, 100);

    return () => clearTimeout(initMap);
  }, [report.latitude, report.longitude]);

  // 2. Draw Routing and Dynamic Markers (Historical & Live)
  useEffect(() => {
    if (!report.latitude || !report.longitude) return;

    let isDrawing = true;

    const drawMapElements = async () => {
      if (!isDrawing) return;

      if (!mapRef.current) {
        setTimeout(drawMapElements, 100);
        return;
      }

      const reportLat = parseFloat(report.latitude);
      const reportLon = parseFloat(report.longitude);

      if (isResolved && timelineData) {
        const sLat = parseFloat(timelineData.start_lat);
        const sLon = parseFloat(timelineData.start_lon);
        const resLat = parseFloat(timelineData.resolved_lat);
        const resLon = parseFloat(timelineData.resolved_lon);

        if (sLat && sLon) {
          const startIcon = L.divIcon({
            className: "start-marker",
            html: `<div style="background-color: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(59,130,246,0.6); display: flex; align-items: center; justify-content: center; font-size: 10px; color: white;">▶</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          if (!startMarkerRef.current) {
            startMarkerRef.current = L.marker([sLat, sLon], {
              icon: startIcon,
            }).addTo(mapRef.current);
          }
        }

        if (resLat && resLon) {
          const resolvedIcon = L.divIcon({
            className: "resolved-marker",
            html: `<div style="background-color: #16a34a; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(22,163,74,0.6); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; color: white;">✓</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          if (!resolvedMarkerRef.current) {
            resolvedMarkerRef.current = L.marker([resLat, resLon], {
              icon: resolvedIcon,
            }).addTo(mapRef.current);
          }
        }

        const waypoints = [];
        if (sLat && sLon) waypoints.push([sLon, sLat]);
        waypoints.push([reportLon, reportLat]);

        if (waypoints.length > 1) {
          try {
            const coordsStr = waypoints.map((wp) => wp.join(",")).join(";");
            const response = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`,
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
              routePoints = waypoints.map((wp) => [wp[1], wp[0]]);
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
            console.error("Historical routing failed:", error);
            if (!isDrawing) return;
            const fallbackPoints = waypoints.map((wp) => [wp[1], wp[0]]);
            if (!lineRef.current) {
              lineRef.current = L.polyline(fallbackPoints, {
                color: "#1b0b8c",
                weight: 5,
                dashArray: "10, 10",
                opacity: 0.8,
              }).addTo(mapRef.current);
              mapRef.current.fitBounds(lineRef.current.getBounds(), {
                padding: [50, 50],
                maxZoom: 18,
              });
            } else {
              lineRef.current.setLatLngs(fallbackPoints);
            }
          }
        }
      } else if (linemanLocation) {
        const linemanLat = parseFloat(linemanLocation.lat);
        const linemanLon = parseFloat(linemanLocation.lon);

        const linemanIcon = L.divIcon({
          className: "live-tracker-icon",
          html: `<div style="background-color: #10b981; width: 26px; height: 26px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 15px rgba(16, 185, 129, 0.8); display: flex; align-items: center; justify-content: center; font-size: 14px; animation: pulse-ring 2s infinite;">⚡</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        if (!linemanMarkerRef.current) {
          linemanMarkerRef.current = L.marker([linemanLat, linemanLon], {
            icon: linemanIcon,
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
            routePoints = data.routes[0].geometry.coordinates.map((coord) => [
              coord[1],
              coord[0],
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
          console.error("Live routing failed:", error);
          if (!isDrawing) return;
          const fallbackPoints = [
            [linemanLat, linemanLon],
            [reportLat, reportLon],
          ];
          if (!lineRef.current) {
            lineRef.current = L.polyline(fallbackPoints, {
              color: "#1b0b8c",
              weight: 5,
              dashArray: "10, 10",
              opacity: 0.8,
            }).addTo(mapRef.current);
            mapRef.current.fitBounds(lineRef.current.getBounds(), {
              padding: [50, 50],
              maxZoom: 18,
            });
          } else {
            lineRef.current.setLatLngs(fallbackPoints);
          }
        }
      }
    };

    drawMapElements();

    return () => {
      isDrawing = false;
    };
  }, [
    linemanLocation,
    report.latitude,
    report.longitude,
    isResolved,
    timelineData,
  ]);

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
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "#f8fafc",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "20px 15px",
          background: "#1b0b8c",
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
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={32} color="#fff" />
        </button>
        <span
          style={{
            color: "#fff",
            fontWeight: "900",
            marginLeft: "10px",
            letterSpacing: "1px",
            fontSize: "1rem",
          }}
        >
          {t.viewLocationMap}
        </span>
      </div>
      <div style={{ flex: 1, width: "100%", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            bottom: "30px",
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
          {isResolved && timelineData?.start_lat && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#3b82f6",
                  borderRadius: "50%",
                  border: "2px solid #fff",
                }}
              ></div>
              Start
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                background: "#facc15",
                borderRadius: "50%",
                border: "2px solid #1b0b8c",
              }}
            ></div>
            Issue
          </div>

          {isResolved && timelineData?.resolved_lat && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#16a34a",
                  borderRadius: "50%",
                  border: "2px solid #fff",
                }}
              ></div>
              Resolved
            </div>
          )}

          {isInProgress && (
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
              ></div>
              Lineman
            </div>
          )}
        </div>

        <div
          ref={mapContainerRef}
          style={{ position: "absolute", top: 0, bottom: 0, width: "100%" }}
        />
      </div>
    </div>
  );
}
