// Dados OFICIAIS publicados pela Prefeitura de Magé (https://mage.rj.gov.br/amarelinho/).
// Regras deste arquivo:
//  - "summary" reproduz a lista "Linhas com Tarifa Zero disponíveis" (nome, origem x destino, funcionamento).
//  - "published" reproduz o detalhamento da mesma linha na página (saída, chegada, pontos).
//  - "schedule" reproduz o quadro de horários (PDF) vinculado à linha na página oficial.
//  - Quando a própria fonte apresenta informações divergentes, isso fica registrado em "sourceNotes".
// Nada aqui é simulado.
import { SOURCES } from './sources.js';

// Cartaz "Novos pontos de parada · Linha TZ01 - Piabetá x Magé" (Prefeitura de Magé).
const TZ01_STOPS = [
  'Rodoviária de Piabetá', 'Fórum de Piabetá', 'Hospital do Olho', 'Entrada de Piabetá (Bongaba)',
  'Entrada de Mauá', 'Santa Dalila', 'Entrada principal de Suruí', 'Segunda entrada de Suruí',
  'Barão de Iriri', 'Corpo de Bombeiros', '1ª entrada de Magé (Piedade)', '2ª entrada de Magé (Barbuda)',
  'Detran', 'Praça da Prefeitura', 'Rodoviária de Magé'
];

const DAILY_5_22 = { start: '05:00', end: '22:00', label: 'Diariamente, das 5h às 22h' };

export const LINES = [
  {
    id: 'TZ01',
    summary: { name: 'Rodoviária de Piabetá x Rodoviária de Magé', variant: 'Expresso', origin: 'Rodoviária de Piabetá', destination: 'Rodoviária de Magé' },
    operatingHours: DAILY_5_22,
    published: {
      title: 'Linha TZ01 - Piabetá x Magé',
      departure: 'Rodoviária de Piabetá',
      arrival: 'Rodoviária de Magé',
      stops: TZ01_STOPS,
      stopsLabel: 'Pontos de parada',
      stopsSource: SOURCES.stopsPoster
    },
    schedule: {
      title: 'Quadro de horários TZ01 · Piabetá x Magé',
      pdf: SOURCES.schedulePdf('TZ01', 'HR_TZ01-PIABETA-X-MAGE.pdf'),
      directions: [
        { id: 'ida', label: 'Saída da Rodoviária de Piabetá', departures: ['05:00','05:45','06:30','07:15','08:00','08:45','09:30','10:15','11:00','11:45','12:30','13:15','13:50','14:35','15:20','16:05','16:50','17:35','18:20','19:05','19:50','20:35','21:20','22:05'] }
      ]
    },
    returnLineId: 'TZ02',
    sourceNotes: []
  },
  {
    id: 'TZ02',
    summary: { name: 'Rodoviária de Magé x Rodoviária de Piabetá', variant: 'Expresso', origin: 'Rodoviária de Magé', destination: 'Rodoviária de Piabetá' },
    operatingHours: DAILY_5_22,
    published: {
      title: 'Itinerário de volta da TZ01 (Magé x Piabetá)',
      departure: 'Rodoviária de Magé',
      arrival: 'Rodoviária de Piabetá',
      stops: TZ01_STOPS.slice().reverse(),
      stopsLabel: 'Pontos de parada (mesmas paradas da TZ01, no sentido inverso)',
      stopsSource: SOURCES.stopsPoster
    },
    schedule: {
      title: 'Quadro de horários TZ01 · saídas de Magé',
      pdf: SOURCES.schedulePdf('TZ01', 'HR_TZ01-PIABETA-X-MAGE.pdf'),
      directions: [
        { id: 'ida', label: 'Saída da Rodoviária de Magé', departures: ['05:00','05:45','06:30','07:15','08:00','08:45','09:30','10:15','11:00','11:45','12:30','13:15','13:50','14:35','15:20','16:05','16:50','17:35','18:20','19:05','19:50','20:35','21:20','22:05'] }
      ]
    },
    returnLineId: 'TZ01',
    sourceNotes: [
      'Horários: tabela "Saída da Rodoviária de Magé" do quadro da TZ01, que corresponde ao itinerário de volta (TZ02) informado no cartaz de pontos de parada.',
      'O quadro de horários publicado com o nome TZ02 traz a linha "Mauá x Magé".'
    ]
  },
  {
    id: 'TZ03',
    summary: { name: 'Entrada de Mauá x Cantinho da Vovó / Ipiranga', origin: 'Entrada de Mauá', destination: 'Cantinho da Vovó / Ipiranga' },
    operatingHours: DAILY_5_22,
    published: { title: 'Mauá x Piabetá', departure: 'Mauá', arrival: 'Rodoviária de Piabetá', stops: [] },
    schedule: {
      title: 'TZ03 · MAUÁ x PIABETÁ',
      pdf: SOURCES.schedulePdf('TZ03', 'HR_TZ03-MAUA-X-PIABETA.pdf'),
      directions: [
        { id: 'ida', label: 'Saída de Mauá', departures: ['05:00','06:40','08:20','10:10','12:00','13:50','15:30','17:10','19:00','20:40'] },
        { id: 'volta', label: 'Saída da Rodoviária de Piabetá', departures: ['05:50','07:30','09:20','11:10','13:00','14:40','16:20','18:10','19:50','21:30'] }
      ]
    },
    sourceNotes: ['Na lista de linhas, a TZ03 aparece como "Entrada de Mauá x Cantinho da Vovó / Ipiranga"; no detalhamento e no quadro de horários, como "Mauá x Piabetá".']
  },
  {
    id: 'TZ04',
    summary: { name: 'São Francisco x Entrada de Mauá', origin: 'São Francisco', destination: 'Entrada de Mauá' },
    operatingHours: DAILY_5_22,
    published: { title: 'Mauá x Ipiranga', departure: 'Mauá BR 493', arrival: 'Ipiranga (Cantinho da Vovó)', stops: [] },
    schedule: {
      title: 'TZ04 · MAUÁ x IPIRANGA',
      pdf: SOURCES.schedulePdf('TZ04', 'HR_TZ04-MAUA-X-IPIRANGA.pdf'),
      directions: [
        { id: 'ida', label: 'Saída de Mauá BR493', departures: ['06:10','08:30','11:00','13:20','15:20','17:20','19:10','20:50'] },
        { id: 'volta', label: 'Saída de Ipiranga (Cantinho da Vovó)', departures: ['05:00','07:20','09:50','12:10','14:20','16:20','18:20','20:00','21:20'] }
      ]
    },
    sourceNotes: ['Na lista de linhas, a TZ04 aparece como "São Francisco x Entrada de Mauá"; no detalhamento e no quadro de horários, como "Mauá x Ipiranga".']
  },
  {
    id: 'TZ05',
    summary: { name: 'Entrada de Mauá x Rodoviária de Piabetá', origin: 'Entrada de Mauá', destination: 'Rodoviária de Piabetá' },
    operatingHours: DAILY_5_22,
    published: { title: 'Mauá x São Francisco', departure: 'Entrada de Mauá BR 493', arrival: 'São Francisco', stops: ['Entrada de Mauá', 'Entrada de Piabetá (Bongaba)', 'Hospital do Olho', 'Fórum de Piabetá', 'Rodoviária de Piabetá'], stopsLabel: 'Pontos de parada no trajeto', stopsSource: SOURCES.stopsPoster },
    schedule: {
      title: 'TZ05 · MAUÁ x SÃO FRANCISCO',
      pdf: SOURCES.schedulePdf('TZ05', 'HR_TZ05-MAUA-X-SAO-FRANCISCO.pdf'),
      directions: [
        { id: 'ida', label: 'Saída de BR493 Entrada de Mauá', departures: ['04:30','06:10','08:30','11:00','13:30','15:50','18:10','20:20'] },
        { id: 'volta', label: 'Saída de São Francisco', departures: ['05:00','07:20','09:50','12:20','14:40','17:00','19:20','21:20'] }
      ]
    },
    sourceNotes: ['Na lista de linhas, a TZ05 aparece como "Entrada de Mauá x Rodoviária de Piabetá"; no detalhamento e no quadro de horários, como "Mauá x São Francisco".', 'Pontos: o cartaz da TZ01 informa que a TZ05 usa os mesmos pontos, somente os que estão no trajeto da linha. A seleção dos pontos entre a Entrada de Mauá e a Rodoviária de Piabetá foi feita pela ordem do itinerário da TZ01.']
  },
  {
    id: 'TZ06',
    summary: { name: 'Entrada de Mauá x Rodoviária de Magé', origin: 'Entrada de Mauá', destination: 'Rodoviária de Magé' },
    operatingHours: DAILY_5_22,
    published: { title: 'Magé x Andorinhas', departure: 'Magé', arrival: 'Andorinhas', stops: ['Entrada de Mauá', 'Santa Dalila', 'Entrada principal de Suruí', 'Segunda entrada de Suruí', 'Barão de Iriri', 'Corpo de Bombeiros', '1ª entrada de Magé (Piedade)', '2ª entrada de Magé (Barbuda)', 'Detran', 'Praça da Prefeitura', 'Rodoviária de Magé'], stopsLabel: 'Pontos de parada no trajeto', stopsSource: SOURCES.stopsPoster },
    schedule: {
      title: 'TZ06 · MAGÉ x ANDORINHAS',
      pdf: SOURCES.schedulePdf('TZ06', 'HR_TZ06-MAGE-X-ANDORINHAS.pdf'),
      directions: [
        { id: 'ida', label: 'Saída de Magé', departures: ['06:40','09:00','11:20','13:30','16:30','19:30'] },
        { id: 'volta', label: 'Saída de Andorinhas', departures: ['05:30','07:50','10:10','12:30','15:00','18:00','21:00'] }
      ]
    },
    sourceNotes: ['Na lista de linhas, a TZ06 aparece como "Entrada de Mauá x Rodoviária de Magé"; no detalhamento e no quadro de horários, como "Magé x Andorinhas".', 'Pontos: o cartaz da TZ01 informa que a TZ06 usa os mesmos pontos, somente os que estão no trajeto da linha. A seleção dos pontos entre a Entrada de Mauá e a Rodoviária de Magé foi feita pela ordem do itinerário da TZ01.']
  },
  {
    id: 'TZ07',
    summary: { name: 'Capela x Rodoviária de Piabetá', origin: 'Capela', destination: 'Rodoviária de Piabetá' },
    operatingHours: DAILY_5_22,
    published: { title: 'Piabetá x Andorinhas (via Capela)', departure: 'Piabetá', arrival: 'Andorinhas', stops: [] },
    schedule: {
      title: 'TZ07 · PIABETÁ x ANDORINHAS (via CAPELA)',
      pdf: SOURCES.schedulePdf('TZ07', 'HR_TZ07-PIABETA-X-ANDORINHAS-Via-CAPELA.pdf'),
      directions: [
        { id: 'ida', label: 'Saída da Rodoviária de Piabetá', departures: ['05:00','07:50','10:50','13:30','16:20','19:10'] },
        { id: 'volta', label: 'Saída de Andorinhas', departures: ['06:30','09:20','12:10','15:00','17:50','20:40'] }
      ]
    },
    sourceNotes: ['Na lista de linhas, a TZ07 aparece como "Capela x Rodoviária de Piabetá"; no detalhamento e no quadro de horários, como "Piabetá x Andorinhas (via Capela)".']
  },
  {
    id: 'TZ08',
    summary: { name: 'Andorinhas x Rodoviária de Piabetá', origin: 'Andorinhas', destination: 'Rodoviária de Piabetá' },
    operatingHours: DAILY_5_22,
    published: { title: 'Suruí x Rio do Ouro (via Conceição)', departure: 'Entrada de Suruí', arrival: 'Escola Municipal Celso Goulart', stops: [] },
    schedule: {
      title: 'TZ08 · SURUÍ x RIO D’OURO (via CONCEIÇÃO)',
      pdf: SOURCES.schedulePdf('TZ08', 'HR_TZ08-SURUI-X-RIO-DOURO-via-CONCEICAO.pdf'),
      directions: [
        { id: 'ida', label: 'Saída da Entrada de Suruí', departures: ['06:10','08:30','11:00','13:40','16:40','19:40'] },
        { id: 'volta', label: 'Saída da Escola Municipal Celso Goulart', departures: ['05:00','07:20','09:50','12:20','15:10','18:10','21:10'] }
      ]
    },
    sourceNotes: ['Na lista de linhas, a TZ08 aparece como "Andorinhas x Rodoviária de Piabetá"; no detalhamento e no quadro de horários, como "Suruí x Rio do Ouro (via Conceição)".']
  },
  {
    id: 'TZ09',
    summary: { name: 'Magé x Píer da Piedade', origin: 'Magé', destination: 'Píer da Piedade' },
    operatingHours: DAILY_5_22,
    published: { title: 'Magé x Píer da Piedade', departure: 'Magé', arrival: 'Píer da Piedade', stops: [] },
    schedule: {
      title: 'TZ09 · MAGÉ x PÍER DA PIEDADE',
      pdf: SOURCES.schedulePdf('TZ09', 'HR_TZ09-MAGE-X-PIER-DA-PIEDADE.pdf'),
      directions: [
        { id: 'ida', label: 'Saída da Rodoviária de Magé', departures: ['05:50','08:20','11:00','13:30','15:50','18:10','20:30'] },
        { id: 'volta', label: 'Saída do Píer da Piedade', departures: ['06:30','09:10','11:40','14:10','16:30','18:50','21:10'] }
      ]
    },
    sourceNotes: []
  },
  {
    id: 'TZ10',
    summary: { name: 'Magé x Barbuda', variant: 'Via Saco', origin: 'Magé', destination: 'Barbuda' },
    operatingHours: DAILY_5_22,
    published: { title: 'Magé x Barbuda (Via Saco)', departure: 'Rodoviária de Magé', arrival: null, stops: [] },
    schedule: {
      title: 'TZ10 · MAGÉ x BARBUDA (via SACO)',
      pdf: SOURCES.schedulePdf('TZ10', 'HR_TZ10-MAGE-X-BARBUDA-via-SACO.pdf'),
      directions: [
        { id: 'ida', label: 'Saída da Rodoviária de Magé', departures: ['05:00','07:20','10:00','12:30','14:50','17:10','19:30'] }
      ]
    },
    sourceNotes: ['O quadro de horários publica apenas as saídas da Rodoviária de Magé.']
  },
  {
    id: 'TZ11',
    summary: { name: 'Piabetá x Raiz da Serra', variant: 'Via Parque Caçula', origin: 'Piabetá', destination: 'Raiz da Serra' },
    operatingHours: DAILY_5_22,
    published: { title: 'Piabetá x Raiz da Serra (Via Parque Caçula)', departure: 'Rodoviária de Piabetá', arrival: 'Raiz da Serra', stops: [] },
    schedule: {
      title: 'TZ11 · PIABETÁ x RAIZ DA SERRA (via PARQUE CAÇULA)',
      pdf: SOURCES.schedulePdf('TZ11', 'HR_TZ11-PIABETA-X-RAIZ-DA-SERRA-via-PARQUE-CACULA.pdf'),
      directions: [
        { id: 'ida', label: 'Saída da Rodoviária de Piabetá', departures: ['05:45','07:15','08:45','10:20','11:55','13:30','14:50','16:15','17:45','19:15','20:35'] },
        { id: 'volta', label: 'Saída do Ponto Final de Raiz da Serra', departures: ['05:00','06:30','08:00','09:35','11:10','12:40','14:10','15:30','17:00','18:30','19:55','21:15'] }
      ]
    },
    sourceNotes: []
  },
  {
    id: 'TZ12',
    summary: { name: 'Suruí x Rio do Ouro', variant: 'Via Conceição', origin: 'Suruí', destination: 'Rio do Ouro' },
    operatingHours: DAILY_5_22,
    published: { title: 'Suruí x Rio do Ouro (Via Conceição)', departure: 'Entrada de Suruí', arrival: 'Escola Municipal Celso Goulart', stops: [] },
    schedule: null,
    sourceNotes: ['Horários e pontos: "aguardando dados" na página oficial.']
  },
  {
    id: 'TZ13',
    summary: { name: 'Piabetá x Fragoso', variant: 'Via Maurimárcia e Pau Grande', origin: 'Piabetá', destination: 'Fragoso' },
    operatingHours: { start: '06:00', end: '21:00', label: 'Diariamente, das 6h às 21h' },
    published: {
      title: 'Piabetá x Fragoso (Via Maurimárcia e Pau Grande)',
      departure: 'Rodoviária de Piabetá',
      arrival: 'Praça da Fazenda – Fragoso',
      stopsLabel: 'Itinerário publicado (ida)',
      stops: ['R. Dona Elvira','Av. Santos Dumont','R. Nossa Sra. da Guia','R. do Relógio','R. 10','Av. do Canal','R. Dezessete','R. 15','R. 20','R. 19','Estr. Mineira','R. Henrique José','R. São Renato','R. Paulo Lavoier','R. Maria Ferreira','R. São Francisco','R. Guarani','R. Gregório Santana','R. Arisitides Portugal','Estr. da Cachoeira','R. Santana','R. Cambucá','R. Carioca','R. Jacamar','Estr. de Pau Grande','Av. Automóvel Clube','R. 6','R. Anacleto Paula Teixeira'],
      returnStops: ['R. Anacleto Paula Teixeira','R. Joaquim Fernandes Lima','R. Belmiro dos Santos','Av. Automóvel Clube','Estr. de Pau Grande','R. Jacamar','R. Carioca','R. Cambucá','R. Santana','Estr. da Cachoeira','R. Arisitides Portugal','R. Gregório Santana','Av. Santos Dumont','R. São Fidélis','R. Santa Elisa','R. Guarani','R. São Francisco','R. Maria Ferreira','R. Paulo Lavoier','R. São Renato','R. Henrique José','Estr. Mineira','R. 19','R. 20','R. 15','R. Dezessete','Av. do Canal','R. 10','R. do Relógio','R. Nossa Sra. da Guia','Av. Santos Dumont','R. Dona Elvira']
    },
    schedule: {
      title: 'TZ13 · horários publicados na página',
      pdf: null,
      directions: [
        { id: 'ida', label: 'Saída da Rodoviária de Piabetá', departures: ['06:10','08:40','11:00','13:20','15:40','18:00','20:00'] },
        { id: 'volta', label: 'Saída da Praça da Fazenda – Fragoso', departures: ['05:00','07:20','09:50','12:10','14:30','16:50','19:00','21:00'] }
      ]
    },
    sourceNotes: ['Horários reproduzidos da página oficial e exibidos em ordem cronológica.']
  },
  {
    id: 'TZ14',
    summary: { name: 'Piabetá x Ponte Preta', variant: 'Circular', origin: 'Piabetá', destination: 'Ponte Preta' },
    operatingHours: { start: '05:00', end: '21:00', label: 'Diariamente, das 5h às 21h' },
    published: {
      title: 'Piabetá x Ponte Preta (Circular)',
      departure: 'Rodoviária de Piabetá',
      arrival: null,
      stopsLabel: 'Itinerário publicado (circular)',
      stops: ['R. Dona Elvira','Av. Santos Dumont','R. D','R. São João','R. Nacionalista','R. H','Av. Humaitá','R. A','Tv. 4','R. C','Tv. Cinco','R. C','Tv. Cinco','R. D','Estr. Mineira','R. D','Tv. F','Rod. Santos Dumont','Estr. União e Indústria','R. Alfa','R. Nilo Peçanha','R. Maria Cândida Leite','R. José Pereira dos Santos','R. Dr. Hildebrando de Góes Araújo','R. José Ulman','Av. Mauá','R. Dona Elvira']
    },
    schedule: {
      title: 'TZ14 · horários publicados na página',
      pdf: null,
      directions: [
        { id: 'circular', label: 'Saída da Rodoviária de Piabetá', departures: ['05:00','06:10','07:20','08:40','10:00','11:10','12:20','13:35','14:40','15:50','17:10','18:30','19:50','20:55'] }
      ]
    },
    sourceNotes: ['Horários reproduzidos da página oficial e exibidos em ordem cronológica.']
  }
];
