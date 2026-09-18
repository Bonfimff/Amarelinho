import { html, raw } from '../../lib/text.js';
import { SOURCES } from '../../data/official/sources.js';

export default {
  title: 'Sobre',

  mount(el, ctx) {
    ctx.map.showOverview();
    const link = (s, label = s.title) => html`<a href="${s.url}" target="_blank" rel="noopener">${label}</a>`;
    const list = (items, cls = 'check-list') => html`<ul class="${cls}">${items.map((i) => html`<li>${i}</li>`)}</ul>`;

    el.innerHTML = html`
      <header class="view-head">
        <p class="ribbon">Protótipo conceitual · não oficial</p>
        <h1>Sobre o projeto</h1>
      </header>

      <section class="card prose">
        <p>Este protótipo apresenta uma proposta de modernização do acesso às informações do Amarelinho – Tarifa Zero, com o objetivo de demonstrar como uma plataforma digital poderia facilitar para os cidadãos de Magé a consulta e o acompanhamento das informações relacionadas ao serviço.</p>
        <p>A proposta contempla, entre outras funcionalidades:</p>
        ${raw(list(['Consulta das linhas disponíveis', 'Origem e destino', 'Itinerários', 'Pontos de parada', 'Horários programados', 'Identificação das linhas em operação', 'Visualização dos veículos no mapa', 'Previsão de chegada a determinado ponto', 'Acompanhamento do deslocamento do ônibus', 'Informações sobre a próxima parada']))}
        <p>A plataforma apresentada neste protótipo é uma demonstração conceitual e não constitui um canal oficial da Prefeitura Municipal de Magé.</p>
        <a class="about-logo" href="https://mage.rj.gov.br/" target="_blank" rel="noopener" aria-label="Site da Prefeitura Municipal de Magé (abre em nova aba)"><img src="assets/brand/prefeitura-mage.png" alt="Prefeitura de Magé" width="500" height="152" /></a>
      </section>

      <section class="card prose">
        <h2 class="card-title">Dados e informações utilizados</h2>
        <p>O protótipo combina informações baseadas em publicações públicas da Prefeitura de Magé com elementos simulados exclusivamente para demonstrar como a solução poderia funcionar.</p>

        <h3 class="data-split__title"><span class="kind-dot kind-dot--public" aria-hidden="true"></span>Informações baseadas em fontes públicas</h3>
        <p>Foram utilizadas, quando disponíveis nas fontes consultadas:</p>
        ${raw(list(['Linhas do Amarelinho – Tarifa Zero', 'Origens e destinos', 'Horários de funcionamento', 'Horários programados publicados', 'Itinerários', 'Pontos de parada', 'Informações operacionais divulgadas pela Prefeitura']))}
        <p>A página oficial do Amarelinho atualmente apresenta as linhas TZ01 a TZ14, seus respectivos destinos e faixas de funcionamento. Por exemplo, a TZ01 é apresentada como Rodoviária de Piabetá x Rodoviária de Magé (Expresso), com funcionamento diário das 5h às 22h. <small class="muted">Fonte: ${raw(link(SOURCES.amarelinhoPage, 'Prefeitura Municipal de Magé'))}</small></p>
        <p>A Prefeitura também publicou informações específicas sobre os pontos de parada da TZ01, incluindo Rodoviária de Piabetá, Fórum de Piabetá, Hospital do Olho, Entrada de Piabetá, Entrada de Mauá, pontos em Suruí e outros até a Rodoviária de Magé. A publicação informa ainda que o itinerário de volta da TZ02 utiliza as mesmas paradas. <small class="muted">Fonte: ${raw(link(SOURCES.stopsPoster, 'Prefeitura Municipal de Magé'))}</small></p>

        <h3 class="data-split__title"><span class="kind-dot kind-dot--sim" aria-hidden="true"></span>Elementos simulados para demonstração</h3>
        <p>As seguintes informações são fictícias/simuladas para fins de demonstração:</p>
        ${raw(list(['Posição atual dos ônibus', 'Deslocamento dos veículos', 'Velocidade', 'Eventuais atrasos', 'Previsão de chegada', 'Atualização da localização', 'Quantidade de ônibus em circulação', 'Status operacional do veículo', 'Próxima parada', 'Tempo estimado até a próxima parada'], 'check-list check-list--sim'))}
      </section>

      <section class="card prose about-alert">
        <h2 class="card-title">Importante</h2>
        <p><strong>Os veículos apresentados no mapa não representam a localização real dos ônibus.</strong></p>
        <p>A movimentação apresentada no protótipo é uma simulação de acompanhamento, criada para demonstrar como poderia funcionar uma futura solução conectada às informações operacionais do serviço.</p>
      </section>

      <section class="card prose">
        <h2 class="card-title">Simulação de acompanhamento</h2>
        <p>Durante a demonstração, o usuário pode visualizar um ônibus se deslocando pelo mapa ao longo do itinerário selecionado.</p>
        <p>A simulação permite representar uma experiência semelhante à que poderia ser oferecida futuramente caso existissem dados de localização dos veículos disponibilizados para integração.</p>
        <p>O protótipo pode apresentar, por exemplo:</p>
        <div class="demo-example" aria-label="Exemplo ilustrativo de ônibus em circulação">
          <p class="demo-example__kicker">Ônibus em circulação</p>
          <div class="demo-example__head">
            <img src="IMG/img-onibus.png" alt="" width="48" height="48" />
            <div><strong>Amarelinho · Linha TZ01</strong><span>Rodoviária de Piabetá → Rodoviária de Magé</span><em>Em trajeto</em></div>
          </div>
          <p class="demo-example__kicker demo-example__kicker--sim">Informações simuladas</p>
          <dl class="demo-example__grid">
            <div><dt>Próxima parada</dt><dd>Entrada de Mauá</dd></div>
            <div><dt>Distância</dt><dd>1,8 km</dd></div>
            <div><dt>Previsão</dt><dd>5 min</dd></div>
            <div><dt>Velocidade</dt><dd>32 km/h</dd></div>
            <div><dt>Última atualização</dt><dd>agora</dd></div>
          </dl>
        </div>
        <p class="fine">Esses dados são apenas ilustrativos nesta demonstração.</p>
      </section>

      <section class="card prose">
        <h2 class="card-title">Representação cartográfica</h2>
        <p>O mapa utilizado no protótipo tem finalidade exclusivamente demonstrativa.</p>
        <p>O traçado apresentado procura representar visualmente o percurso das linhas utilizando informações públicas disponíveis e uma base cartográfica digital.</p>
        <p>O traçado exibido, a posição dos pontos e a movimentação dos veículos não devem ser interpretados como representação cartográfica ou localização operacional oficial.</p>
        <p>Quando não houver coordenadas oficiais disponíveis para determinado ponto ou trecho, sua posição poderá ser aproximada para fins de visualização.</p>
      </section>

      <section class="card prose">
        <h2 class="card-title">Como funcionaria em uma futura versão integrada</h2>
        <p>A proposta demonstrada neste protótipo foi estruturada de forma que, futuramente, informações reais de operação possam substituir os dados simulados, caso existam sistemas de rastreamento e informações disponíveis para integração.</p>
        <p>Nesse cenário, a plataforma poderia apresentar:</p>
        <ul class="feature-list">
          <li><strong>Localização do veículo</strong><span>A posição atual do ônibus no mapa.</span></li>
          <li><strong>Próxima parada</strong><span>Identificação da próxima parada prevista no itinerário.</span></li>
          <li><strong>Previsão de chegada</strong><span>Estimativa de quanto tempo falta para o veículo chegar ao ponto selecionado.</span></li>
          <li><strong>Atualização</strong><span>Indicação do momento da última informação recebida.</span></li>
          <li><strong>Situação da viagem</strong><span>Por exemplo: em circulação; próximo da parada; parado; fora de operação; última localização conhecida.</span></li>
        </ul>
        <p class="fine">Essas funcionalidades representam possibilidades da solução e não significam que os dados estejam atualmente disponíveis ao protótipo.</p>
      </section>

      <section class="card prose" id="fontes">
        <h2 class="card-title">Fontes das informações</h2>
        <p>As informações utilizadas na construção da demonstração são baseadas principalmente em publicações públicas da Prefeitura Municipal de Magé.</p>
        <ul class="sources">
          <li>${raw(link(SOURCES.amarelinhoPage, 'Prefeitura Municipal de Magé: Amarelinho, Tarifa Zero'))}<small>Página oficial com informações sobre as linhas, origens, destinos, horários e detalhamento disponível para o programa.</small></li>
          <li>${raw(link(SOURCES.stopsPoster, 'Boletim Informativo Oficial: Pontos da Linha TZ01'))}<small>Publicação oficial com os pontos de parada da TZ01 e informações relacionadas às linhas TZ02, TZ05 e TZ06.</small></li>
          <li><span>Boletins Informativos Oficiais: Itinerários</span><span class="muted">Prefeitura Municipal de Magé</span><small>Também foram consideradas publicações oficiais que apresentam informações detalhadas de itinerários e características de determinadas linhas, incluindo informações das linhas TZ13 e TZ14.</small></li>
          <li>${raw(link(SOURCES.openStreetMap))}<small>Base cartográfica utilizada para a representação visual do mapa e da malha viária.</small></li>
        </ul>
      </section>

      <section class="card prose">
        <h2 class="card-title">Natureza das informações</h2>
        <p>Para facilitar a compreensão, o protótipo diferencia visualmente:</p>
        <ul class="kind-legend">
          <li><span class="kind-dot kind-dot--public" aria-hidden="true"></span><div><strong>Informação baseada em fonte pública</strong><span>Informação obtida de publicação ou página pública da Prefeitura.</span></div></li>
          <li><span class="kind-dot kind-dot--sim" aria-hidden="true"></span><div><strong>Informação simulada</strong><span>Informação criada exclusivamente para demonstrar uma funcionalidade que poderá existir futuramente.</span></div></li>
          <li><span class="kind-dot kind-dot--real" aria-hidden="true"></span><div><strong>Informação operacional real</strong><span>Não utilizada neste protótipo.</span></div></li>
        </ul>
        <p class="fine">A disponibilização de localização real dos veículos, previsão de chegada em tempo real e demais informações dinâmicas dependeria da existência de dados operacionais disponíveis e de eventual integração autorizada com os sistemas responsáveis pelo acompanhamento da frota.</p>
      </section>

      <section class="card prose">
        <h2 class="card-title">Data da consulta</h2>
        <p>Fontes consultadas em: <strong>16 de setembro de 2026</strong>.</p>
        <p>As informações públicas podem ser alteradas ou atualizadas pela Prefeitura. Por esse motivo, o protótipo deve ser entendido como uma demonstração baseada nas informações disponíveis na data da consulta, e não como uma reprodução permanente do conteúdo oficial.</p>
      </section>

      <section class="card prose about-alert">
        <h2 class="card-title">Aviso importante</h2>
        <p>Este é um protótipo conceitual, desenvolvido para demonstrar uma possível experiência digital para consulta e acompanhamento do Amarelinho – Tarifa Zero.</p>
        <p>Não possui vínculo institucional, representação ou autorização oficial da Prefeitura Municipal de Magé.</p>
        <p>As informações de localização, velocidade, previsão de chegada, quantidade de veículos e demais dados dinâmicos exibidos no modo de demonstração são simulados e não representam a operação real da frota.</p>
      </section>

      <section class="card prose">
        <h2 class="card-title">Dados de uso do protótipo</h2>
        <p>Para entender como as pessoas usam a demonstração e melhorá-la, o protótipo registra a navegação: telas abertas, recursos exibidos, ações realizadas (como iniciar a simulação ou abrir uma linha), tipo de aparelho, tamanho de tela, idioma, data e hora.</p>
        <p><strong>Não são coletados dados pessoais.</strong> Não há cadastro, não pedimos nome, e-mail ou telefone, não usamos a localização real do aparelho e não guardamos o endereço IP. A identificação é um número aleatório gerado no próprio navegador, sem ligação com a pessoa, que pode ser apagado a qualquer momento limpando os dados do site.</p>
        <p class="fine">Os registros são usados apenas para avaliar o uso desta demonstração e não são compartilhados com terceiros.</p>
      </section>

      <section class="card prose">
        <h2 class="card-title">Desenvolvimento</h2>
        <p>Protótipo concebido e desenvolvido pela <strong>Exksvol</strong>.</p>
        <a class="dev-credit" href="https://www.exksvol.com" target="_blank" rel="noopener" aria-label="Exksvol, desenvolvedora do protótipo (abre em nova aba)">
        <span class="dev-credit__label">Desenvolvido por</span>
        <img src="assets/brand/exksvol.png" alt="Exksvol Systems" width="790" height="160" />
      </a>
      </section>
    `;
  }
};
