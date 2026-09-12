export type MapTileStyle = "standard" | "light" | "dark";

export interface TileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
}

const OSM_ATTRIBUTION = '© <a href="https://openstreetmap.org">OpenStreetMap</a>';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION}, © <a href="https://carto.com/attributions">CARTO</a>`;

const CARTO_STYLES: Record<"light" | "dark", string> = {
  light: "light_all",
  dark: "dark_all",
};

const STANDARD: TileConfig = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: OSM_ATTRIBUTION,
  maxZoom: 19,
};

function cartoConfig(style: "light" | "dark", key: string): TileConfig {
  const base = `https://{s}.basemaps.cartocdn.com/${CARTO_STYLES[style]}/{z}/{x}/{y}{r}.png`;
  return {
    url: key ? `${base}?api_key=${encodeURIComponent(key)}` : base,
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  };
}

export function readCartoKey(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.getAttribute("data-carto") || "";
}

export function readMapStyle(): MapTileStyle {
  if (typeof document === "undefined") return "standard";
  const attr = document.documentElement.getAttribute("data-map");
  return attr === "light" || attr === "dark" ? attr : "standard";
}

export function tileConfig(style?: MapTileStyle): TileConfig {
  const resolved = style ?? readMapStyle();
  if (resolved === "standard") return STANDARD;
  const key = readCartoKey();
  if (!key) return STANDARD;
  return cartoConfig(resolved, key);
}

export function validateCartoKey(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined" || !key.trim()) {
      resolve(false);
      return;
    }
    const img = new Image();
    const timer = setTimeout(() => { img.src = ""; resolve(false); }, 6000);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.crossOrigin = "anonymous";
    img.src = `https://a.basemaps.cartocdn.com/dark_all/12/655/1583.png?api_key=${encodeURIComponent(key.trim())}`;
  });
}
