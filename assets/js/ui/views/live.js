import { navigate } from '../router.js';

// "Ao vivo": abre o ônibus da demonstração (ou o primeiro em circulação da TZ01).
export default {
  title: 'Ao vivo',

  async mount(el, ctx) {
    el.innerHTML = '<div class="loading-row"><span class="spinner" aria-hidden="true"></span>Localizando ônibus…</div>';
    const { transport } = ctx;
    const lineId = transport.demo?.lineId || 'TZ01';
    const vehicles = await transport.getVehicles({ lineId });
    const demo = vehicles.find((v) => v.id === transport.demo?.vehicleId && v.status !== 'arrived');
    const pick = demo || vehicles.filter((v) => v.status !== 'arrived').sort((a, b) => a.progress - b.progress)[0];
    if (pick) navigate(`/veiculo/${pick.id}`, { seguir: 1 }, { replace: true });
    else navigate(`/linha/${lineId}`, null, { replace: true });
  }
};
