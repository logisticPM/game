import { System } from './System';
import { GameState, GamePhase, Hand, PlayerInfo, Role } from '../components';

export class WinConditionSystem extends System {
  constructor(world: any) {
    super(world);
  }

  update(delta: number): void {
    const gameState = this.world.getGameState();
    if (!gameState || gameState.phase !== GamePhase.Playing) return;

    const players = this.world.entities.with(PlayerInfo, Hand);

    for (const player of players) {
      const hand = this.world.components.get(player, Hand);
      if (hand.cards.length === 0) {
        const playerInfo = this.world.components.get(player, PlayerInfo);
        if (playerInfo.role === Role.Landlord) {
          gameState.winner = 'landlord';
        } else {
          gameState.winner = 'farmers';
        }
        gameState.phase = GamePhase.Finished;
        this.world.eventBus.emit('gameStateChanged', gameState);
        return; // End check
      }
    }
  }
}
