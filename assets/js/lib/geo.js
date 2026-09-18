const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function haversine(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function bearing(lat1, lng1, lat2, lng2) {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function indexAtOrBefore(points, value, col) {
  let lo = 0;
  let hi = points.length - 1;
  if (value <= points[0][col]) return 0;
  if (value >= points[hi][col]) return hi - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][col] <= value) lo = mid; else hi = mid;
  }
  return lo;
}

export function pointAtDistance(points, alongM) {
  const i = indexAtOrBefore(points, alongM, 2);
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  const span = b[2] - a[2] || 1;
  const t = Math.max(0, Math.min(1, (alongM - a[2]) / span));
  return {
    lat: a[0] + (b[0] - a[0]) * t,
    lng: a[1] + (b[1] - a[1]) * t,
    bearing: bearing(a[0], a[1], b[0], b[1]),
    index: i
  };
}

export function courseAtDistance(points, alongM, windowM = 200) {
  const total = points[points.length - 1][2];
  const half = Math.max(1, windowM / 2);
  const clamp = (m) => Math.max(0, Math.min(total, m));
  const a = pointAtDistance(points, clamp(alongM - half));
  const b = pointAtDistance(points, clamp(alongM + half));

  if (haversine(a.lat, a.lng, b.lat, b.lng) < 1) return pointAtDistance(points, alongM).bearing;
  return bearing(a.lat, a.lng, b.lat, b.lng);
}

export function distanceAtDriveTime(points, driveSec) {
  const i = indexAtOrBefore(points, driveSec, 3);
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  const span = b[3] - a[3] || 1;
  const t = Math.max(0, Math.min(1, (driveSec - a[3]) / span));
  return a[2] + (b[2] - a[2]) * t;
}

export function driveTimeAtDistance(points, alongM) {
  const i = indexAtOrBefore(points, alongM, 2);
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  const span = b[2] - a[2] || 1;
  const t = Math.max(0, Math.min(1, (alongM - a[2]) / span));
  return a[3] + (b[3] - a[3]) * t;
}

export function subRoute(points, fromM, toM) {
  const t0 = driveTimeAtDistance(points, fromM);
  const start = pointAtDistance(points, fromM);
  const end = pointAtDistance(points, toM);
  return [
    [start.lat, start.lng, 0, 0],
    ...points.filter((p) => p[2] > fromM && p[2] < toM).map((p) => [p[0], p[1], p[2] - fromM, p[3] - t0]),
    [end.lat, end.lng, toM - fromM, driveTimeAtDistance(points, toM) - t0]
  ];
}

export function reverseRoute(points) {
  const last = points[points.length - 1];
  return points.slice().reverse().map((p) => [p[0], p[1], last[2] - p[2], last[3] - p[3]]);
}

export function sliceRoute(points, fromM, toM) {
  if (toM <= fromM) return [];
  const start = pointAtDistance(points, fromM);
  const end = pointAtDistance(points, toM);
  const inner = points.filter((p) => p[2] > fromM && p[2] < toM).map((p) => [p[0], p[1]]);
  return [[start.lat, start.lng], ...inner, [end.lat, end.lng]];
}

export function formatDistance(meters) {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
