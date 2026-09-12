export type MapTileStyle = "standard" | "light" | "dark";

export interface TileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
}

const OSM_ATTRIBUTION = '© <a href="https://openstreetmap.org">OpenStreetMap</a>';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION}, © <a href="https://carto.com/attributions">CARTO</a>`;

const TILES: Record<MapTileStyle, TileConfig> = {
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  },
};

export function readMapStyle(): MapTileStyle {
  if (typeof document === "undefined") return "standard";
  const attr = document.documentElement.getAttribute("data-map");
  return attr === "light" || attr === "dark" ? attr : "standard";
}

export function tileConfig(style?: MapTileStyle): TileConfig {
  return TILES[style ?? readMapStyle()];
}
