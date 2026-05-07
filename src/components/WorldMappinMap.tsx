/**
 * Inline WorldMappin pin renderer for post bodies.
 *
 * Posts on Hive embed a geo-pin via the comment marker
 *   `[//]:# (!worldmappin 3.16374 lat 101.68892 long I was here d3scr)`
 * which `extractWorldMappinPins` parses into { lat, lng, description }. This
 * component takes that data and renders a Leaflet map (OSM raster tiles)
 * with a single pin at the location — visually matched to hivesuite's full
 * Map screen so the standalone and inline experiences feel like the same
 * surface (same pin SVG, dark canvas, themed attribution + zoom-bar).
 *
 * Why a `DivIcon` for the marker: Leaflet's default Marker pulls PNGs from
 * its CSS, which Vite's bundler doesn't auto-resolve. Building the icon
 * from inline SVG keeps the kit consumer-agnostic — no asset shim needed.
 */
import React, { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Scoped theme for the inline WorldMappin map — dark canvas, themed
 * attribution, dark zoom-bar buttons, marker drop shadow. Injected once as
 * a `<style>` tag so the kit can ship without an extra CSS asset for
 * consumers to import.
 */
const STYLE_ID = "hive-worldmappin-styles";
const STYLE_TEXT = `
.hive-worldmappin .leaflet-container {
  background: #0d1118;
  /* Trap Leaflet's z-indexes (panes 200–700, controls 800) inside the
     canvas's stacking context so consumer overlays — drawers, modals,
     toasts — at any z >= 1 sit above the map predictably. Without this
     the leaflet container has no z-index and its children's z-values
     leak out and race overlays for a few frames after mount. */
  isolation: isolate;
}
.hive-worldmappin .leaflet-control-attribution {
  background: rgba(13, 17, 24, 0.78);
  color: #cfd3da;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}
.hive-worldmappin .leaflet-control-attribution a { color: #ffd166; }
.hive-worldmappin .leaflet-bar {
  border: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.hive-worldmappin .leaflet-bar a {
  background: #1a1f29;
  color: #f0f0f8;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.hive-worldmappin .leaflet-bar a:hover { background: #2a3038; }
.hive-worldmappin-pin { background: transparent !important; border: none !important; }
.hive-worldmappin-pin svg { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)); }
`;

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = STYLE_TEXT;
  document.head.appendChild(el);
}

export interface WorldMappinMapProps {
  lat: number;
  lng: number;
  description?: string;
  /** CSS height — defaults to 320px which fits comfortably between body
   *  paragraphs and footer on detail pages. */
  height?: number | string;
  /** Initial zoom — 12 is "city-block" detail. Bump to 15+ for a pinpoint. */
  zoom?: number;
  className?: string;
}

// Identical to hivesuite/src/pages/MapPage.tsx so the inline post map and
// the full Map screen render the same pin glyph.
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32">
  <path d="M12 0 C5.4 0 0 5.4 0 12 c0 9 12 20 12 20 s12 -11 12 -20 C24 5.4 18.6 0 12 0 z" fill="#e31337" stroke="#1c1f29" stroke-width="1.5"/>
  <circle cx="12" cy="11.5" r="4.4" fill="#fff8e0"/>
</svg>`;

const pinIcon = L.divIcon({
  className: "hive-worldmappin-pin",
  html: PIN_SVG,
  iconSize: [24, 32],
  iconAnchor: [12, 30],
  popupAnchor: [0, -28],
});

export const WorldMappinMap: React.FC<WorldMappinMapProps> = ({
  lat,
  lng,
  description,
  height = 320,
  zoom = 12,
  className = "",
}) => {
  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);

  // Inject the hivesuite Map screen's Leaflet theme once on first render.
  useEffect(() => { ensureStyles(); }, []);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`hive-worldmappin rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#0d1118] ${className}`}
    >
      <div style={{ height: heightStyle, width: "100%" }}>
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          zoomControl={false}
          style={{ height: "100%", width: "100%", background: "#0d1118" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ZoomControl position="bottomright" />
          <Marker position={center} icon={pinIcon}>
            {description && (
              <Popup>
                <div className="text-sm text-gray-800 max-w-[220px]">
                  {description}
                </div>
              </Popup>
            )}
          </Marker>
        </MapContainer>
      </div>
      <div className="px-3 py-2 bg-[rgba(255,255,255,0.04)] border-t border-[rgba(255,255,255,0.08)] flex items-center gap-2 text-xs text-[#cfd3da]">
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#e31337]" />
        <span className="truncate">
          {description || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        </span>
      </div>
    </div>
  );
};

export default WorldMappinMap;
