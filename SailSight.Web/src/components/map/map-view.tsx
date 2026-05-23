"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
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
  pointsRef.current = points;
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
    if (followMode && point) map.panTo(point);
  }, [point, followMode, map]);
  return null;
}

/** Canvas size of the permanent boat icon, in px. Scale is applied via CSS transform. */
const BOAT_ICON_CANVAS = 80;

/**
 * A fixed, never-recreated Leaflet icon for the playback boat arrow.
 * Heading and zoom-scale are applied via direct DOM style mutation so that
 * CSS transitions fire smoothly on every update.
 */
function makePermanentBoatIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="boat-arrow" style="width:${BOAT_ICON_CANVAS}px;height:${BOAT_ICON_CANVAS}px;transform-origin:center center;transition:transform 0.3s ease-out;transform:rotate(0deg) scale(0.15);"><svg viewBox="0 0 24 24" width="${BOAT_ICON_CANVAS}" height="${BOAT_ICON_CANVAS}"><path d="M12 2 L20 22 L12 18 L4 22 Z" fill="#FF4500" stroke="#fff" stroke-width="1"/></svg></div>`,
    iconSize: [BOAT_ICON_CANVAS, BOAT_ICON_CANVAS],
    iconAnchor: [BOAT_ICON_CANVAS / 2, BOAT_ICON_CANVAS / 2],
  });
}

function metersPerPixel(zoom: number, latDeg: number): number {
  return (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / Math.pow(2, zoom);
}

/** Pixel size for the boat icon so it approximates the real physical length. Minimum 20 px for visibility. */
function boatIconSize(lengthMeters: number, zoom: number, latDeg: number): number {
  const px = lengthMeters / metersPerPixel(zoom, latDeg);
  return Math.round(Math.max(20, Math.min(80, px)));
}

/** Canvas size for start-line markers (pin + boat end). Scale is applied via CSS transform. */
const START_MARKER_CANVAS = 48;

/**
 * Pixel size for landmark markers (start line pin/boat end) based on zoom.
 * Scales from 10 px at zoom 14 up to 32 px at high zoom, floored at 10 px.
 */
function zoomMarkerPx(zoom: number): number {
  return Math.round(Math.max(10, Math.min(32, 10 * Math.pow(1.5, zoom - 14))));
}

function makePermanentPinIcon(): L.DivIcon {
  const c = START_MARKER_CANVAS;
  return L.divIcon({
    className: "",
    html: `<div class="start-pin" style="width:${c}px;height:${c}px;transform-origin:center center;transition:transform 0.3s ease-out;transform:scale(0.33);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${c}" height="${c}"><polygon points="12,3 22,21 2,21" fill="#00CCFF" stroke="#fff" stroke-width="1"/></svg></div>`,
    iconSize: [c, c],
    iconAnchor: [c / 2, c / 2],
  });
}

function makePermanentBoatEndIcon(): L.DivIcon {
  const c = START_MARKER_CANVAS;
  return L.divIcon({
    className: "",
    html: `<div class="start-boat-end" style="width:${c}px;height:${c}px;transform-origin:center center;transition:transform 0.3s ease-out;transform:scale(0.33);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${c}" height="${c}"><rect x="3" y="3" width="18" height="18" rx="2" fill="#FF4500" stroke="#fff" stroke-width="1"/></svg></div>`,
    iconSize: [c, c],
    iconAnchor: [c / 2, c / 2],
  });
}

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

  const smoothedPositions = useMemo(
    () => smoothTrackPositions(positions ?? []),
    [positions]
  );
  const smoothedPreRacePositions = useMemo(
    () => smoothTrackPositions(preRacePositions ?? []),
    [preRacePositions]
  );

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
    () => heatmapPositions.map((p) => [n(p.latitude), n(p.longitude)] as [number, number]),
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

  const smoothedWindowPositions = useMemo(
    () => smoothTrackPositions(windowPositions ?? []),
    [windowPositions]
  );
  const windowPoints = useMemo(
    () => simplifyTrack(smoothedWindowPositions, tolerance),
    [smoothedWindowPositions, tolerance]
  );

  const center = points[0] ?? [0, 0];
  const centerLat = (center as [number, number])[0];
  const boatLength = (boatLengthMeters != null && isFinite(boatLengthMeters) && boatLengthMeters > 0)
    ? boatLengthMeters
    : 11;
  const iconSize = boatIconSize(boatLength, zoom, centerLat);

  // Stable icon instance — never recreated so CSS transitions fire on every update.
  const permanentBoatIcon = useMemo(() => makePermanentBoatIcon(), []);
  const boatMarkerRef = useRef<L.Marker | null>(null);

  // Stable icons for start line markers.
  const permanentPinIcon = useMemo(() => makePermanentPinIcon(), []);
  const permanentBoatEndIcon = useMemo(() => makePermanentBoatEndIcon(), []);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const boatEndMarkerRef = useRef<L.Marker | null>(null);

  // Landmark marker scale — used by start pin, start boat end.
  const startMarkerScale = useMemo(() => zoomMarkerPx(zoom) / START_MARKER_CANVAS, [zoom]);

  // Course mark radius (CircleMarker is SVG so we update via prop).
  const markRadius = useMemo(
    () => Math.round(Math.max(4, Math.min(10, 4 * Math.pow(1.5, zoom - 14)))),
    [zoom]
  );

  // Update heading and scale directly on the existing DOM element so the
  // CSS transition (defined in the icon HTML) plays smoothly.
  useEffect(() => {
    const marker = boatMarkerRef.current;
    if (!marker) return;
    const el = marker.getElement();
    if (!el) return;
    const arrow = el.querySelector(".boat-arrow") as HTMLElement | null;
    if (!arrow) return;
    const scale = iconSize / BOAT_ICON_CANVAS;
    arrow.style.transform = `rotate(${playbackPosition?.cog ?? 0}deg) scale(${scale})`;
  }, [playbackPosition?.cog, iconSize]);

  // Update start line marker scales via DOM mutation so CSS transitions fire.
  useEffect(() => {
    const pin = pinMarkerRef.current?.getElement()?.querySelector(".start-pin") as HTMLElement | null;
    const boatEnd = boatEndMarkerRef.current?.getElement()?.querySelector(".start-boat-end") as HTMLElement | null;
    if (pin) pin.style.transform = `scale(${startMarkerScale})`;
    if (boatEnd) boatEnd.style.transform = `scale(${startMarkerScale})`;
  }, [startMarkerScale]);

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

      {trackMode === "heatmap" && heatmapPositions.length > 1 && (
        <>
          {heatmapPoints.slice(0, -1).map((p, i) => {
            const v = heatmapMaxSpeeds[i] ?? 0;
            const t = (v - speedRange.min) / (speedRange.max - speedRange.min);
            return (
              <Polyline
                key={i}
                positions={[p, heatmapPoints[i + 1]]}
                pathOptions={{ color: speedColor(Math.max(0, Math.min(1, t))), weight: 3, opacity: 0.9 }}
              />
            );
          })}
        </>
      )}

      {windowPoints.length > 1 && (
        <Polyline positions={windowPoints} pathOptions={{ color: "#FF8C00", weight: 9, opacity: 0.35 }} />
      )}

      {legs?.map((m, i) => (
        <CircleMarker
          key={i}
          center={[m.latitude, m.longitude]}
          radius={markRadius}
          pathOptions={{ color: "#FFCC00", fillColor: "#FFCC00", fillOpacity: 0.8 }}
        >
          <Tooltip>{m.markName}</Tooltip>
        </CircleMarker>
      ))}

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
