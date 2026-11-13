"use client";
// Қала картасы: OpenFreeMap (OpenStreetMap), 3D ғимараттар, қазақша атаулар, жерсерік, белгішелер, кластерлер,
// 3D ошақ бағандары, бригада көліктері, автоматты айналу.
import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, GeoJSONSource, Marker, Popup, StyleSpecification } from "maplibre-gl";
import { CITY_CENTER } from "@/lib/meta";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  size?: number;
  weight?: number;
  stroke?: string;
  label?: string;
  sub?: string;
  icon?: string; // эмодзи белгіше (бар болса — маркер-белгіше)
}

export interface Vehicle {
  id: string;
  lat: number;
  lng: number;
  label: string;
  busy: boolean;
  kind?: "brigade" | "truck"; // truck — GPS бар қоқыс тасушы
  collecting?: boolean;
}

const STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
  mono: "https://tiles.openfreemap.org/styles/positron",
};
const FONT = ["Noto Sans Regular"];

function localizeLabels(m: MLMap) {
  for (const l of m.getStyle().layers ?? []) {
    if (l.type !== "symbol") continue;
    const tf = m.getLayoutProperty(l.id, "text-field");
    if (!tf) continue;
    const s = JSON.stringify(tf);
    if (s.includes("ref") && !s.includes("name")) continue;
    const ru = document.documentElement.lang === "ru";
    m.setLayoutProperty(l.id, "text-field", ru ? ["coalesce", ["get", "name:ru"], ["get", "name"], ["get", "name:latin"]] : ["coalesce", ["get", "name:kk"], ["get", "name"], ["get", "name:latin"]]);
  }
}

/** Түнгі картаның контрастын арттыру: көшелер, атаулар, саябақтар, су проектордан да көрінеді */
function boostDark(m: MLMap) {
  const set = (id: string, prop: string, v: unknown) => {
    try {
      if (m.getLayer(id)) m.setPaintProperty(id, prop as never, v as never);
    } catch {}
  };
  set("background", "background-color", "#121211");
  set("landuse_residential", "fill-color", "#191917");
  set("landcover_wood", "fill-color", "#17211a");
  set("landuse_park", "fill-color", "#17211a");
  set("water", "fill-color", "#0f2230");
  set("waterway", "line-color", "#16364a");
  set("building", "fill-color", "#22221f");
  set("highway_path", "line-color", "#2c2c29");
  set("highway_minor", "line-color", "#33332f");
  set("highway_major_casing", "line-color", "rgba(120,118,110,0.55)");
  set("highway_major_inner", "line-color", "#46453f");
  set("highway_major_subtle", "line-color", "#46453f");
  set("highway_motorway_casing", "line-color", "rgba(140,138,128,0.6)");
  set("highway_motorway_subtle", "line-color", "#55534c");
  for (const id of ["railway", "railway_minor", "railway_transit"]) set(id, "line-color", "#3a3a36");
  set("highway_name_other", "text-color", "#a9a79e");
  set("highway_name_other", "text-halo-color", "#0e0e0d");
  set("highway_name_other", "text-halo-width", 1.4);
  set("water_name", "text-color", "#6f97b3");
  for (const l of m.getStyle().layers ?? [])
    if (l.id.startsWith("place_")) {
      set(l.id, "text-color", "#d6d4cc");
      set(l.id, "text-halo-color", "#0e0e0d");
      set(l.id, "text-halo-width", 1.6);
    }
}

function add3dBuildings(m: MLMap, theme: "dark" | "light" | "mono") {
  if (m.getLayer("building-3d")) {
    if (theme === "dark") m.setPaintProperty("building-3d", "fill-extrusion-color", "#2a2a27");
    return;
  }
  const firstSymbol = m.getStyle().layers?.find((l) => l.type === "symbol")?.id;
  m.addLayer(
    {
      id: "ts-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13.5,
      paint: {
        "fill-extrusion-color": theme === "dark" ? "#2b2b28" : "#e3e1da",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": theme === "dark" ? 0.95 : 0.75,
      },
    },
    firstSymbol,
  );
}

/** Маркер-белгіше суреті: түсті дөңгелек + ақ жиек + эмодзи (2x сапа) */
function pinImage(color: string, icon: string) {
  const S = 72;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const x = c.getContext("2d")!;
  x.shadowColor = "rgba(0,0,0,0.45)";
  x.shadowBlur = 8;
  x.shadowOffsetY = 3;
  x.beginPath();
  x.arc(S / 2, S / 2, 26, 0, Math.PI * 2);
  x.fillStyle = color;
  x.fill();
  x.shadowColor = "transparent";
  x.lineWidth = 5;
  x.strokeStyle = "#ffffff";
  x.stroke();
  x.font = "28px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(icon, S / 2, S / 2 + 2);
  return x.getImageData(0, 0, S, S);
}

/** Алтыбұрышты торға жинау (≈250 м): 3D ошақ бағандары үшін */
function hexbin(points: MapPoint[]) {
  const R = 0.0021; // ендік бойынша
  const k = 1 / Math.cos((44.85 * Math.PI) / 180);
  const cells = new Map<string, { q: number; r: number; n: number }>();
  for (const p of points) {
    if ((p.weight ?? 1) < 0.5) continue;
    const x = (p.lng - CITY_CENTER[0]) / k / R;
    const y = (p.lat - CITY_CENTER[1]) / R;
    let q = ((Math.sqrt(3) / 3) * x - y / 3) ;
    let r = (2 / 3) * y;
    // cube round
    let cx = q, cz = r, cy = -cx - cz;
    let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy <= dz) rz = -rx - ry;
    q = rx;
    r = rz;
    const key = `${q}:${r}`;
    const c = cells.get(key) ?? { q, r, n: 0 };
    c.n += p.weight ?? 1;
    cells.set(key, c);
  }
  const features = [...cells.values()].map(({ q, r, n }) => {
    const cxp = R * Math.sqrt(3) * (q + r / 2);
    const cyp = R * 1.5 * r;
    const ring: [number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      ring.push([CITY_CENTER[0] + (cxp + R * 0.92 * Math.cos(a)) * k, CITY_CENTER[1] + cyp + R * 0.92 * Math.sin(a)]);
    }
    return { type: "Feature" as const, properties: { n }, geometry: { type: "Polygon" as const, coordinates: [ring] } };
  });
  return { type: "FeatureCollection" as const, features };
}

const TRUCK = (busy: boolean) =>
  `<svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="${busy ? "#f5a524" : "#f2f1ed"}" stroke="#0e0e0d" stroke-width="2"/><path d="M8 19.5V12.8c0-.5.4-.8.8-.8h9.4c.5 0 .8.3.8.8v6.7M19 15h3.6l2.4 3v1.5M8 19.5h17" fill="none" stroke="#0e0e0d" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="21" r="1.9" fill="#0e0e0d"/><circle cx="21.5" cy="21" r="1.9" fill="#0e0e0d"/></svg>`;

const GARBAGE = (collecting: boolean) =>
  `<svg width="38" height="38" viewBox="0 0 38 38"><rect x="2" y="2" width="34" height="34" rx="9" fill="${collecting ? "#1e7a4c" : "#0e0e0d"}" stroke="#f2f1ed" stroke-width="2"/><path d="M8 24V13.5c0-.6.4-1 1-1h12.5c.6 0 1 .4 1 1V24M22.5 17h4l3 3.6V24M8 24h21.5" fill="none" stroke="#f2f1ed" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 16.5v5M15.3 16.5v5M18.6 16.5v5" stroke="#f2f1ed" stroke-width="1.4" stroke-linecap="round"/><circle cx="12.5" cy="26" r="2.2" fill="#f2f1ed"/><circle cx="25" cy="26" r="2.2" fill="#f2f1ed"/></svg>`;

export default function MapView({
  points,
  theme = "dark",
  heat = false,
  selectedId,
  onSelect,
  focus,
  pulse = [],
  zoom = 13.2,
  pitch = 0,
  className = "",
  onMapClick,
  pin,
  padding,
  controls = true,
  interactive = true,
  route,
  controlsPos = "bottom-right",
  basemapSwitch = true,
  geolocate = false,
  cluster = false,
  hex3d = false,
  vehicles = [],
  autoRotate = false,
}: {
  points: MapPoint[];
  theme?: "dark" | "light" | "mono";
  heat?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  focus?: { lat: number; lng: number; zoom?: number; key?: string | number; pitch?: number } | null;
  pulse?: { id: string; lat: number; lng: number; color: string }[];
  zoom?: number;
  pitch?: number;
  className?: string;
  onMapClick?: (p: { lat: number; lng: number }) => void;
  pin?: { lat: number; lng: number } | null;
  padding?: { left?: number; right?: number; top?: number; bottom?: number };
  controls?: boolean;
  interactive?: boolean;
  route?: { from: { lat: number; lng: number }; to: { lat: number; lng: number } } | null;
  controlsPos?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  basemapSwitch?: boolean;
  geolocate?: boolean;
  cluster?: boolean;
  hex3d?: boolean;
  vehicles?: Vehicle[];
  autoRotate?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sat, setSat] = useState(false);
  const markers = useRef<Map<string, Marker>>(new Map());
  const vehMarkers = useRef<Map<string, { mk: Marker; from: [number, number]; to: [number, number]; t0: number }>>(new Map());
  const pinMarker = useRef<Marker | null>(null);
  const popup = useRef<Popup | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const cb = useRef({ onSelect, onMapClick });
  cb.current = { onSelect, onMapClick };
  const latest = useRef({ points, heat, selectedId, hex3d });
  latest.current = { points, heat, selectedId, hex3d };

  const toGeo = (pts: MapPoint[]) => ({
    type: "FeatureCollection" as const,
    features: pts.map((p) => ({
      type: "Feature" as const,
      properties: {
        id: p.id,
        color: p.color,
        size: p.size ?? 6,
        weight: p.weight ?? 1,
        stroke: p.stroke ?? (theme === "dark" ? "#0e0e0d" : "#ffffff"),
        label: p.label ?? "",
        sub: p.sub ?? "",
        icon: p.icon ?? "",
      },
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !el.current) return;
      lib.current = maplibre;
      const m = new maplibre.Map({
        container: el.current,
        style: STYLES[theme] as unknown as StyleSpecification,
        center: CITY_CENTER,
        zoom,
        pitch,
        bearing: pitch ? -17 : 0,
        maxPitch: 70,
        interactive,
        attributionControl: { compact: true },
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      });
      map.current = m;
      if (padding && window.innerWidth >= 1024) m.setPadding({ left: 0, right: 0, top: 0, bottom: 0, ...padding });
      if (controls && interactive) {
        m.addControl(new maplibre.NavigationControl({ visualizePitch: true }), controlsPos);
        m.addControl(new maplibre.ScaleControl({ maxWidth: 90, unit: "metric" }), controlsPos);
      }
      if (geolocate && interactive) {
        const geo = new maplibre.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, showUserLocation: true });
        m.addControl(geo, controlsPos);
        geo.on("geolocate", (e: GeolocationPosition) => cb.current.onMapClick?.({ lat: e.coords.latitude, lng: e.coords.longitude }));
      }
      // белгіше суреттері сұраныс бойынша жасалады: "ts-pin|<түс>|<эмодзи>"
      m.on("styleimagemissing", (e) => {
        if (!e.id.startsWith("ts-pin|")) return;
        const [, color, icon] = e.id.split("|");
        if (!m.hasImage(e.id)) m.addImage(e.id, pinImage(color, icon), { pixelRatio: 2 });
      });

      m.on("load", () => {
        try {
          localizeLabels(m);
          if (theme === "dark") boostDark(m);
          add3dBuildings(m, theme);
        } catch {}
        const firstSymbol = m.getStyle().layers?.find((l) => l.type === "symbol")?.id;
        try {
          m.addSource("sat", {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "Жерсерік: © Esri, Maxar, Earthstar Geographics",
          });
          m.addLayer({ id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } }, firstSymbol);
        } catch {}

        const data = toGeo(latest.current.points);
        m.addSource("raw", { type: "geojson", data });
        m.addSource("pts", cluster ? { type: "geojson", data, cluster: true, clusterRadius: 46, clusterMaxZoom: 14.5 } : { type: "geojson", data });
        m.addSource("hex", { type: "geojson", data: hexbin(latest.current.points) });
        m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        m.addLayer({
          id: "hex",
          type: "fill-extrusion",
          source: "hex",
          layout: { visibility: latest.current.hex3d ? "visible" : "none" },
          paint: {
            "fill-extrusion-color": ["interpolate", ["linear"], ["get", "n"], 1, "#6b1c17", 3, "#b81a13", 6, "#e2231a", 10, "#ff7a50", 16, "#ffd0a0"],
            "fill-extrusion-height": ["*", ["get", "n"], 85],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.82,
          },
        });
        m.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round" },
          paint: { "line-color": "#e2231a", "line-width": 3.5, "line-dasharray": [1.4, 1.4] },
        });
        m.addLayer({
          id: "heat",
          type: "heatmap",
          source: "raw",
          maxzoom: 16,
          layout: { visibility: latest.current.heat ? "visible" : "none" },
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 15, 1.6],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 18, 15, 46],
            "heatmap-opacity": 0.7,
            "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(226,35,26,0)", 0.3, "rgba(226,35,26,0.25)", 0.6, "rgba(226,35,26,0.55)", 1, "rgba(255,90,60,0.85)"],
          },
        });

        if (cluster) {
          m.addLayer({
            id: "cl",
            type: "circle",
            source: "pts",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": ["step", ["get", "point_count"], "#e2231a", 6, "#c41d16", 15, "#8f1510"],
              "circle-radius": ["step", ["get", "point_count"], 17, 6, 22, 15, 28],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 3,
              "circle-opacity": 0.95,
            },
          });
          m.addLayer({
            id: "cl-n",
            type: "symbol",
            source: "pts",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 14, "text-allow-overlap": true },
            paint: { "text-color": "#ffffff" },
          });
        }
        const single: unknown[] = cluster ? ["!", ["has", "point_count"]] : ["all"];
        m.addLayer({
          id: "halo",
          type: "circle",
          source: "pts",
          filter: ["all", single, ["==", ["get", "icon"], ""]] as never,
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["*", ["get", "size"], 1.2], 16, ["*", ["get", "size"], 2.6]],
            "circle-opacity": 0.16,
            "circle-pitch-alignment": "map",
          },
        });
        m.addLayer({
          id: "dots",
          type: "circle",
          source: "pts",
          filter: ["all", single, ["==", ["get", "icon"], ""]] as never,
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["*", ["get", "size"], 0.9], 16, ["*", ["get", "size"], 1.7]],
            "circle-stroke-color": ["get", "stroke"],
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 16, 2.2],
            "circle-pitch-alignment": "map",
          },
        });
        m.addLayer({
          id: "icons",
          type: "symbol",
          source: "pts",
          filter: ["all", single, ["!=", ["get", "icon"], ""]] as never,
          layout: {
            "icon-image": ["concat", "ts-pin|", ["get", "color"], "|", ["get", "icon"]],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 11, ["*", 0.5, ["/", ["get", "size"], 8]], 16, ["*", 1, ["/", ["get", "size"], 8]]],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-sort-key": ["-", 0, ["get", "size"]],
          },
        });
        m.addLayer({
          id: "selected",
          type: "circle",
          source: "pts",
          filter: ["==", ["get", "id"], latest.current.selectedId ?? ""],
          paint: {
            "circle-color": "rgba(0,0,0,0)",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 14, 16, 26],
            "circle-stroke-color": theme === "dark" ? "#f2f1ed" : "#0e0e0d",
            "circle-stroke-width": 3,
            "circle-pitch-alignment": "map",
          },
        });

        popup.current = new maplibre.Popup({ closeButton: false, closeOnClick: false, offset: 16, className: "ts-popup" });
        const hover = (e: maplibregl.MapLayerMouseEvent) => {
          const f = e.features?.[0];
          m.getCanvas().style.cursor = "pointer";
          const label = f?.properties?.label as string;
          if (!f || !label) return;
          const node = document.createElement("div");
          const t = document.createElement("div");
          t.className = "ts-popup-t";
          t.textContent = label;
          node.appendChild(t);
          if (f.properties?.sub) {
            const s = document.createElement("div");
            s.className = "ts-popup-s";
            s.textContent = f.properties.sub as string;
            node.appendChild(s);
          }
          popup.current!.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(node).addTo(m);
        };
        const leave = () => {
          m.getCanvas().style.cursor = "";
          popup.current?.remove();
        };
        for (const id of ["dots", "icons"]) {
          m.on("mousemove", id, hover);
          m.on("mouseleave", id, leave);
          m.on("click", id, (e) => {
            const pid = e.features?.[0]?.properties?.id as string | undefined;
            if (pid) cb.current.onSelect?.(pid);
          });
        }
        if (cluster) {
          m.on("click", "cl", async (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const z = await (m.getSource("pts") as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id as number);
            m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z + 0.3, duration: 700 });
          });
          m.on("mouseenter", "cl", () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", "cl", () => (m.getCanvas().style.cursor = ""));
        }
        m.on("click", (e) => {
          const hits = m.queryRenderedFeatures(e.point, { layers: ["dots", "icons", ...(cluster ? ["cl"] : [])] });
          if (!hits.length) cb.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
        setLoaded(true);
      });
    })();
    const vm = vehMarkers.current;
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
      vm.clear();
      pinMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const m = map.current!;
    const data = toGeo(points);
    (m.getSource("pts") as GeoJSONSource | undefined)?.setData(data);
    (m.getSource("raw") as GeoJSONSource | undefined)?.setData(data);
    if (hex3d) (m.getSource("hex") as GeoJSONSource | undefined)?.setData(hexbin(points));
  }, [points, loaded, hex3d]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded) return;
    map.current?.setLayoutProperty("heat", "visibility", heat ? "visible" : "none");
  }, [heat, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const m = map.current!;
    m.setLayoutProperty("hex", "visibility", hex3d ? "visible" : "none");
    if (hex3d) {
      (m.getSource("hex") as GeoJSONSource).setData(hexbin(latest.current.points));
      if (m.getPitch() < 45) m.easeTo({ pitch: 58, duration: 900 });
    }
  }, [hex3d, loaded]);

  useEffect(() => {
    const m = map.current;
    if (!loaded || !m?.getLayer("sat")) return;
    m.setLayoutProperty("sat", "visibility", sat ? "visible" : "none");
    for (const id of ["building-3d", "ts-buildings"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", sat ? "none" : "visible");
  }, [sat, loaded]);

  useEffect(() => {
    if (!loaded) return;
    map.current?.setFilter("selected", ["==", ["get", "id"], selectedId ?? ""]);
  }, [selectedId, loaded]);

  useEffect(() => {
    if (!loaded) return;
    (map.current?.getSource("route") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: route
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[route.from.lng, route.from.lat], [route.to.lng, route.to.lat]] } }]
        : [],
    });
  }, [route?.from.lat, route?.from.lng, route?.to.lat, route?.to.lng, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focus || !map.current || !loaded) return;
    const opts: Parameters<MLMap["flyTo"]>[0] = { center: [focus.lng, focus.lat], zoom: focus.zoom ?? 16, speed: 1.3, curve: 1.4, essential: true };
    if (typeof focus.pitch === "number" && Number.isFinite(focus.pitch)) opts.pitch = focus.pitch; // undefined → NaN болып, камераны бұзады
    map.current.flyTo(opts);
  }, [focus?.lat, focus?.lng, focus?.key, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Бригада көліктері: позиция өзгергенде 1,2 с ішінде тегіс жылжиды
  useEffect(() => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L || !loaded) return;
    const want = new Set(vehicles.map((v) => v.id));
    for (const [id, v] of vehMarkers.current)
      if (!want.has(id)) {
        v.mk.remove();
        vehMarkers.current.delete(id);
      }
    for (const v of vehicles) {
      const cur = vehMarkers.current.get(v.id);
      if (!cur) {
        const node = document.createElement("div");
        node.className = v.kind === "truck" ? "ts-veh ts-truck" : "ts-veh";
        node.innerHTML = `${v.kind === "truck" ? GARBAGE(!!v.collecting) : TRUCK(v.busy)}<span></span>`;
        node.querySelector("span")!.textContent = v.label;
        const mk = new L.Marker({ element: node }).setLngLat([v.lng, v.lat]).addTo(m);
        vehMarkers.current.set(v.id, { mk, from: [v.lng, v.lat], to: [v.lng, v.lat], t0: 0 });
      } else {
        const p = cur.mk.getLngLat();
        cur.from = [p.lng, p.lat];
        cur.to = [v.lng, v.lat];
        cur.t0 = performance.now();
        const el = cur.mk.getElement();
        if (v.kind === "truck") el.querySelector("svg rect")?.setAttribute("fill", v.collecting ? "#1e7a4c" : "#0e0e0d");
        else el.querySelector("svg circle")?.setAttribute("fill", v.busy ? "#f5a524" : "#f2f1ed");
        const sp = el.querySelector("span");
        if (sp && sp.textContent !== v.label) sp.textContent = v.label;
      }
    }
    let raf = 0;
    const step = (t: number) => {
      let moving = false;
      for (const v of vehMarkers.current.values()) {
        const k = Math.min(1, (t - v.t0) / 1900);
        if (k < 1) moving = true;
        v.mk.setLngLat([v.from[0] + (v.to[0] - v.from[0]) * k, v.from[1] + (v.to[1] - v.from[1]) * k]);
      }
      if (moving) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [vehicles, loaded]);

  // Презентация режимі: камера қала үстімен баяу айналады, қолмен ұстаса — тоқтайды
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded || !autoRotate) return;
    let raf = 0;
    let on = true;
    const stop = () => (on = false);
    m.on("mousedown", stop);
    m.on("touchstart", stop);
    m.on("wheel", stop);
    const spin = () => {
      if (!on) return;
      m.setBearing(m.getBearing() + 0.05);
      raf = requestAnimationFrame(spin);
    };
    m.easeTo({ pitch: 60, zoom: Math.max(13.6, m.getZoom()), duration: 1200 });
    raf = requestAnimationFrame(spin);
    return () => {
      cancelAnimationFrame(raf);
      m.off("mousedown", stop);
      m.off("touchstart", stop);
      m.off("wheel", stop);
    };
  }, [autoRotate, loaded]);

  useEffect(() => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L) return;
    const want = new Set(pulse.map((p) => p.id));
    for (const [id, mk] of markers.current)
      if (!want.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    for (const p of pulse) {
      if (markers.current.has(p.id)) continue;
      const node = document.createElement("div");
      node.style.cssText = "position:relative;width:22px;height:22px;pointer-events:none";
      node.innerHTML = `<span class="ping-ring" style="background:${p.color}"></span><span class="ping-ring" style="background:${p.color};animation-delay:.6s"></span>`;
      markers.current.set(p.id, new L.Marker({ element: node }).setLngLat([p.lng, p.lat]).addTo(m));
    }
  }, [pulse, loaded]);

  useEffect(() => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L) return;
    if (!pin) {
      pinMarker.current?.remove();
      pinMarker.current = null;
      return;
    }
    if (!pinMarker.current) {
      const node = document.createElement("div");
      node.innerHTML = `<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43s15-14.3 15-25.5C32 8.4 25.3 2 17 2S2 8.4 2 17.5C2 28.7 17 43 17 43z" fill="#E2231A" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="17" r="5.5" fill="#fff"/></svg>`;
      pinMarker.current = new L.Marker({ element: node, anchor: "bottom" }).setLngLat([pin.lng, pin.lat]).addTo(m);
    } else pinMarker.current.setLngLat([pin.lng, pin.lat]);
  }, [pin?.lat, pin?.lng, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div ref={el} className="h-full w-full" />
      {basemapSwitch && interactive && controls && (
        <div className="ts-basemap absolute z-[2] flex overflow-hidden rounded-[4px] border border-black/10 bg-white/95 text-[11px] font-semibold shadow-lg">
          {[
            [false, "Карта"],
            [true, "Спутник"],
          ].map(([v, l]) => (
            <button
              key={String(l)}
              type="button"
              aria-pressed={sat === v}
              onClick={() => setSat(v as boolean)}
              className={`px-3 py-2 transition ${sat === v ? "bg-[#0e0e0d] text-white" : "text-[#0e0e0d] hover:bg-black/5"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
