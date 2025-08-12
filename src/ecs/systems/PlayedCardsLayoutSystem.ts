import { System } from './System';
import { Entity } from '../types';
import { Transform, CardData, PlayerInfo, Sprite } from '../components';
import { EventName } from '../EventBus';

export class PlayedCardsLayoutSystem extends System {
  private playedCards: Map<number, Entity[]> = new Map(); // playerId -> cards
  private screenWidth: number;
  private screenHeight: number;

  constructor(world: any, screenWidth: number = 1280, screenHeight: number = 720) {
    super(world);
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (this.world?.eventBus) {
      // Use validated play event from rules system
      this.world.eventBus.on(EventName.PlayCardsValidated, this.handlePlayValidated.bind(this));
      // Also respond to state changes to re-layout from gameState.lastPlay
      this.world.eventBus.on(EventName.GameStateChanged, this.syncFromGameState.bind(this));
      // Preview human play immediately to ensure visible feedback
      this.world.eventBus.on(EventName.PlayCardsRequest, this.previewHumanPlay.bind(this));
      // Clear preview on invalid play
      this.world.eventBus.on(EventName.InvalidPlay, this.handleInvalidPlay.bind(this));
    }
  }

  private handlePlayValidated(data: { playerId: number; cards: Entity[]; combinationType?: any }): void {
    const { playerId, cards } = data;
    // Only keep the newest play on table
    this.clearAllPlayedCards();
    this.playedCards.set(playerId, cards);
    this.layoutPlayedCards(playerId, cards);
  }

  private syncFromGameState(payload: { gameState: any }): void {
    try {
      const gs = payload.gameState || payload;
      if (!gs || !gs.lastPlay || gs.lastPlay.length === 0 || gs.lastPlayOwnerId === undefined || gs.lastPlayOwnerId === null) {
        return;
      }
      // Ensure only last play is visible
      this.clearAllPlayedCards();
      this.playedCards.set(gs.lastPlayOwnerId, gs.lastPlay as Entity[]);
      this.layoutPlayedCards(gs.lastPlayOwnerId, gs.lastPlay as Entity[]);
    } catch (_) {
      // no-op
    }
  }

  private previewHumanPlay(data: { playerId: number; cards: Entity[] }): void {
    try {
      if (data.playerId !== 0 || !data.cards || data.cards.length === 0) return;
      // Layout as a preview; validated event will confirm or InvalidPlay will clear
      this.clearAllPlayedCards();
      this.playedCards.set(0, data.cards);
      this.layoutPlayedCards(0, data.cards);
    } catch (_) {}
  }

  private handleInvalidPlay(data: { playerId: number }): void {
    try {
      if (!data || data.playerId !== 0) return;
      // Remove preview for human invalid play
      const cards = this.playedCards.get(0);
      if (cards) {
        cards.forEach(cardEntity => {
          const sprite = this.world.components.tryGet(cardEntity, Sprite);
          if (sprite) sprite.visible = false;
        });
        this.playedCards.delete(0);
      }
      // Restore last valid play on table after invalid attempt
      const gs = this.world.getGameState?.();
      if (gs) {
        this.syncFromGameState({ gameState: gs });
      }
    } catch (_) {}
  }

  private layoutPlayedCards(playerId: number, cardEntities: Entity[]): void {
    const centerX = this.screenWidth / 2;
    const centerY = this.screenHeight / 2;
    
    // Calculate card spacing
    const cardWidth = 80;
    const cardSpacing = Math.min(cardWidth * 0.8, (this.screenWidth * 0.6) / cardEntities.length);
    const totalWidth = (cardEntities.length - 1) * cardSpacing;
    const startX = centerX - totalWidth / 2;

    // Position cards based on player
    let baseY = centerY;
    if (playerId === 0) {
      baseY = centerY + 40; // Human a bit below center
    } else {
      baseY = centerY - 40; // AIs a bit above center
    }

    // Layout each card
    cardEntities.forEach((cardEntity, index) => {
      const transform = this.world.components.get(cardEntity, Transform);
      if (transform) {
        transform.x = startX + index * cardSpacing;
        transform.y = baseY;
        transform.rotation = 0;
        transform.scaleX = 0.7;
        transform.scaleY = 0.7;
        transform.zIndex = 500 + index;
      }
      const sprite = this.world.components.tryGet(cardEntity, Sprite);
      if (sprite) {
        sprite.visible = true;
        sprite.alpha = 1;
      }
    });
  }

  private clearPlayedCards(data: { playerId: number }): void {
    const { playerId } = data;
    const cards = this.playedCards.get(playerId);
    
    if (cards) {
      // Hide the played cards
      cards.forEach(cardEntity => {
        const sprite = this.world.components.tryGet(cardEntity, Sprite);
        if (sprite) {
          sprite.visible = false;
        }
      });
      this.playedCards.delete(playerId);
    }
  }

  private clearAllPlayedCards(): void {
    for (const playerId of this.playedCards.keys()) {
      this.clearPlayedCards({ playerId });
    }
  }

  public getPlayedCards(playerId: number): Entity[] {
    return this.playedCards.get(playerId) || [];
  }

  public getAllPlayedCards(): Map<number, Entity[]> {
    return new Map(this.playedCards);
  }

  update(deltaTime: number): void {
    // This system is primarily event-driven
    // Could add animations here if needed
  }
}
