"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap, useMapEvents, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import { n } from "@/lib/schemas";
import { simplifyTrack, simplifyPositionsWithMaxSpeeds, smoothTrackPositions, zoomToTolerance } from "@/lib/track-utils";
import type { RaceMapProps, TrackMode } from "./race-map";

interface InternalProps extends RaceMapProps {
  openSeaMap: boolean;
  trackMode: TrackMode;
  followMode: boolean;
  onExitFollow: () => void;
  fitTick: number;
}

// Heatmap color from speed (m/s normalized over the track range).
function speedColor(t: number): string {
  // 0=blue, 0.25=cyan, 0.5=neon-green, 0.75=yellow, 1=red
  const stops: [number, [number, number, number]][] = [
    [0, [0, 0, 255]],
    [0.25, [0, 255, 255]],
    [0.5, [0, 255, 0]],
    [0.75, [255, 255, 0]],
    [1, [255, 0, 0]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r},${g},${b})`;
    }
  }
  return "rgb(255,0,0)";
}

function ZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
}

function AutoInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function FitBounds({ points, fitTick }: { points: L.LatLngExpression[]; fitTick: number }) {
  const map = useMap();
  const pointsRef = useRef(points);
  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => {
    if (pointsRef.current.length === 0) return;
    const b = L.latLngBounds(pointsRef.current);
    map.fitBounds(b.pad(0.05));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTick, map]);
  return null;
}

function DragTracker({ onDrag }: { onDrag: () => void }) {
  useMapEvents({ dragstart: () => onDrag() });
  return null;
}

function FollowBoat({ point, followMode }: { point: L.LatLngExpression | null; followMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!followMode || !point) return;
    
    // Smart Panning: only pan if the point is near the edge of the viewport
    const latlng = L.latLng(point);
    const bounds = map.getBounds();
    const pad = 0.2; // 20% margin
    const innerBounds = bounds.pad(-pad);
    
    if (!innerBounds.contains(latlng)) {
      map.panTo(latlng, { animate: true, duration: 0.5 });
    }
  }, [point, followMode, map]);
  return null;
}

/** Fixed size of the playback boat arrow in pixels. */
const BOAT_ICON_SIZE = 40;
/** Canvas size of the boat icon source (viewBox). */
const BOAT_ICON_CANVAS = 80;

/**
 * A fixed, never-recreated Leaflet icon for the playback boat arrow.
 */
function makePermanentBoatIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="boat-arrow" style="width:${BOAT_ICON_CANVAS}px;height:${BOAT_ICON_CANVAS}px;transform-origin:center center;transition:transform 0.3s ease-out;transform:rotate(0deg) scale(${BOAT_ICON_SIZE / BOAT_ICON_CANVAS});"><svg viewBox="0 0 24 24" width="${BOAT_ICON_CANVAS}" height="${BOAT_ICON_CANVAS}"><path d="M12 2 L20 22 L12 18 L4 22 Z" fill="#FF4500" stroke="#fff" stroke-width="1"/></svg></div>`,
    iconSize: [BOAT_ICON_CANVAS, BOAT_ICON_CANVAS],
    iconAnchor: [BOAT_ICON_CANVAS / 2, BOAT_ICON_CANVAS / 2],
  });
}

/** Fixed size for start-line markers (pin + boat end). */
const START_MARKER_SIZE = 24;
/** Canvas size for start-line markers source. */
const START_MARKER_CANVAS = 48;

function makePermanentPinIcon(): L.DivIcon {
  const c = START_MARKER_CANVAS;
  const scale = START_MARKER_SIZE / START_MARKER_CANVAS;
  return L.divIcon({
    className: "",
    html: `<div class="start-pin" style="width:${c}px;height:${c}px;transform-origin:center center;transform:scale(${scale});display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${c}" height="${c}"><polygon points="12,3 22,21 2,21" fill="#00CCFF" stroke="#fff" stroke-width="1"/></svg></div>`,
    iconSize: [c, c],
    iconAnchor: [c / 2, c / 2],
  });
}

function makePermanentBoatEndIcon(): L.DivIcon {
  const c = START_MARKER_CANVAS;
  const scale = START_MARKER_SIZE / START_MARKER_CANVAS;
  return L.divIcon({
    className: "",
    html: `<div class="start-boat-end" style="width:${c}px;height:${c}px;transform-origin:center center;transform:scale(${scale});display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${c}" height="${c}"><rect x="3" y="3" width="18" height="18" rx="2" fill="#FF4500" stroke="#fff" stroke-width="1"/></svg></div>`,
    iconSize: [c, c],
    iconAnchor: [c / 2, c / 2],
  });
}

/** Fixed radius for course marks in pixels. */
const MARK_RADIUS = 6;

export default function MapView({
  positions, race, legs, startLine, playbackPosition, preRacePositions, windowPositions,
  boatLengthMeters,
  openSeaMap, trackMode, followMode, onExitFollow, fitTick,
}: InternalProps) {
  const { resolvedTheme } = useTheme();
  const [zoom, setZoom] = useState(14);
  const tileUrl = resolvedTheme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const tolerance = useMemo(() => zoomToTolerance(zoom), [zoom]);

  // Positions are now normalized (including pre-calculated timestamps and smoothed at source)
  const smoothedPositions = positions ?? [];
  const smoothedPreRacePositions = preRacePositions ?? [];

  const points = useMemo(
    () => simplifyTrack(smoothedPositions, tolerance),
    [smoothedPositions, tolerance]
  );
  const preRacePoints = useMemo(
    () => simplifyTrack(smoothedPreRacePositions, tolerance),
    [smoothedPreRacePositions, tolerance]
  );

  // For heatmap mode we need per-segment max speed, so simplify with max-speed tracking.
  const heatmapData = useMemo(
    () => simplifyPositionsWithMaxSpeeds(smoothedPositions, tolerance),
    [smoothedPositions, tolerance]
  );
  const heatmapPositions = heatmapData.positions;
  const heatmapMaxSpeeds = heatmapData.maxSpeeds;
  const heatmapPoints = useMemo(
    () => heatmapPositions.map((p) => [p.lat, p.lon] as [number, number]),
    [heatmapPositions]
  );

  const speedRange = useMemo(() => {
    if (!heatmapMaxSpeeds.length) return { min: 0, max: 1 };
    let min = Infinity, max = -Infinity;
    for (const v of heatmapMaxSpeeds) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max: max > min ? max : min + 1 };
  }, [heatmapMaxSpeeds]);

  const windowPoints = useMemo(
    () => simplifyTrack(windowPositions ?? [], tolerance),
    [windowPositions, tolerance]
  );

  const center = points[0] ?? [0, 0];

  // Stable icon instance — never recreated so CSS transitions fire on every update.
  const permanentBoatIcon = useMemo(() => makePermanentBoatIcon(), []);
  const boatMarkerRef = useRef<L.Marker | null>(null);

  // Stable icons for start line markers.
  const permanentPinIcon = useMemo(() => makePermanentPinIcon(), []);
  const permanentBoatEndIcon = useMemo(() => makePermanentBoatEndIcon(), []);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const boatEndMarkerRef = useRef<L.Marker | null>(null);

  // Update heading directly on the existing DOM element so the
  // CSS transition (defined in the icon HTML) plays smoothly.
  useEffect(() => {
    const marker = boatMarkerRef.current;
    if (!marker) return;
    const el = marker.getElement();
    if (!el) return;
    const arrow = el.querySelector(".boat-arrow") as HTMLElement | null;
    if (!arrow) return;
    const scale = BOAT_ICON_SIZE / BOAT_ICON_CANVAS;
    arrow.style.transform = `rotate(${playbackPosition?.cogDeg ?? 0}deg) scale(${scale})`;
  }, [playbackPosition?.cogDeg]);

  // Heatmap Optimization: Group segments into fewer Polyline groups
  const heatmapSegments = useMemo(() => {
    if (trackMode !== "heatmap" || heatmapPoints.length < 2) return [];
    
    // To reduce the number of Polyline components, we group segments that have 
    // very similar speeds (e.g. within 5% of range).
    const segments: { points: [number, number][]; color: string }[] = [];
    if (heatmapPoints.length === 0) return [];

    let currentPoints: [number, number][] = [heatmapPoints[0]];
    let lastColor = "";

    const range = speedRange.max - speedRange.min;

    for (let i = 0; i < heatmapPoints.length - 1; i++) {
      const v = heatmapMaxSpeeds[i] ?? 0;
      const t = (v - speedRange.min) / (range || 1);
      const color = speedColor(Math.max(0, Math.min(1, t)));
      
      if (color === lastColor) {
        currentPoints.push(heatmapPoints[i + 1]);
      } else {
        if (currentPoints.length > 1) {
          segments.push({ points: currentPoints, color: lastColor });
        }
        currentPoints = [heatmapPoints[i], heatmapPoints[i + 1]];
        lastColor = color;
      }
    }
    if (currentPoints.length > 1) {
      segments.push({ points: currentPoints, color: lastColor });
    }
    return segments;
  }, [trackMode, heatmapPoints, heatmapMaxSpeeds, speedRange]);

  return (
    <MapContainer center={center as L.LatLngExpression} zoom={14} className="h-full w-full">
      <ZoomTracker onZoom={setZoom} />
      <AutoInvalidateSize />
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      {openSeaMap && (
        <TileLayer
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
          attribution='&copy; OpenSeaMap'
          opacity={0.85}
        />
      )}

      {preRacePoints.length > 1 && (
        <Polyline positions={preRacePoints} pathOptions={{ color: "#B200FF", weight: 2, dashArray: "4,6", opacity: 0.85 }} />
      )}

      {trackMode === "flat" && points.length > 1 && (
        <Polyline positions={points} pathOptions={{ color: "#00FFFF", weight: 3, opacity: 0.9 }} />
      )}

      {trackMode === "heatmap" && heatmapSegments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.points}
          pathOptions={{ color: seg.color, weight: 3, opacity: 0.9 }}
        />
      ))}

      {windowPoints.length > 1 && (
        <Polyline positions={windowPoints} pathOptions={{ color: "#FF8C00", weight: 9, opacity: 0.35 }} />
      )}

      {legs?.map((m, i) => {
        const lat = n(m.latitude);
        const lon = n(m.longitude);
        const isGate = m.legType === "Gate";

        if (isGate) {
          const gateLat = m.gateLatitude != null ? n(m.gateLatitude) : null;
          const gateLon = m.gateLongitude != null ? n(m.gateLongitude) : null;
          const hasGateMark = gateLat != null && gateLon != null;

          return (
            <Fragment key={i}>
              <CircleMarker
                center={[lat, lon]}
                radius={MARK_RADIUS}
                pathOptions={{ color: "#FFCC00", fillColor: "#FFCC00", fillOpacity: 0.8 }}
              >
                <Tooltip>{`${m.markName} (Gate Port Buoy)`}</Tooltip>
              </CircleMarker>

              {hasGateMark && (
                <Fragment>
                  <CircleMarker
                    center={[gateLat, gateLon]}
                    radius={MARK_RADIUS}
                    pathOptions={{ color: "#FFCC00", fillColor: "#FFCC00", fillOpacity: 0.8 }}
                  >
                    <Tooltip>{m.gateMarkName ?? `${m.markName} (Gate Starboard Buoy)`}</Tooltip>
                  </CircleMarker>
                  <Polyline
                    positions={[[lat, lon], [gateLat, gateLon]]}
                    pathOptions={{ color: "#FFCC00", weight: 2, dashArray: "4,4", opacity: 0.8 }}
                  />
                </Fragment>
              )}
            </Fragment>
          );
        } else {
          const radius = m.overrideRoundingRadiusMeters != null ? n(m.overrideRoundingRadiusMeters) : n(m.markDefaultRoundingRadiusMeters);
          const hasRadius = !isNaN(radius) && radius > 0;
          const sideText = m.passingSide ? `Round to ${m.passingSide}` : "Round";
          const radiusText = hasRadius ? `Radius: ${radius.toFixed(0)}m` : "";
          const tooltipText = `${m.markName} (${sideText}${radiusText ? `, ${radiusText}` : ""})`;

          return (
            <Fragment key={i}>
              <CircleMarker
                center={[lat, lon]}
                radius={MARK_RADIUS}
                pathOptions={{ color: "#FFCC00", fillColor: "#FFCC00", fillOpacity: 0.8 }}
              >
                <Tooltip>{tooltipText}</Tooltip>
              </CircleMarker>

              {hasRadius && (
                <Circle
                  center={[lat, lon]}
                  radius={radius}
                  pathOptions={{
                    color: m.passingSide === "Starboard" ? "#10B981" : "#EF4444",
                    fillColor: m.passingSide === "Starboard" ? "#10B981" : "#EF4444",
                    fillOpacity: 0.1,
                    dashArray: "5,5",
                    weight: 1.5,
                  }}
                />
              )}
            </Fragment>
          );
        }
      })}

      {startLine?.pin && startLine?.boat && (
        <Polyline
          positions={[[startLine.pin.lat, startLine.pin.lon], [startLine.boat.lat, startLine.boat.lon]]}
          pathOptions={{ color: "#00CCFF", weight: 2, dashArray: "6,4", opacity: 0.9 }}
        />
      )}
      {startLine?.pin && (
        <Marker
          ref={pinMarkerRef}
          position={[startLine.pin.lat, startLine.pin.lon]}
          icon={permanentPinIcon}
        >
          <Tooltip>Pin end</Tooltip>
        </Marker>
      )}
      {startLine?.boat && (
        <Marker
          ref={boatEndMarkerRef}
          position={[startLine.boat.lat, startLine.boat.lon]}
          icon={permanentBoatEndIcon}
        >
          <Tooltip>Boat end</Tooltip>
        </Marker>
      )}

      {playbackPosition && (
        <Marker
          ref={boatMarkerRef}
          position={[playbackPosition.lat, playbackPosition.lon]}
          icon={permanentBoatIcon}
        />
      )}

      <FitBounds points={points as L.LatLngExpression[]} fitTick={fitTick} />
      <DragTracker onDrag={onExitFollow} />
      <FollowBoat point={playbackPosition ? [playbackPosition.lat, playbackPosition.lon] : null} followMode={followMode} />
    </MapContainer>
  );
}
