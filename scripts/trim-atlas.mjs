// 재난 지도(일본·한국 둘레)에 쓸 해안선·국경만 world-atlas 50m 에서 잘라 GeoJSON 으로 남긴다.
// 지도 데이터가 바뀌면 `node scripts/trim-atlas.mjs` 로 다시 만든다
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { feature, mesh } from 'topojson-client';

// 화면에 보이는 범위보다 넉넉히. 밖의 점은 이 상자 테두리로 당겨 모양이 닫히게 한다
const BOX = { west: 110, east: 160, south: 15, north: 55 };
const DIGITS = 2; // 약 1km. 이 축척에서 차이가 보이지 않는다

const require = createRequire(import.meta.url);
const topology = JSON.parse(
  await readFile(require.resolve('world-atlas/countries-50m.json'), 'utf8'),
);

const round = (value) => Number(value.toFixed(DIGITS));
const clamp = ([lng, lat]) => [
  round(Math.min(BOX.east, Math.max(BOX.west, lng))),
  round(Math.min(BOX.north, Math.max(BOX.south, lat))),
];
const inside = ([lng, lat]) =>
  lng >= BOX.west && lng <= BOX.east && lat >= BOX.south && lat <= BOX.north;

function line(points) {
  const out = [];
  for (const point of points.map(clamp)) {
    const last = out.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  return out;
}

function polygon(rings) {
  if (!rings[0]?.some(inside)) return null;
  const kept = rings.map(line).filter((ring) => ring.length >= 4);
  return kept.length ? kept : null;
}

const countries = feature(topology, topology.objects.countries).features.flatMap((item) => {
  const { type, coordinates } = item.geometry ?? {};
  const polygons = (type === 'Polygon' ? [coordinates] : type === 'MultiPolygon' ? coordinates : [])
    .map(polygon)
    .filter(Boolean);
  if (!polygons.length) return [];
  return [
    {
      type: 'Feature',
      id: item.id,
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    },
  ];
});

const borders = mesh(topology, topology.objects.countries, (a, b) => a !== b);
const borderLines = borders.coordinates.filter((points) => points.some(inside)).map(line);

await writeFile(
  new URL('../src/assets/geo/east-asia-50m.json', import.meta.url),
  JSON.stringify({
    countries: { type: 'FeatureCollection', features: countries },
    borders: { type: 'MultiLineString', coordinates: borderLines },
  }),
);
console.warn(`countries ${countries.length}, border lines ${borderLines.length}`);

// 소개·온보딩 지구본(정사영)용 세계 육지. 면으로 채우므로 국경 없이 land 만, 0.1° 로 반올림
const landTopology = JSON.parse(
  await readFile(require.resolve('world-atlas/land-110m.json'), 'utf8'),
);
const roundLine = (points) =>
  points.map(([lng, lat]) => [Number(lng.toFixed(1)), Number(lat.toFixed(1))]);
const land = feature(landTopology, landTopology.objects.land);
const landGeometry = {
  type: 'MultiPolygon',
  coordinates: land.features.flatMap((item) =>
    item.geometry.type === 'Polygon'
      ? [item.geometry.coordinates.map(roundLine)]
      : item.geometry.coordinates.map((polygon) => polygon.map(roundLine)),
  ),
};
await writeFile(
  new URL('../src/assets/geo/world-land-110m.json', import.meta.url),
  JSON.stringify(landGeometry),
);
console.warn(`world land polygons ${landGeometry.coordinates.length}`);
