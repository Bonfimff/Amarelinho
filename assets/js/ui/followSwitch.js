// Liga o interruptor "Seguir o ônibus" dos controles de simulação à linha já exibida no mapa.
// Acompanhar um ônibus apenas aproxima a câmera: não troca a linha nem redesenha o trajeto.
export function bindFollowSwitch(ctx, pickVehicleId) {
  const { map, sim, announce } = ctx;
  if (!sim) return;
  // O switch reflete o estado do mapa: arrastar o mapa ou o ônibus sumir do feed desliga o acompanhamento.
  map.on('follow', ({ id }) => sim.setFollow(Boolean(id)));
  sim.show({
    follow: Boolean(map.followId),
    onFollowChange: (checked) => {
      if (!checked) { map.setFollow(null); return; }
      const id = pickVehicleId();
      if (!id || !map.focusVehicle(id)) {
        sim.setFollow(false);
        announce?.('Nenhum ônibus em circulação nesta linha agora.');
        return;
      }
      map.setFollow(id);
    }
  });
}
