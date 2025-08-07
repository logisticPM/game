import { System } from './System';
import { Entity } from '../types';
import { Transform, CardData, PlayerInfo } from '../components';

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
      this.world.eventBus.on('CardsPlayed', this.handleCardsPlayed.bind(this));
      this.world.eventBus.on('TurnEnded', this.clearPlayedCards.bind(this));
      this.world.eventBus.on('RoundEnded', this.clearAllPlayedCards.bind(this));
    }
  }

  private handleCardsPlayed(data: { playerId: number, cardEntities: Entity[] }): void {
    const { playerId, cardEntities } = data;
    
    // Store the played cards
    this.playedCards.set(playerId, cardEntities);
    
    // Layout the cards in the center area
    this.layoutPlayedCards(playerId, cardEntities);
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
      baseY = centerY + 50; // Player's cards slightly below center
    } else if (playerId === 1) {
      baseY = centerY - 50; // Left opponent's cards slightly above center
    } else if (playerId === 2) {
      baseY = centerY - 50; // Right opponent's cards slightly above center
    }

    // Layout each card
    cardEntities.forEach((cardEntity, index) => {
      const transform = this.world.components.get(cardEntity, Transform);
      if (transform) {
        transform.x = startX + index * cardSpacing;
        transform.y = baseY;
        transform.rotation = 0;
        transform.scaleX = 0.8;
        transform.scaleY = 0.8;
      }
    });
  }

  private clearPlayedCards(data: { playerId: number }): void {
    const { playerId } = data;
    const cards = this.playedCards.get(playerId);
    
    if (cards) {
      // Hide or remove the played cards
      cards.forEach(cardEntity => {
        const transform = this.world.components.get(cardEntity, Transform);
        if (transform) {
          transform.visible = false;
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
