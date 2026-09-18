export const SOURCES = {
  amarelinhoPage: {
    id: 'amarelinhoPage',
    title: 'Página Amarelinho da Prefeitura Municipal de Magé',
    url: 'https://mage.rj.gov.br/amarelinho/',
    publisher: 'Prefeitura Municipal de Magé',
    note: 'Lista de linhas com Tarifa Zero, faixas de funcionamento e detalhamento das linhas.'
  },
  schedulePdf: (lineId, file) => ({
    id: `pdf-${lineId}`,
    title: `Quadro de horários ${lineId} (PDF)`,
    url: `https://mage.rj.gov.br/wp-content/uploads/2025/11/${file}`,
    publisher: 'Secretaria Municipal de Transportes de Magé'
  }),
  stopsPoster: {
    id: 'stopsPoster',
    title: 'Cartaz "Novos pontos de parada · Linha TZ01 - Piabetá x Magé"',
    url: 'https://www.instagram.com/p/DMtEBGNR5TB/',
    publisher: 'Prefeitura Municipal de Magé',
    note: 'Pontos de parada da TZ01. Informa que a volta (TZ02) tem as mesmas paradas e que as linhas TZ05 e TZ06 usam os pontos que estão em seus trajetos.'
  },
  openStreetMap: {
    id: 'openStreetMap',
    title: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/copyright',
    publisher: 'Colaboradores do OpenStreetMap',
    note: 'Base do mapa, traçado viário e posição aproximada dos pontos.'
  }
};
