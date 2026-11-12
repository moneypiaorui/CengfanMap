export interface MapFeature {
  properties: { name: string; filename?: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}

function ringsOf(feature: MapFeature): number[][][] {
  return feature.geometry.type === "Polygon"
    ? (feature.geometry.coordinates as number[][][])
    : (feature.geometry.coordinates as number[][][][]).flat();
}

export function projectFeatures(features: MapFeature[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const feature of features) {
    for (const ring of ringsOf(feature)) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const scale = Math.min(760 / (maxX - minX || 1), 510 / (maxY - minY || 1));
  const project = ([x, y]: number[]) => [
    45 + (760 - (maxX - minX) * scale) / 2 + (x - minX) * scale,
    30 + (510 - (maxY - minY) * scale) / 2 + (maxY - y) * scale,
  ];
  return features.map((feature, index) => {
    const rings = ringsOf(feature).map((ring) => ring.map(project));
    const points = rings.flat();
    return {
      id: feature.properties.name + "-" + index,
      name: feature.properties.name,
      path: rings
        .map(
          (ring) =>
            ring
              .map(
                (point, i) =>
                  (i ? "L" : "M") +
                  point.map((n) => Number(n.toFixed(2))).join(","),
              )
              .join(" ") + " Z",
        )
        .join(" "),
      x: points.reduce((sum, point) => sum + point[0], 0) / points.length,
      y: points.reduce((sum, point) => sum + point[1], 0) / points.length,
    };
  });
}

const stops = [
  [255, 255, 255],
  [164, 217, 238],
  [126, 186, 238],
  [53, 127, 238],
  [12, 112, 238],
  [0, 108, 238],
];

export function colorForCount(count: number) {
  const position = Math.min(Math.max(count, 0) / 10, 1) * (stops.length - 1);
  const index = Math.min(Math.floor(position), stops.length - 2);
  const fraction = position - index;
  return (
    "rgb(" +
    stops[index]
      .map((value, channel) =>
        Math.round(value + (stops[index + 1][channel] - value) * fraction),
      )
      .join(",") +
    ")"
  );
}
