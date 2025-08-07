import { System } from './System';
import { Entity } from '../types';
import { CardSelected, Transform, CardData } from '../components';

export class CardSelectionSystem extends System {
  private selectedCards: Set<Entity> = new Set();

  constructor(world: any) {
    super(world);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (this.world?.eventBus) {
      this.world.eventBus.on('CardClicked', this.handleCardClick.bind(this));
      this.world.eventBus.on('ClearSelection', this.clearSelection.bind(this));
    }
  }

  private handleCardClick(data: { cardEntity: Entity }): void {
    const { cardEntity } = data;
    
    if (this.selectedCards.has(cardEntity)) {
      this.deselectCard(cardEntity);
    } else {
      this.selectCard(cardEntity);
    }
  }

  private selectCard(cardEntity: Entity): void {
    // Add selected component
    this.world.components.add(cardEntity, new CardSelected(true));
    this.selectedCards.add(cardEntity);

    // Raise the card visually
    const transform = this.world.components.get(cardEntity, Transform);
    if (transform) {
      transform.y -= 20; // Raise by 20 pixels
    }

    if (this.world?.eventBus) {
      this.world.eventBus.emit('CardSelected', { cardEntity });
    }
  }

  private deselectCard(cardEntity: Entity): void {
    // Remove selected component
    this.world.components.remove(cardEntity, CardSelected);
    this.selectedCards.delete(cardEntity);

    // Lower the card back to original position
    const transform = this.world.components.get(cardEntity, Transform);
    if (transform) {
      transform.y += 20; // Lower by 20 pixels
    }

    if (this.world?.eventBus) {
      this.world.eventBus.emit('CardDeselected', { cardEntity });
    }
  }

  private clearSelection(): void {
    for (const cardEntity of this.selectedCards) {
      this.deselectCard(cardEntity);
    }
  }

  public getSelectedCards(): Entity[] {
    return Array.from(this.selectedCards);
  }

  public getSelectedCardData(): CardData[] {
    return this.getSelectedCards()
      .map(entity => this.world.components.get(entity, CardData))
      .filter(cardData => cardData !== undefined) as CardData[];
  }

  update(deltaTime: number): void {
    // This system is event-driven, no continuous updates needed
  }
}
