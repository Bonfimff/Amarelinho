// Auditoria de uso: registra telas visitadas, recursos vistos e ações, com data, hora e tipo de
// aparelho, e envia em lotes para a API. Não coleta nome, e-mail, telefone nem localização real;
// a identificação é um número aleatório do próprio navegador, sem ligação com a pessoa.
import { APP_CONFIG } from '../config.js';

const chave = { visitante: 'amarelinho:visitante', sessao: 'amarelinho:sessao' };

const sorteia = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Identificador anônimo persistente (aparelho) e o da sessão (aba). Falha em silêncio se o navegador bloquear. */
function identifica(armazem, nome) {
  try {
    const atual = armazem.getItem(nome);
    if (atual) return atual;
    const novo = sorteia();
    armazem.setItem(nome, novo);
    return novo;
  } catch {
    return 'anonimo';
  }
}

function aparelho() {
  const ua = navigator.userAgent || '';
  const toque = (navigator.maxTouchPoints || 0) > 0;
  const largura = window.screen?.width || window.innerWidth;
  let tipo = 'computador';
  if (navigator.userAgentData?.mobile || /Android|iPhone|iPod|Windows Phone/i.test(ua)) tipo = 'celular';
  else if (/iPad|Tablet/i.test(ua) || (toque && largura >= 768 && largura <= 1280)) tipo = 'tablet';
  return {
    tipo,
    tela: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    janela: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio || 1,
    toque,
    idioma: navigator.language || null,
    fusoHorario: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    plataforma: navigator.userAgentData?.platform || null,
    userAgent: ua,
    origem: document.referrer || null
  };
}

// Ações acompanhadas: seletor -> nome do evento. Concentrar aqui evita espalhar chamadas pelas telas.
const ACOES = [
  ['[data-nav]', 'abas_inferiores', (el) => ({ aba: el.dataset.nav })],
  ['[data-see-map]', 'ver_no_mapa'],
  ['[data-restart]', 'simulacao_reiniciar'],
  ['[data-minimize]', 'simulacao_minimizar'],
  ['[data-speed]', 'simulacao_velocidade', (el) => ({ velocidade: el.dataset.speed })],
  ['[data-jump]', 'simulacao_avancar_ate_partida'],
  ['[data-next-bus]', 'proximo_onibus'],
  ['[data-sheet-handle]', 'painel_alternar'],
  ['[data-center]', 'ver_ponto_no_mapa'],
  ['.vehicle-row', 'abrir_veiculo', (el) => ({ destino: el.getAttribute('href') })],
  ['.line-card', 'abrir_linha', (el) => ({ destino: el.getAttribute('href') })],
  ['.stop-timeline a, .timeline__item a', 'abrir_ponto', (el) => ({ destino: el.getAttribute('href') })],
  ['[data-filter]', 'filtrar_linhas', (el) => ({ filtro: el.dataset.filter })],
  ['[role="tab"]', 'aba_da_linha', (el) => ({ aba: el.textContent.trim() })],
  ['.chip', 'sugestao_de_busca', (el) => ({ termo: el.textContent.trim() })],
  ['#locate', 'minha_localizacao'],
  ['.dev-credit, .about-logo, a[target="_blank"]', 'link_externo', (el) => ({ destino: el.getAttribute('href') })]
];

export class Analytics {
  #fila = [];
  #endpoint;
  #ligado;
  #visitante;
  #sessao;
  #telaAtual = null;
  #entrouEm = 0;
  #timer = null;

  constructor({ endpoint, enabled, flushMs = 15000 } = {}) {
    this.#endpoint = endpoint;
    this.#ligado = Boolean(enabled && endpoint);
    this.#visitante = identifica(localStorage, chave.visitante);
    this.#sessao = identifica(sessionStorage, chave.sessao);
    if (!this.#ligado) return;

    this.registra('sessao', 'inicio', aparelho());
    this.#ouveAcoes();
    this.#timer = setInterval(() => this.envia(), flushMs);
    // Fechar a aba ou trocar de app: manda o que estiver na fila antes de perder.
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.#fechaTela(), this.envia(); });
    addEventListener('pagehide', () => { this.#fechaTela(); this.envia(); });
  }

  /** Uma tela aberta. Ao trocar, fecha a anterior com o tempo de permanência. */
  tela(nome, detalhe = {}) {
    if (!this.#ligado) return;
    this.#fechaTela();
    this.#telaAtual = nome;
    this.#entrouEm = performance.now();
    this.registra('tela', nome, detalhe);
  }

  /** Um recurso que apareceu para a pessoa (cartão, mapa, lista), sem ela ter clicado em nada. */
  recurso(nome, detalhe = {}) {
    this.registra('recurso', nome, detalhe);
  }

  acao(nome, detalhe = {}) {
    this.registra('acao', nome, detalhe);
  }

  registra(tipo, nome, detalhe = {}) {
    if (!this.#ligado) return;
    this.#fila.push({
      id: sorteia(),
      visitante: this.#visitante,
      sessao: this.#sessao,
      tipo,
      nome,
      detalhe,
      rota: location.hash || '#/',
      titulo: document.title,
      momento: new Date().toISOString(),
      fusoMin: -new Date().getTimezoneOffset()
    });
    if (this.#fila.length >= 25) this.envia();
  }

  #fechaTela() {
    if (!this.#telaAtual) return;
    const ms = Math.round(performance.now() - this.#entrouEm);
    this.registra('tela_saida', this.#telaAtual, { permanenciaMs: ms });
    this.#telaAtual = null;
  }

  #ouveAcoes() {
    document.addEventListener('click', (e) => {
      for (const [seletor, nome, extra] of ACOES) {
        const el = e.target.closest(seletor);
        if (el) { this.acao(nome, extra ? extra(el) : {}); return; }
      }
    }, { capture: true });

    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.matches?.('[data-follow]')) this.acao('seguir_onibus', { ligado: el.checked });
    }, { capture: true });

    document.addEventListener('submit', (e) => {
      if (e.target.matches?.('[data-search], .search')) {
        const termo = new FormData(e.target).get('q');
        this.acao('busca', { termo: String(termo || '').slice(0, 80) });
      }
    }, { capture: true });

    // Play e pausa saem do próprio botão, que troca de rótulo conforme o estado.
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-toggle]');
      if (el) this.acao('simulacao', { acao: el.dataset.state === 'true' ? 'pausar' : 'iniciar' });
    }, { capture: true });
  }

  /** Envia a fila. Usa sendBeacon quando a página está saindo, que sobrevive ao fechamento. */
  envia() {
    if (!this.#ligado || !this.#fila.length) return;
    const lote = { enviadoEm: new Date().toISOString(), eventos: this.#fila.splice(0, this.#fila.length) };
    const corpo = JSON.stringify(lote);
    try {
      if (navigator.sendBeacon && document.visibilityState === 'hidden') {
        navigator.sendBeacon(this.#endpoint, new Blob([corpo], { type: 'application/json' }));
        return;
      }
      fetch(this.#endpoint, {
        method: 'POST', body: corpo, keepalive: true, credentials: 'omit', mode: 'cors',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
    } catch {
      // Auditoria nunca pode atrapalhar o uso do app.
    }
  }
}

export const analytics = new Analytics({
  endpoint: `${APP_CONFIG.apiBaseUrl}/events`,
  ...APP_CONFIG.analytics
});
