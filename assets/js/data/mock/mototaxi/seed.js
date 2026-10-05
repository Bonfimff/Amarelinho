export const DOC_TYPES = [
  { id: 'cnh', label: 'CNH categoria A com atividade remunerada' },
  { id: 'curso', label: 'Curso especializado de mototaxista' },
  { id: 'licenciamento', label: 'Licenciamento da moto na categoria aluguel' },
  { id: 'vistoria', label: 'Vistoria da moto' },
  { id: 'pessoal', label: 'Identificação e comprovante de residência' }
];

export const DEFAULT_RULES = {
  tarifa: { minimo: 6, kmIncluidos: 2, porKmAdicional: 1.5 },
  despacho: { raioInicialM: 3000, fatorAmpliacao: 1.6, tempoAceiteSeg: 15, maxPorRodada: 5, cancelGratisSeg: 60 }
};

export const PASSENGER_NAMES = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elaine', 'Fábio', 'Gisele', 'Heitor', 'Isabela', 'João', 'Karina', 'Leandro', 'Mariana', 'Nelson', 'Patrícia', 'Rafael'];

const allDocs = (status) => Object.fromEntries(DOC_TYPES.map((d) => [d.id, status]));

export const SEED_DRIVERS = [
  { id: 'd1', isUser: true, name: 'Carlos', phone: '(21) 9****-0001', moto: { model: 'Honda CG 160', color: 'Vermelha', plate: 'SIM1A01' }, reg: 'aprovado', docs: allDocs('aprovado'), stand: 'entrada-maua', online: false },
  { id: 'd2', name: 'Marcos', phone: '(21) 9****-0002', moto: { model: 'Yamaha Factor 150', color: 'Preta', plate: 'SIM1A02' }, reg: 'aprovado', docs: allDocs('aprovado'), stand: 'rodoviaria-piabeta', online: true },
  { id: 'd3', name: 'Jorge', phone: '(21) 9****-0003', moto: { model: 'Honda Biz 125', color: 'Azul', plate: 'SIM1A03' }, reg: 'aprovado', docs: allDocs('aprovado'), stand: 'entrada-maua', online: true },
  { id: 'd4', name: 'Paulo', phone: '(21) 9****-0004', moto: { model: 'Honda CG 160', color: 'Prata', plate: 'SIM1A04' }, reg: 'aprovado', docs: allDocs('aprovado'), stand: 'entrada-principal-surui', online: true },
  { id: 'd5', name: 'Sérgio', phone: '(21) 9****-0005', moto: { model: 'Honda Pop 110', color: 'Branca', plate: 'SIM1A05' }, reg: 'aprovado', docs: allDocs('aprovado'), stand: 'entrada-mage-piedade', online: true },
  { id: 'd6', name: 'Wellington', phone: '(21) 9****-0006', moto: { model: 'Yamaha Fazer 150', color: 'Azul', plate: 'SIM1A06' }, reg: 'aprovado', docs: { ...allDocs('aprovado'), licenciamento: 'vencido' }, stand: 'rodoviaria-mage', online: true },
  { id: 'd7', name: 'Anderson', phone: '(21) 9****-0007', moto: { model: 'Honda CG 125', color: 'Preta', plate: 'SIM1A07' }, reg: 'em_analise', docs: allDocs('enviado'), stand: 'rodoviaria-piabeta', online: false },
  { id: 'd8', name: 'Ricardo', phone: '(21) 9****-0008', moto: { model: 'Yamaha Factor 125', color: 'Vermelha', plate: 'SIM1A08' }, reg: 'pendencia', regNote: 'Vistoria da moto ainda não apresentada.', docs: { ...allDocs('enviado'), vistoria: 'pendente' }, stand: 'entrada-mage-piedade', online: false },
  { id: 'd9', name: 'Fabrício', phone: '(21) 9****-0009', moto: { model: 'Honda Biz 110', color: 'Verde', plate: 'SIM1A09' }, reg: 'suspenso', regNote: 'Suspenso após ocorrência confirmada (exemplo).', docs: allDocs('aprovado'), stand: 'rodoviaria-mage', online: false }
];
