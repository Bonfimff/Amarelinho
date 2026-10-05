import { Emitter } from '../../../lib/emitter.js';
import { nowSec, secToHHMM } from '../../../lib/time.js';
import { PLACES, placeById, latLngAt, placeAt } from './corridor.js';
import { SEED_DRIVERS, DOC_TYPES, DEFAULT_RULES, PASSENGER_NAMES } from './seed.js';

const AVG_SPEED = 8.3;
const STEP_MS = 250;
const MAX_ACTIVE_SPAWNED = 4;
const ACTIVE = ['ofertada', 'a_caminho', 'no_local', 'em_corrida'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const pad4 = (n) => String(n).padStart(4, '0');

const seedStats = (isUser) => {
  if (isUser) return { offered: 0, accepted: 0, declined: 0, expired: 0 };
  const offered = Math.floor(rand(30, 70));
  const accepted = Math.round(offered * rand(0.72, 0.93));
  const declined = Math.floor((offered - accepted) * 0.6);
  return { offered, accepted, declined, expired: offered - accepted - declined };
};

export const RIDE_STATES = {
  ofertada: 'Procurando mototaxista',
  a_caminho: 'Mototaxista a caminho',
  no_local: 'Mototaxista no local',
  em_corrida: 'Em corrida',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  sem_aceite: 'Sem aceite'
};

export class MotoWorld extends Emitter {
  rules = clone(DEFAULT_RULES);
  spawnEnabled = true;
  playing = false;
  speed = 5;
  sim = 0;
  t = 0;
  drivers = new Map();
  rides = [];
  occurrences = [];
  audit = [];
  passenger = { registered: false, name: '', phone: '' };
  userDriverId = 'd1';
  #timer = null;
  #last = 0;
  #nextSpawnT = 0;
  #seq = { ride: 0, occ: 0, cred: 0, audit: 0 };

  constructor() {
    super();
    this.reset();
  }

  reset({ driverFromScratch = false } = {}) {
    const wasPlaying = this.playing;
    this.pause();
    this.rules = clone(DEFAULT_RULES);
    this.sim = nowSec();
    this.t = 0;
    this.#seq = { ride: 0, occ: 0, cred: 0, audit: 0 };
    this.drivers = new Map();
    this.rides = [];
    this.occurrences = [];
    this.audit = [];
    this.passenger = { registered: false, name: '', phone: '' };
    SEED_DRIVERS.forEach((s) => {
      const stand = placeById(s.stand);
      const d = {
        id: s.id, isUser: Boolean(s.isUser), name: s.name, phone: s.phone, moto: { ...s.moto },
        reg: s.reg, regNote: s.regNote || '', docs: { ...s.docs }, credential: null,
        standId: s.stand, online: s.online, along: Math.max(0, stand.along + (Number(s.id.slice(1)) % 3 - 1) * 180),
        speed: rand(7.4, 9.2), rideId: null, registeredSim: this.sim - 86400 * 20,
        stats: seedStats(Boolean(s.isUser)), cancelled: s.isUser ? 0 : Math.floor(rand(0, 3))
      };
      if (d.reg === 'aprovado' || d.reg === 'suspenso') d.credential = this.#newCredential();
      this.drivers.set(d.id, d);
    });
    if (driverFromScratch) {
      const me = this.drivers.get(this.userDriverId);
      Object.assign(me, { reg: 'nao_cadastrado', docs: Object.fromEntries(DOC_TYPES.map((x) => [x.id, 'pendente'])), credential: null, online: false, name: '', phone: '', moto: { model: '', color: '', plate: '' } });
    }
    this.#seedHistory();
    this.#nextSpawnT = 12;
    this.emit('change', { topic: 'reset' });
    this.emit('tick');
    if (wasPlaying) this.start();
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.#last = performance.now();
    this.#timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - this.#last) / 1000);
      this.#last = now;
      this.step(dt);
    }, STEP_MS);
    this.emit('change', { topic: 'clock' });
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.#timer);
    this.emit('change', { topic: 'clock' });
  }

  setSpeed(n) {
    this.speed = n;
    this.emit('change', { topic: 'clock' });
  }

  setSpawn(on) {
    this.spawnEnabled = Boolean(on);
    this.emit('change', { topic: 'clock' });
  }

  step(dt) {
    const dtSim = dt * this.speed;
    this.t += dt;
    this.sim += dtSim;
    this.#maybeSpawn();
    this.#moveDrivers(dtSim);
    for (const ride of this.rides) if (ACTIVE.includes(ride.state)) this.#advanceRide(ride);
    this.emit('tick');
  }

  driver = (id) => this.drivers.get(id);
  get userDriver() { return this.drivers.get(this.userDriverId); }
  ride = (id) => this.rides.find((r) => r.id === id);
  clock = () => secToHHMM(this.sim);

  statusOf(d) {
    if (d.reg !== 'aprovado') return d.reg;
    const ride = d.rideId && this.ride(d.rideId);
    if (ride) return ride.state;
    return d.online ? 'disponivel' : 'offline';
  }

  eligibleDrivers(along, radiusM) {
    return [...this.drivers.values()]
      .filter((d) => d.reg === 'aprovado' && d.online && !d.rideId && Math.abs(d.along - along) <= radiusM)
      .sort((a, b) => Math.abs(a.along - along) - Math.abs(b.along - along));
  }

  rating(driverId) {
    const rated = this.rides.filter((r) => r.driverId === driverId && r.state === 'concluida' && r.rating);
    if (!rated.length) return null;
    return rated.reduce((s, r) => s + r.rating, 0) / rated.length;
  }

  ridesOfPassenger = () => this.rides.filter((r) => r.passenger.isUser).sort((a, b) => b.createdSim - a.createdSim);
  activeRideOfPassenger = () => this.rides.find((r) => r.passenger.isUser && ACTIVE.includes(r.state));
  ridesOfDriver = (id) => this.rides.filter((r) => r.driverId === id).sort((a, b) => b.createdSim - a.createdSim);
  activeRideOfDriver = (id) => { const d = this.drivers.get(id); return d?.rideId ? this.ride(d.rideId) : null; };

  offersFor(driverId) {
    const d = this.drivers.get(driverId);
    if (!d || d.reg !== 'aprovado' || !d.online || d.rideId) return [];
    return this.rides.filter((r) => r.state === 'ofertada' && r.currentOffer === driverId && r.offers[driverId]?.state === 'pendente');
  }

  fareFor(distanceM) {
    const { minimo, kmIncluidos, porKmAdicional } = this.rules.tarifa;
    const extra = Math.max(0, distanceM / 1000 - kmIncluidos);
    return Math.round((minimo + extra * porKmAdicional) * 2) / 2;
  }

  quote(origin, dest) {
    const distanceM = Math.abs(dest.along - origin.along);
    return { distanceM, fare: this.fareFor(distanceM), durationSec: distanceM / AVG_SPEED, valid: distanceM >= 200 };
  }

  passengerRegister({ name, phone }) {
    this.passenger = { registered: true, name: name.trim(), phone: phone.trim() };
    this.emit('change', { topic: 'passenger' });
  }

  requestRide({ origin, dest, preferredDriverId = null }) {
    if (this.activeRideOfPassenger()) return null;
    const q = this.quote(origin, dest);
    if (!q.valid) return null;
    const ride = this.#createRide({
      passenger: { name: this.passenger.name || 'Passageiro', phone: this.passenger.phone, isUser: true },
      origin, dest, preferredDriverId
    });
    return ride;
  }

  cancelRide(id, by, reason = '') {
    const ride = this.ride(id);
    if (!ride || !['ofertada', 'a_caminho', 'no_local'].includes(ride.state)) return false;
    const driver = ride.driverId && this.drivers.get(ride.driverId);
    if (by === 'mototaxista' && ride.state !== 'ofertada') {

      this.#releaseDriver(driver);
      driver.cancelled += 1;
      ride.excluded = [...(ride.excluded || []), driver.id];
      ride.driverId = null;
      ride.round = 1;
      ride.radiusM = this.rules.despacho.raioInicialM;
      ride.state = 'ofertada';
      this.#event(ride, 'desistencia', `${driver.name} desistiu da corrida${reason ? ` (${reason})` : ''}. O pedido volta para a fila.`);
      this.#dispatch(ride);
      this.emit('change', { topic: 'ride', id });
      return true;
    }
    const late = ride.acceptedT != null && this.t - ride.acceptedT > this.rules.despacho.cancelGratisSeg;
    if (ride.currentOffer) { ride.offers[ride.currentOffer].state = 'cancelada'; ride.currentOffer = null; }
    ride.state = 'cancelada';
    ride.cancelBy = by;
    ride.cancelReason = reason;
    ride.late = Boolean(late);
    if (driver) this.#releaseDriver(driver);
    this.#event(ride, 'cancelada', `Cancelada pelo ${by}${reason ? `: ${reason}` : ''}${late ? ' (depois do prazo de cancelamento sem custo)' : ''}.`);
    this.emit('change', { topic: 'ride', id });
    return true;
  }

  rateRide(id, stars, comment = '') {
    const ride = this.ride(id);
    if (!ride || ride.state !== 'concluida' || ride.rating) return false;
    ride.rating = stars;
    ride.comment = comment.trim();
    this.#event(ride, 'avaliacao', `Avaliação do passageiro: ${stars} de 5.`);
    this.emit('change', { topic: 'ride', id });
    return true;
  }

  rateRidePassenger(id, stars) {
    const ride = this.ride(id);
    if (!ride || ride.state !== 'concluida' || ride.passengerRating) return false;
    ride.passengerRating = stars;
    this.#event(ride, 'avaliacao', `Avaliação do mototaxista: ${stars} de 5.`);
    this.emit('change', { topic: 'ride', id });
    return true;
  }

  passengerScore(ride) {
    if (!ride.passenger.isUser) return ride.passenger.rating ?? null;
    const rated = this.rides.filter((r) => r.passenger.isUser && r.passengerRating);
    return rated.length ? rated.reduce((s, r) => s + r.passengerRating, 0) / rated.length : null;
  }

  acceptRate(driverId) {
    const s = this.drivers.get(driverId)?.stats;
    return s && s.offered ? s.accepted / s.offered : null;
  }

  setOnline(driverId, online) {
    const d = this.drivers.get(driverId);
    if (!d || d.reg !== 'aprovado' || d.rideId) return false;
    d.online = Boolean(online);
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  acceptRide(rideId, driverId) {
    const ride = this.ride(rideId);
    const d = this.drivers.get(driverId);
    if (!ride || !d || ride.state !== 'ofertada' || ride.currentOffer !== driverId || ride.offers[driverId]?.state !== 'pendente' || d.rideId || !d.online) return null;
    ride.offers[driverId].state = 'aceita';
    ride.currentOffer = null;
    d.stats.accepted += 1;
    ride.driverId = driverId;
    ride.acceptedT = this.t;
    ride.acceptSec = this.t - ride.createdT;
    ride.acceptedSim = this.sim;
    ride.state = 'a_caminho';
    d.rideId = ride.id;
    this.#event(ride, 'aceita', `${d.name} aceitou o pedido.`);
    this.#event(ride, 'a_caminho', `${d.name} está a caminho do passageiro.`);
    this.emit('change', { topic: 'ride', id: ride.id });
    return ride;
  }

  declineOffer(rideId, driverId) {
    const ride = this.ride(rideId);
    const o = ride?.offers[driverId];
    if (!o || o.state !== 'pendente' || ride.currentOffer !== driverId) return false;
    o.state = 'recusada';
    this.drivers.get(driverId).stats.declined += 1;
    this.#event(ride, 'oferta', 'O mototaxista recusou. Buscando o próximo.');
    this.#queueNext(ride);
    return true;
  }

  startRide(rideId, pin = null, { auto = false } = {}) {
    const ride = this.ride(rideId);
    if (!ride || ride.state !== 'no_local') return false;
    if (!auto && String(pin) !== ride.pin) return 'pin';
    ride.state = 'em_corrida';
    ride.startedSim = this.sim;
    this.#event(ride, 'em_corrida', 'Corrida iniciada.');
    this.emit('change', { topic: 'ride', id: rideId });
    return true;
  }

  finishRide(rideId) {
    const ride = this.ride(rideId);
    if (!ride || ride.state !== 'em_corrida' || !ride.atDest) return false;
    const d = this.drivers.get(ride.driverId);
    ride.state = 'concluida';
    ride.finishedSim = this.sim;
    this.#releaseDriver(d);
    this.#event(ride, 'concluida', `Corrida concluída. Valor pela tabela: ${money(ride.fare)}.`);
    this.emit('change', { topic: 'ride', id: rideId });
    return true;
  }

  driverSaveProfile(id, { name, phone, moto }) {
    const d = this.drivers.get(id);
    Object.assign(d, { name: name.trim(), phone: phone.trim(), moto: { ...moto } });
    this.emit('change', { topic: 'drivers' });
  }

  driverSendDoc(id, docId) {
    const d = this.drivers.get(id);
    if (!d || !['nao_cadastrado', 'pendencia'].includes(d.reg)) return false;
    d.docs[docId] = 'enviado';
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  driverSubmit(id) {
    const d = this.drivers.get(id);
    if (!d || !['nao_cadastrado', 'pendencia'].includes(d.reg)) return false;
    if (DOC_TYPES.some((x) => d.docs[x.id] !== 'enviado' && d.docs[x.id] !== 'aprovado')) return false;
    d.reg = 'em_analise';
    d.regNote = '';
    this.#audit('Mototaxista', 'Cadastro enviado para análise', `${d.name || d.id}`);
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  adminApprove(id) {
    const d = this.drivers.get(id);
    if (!d || !['em_analise', 'pendencia'].includes(d.reg)) return false;
    DOC_TYPES.forEach((x) => { d.docs[x.id] = 'aprovado'; });
    d.reg = 'aprovado';
    d.regNote = '';
    d.credential ||= this.#newCredential();
    this.#audit('Secretaria', 'Cadastro aprovado', `${d.name} (${d.credential})`);
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  adminRequestFix(id, docId, note) {
    const d = this.drivers.get(id);
    if (!d || d.reg !== 'em_analise') return false;
    d.reg = 'pendencia';
    if (docId) d.docs[docId] = 'recusado';
    d.regNote = note.trim() || 'Há documentos a corrigir.';
    this.#audit('Secretaria', 'Pendência no cadastro', `${d.name}: ${d.regNote}`);
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  adminSuspend(id, reason) {
    const d = this.drivers.get(id);
    if (!d || d.reg !== 'aprovado' || d.rideId) return false;
    d.reg = 'suspenso';
    d.online = false;
    d.regNote = reason.trim() || 'Suspenso pela Secretaria.';
    this.#audit('Secretaria', 'Profissional suspenso', `${d.name}: ${d.regNote}`);
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  adminReactivate(id) {
    const d = this.drivers.get(id);
    if (!d || d.reg !== 'suspenso') return false;
    d.reg = 'aprovado';
    d.regNote = '';
    if (d.docs.licenciamento === 'vencido') d.docs.licenciamento = 'aprovado';
    this.#audit('Secretaria', 'Profissional reativado', d.name);
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  adminCancelRegistration(id, reason) {
    const d = this.drivers.get(id);
    if (!d || d.rideId || ['cancelado', 'nao_cadastrado'].includes(d.reg)) return false;
    d.reg = 'cancelado';
    d.online = false;
    d.regNote = reason.trim() || 'Credenciamento cancelado.';
    this.#audit('Secretaria', 'Credenciamento cancelado', `${d.name}: ${d.regNote}`);
    this.emit('change', { topic: 'drivers' });
    return true;
  }

  updateRules(patch) {
    const changes = [];
    for (const group of ['tarifa', 'despacho']) {
      for (const [key, value] of Object.entries(patch[group] || {})) {
        if (Number.isFinite(value) && value >= 0 && this.rules[group][key] !== value) {
          changes.push(`${key}: ${this.rules[group][key]} para ${value}`);
          this.rules[group][key] = value;
        }
      }
    }
    if (changes.length) this.#audit('Secretaria', 'Regras alteradas', changes.join('; '));
    this.emit('change', { topic: 'rules' });
    return changes.length;
  }

  openOccurrence({ by, rideId = null, type, text }) {
    const ride = rideId && this.ride(rideId);
    const occ = {
      id: `OC-${new Date().getFullYear()}-${pad4(++this.#seq.occ)}`,
      by, rideId: rideId || null, driverId: ride?.driverId || null, type, text: text.trim(),
      status: 'aberta', reply: '', createdSim: this.sim, mine: true
    };
    this.occurrences.unshift(occ);
    this.#audit(by === 'passageiro' ? 'Passageiro' : 'Mototaxista', 'Ocorrência registrada', `${occ.id}: ${type}`);
    this.emit('change', { topic: 'occurrences' });
    return occ;
  }

  updateOccurrence(id, { status, reply }) {
    const occ = this.occurrences.find((o) => o.id === id);
    if (!occ) return false;
    const before = occ.status;
    occ.status = status;
    occ.reply = reply.trim();
    this.#audit('Secretaria', 'Ocorrência atualizada', `${id}: ${before} para ${status}`);
    this.emit('change', { topic: 'occurrences' });
    return true;
  }

  stats() {
    const rides = this.rides;
    const done = rides.filter((r) => r.state === 'concluida');
    const avg = (list, fn) => (list.length ? list.reduce((s, r) => s + fn(r), 0) / list.length : null);
    const approved = [...this.drivers.values()].filter((d) => d.reg === 'aprovado');
    const ratings = done.filter((r) => r.rating);
    return {
      approved: approved.length,
      online: approved.filter((d) => d.online || d.rideId).length,
      inRide: rides.filter((r) => r.state === 'em_corrida').length,
      active: rides.filter((r) => ACTIVE.includes(r.state)).length,
      total: rides.length,
      done: done.length,
      cancelled: rides.filter((r) => r.state === 'cancelada').length,
      noAccept: rides.filter((r) => r.state === 'sem_aceite').length,
      avgAcceptSec: avg(rides.filter((r) => r.acceptSec != null), (r) => r.acceptSec),
      avgPickupMin: avg(rides.filter((r) => r.pickupSec != null), (r) => r.pickupSec / 60),
      avgRating: avg(ratings, (r) => r.rating),
      km: done.reduce((s, r) => s + r.distanceM, 0) / 1000,
      pendingRegs: [...this.drivers.values()].filter((d) => d.reg === 'em_analise').length,
      openOccurrences: this.occurrences.filter((o) => o.status !== 'resolvida').length,
      expiredDocs: approved.filter((d) => Object.values(d.docs).includes('vencido')).length,
      acceptRate: (() => {
        const all = [...this.drivers.values()].reduce((a, d) => ({ o: a.o + d.stats.offered, c: a.c + d.stats.accepted }), { o: 0, c: 0 });
        return all.o ? all.c / all.o : null;
      })()
    };
  }

  ridesCsv() {
    const head = ['codigo', 'hora', 'origem', 'destino', 'km', 'valor_tabela', 'situacao', 'mototaxista', 'nota'];
    const rows = this.rides.slice().sort((a, b) => a.createdSim - b.createdSim).map((r) => [
      r.id, secToHHMM(r.createdSim), r.origin.name, r.dest.name, (r.distanceM / 1000).toFixed(1).replace('.', ','),
      r.fare.toFixed(2).replace('.', ','), RIDE_STATES[r.state], r.driverId ? this.drivers.get(r.driverId).name : '', r.rating || ''
    ]);
    return [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  #newCredential() {
    return `MT-${pad4(++this.#seq.cred)}`;
  }

  #audit(actor, action, detail) {
    this.audit.unshift({ id: ++this.#seq.audit, sim: this.sim, actor, action, detail });
    this.emit('change', { topic: 'audit' });
  }

  #event(ride, type, text) {
    ride.events.push({ sim: this.sim, type, text });
  }

  #releaseDriver(d) {
    if (!d) return;
    d.rideId = null;
  }

  #createRide({ passenger, origin, dest, preferredDriverId = null }) {
    const q = this.quote(origin, dest);
    const ride = {
      id: `C-${pad4(++this.#seq.ride)}`,
      passenger, origin, dest, distanceM: q.distanceM, fare: q.fare,
      state: 'ofertada', driverId: null, preferredDriverId, pin: String(1000 + Math.floor(Math.random() * 9000)),
      round: 1, radiusM: this.rules.despacho.raioInicialM, offers: {}, queue: [], queueIdx: 0, currentOffer: null, nextT: 0, excluded: [],
      createdSim: this.sim, createdT: this.t, acceptedT: null, acceptSec: null, pickupSec: null,
      atDest: false, rating: null, comment: '', events: []
    };
    this.rides.push(ride);
    this.#event(ride, 'criada', `Pedido de ${passenger.name}: ${origin.name} para ${dest.name}.`);
    this.#dispatch(ride);
    this.emit('change', { topic: 'ride', id: ride.id });
    return ride;
  }

  #dispatch(ride) {
    const asked = new Set(Object.keys(ride.offers));
    const pool = this.eligibleDrivers(ride.origin.along, ride.radiusM).filter((d) => !ride.excluded.includes(d.id) && !asked.has(d.id));
    const eta = (d) => Math.abs(d.along - ride.origin.along) / d.speed;
    pool.sort((a, b) => eta(a) - eta(b) || (this.rating(b.id) || 0) - (this.rating(a.id) || 0));

    const first = ride.round === 1 && ride.preferredDriverId ? pool.findIndex((d) => d.id === ride.preferredDriverId) : -1;
    if (first > 0) pool.unshift(...pool.splice(first, 1));
    ride.queue = pool.slice(0, this.rules.despacho.maxPorRodada).map((d) => d.id);
    ride.queueIdx = 0;
    const km = (ride.radiusM / 1000).toFixed(1).replace('.', ',');
    this.#event(ride, 'oferta', ride.queue.length
      ? `${ride.queue.length} ${ride.queue.length === 1 ? 'mototaxista disponível' : 'mototaxistas disponíveis'} num raio de ${km} km. As ofertas saem uma a uma, do mais próximo ao mais distante.`
      : `Nenhum mototaxista disponível num raio de ${km} km.`);
    if (ride.queue.length) this.#offerNext(ride);
    else { ride.currentOffer = null; ride.nextT = this.t + 3; }
  }

  #offerNext(ride) {
    while (ride.queueIdx < ride.queue.length) {
      const id = ride.queue[ride.queueIdx++];
      const d = this.drivers.get(id);

      if (!d || d.reg !== 'aprovado' || !d.online || d.rideId) continue;
      const windowSec = this.rules.despacho.tempoAceiteSeg;
      const distM = Math.abs(d.along - ride.origin.along);
      ride.currentOffer = id;
      ride.offers[id] = {
        state: 'pendente', sentT: this.t, expiresT: this.t + windowSec,
        decideT: d.isUser ? null : this.t + rand(2.5, Math.max(3, windowSec - 2)),
        willAccept: Math.random() < 0.7, distM, etaSec: distM / d.speed
      };
      d.stats.offered += 1;
      this.#event(ride, 'oferta', `Oferta ${ride.queueIdx} de ${ride.queue.length} enviada. Aguardando resposta.`);
      this.emit('change', { topic: 'ride', id: ride.id });
      return;
    }
    this.#nextRound(ride);
  }

  #queueNext(ride) {
    ride.currentOffer = null;
    ride.nextT = this.t + 1.2;
    this.emit('change', { topic: 'ride', id: ride.id });
  }

  #advanceRide(ride) {
    const d = ride.driverId && this.drivers.get(ride.driverId);
    if (ride.state === 'ofertada') {
      const id = ride.currentOffer;
      if (!id) { if (this.t >= ride.nextT) this.#offerNext(ride); return; }
      const o = ride.offers[id];
      const driver = this.drivers.get(id);

      if (!driver.online || driver.rideId || driver.reg !== 'aprovado') { o.state = 'cancelada'; this.#queueNext(ride); return; }
      if (!driver.isUser && this.t >= o.decideT) {
        if (o.willAccept) { this.acceptRide(ride.id, id); return; }
        o.state = 'recusada';
        driver.stats.declined += 1;
        this.#event(ride, 'oferta', 'O mototaxista recusou. Buscando o próximo.');
        this.#queueNext(ride);
        return;
      }
      if (this.t >= o.expiresT) {
        o.state = 'expirada';
        driver.stats.expired += 1;
        this.#event(ride, 'oferta', 'Sem resposta no tempo. Buscando o próximo.');
        this.#queueNext(ride);
      }
    } else if (ride.state === 'a_caminho') {
      if (Math.abs(d.along - ride.origin.along) < 12) {
        ride.state = 'no_local';
        ride.pickupSec = this.sim - ride.acceptedSim;
        ride.autoStartT = this.t + rand(8, 16);
        this.#event(ride, 'no_local', `${d.name} chegou ao local de embarque.`);
        this.emit('change', { topic: 'ride', id: ride.id });
      }
    } else if (ride.state === 'no_local') {
      if (!d.isUser && this.t >= ride.autoStartT) this.startRide(ride.id, null, { auto: true });
    } else if (ride.state === 'em_corrida') {
      if (!ride.atDest && Math.abs(d.along - ride.dest.along) < 12) {
        ride.atDest = true;
        ride.autoFinishT = this.t + rand(2, 4);
        this.#event(ride, 'destino', 'A moto chegou ao destino.');
        this.emit('change', { topic: 'ride', id: ride.id });
      }
      if (ride.atDest && !d.isUser && this.t >= ride.autoFinishT) this.finishRide(ride.id);
    }
  }

  #nextRound(ride) {
    ride.currentOffer = null;
    if (ride.round === 1) {
      ride.round = 2;
      ride.radiusM *= this.rules.despacho.fatorAmpliacao;
      this.#event(ride, 'oferta', 'Ninguém aceitou. Ampliando a busca.');
      this.#dispatch(ride);
    } else {
      ride.state = 'sem_aceite';
      this.#event(ride, 'sem_aceite', 'Nenhum mototaxista aceitou o pedido.');
    }
    this.emit('change', { topic: 'ride', id: ride.id });
  }

  #moveDrivers(dtSim) {
    for (const d of this.drivers.values()) {
      const ride = d.rideId && this.ride(d.rideId);
      let target = null;
      if (ride?.state === 'a_caminho') target = ride.origin.along;
      else if (ride?.state === 'em_corrida' && !ride.atDest) target = ride.dest.along;
      let step = d.speed * dtSim;
      if (target == null && !ride && d.online && d.reg === 'aprovado') {

        target = placeById(d.standId).along;
        step = Math.min(step, 2.5 * dtSim);
      }
      if (target == null) continue;
      const delta = target - d.along;
      d.along += Math.sign(delta) * Math.min(Math.abs(delta), step);
    }
  }

  #maybeSpawn() {
    if (!this.spawnEnabled || this.t < this.#nextSpawnT) return;
    this.#nextSpawnT = this.t + rand(25, 60);
    const open = this.rides.filter((r) => !r.passenger.isUser && ACTIVE.includes(r.state)).length;
    if (open >= MAX_ACTIVE_SPAWNED) return;
    let a;
    let b;
    do {
      a = pick(PLACES);
      b = pick(PLACES);
    } while (Math.abs(a.along - b.along) < 1500 || Math.abs(a.along - b.along) > 9000);
    this.#createRide({ passenger: { name: pick(PASSENGER_NAMES), phone: `(21) 9****-${pad4(Math.floor(rand(0, 9999)))}`, isUser: false, rating: Math.round(rand(4.3, 5) * 10) / 10 }, origin: a, dest: b });
  }

  #seedHistory() {
    const names = [...this.drivers.values()].filter((d) => d.reg === 'aprovado' && !d.isUser);
    const states = ['concluida', 'concluida', 'concluida', 'concluida', 'concluida', 'concluida', 'concluida', 'concluida', 'cancelada', 'sem_aceite', 'concluida', 'concluida'];
    states.forEach((state, i) => {
      let a;
      let b;
      do { a = pick(PLACES); b = pick(PLACES); } while (Math.abs(a.along - b.along) < 1500 || Math.abs(a.along - b.along) > 9000);
      const createdSim = this.sim - (states.length - i) * rand(900, 1700);
      const d = pick(names);
      const q = this.quote(a, b);
      const r = {
        id: `C-${pad4(++this.#seq.ride)}`, passenger: { name: pick(PASSENGER_NAMES), phone: '', isUser: false },
        origin: a, dest: b, distanceM: q.distanceM, fare: q.fare, state, driverId: state === 'concluida' ? d.id : null,
        round: 1, radiusM: 3000, offers: {}, excluded: [], createdSim, createdT: 0, acceptedT: null,
        acceptSec: state === 'concluida' ? rand(5, 22) : null, pickupSec: state === 'concluida' ? rand(120, 420) : null,
        atDest: state === 'concluida', rating: state === 'concluida' ? pick([5, 5, 5, 4, 4, 3, 5, 4, 2]) : null, comment: '',
        events: [{ sim: createdSim, type: 'criada', text: `Pedido de ${PASSENGER_NAMES[i]}: ${a.name} para ${b.name}.` }]
      };
      if (state === 'cancelada') { r.cancelBy = 'passageiro'; r.cancelReason = 'mudou de ideia'; }
      if (state === 'sem_aceite') r.events.push({ sim: createdSim + 60, type: 'sem_aceite', text: 'Nenhum mototaxista aceitou o pedido.' });
      if (state === 'concluida') r.events.push({ sim: createdSim + 20, type: 'aceita', text: `${d.name} aceitou o pedido.` }, { sim: createdSim + 600 + q.durationSec, type: 'concluida', text: `Corrida concluída. Valor pela tabela: ${money(q.fare)}.` });
      this.rides.push(r);
    });
    this.occurrences.push({
      id: `OC-${new Date().getFullYear()}-${pad4(++this.#seq.occ)}`, by: 'passageiro', rideId: this.rides[1].id, driverId: this.rides[1].driverId,
      type: 'Cobrança acima da tabela', text: 'Ocorrência de exemplo: valor cobrado maior que o informado no aplicativo.', status: 'aberta', reply: '', createdSim: this.sim - 3600
    });
    this.audit.unshift({ id: ++this.#seq.audit, sim: this.sim - 7200, actor: 'Sistema', action: 'Demonstração iniciada', detail: 'Dados fictícios carregados.' });
  }
}

export const money = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;
export { latLngAt, placeAt };
