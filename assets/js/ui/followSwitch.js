export function bindFollowSwitch(ctx, pickVehicleId) {
  const { map, sim, announce } = ctx;
  if (!sim) return;

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
