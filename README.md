# Amarelinho Tarifa Zero · Magé

Protótipo conceitual (não oficial) de uma plataforma de informações do **Amarelinho – Tarifa Zero** da Prefeitura de Magé/RJ.
Informações públicas das linhas + **simulação** de localização dos ônibus para demonstrar o acompanhamento em tempo real.

## Como rodar

Requer apenas Python 3 (não há build).

```bash
python serve.py
```

Abra http://localhost:5173. O mapa usa tiles do OpenStreetMap, então é preciso internet.
Não abra o `index.html` direto do disco: módulos JavaScript exigem um servidor HTTP.

## Fluxo de demonstração (≈30 s)

1. **Início** → a simulação começa na hora atual do aparelho, em tempo real (1x): os ônibus aparecem onde estariam agora segundo o quadro de horários.
2. **▶ Acompanhar ônibus** → o ônibus percorre a rota; o painel atualiza próximo ponto, distância e previsão.
3. Card flutuante sobre o mapa: **Pausar**, **Voltar ao horário atual** e velocidade **1x · 2x · 5x · 10x**. Fora do horário de operação (5h às 22h) não há ônibus em circulação.
4. **Linha TZ01** → pontos, horários oficiais, itinerário, sentido.
5. Toque em um **ponto** (ex.: Hospital do Olho) → próximos ônibus → toque no ônibus em circulação para acompanhá-lo.
6. **Buscar** → “Piabetá”, “Suruí”, “TZ09”…

## O que é real, aproximado e simulado

| Tipo | Conteúdo | Onde está |
|---|---|---|
| **Oficial** | Linhas TZ01 a TZ14, nomes, origem/destino, funcionamento, quadros de horários, itinerários e pontos publicados | `assets/js/data/official/` |
| **Aproximado** | Traçado viário da TZ01 e posição dos pontos no mapa (OpenStreetMap + OSRM) | `assets/js/data/geo/tz01-route.js` (gerado por `_fontes/geo/build_tz01.py`) |
| **Simulado** | Posição dos ônibus, velocidade, atrasos, previsão dinâmica, atualização de GPS, veículos em circulação | `assets/js/data/mock/` |

Os veículos simulados seguem **os horários de saída do quadro oficial** da TZ01. As previsões de viagens que ainda não partiram usam o horário programado mais o tempo médio estimado de percurso.

### Observações sobre as fontes
- A página oficial apresenta **informações divergentes** para várias linhas: a lista “Linhas com Tarifa Zero disponíveis” e o detalhamento/quadro de horários da mesma linha trazem nomes diferentes (ex.: TZ03). O protótipo mostra os dois e sinaliza a divergência.
- Pontos de parada: cartaz da Prefeitura “Novos pontos de parada · Linha TZ01 - Piabetá x Magé”. Segundo o cartaz, a volta (TZ02, Magé x Piabetá) tem as mesmas paradas, e as linhas TZ05 e TZ06 usam os pontos que estão em seus trajetos (a seleção desses pontos segue a ordem do itinerário da TZ01).
- Horários da TZ02: tabela “Saída da Rodoviária de Magé” do quadro da TZ01. O PDF publicado com o nome TZ02 traz a linha “Mauá x Magé”.
- A TZ12 não tem horários publicados (“aguardando dados”).
- Cópias das fontes consultadas em 15/09/2026 estão em `_fontes/` (HTML da página e PDFs dos horários).

## Arquitetura

```
index.html
assets/
  css/app.css                      estilos (mobile first; desktop ≥ 1024px)
  vendor/leaflet/                  Leaflet 1.9.4 (local)
  js/
    config.js                      provedor de dados, intervalo de GPS, demo, mapa
    main.js                        inicialização e roteamento
    data/
      official/lines.js            dados oficiais (sem simulação)
      official/sources.js          fontes e links
      geo/tz01-route.js            geometria gerada
      mock/mockTransportData.js    SIMULAÇÃO (única camada que calcula posição/previsão)
      mock/simulationClock.js      relógio da demonstração
    services/
      transportService.js          ponto único de acesso a dados usado pela UI
      httpTransportProvider.js     provedor para API futura (mesmos formatos)
      liveFeed.js                  atualização periódica dos veículos (“GPS”)
    ui/
      map/mapController.js         Leaflet: rota, pontos, veículos, seguir ônibus
      views/                       home, lines, line, stop, vehicle, live, search, about
      components.js, icons.js, sheet.js, router.js
    lib/                           geo, time, text, emitter
```

A interface **não calcula** posição nem previsão: ela consome apenas os objetos devolvidos pelo provedor.

### Integração futura com dados reais

Troque `dataProvider: 'http'` em `config.js` e implemente uma API com os mesmos formatos (endpoints **não existem hoje**):

| Endpoint | Retorno |
|---|---|
| `GET /lines`, `GET /lines/:id` | Linha (id, origem, destino, funcionamento, sentidos, horários) |
| `GET /lines/:id/shape?directionId=` | `points: [lat, lng, distânciaM, tempoS][]` |
| `GET /stops?lineId=&directionId=` | Pontos em ordem |
| `GET /vehicles?lineId=` | Veículos com `position`, `nextStop`, `upcomingStops`, `status`, `source` |
| `GET /vehicle/:id` | Um veículo |
| `GET /arrivals?lineId=&directionId=&stopId=` | Próximas chegadas (`type: realtime | scheduled`) |

Com GPS real, `source` passa de `simulated` para `gps`; o `liveFeed` continua consultando `/vehicles` no intervalo configurado e o mapa suaviza o deslocamento entre leituras.

## Limitações conhecidas
- TZ01 e TZ02 têm ônibus simulados no mapa. TZ05 e TZ06 mostram rota e pontos, sem ônibus (os quadros de horários publicados para essas linhas não correspondem a esses itinerários). As demais linhas mostram informações publicadas e horários.
- A TZ02 reutiliza o traçado da TZ01 invertido (vias de mão única não foram tratadas).
- Tiles padrão do OpenStreetMap servem apenas para demonstração. Em produção, use um provedor de mapas contratado ou servidor próprio.

## Identidade visual

Cores e tipografia seguem a comunicação do Amarelinho e da Prefeitura de Magé: azul institucional, amarelo dos ônibus, faixa com as quatro cores do coração e títulos em caixa alta no estilo dos cartazes. O logotipo oficial da Prefeitura não foi incluído; ele pode ser adicionado no cabeçalho (`index.html`, bloco `.brand`) mediante autorização.

## Publicar

São dois lugares diferentes, e é importante não confundir:

- **O site** (`amarelinho.exksvol.com`) é servido pelo **GitHub Pages**, a partir do branch
  `gh-pages` (ver "Versão sem comentários" abaixo). O servidor não entra nisso.
- **A API** (`api-amarelinho.exksvol.com`) roda em um servidor próprio. Os arquivos do servidor
  (`server/`: API, serviço, nginx e scripts de publicação) **não ficam neste repositório**; são
  mantidos só localmente e enviados direto ao servidor.

```
git add -A && git commit -m "..." && git push   # guarda o codigo-fonte
bash server/publicar-site.sh                   # publica o site (sem comentarios)
```

### Versão sem comentários

O site no ar sai do branch `gh-pages`, que contém só a build: `node server/build.js` monta
`publico/` (ignorada pelo git) sem os comentários do código-fonte, e `bash server/publicar-site.sh`
empurra essa pasta para o `gh-pages`. O `main` segue comentado, para trabalhar.

```
bash server/publicar-site.sh     # monta e publica o site sem comentários
```

Na primeira vez, mude em **Settings > Pages** a origem de `main` para `gh-pages` (raiz).
O `gh-pages` é reescrito a cada publicação — é resultado de build, não fonte.

Arquivos de terceiros em `assets/vendor` são copiados sem alteração, porque as licenças exigem
manter os avisos de direitos autorais.
