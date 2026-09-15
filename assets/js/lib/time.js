// Tempo em segundos desde a meia-noite (horário local de Magé).
export const hhmmToSec = (hhmm) => {
  const [h, m, s = 0] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

const pad = (n) => String(n).padStart(2, '0');

export function secToHHMM(sec) {
  const s = ((Math.round(sec) % 86400) + 86400) % 86400;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
}

export function secToHHMMSS(sec) {
  const s = ((Math.floor(sec) % 86400) + 86400) % 86400;
  return `${secToHHMM(s)}:${pad(s % 60)}`;
}

export function nowSec(date = new Date()) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

/** "agora", "1 min", "25 min", "1 h 10 min" */
export function formatEta(sec) {
  if (sec < 45) return 'agora';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatAgo(seconds) {
  if (seconds < 2) return 'Atualizado agora';
  if (seconds < 60) return `Atualizado há ${seconds} segundos`;
  const m = Math.floor(seconds / 60);
  return `Atualizado há ${m} min`;
}

/** Status de operação a partir da faixa oficial de funcionamento. */
export function operationStatus(hours, at = nowSec()) {
  const start = hhmmToSec(hours.start);
  const end = hhmmToSec(hours.end);
  const open = at >= start && at <= end;
  return {
    open,
    label: open ? 'Em operação' : 'Fora do horário',
    detail: open ? `Até ${hours.end.replace(':00', 'h')}` : `Retorna às ${hours.start.replace(':00', 'h')}`
  };
}

/** Próximas partidas (em segundos) de uma lista oficial HH:MM. */
export function upcomingDepartures(departures, at = nowSec(), limit = 3) {
  return departures.map(hhmmToSec).filter((d) => d >= at).slice(0, limit);
}
