// Basemap for Indonesia.
// Preferred path: a self-hosted Protomaps PMTiles archive (set VITE_PMTILES_URL at build time),
// styled with @protomaps/basemaps "light" flavour, no tile server and no API key.
// Fallback (no PMTiles URL configured yet): OpenFreeMap "positron" style, free and keyless.
// Both paths show the OpenStreetMap attribution through MapLibre's AttributionControl.
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MlMap, AttributionControl, NavigationControl, addProtocol, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
// MapLibre 6 ships its worker as a separate ES module; let Vite bundle it and hand over the URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';

const PMTILES_URL: string | undefined = import.meta.env.VITE_PMTILES_URL;
const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export const INDONESIA_BOUNDS: [[number, number], [number, number]] = [
  [94.5, -11.5],
  [141.5, 6.5],
];

let protocolAdded = false;

function protomapsStyle(url: string, lang: string): StyleSpecification {
  if (!protocolAdded) {
    const protocol = new Protocol();
    addProtocol('pmtiles', protocol.tile);
    protocolAdded = true;
  }
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${url}`,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang }),
  };
}

export interface MapHandle {
  map: MlMap;
  fitTo(bounds: [[number, number], [number, number]]): void;
  resize(): void;
}

export function createMap(container: HTMLElement, lang: string): MapHandle {
  const style = PMTILES_URL ? protomapsStyle(PMTILES_URL, lang) : FALLBACK_STYLE;
  const map = new MlMap({
    container,
    style,
    bounds: INDONESIA_BOUNDS,
    fitBoundsOptions: { padding: 12 },
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
  });
  // Both styles carry their own source attribution (incl. © OpenStreetMap); keep it always expanded.
  map.addControl(new AttributionControl({ compact: false }), 'bottom-right');
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    map,
    fitTo(bounds) {
      map.fitBounds(bounds, { padding: 24, duration: reduce ? 0 : 900 });
    },
    resize() {
      map.resize();
    },
  };
}
