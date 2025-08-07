import { System } from './System';
import { SelectCardRequest, SelectedCards, PlayerInfo } from '../components';

export class PlayerInputSystem extends System {
  constructor(world: any) {
    super(world);
  }

  update(delta: number): void {
    const requests = this.world.components.getEntitiesWith(SelectCardRequest);
    if (requests.length === 0) return;

    const player = this.world.entities.find((entity, getComponent) => {
      const info = getComponent!(PlayerInfo);
      return info && info.id === 0;
    }, this.world.components);
    if (!player) return;

    const selected = this.world.components.get(player, SelectedCards);

    for (const entity of requests) {
      const request = this.world.components.get(entity, SelectCardRequest);
      const cardToSelect = request.card;

      const index = selected.cards.indexOf(cardToSelect);
      if (index > -1) {
        selected.cards.splice(index, 1); // Deselect
      } else {
        selected.cards.push(cardToSelect); // Select
      }

      this.world.components.remove(entity, SelectCardRequest);
    }
  }
}
