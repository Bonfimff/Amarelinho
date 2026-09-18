// =====================================================================================
// mockTransportData: camada de dados SIMULADOS.
// Toda a lógica de simulação vive aqui. A interface nunca calcula posição ou previsão:
// ela consome apenas os formatos devolvidos por este provedor, que são os mesmos que um
// futuro provedor HTTP (fonte oficial/autorizada) devolverá. Ver services/transportService.js.
//
//  REAL (vem de data/official): linhas, nomes, origens/destinos, faixas de funcionamento,
//        quadros de horários e nomes dos pontos.
//  APROXIMADO (vem de data/geo): traçado viário e posição dos pontos, calculados sobre o OpenStreetMap.
//  SIMULADO (calculado aqui): posição dos veículos, velocidade, atrasos, previsões e "GPS".
// =====================================================================================
import { LINES } from '../official/lines.js';
import { TZ01_ROUTE } from '../geo/tz01-route.js';
import { hhmmToSec, secToHHMM, nowSec } from '../../lib/time.js';
import { pointAtDistance, distanceAtDriveTime, reverseRoute, subRoute, driveTimeAtDistance } from '../../lib/geo.js';
import { SimulationClock } from './simulationClock.js';

const DWELL_SEC = 25; // parada média em cada ponto intermediário (simulado)
const PRE_DEPARTURE_SEC = 120; // veículo aparece no terminal 2 min antes da saída
const POST_ARRIVAL_SEC = 60; // e permanece 1 min após chegar

// ---------- Rede: linhas com traçado no mapa ----------
// Todas derivam do itinerário da TZ01, conforme o cartaz de pontos de parada da Prefeitura:
// TZ02 é a volta com as mesmas paradas; TZ05 e TZ06 usam os pontos que estão em seus trajetos.
// `simulate` só é ligado onde há quadro de horários compatível com o itinerário.
const LINE_ROUTES = {
  TZ01: { from: 'rodoviaria-piabeta', to: 'rodoviaria-mage', simulate: true },
  TZ02: { from: 'rodoviaria-mage', to: 'rodoviaria-piabeta', simulate: true },
  TZ05: { from: 'entrada-maua', to: 'rodoviaria-piabeta', simulate: false },
  TZ06: { from: 'entrada-maua', to: 'rodoviaria-mage', simulate: false }
};

function buildDirections(line) {
  const cfg = LINE_ROUTES[line.id];
  if (!cfg) return [];
  const base = TZ01_ROUTE;
  const stopA = base.stops.find((s) => s.id === cfg.from);
  const stopB = base.stops.find((s) => s.id === cfg.to);
  const reverse = stopA.alongM > stopB.alongM;
  const fromM = Math.min(stopA.alongM, stopB.alongM);
  const toM = Math.max(stopA.alongM, stopB.alongM);
  const forward = subRoute(base.points, fromM, toM);
  const last = forward[forward.length - 1];
  const t0 = driveTimeAtDistance(base.points, fromM);

  let stops = base.stops
    .filter((s) => s.alongM >= fromM && s.alongM <= toM)
    .map((s) => ({ ...s, alongM: s.alongM - fromM, driveSec: driveTimeAtDistance(base.points, s.alongM) - t0 }));
  if (reverse) stops = stops.reverse().map((s) => ({ ...s, alongM: last[2] - s.alongM, driveSec: last[3] - s.driveSec }));
  stops = stops.map((s, i) => ({ ...s, sequence: i + 1 }));

  const points = reverse ? reverseRoute(forward) : forward;
  const schedule = cfg.simulate ? line.schedule?.directions?.[0] : null;
  const dir = { id: 'ida', from: line.summary.origin, to: line.summary.destination, points, stops, schedule, simulate: Boolean(schedule) };
  return [{ ...dir, profile: buildTimeProfile(stops) }];
}

/** Horário de chegada/saída de cada ponto relativo à partida (sem variação de tráfego). */
function buildTimeProfile(stops) {
  const last = stops.length - 1;
  return stops.map((s, i) => {
    const arrive = s.driveSec + DWELL_SEC * Math.max(0, i - 1);
    const depart = i > 0 && i < last ? arrive + DWELL_SEC : arrive;
    return { arrive, depart };
  });
}

const NETWORK = new Map(LINES.map((line) => [line.id, { line, directions: buildDirections(line) }]));

// ---------- Variação determinística por viagem (tráfego simulado) ----------
function tripVariation(depSec) {
  const m = Math.round(depSec / 60);
  return {
    factor: 1 + (((m * 37) % 9) - 2) * 0.02, // 0,96 a 1,12 do tempo médio
    delaySec: (((m * 53) % 7) - 2) * 20 // -40 s a +80 s na saída
  };
}

export const tripIdFor = (lineId, directionId, depSec) => `${lineId}-${directionId}-${secToHHMM(depSec).replace(':', '')}`;

function parseTripId(id) {
  const [lineId, directionId, hhmm] = String(id).split('-');
  if (!lineId || !directionId || !/^\d{4}$/.test(hhmm || '')) return null;
  return { lineId, directionId, depSec: hhmmToSec(`${hhmm.slice(0, 2)}:${hhmm.slice(2)}`) };
}

// ---------- Estado de uma viagem num instante ----------
function tripState(line, dir, depSec, now) {
  const { factor, delaySec } = tripVariation(depSec);
  const startSec = depSec + delaySec;
  const elapsed = (now - startSec) / factor; // tempo "de perfil" decorrido
  const { stops, profile, points } = dir;
  const last = stops.length - 1;
  const endElapsed = profile[last].arrive;

  let status;
  let alongM;
  let dwellIndex = -1;
  if (elapsed < 0) {
    status = 'at_origin';
    alongM = 0;
  } else if (elapsed >= endElapsed) {
    status = 'arrived';
    alongM = stops[last].alongM;
  } else {
    status = 'in_transit';
    let i = 0;
    while (i < last && profile[i + 1].arrive <= elapsed) i += 1;
    if (elapsed < profile[i].depart) {
      dwellIndex = i;
      alongM = stops[i].alongM;
      status = 'at_stop';
    } else {
      const drive = stops[i].driveSec + (elapsed - profile[i].depart);
      alongM = Math.min(distanceAtDriveTime(points, drive), stops[i + 1].alongM);
    }
  }

  const position = pointAtDistance(points, alongM);
  const nextIndex = status === 'arrived' ? -1 : stops.findIndex((s, i) => i > dwellIndex && s.alongM > alongM + 3);
  const etaFor = (i) => Math.max(0, profile[i].arrive * factor + startSec - now);

  const upcomingStops = nextIndex < 0 ? [] : stops.slice(nextIndex).map((s, k) => {
    const i = nextIndex + k;
    return { id: s.id, name: s.name, sequence: s.sequence, etaSec: etaFor(i), arrivalTime: secToHHMM(now + etaFor(i)), distanceM: s.alongM - alongM };
  });

  const prev = dwellIndex >= 0 ? stops[dwellIndex] : stops[Math.max(0, (nextIndex < 0 ? last : nextIndex) - 1)];
  const next = nextIndex >= 0 ? stops[nextIndex] : null;

  return {
    id: tripIdFor(line.id, dir.id, depSec),
    tripId: tripIdFor(line.id, dir.id, depSec),
    lineId: line.id,
    directionId: dir.id,
    headsign: dir.to,
    origin: dir.from,
    label: `Viagem das ${secToHHMM(depSec)}`,
    scheduledDeparture: secToHHMM(depSec),
    status,
    position: { lat: position.lat, lng: position.lng, bearing: position.bearing },
    alongM,
    totalDistanceM: stops[last].alongM,
    progress: alongM / stops[last].alongM,
    location: {
      atStop: dwellIndex >= 0 ? { id: stops[dwellIndex].id, name: stops[dwellIndex].name } : status === 'at_origin' ? { id: stops[0].id, name: stops[0].name } : null,
      between: dwellIndex < 0 && next && status === 'in_transit' ? { from: prev.name, to: next.name } : null
    },
    nextStop: upcomingStops[0] || null,
    upcomingStops,
    estimatedArrivalAtDestination: status === 'arrived' ? secToHHMM(startSec + endElapsed * factor) : secToHHMM(now + etaFor(last)),
    delaySec,
    inService: now >= depSec - PRE_DEPARTURE_SEC && elapsed <= endElapsed + POST_ARRIVAL_SEC / factor,
    source: 'simulated',
    sampledAt: now
  };
}

// ---------- Provedor (mesma interface do provedor HTTP) ----------
export function createMockTransportProvider({ demo, speed }) {
  // A simulação acompanha a hora atual do aparelho: os ônibus aparecem onde estariam agora, segundo o quadro de horários.
  // Comeca parada: quem decide iniciar e a pessoa, pelo controle de simulacao.
  const clock = new SimulationClock({ startSec: nowSec(), speed, resetTo: () => nowSec() });

  const lineDto = ({ line, directions }) => ({
    id: line.id,
    code: line.id,
    name: line.summary.name,
    variant: line.summary.variant || null,
    origin: line.summary.origin,
    destination: line.summary.destination,
    operatingHours: line.operatingHours,
    published: line.published,
    schedule: line.schedule,
    sourceNotes: line.sourceNotes,
    directions: directions.map((d) => ({ id: d.id, from: d.from, to: d.to })),
    hasShape: directions.length > 0,
    hasLiveData: directions.some((d) => d.simulate),
    liveDataSource: directions.some((d) => d.simulate) ? 'simulated' : null,
    returnLineId: line.returnLineId || null
  });

  const getDirection = (lineId, directionId) => {
    const entry = NETWORK.get(lineId);
    return entry ? entry.directions.find((d) => d.id === directionId) || null : null;
  };

  const vehiclesAt = (lineId, now) => {
    const entry = NETWORK.get(lineId);
    if (!entry) return [];
    return entry.directions.flatMap((dir) =>
      (dir.schedule?.departures || [])
        .map(hhmmToSec)
        .map((dep) => tripState(entry.line, dir, dep, now))
        .filter((v) => v.inService)
    );
  };

  return {
    kind: 'mock',
    capabilities: { simulation: true },
    clock,
    /** Viagem em destaque: o ônibus da linha de demonstração que saiu por último; sem nenhum em circulação, a próxima saída. */
    get demo() {
      const now = clock.now;
      const dir = getDirection(demo.lineId, demo.directionId);
      const running = vehiclesAt(demo.lineId, now)
        .filter((v) => v.directionId === demo.directionId && v.status !== 'arrived')
        .sort((a, b) => a.progress - b.progress)[0];
      const deps = (dir?.schedule?.departures || []).map(hhmmToSec);
      const nextDep = deps.find((d) => d >= now) ?? deps[0];
      const vehicleId = running ? running.id : tripIdFor(demo.lineId, demo.directionId, nextDep);
      return { lineId: demo.lineId, directionId: demo.directionId, vehicleId, startSec: now };
    },

    now: () => clock.now,

    /** GET /lines */
    async getLines() { return [...NETWORK.values()].map(lineDto); },

    /** GET /lines/:id */
    async getLine(id) { const e = NETWORK.get(id); return e ? lineDto(e) : null; },

    /** GET /lines/:id/shape?directionId= */
    async getShape(lineId, directionId) {
      const dir = getDirection(lineId, directionId);
      return dir ? { lineId, directionId, points: dir.points, source: TZ01_ROUTE.source } : null;
    },

    /** GET /stops?lineId=&directionId= */
    async getStops(lineId, directionId) {
      const dir = getDirection(lineId, directionId);
      return dir ? dir.stops.map(({ id, name, lat, lng, sequence, kind, locationSource, alongM }) => ({ id, name, lat, lng, sequence, kind, locationSource, alongM })) : [];
    },

    /** GET /vehicles?lineId= */
    async getVehicles({ lineId } = {}) {
      const now = clock.now;
      const ids = lineId ? [lineId] : [...NETWORK.keys()];
      return ids.flatMap((id) => vehiclesAt(id, now));
    },

    /** GET /vehicle/:id */
    async getVehicle(id) {
      const parsed = parseTripId(id);
      if (!parsed) return null;
      const entry = NETWORK.get(parsed.lineId);
      const dir = getDirection(parsed.lineId, parsed.directionId);
      if (!entry || !dir) return null;
      return tripState(entry.line, dir, parsed.depSec, clock.now);
    },

    /** GET /arrivals?lineId=&directionId=&stopId= */
    async getArrivals({ lineId, directionId, stopId, limit = 3, horizonSec = 4 * 3600 }) {
      const dir = getDirection(lineId, directionId);
      if (!dir) return [];
      const idx = dir.stops.findIndex((s) => s.id === stopId);
      if (idx < 0) return [];
      const now = clock.now;
      const entry = NETWORK.get(lineId);
      return (dir.schedule?.departures || [])
        .map(hhmmToSec)
        .map((dep) => {
          const started = now >= dep - PRE_DEPARTURE_SEC;
          if (started) {
            const v = tripState(entry.line, dir, dep, now);
            const up = v.upcomingStops.find((s) => s.id === stopId);
            if (!v.inService || !up) return null;
            return { tripId: v.id, vehicleId: v.id, lineId, directionId, stopId, etaSec: up.etaSec, arrivalTime: up.arrivalTime, scheduledDeparture: v.scheduledDeparture, type: 'realtime', source: 'simulated' };
          }
          const eta = dep - now + dir.profile[idx].arrive;
          return { tripId: tripIdFor(lineId, directionId, dep), vehicleId: null, lineId, directionId, stopId, etaSec: eta, arrivalTime: secToHHMM(now + eta), scheduledDeparture: secToHHMM(dep), type: 'scheduled', source: 'schedule' };
        })
        .filter((a) => a && a.etaSec <= horizonSec)
        .sort((a, b) => a.etaSec - b.etaSec)
        .slice(0, limit);
    }
  };
}
