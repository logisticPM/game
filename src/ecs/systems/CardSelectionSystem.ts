import { System } from './System';
import { Entity } from '../types';
import { CardSelected, CardData, SelectedCards, PlayerInfo } from '../components';
import { EventName } from '../EventBus';

export class CardSelectionSystem extends System {
  private selectedCards: Set<Entity> = new Set();

  constructor(world: any) {
    super(world);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (this.world?.eventBus) {
      this.world.eventBus.on(EventName.SelectCardRequest, this.handleSelectCardRequest.bind(this));
      this.world.eventBus.on('clearCardSelection', this.clearSelection.bind(this));
    }
  }

  private handleSelectCardRequest(data: { playerId: number; cardEntity: Entity }): void {
    const { playerId, cardEntity } = data;
    console.log(`[CardSelectionSystem] SelectCardRequest for player ${playerId}, card ${cardEntity}`);
    
    if (this.selectedCards.has(cardEntity)) {
      this.deselectCard(cardEntity, playerId);
    } else {
      this.selectCard(cardEntity, playerId);
    }
  }

  private selectCard(cardEntity: Entity, playerId: number): void {
    // Mark card as selected (component-based for RenderSystem animation)
    const cardSelected = this.world.components.tryGet(cardEntity, CardSelected);
    if (cardSelected) {
      cardSelected.selected = true;
    } else {
      this.world.components.add(cardEntity, new CardSelected(true));
    }
    this.selectedCards.add(cardEntity);

    // Update player's SelectedCards set
    const playerEntity = this.findPlayerById(playerId) ?? this.world.humanPlayer;
    const selected = this.world.components.tryGet(playerEntity, SelectedCards) ?? new SelectedCards();
    if (!this.world.components.has(playerEntity, SelectedCards)) {
      this.world.components.add(playerEntity, selected);
    }
    selected.cards.add(cardEntity);

    if (this.world?.eventBus) {
      this.world.eventBus.emit(EventName.CardSelected, { cardEntity, selected: true, playerId });
    }
    console.log(`[CardSelectionSystem] Selected card ${cardEntity} for player ${playerId}`);
  }

  private deselectCard(cardEntity: Entity, playerId: number): void {
    // Unmark selection but keep component for consistency
    const cardSelected = this.world.components.tryGet(cardEntity, CardSelected);
    if (cardSelected) {
      cardSelected.selected = false;
    }
    this.selectedCards.delete(cardEntity);

    // Update player's SelectedCards set
    const playerEntity = this.findPlayerById(playerId) ?? this.world.humanPlayer;
    const selected = this.world.components.tryGet(playerEntity, SelectedCards);
    if (selected) {
      selected.cards.delete(cardEntity);
    }

    if (this.world?.eventBus) {
      this.world.eventBus.emit(EventName.CardSelected, { cardEntity, selected: false, playerId });
    }
    console.log(`[CardSelectionSystem] Deselected card ${cardEntity} for player ${playerId}`);
  }

  private clearSelection(payload?: { playerId?: number }): void {
    const targetPlayerId = payload?.playerId ?? 0;
    const playerEntity = this.findPlayerById(targetPlayerId) ?? this.world.humanPlayer;

    const selected = this.world.components.tryGet(playerEntity, SelectedCards);
    if (selected) {
      for (const cardEntity of Array.from(selected.cards)) {
        this.deselectCard(cardEntity, targetPlayerId);
      }
      selected.cards.clear();
    }

    // Also clear internal tracking set
    this.selectedCards.clear();
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

  private findPlayerById(playerId: number): number | undefined {
    return this.world.entities.find((entity, getComponent) => {
      const info = getComponent?.(PlayerInfo);
      return info?.id === playerId;
    }, this.world.components);
  }
}
