import * as PIXI from 'pixi.js';
import { Entity } from './types';
import { System } from './systems/System';
import { RenderSystem } from './systems/RenderSystem';
import { EntityManager } from './EntityManager';
import { ComponentManager } from './ComponentManager';
import { createPlayer, createCardDeck, createGameManager } from './entities';
import { CardData, GameState, GamePhase, PlayerInfo, Hand, SelectedCards, CardSelected, Transform } from './components';
import { BiddingSystem } from './systems/BiddingSystem';
import { EventBus } from './EventBus';
import { PlayerInputSystem } from './systems/PlayerInputSystem';
import { PlayValidationSystem } from './systems/PlayValidationSystem';
import { WinConditionSystem } from './systems/WinConditionSystem';
import { AISystem } from './systems/AISystem';
import { CardLayoutSystem } from './systems/CardLayoutSystem';
import { LandlordCardLayoutSystem } from './systems/LandlordCardLayoutSystem';
import { CardSelectionSystem } from './systems/CardSelectionSystem';
import { PlayedCardsLayoutSystem } from './systems/PlayedCardsLayoutSystem';
import { BiddingDebugger } from '../debug/BiddingDebugger';
import { HintSystem } from './systems/HintSystem';
import { VisualEffectsSystem } from './systems/VisualEffectsSystem';

// 前向声明Game类型
interface Game {
  app: PIXI.Application;
  world: World;
}

export class World {
  public readonly app: PIXI.Application;
  public game: Game;
  public entities: EntityManager;
  public components: ComponentManager;
  public eventBus: EventBus;
  public humanPlayer!: Entity;
  public biddingDebugger?: BiddingDebugger;

  private systems = new Map<Function, System>();
  private gameStateEntity!: Entity;

  constructor(app: PIXI.Application, game: Game) {
    this.app = app;
    this.game = game;
    this.entities = new EntityManager();
    this.components = new ComponentManager(this.entities);
    this.eventBus = new EventBus();

    this.registerSystems();
    this.initWorld();
  }

  private registerSystems() {
    this.systems.set(PlayerInputSystem, new PlayerInputSystem(this));
    this.systems.set(AISystem, new AISystem(this));
    this.systems.set(BiddingSystem, new BiddingSystem(this));
    this.systems.set(PlayValidationSystem, new PlayValidationSystem(this));
    this.systems.set(WinConditionSystem, new WinConditionSystem(this));
    this.systems.set(CardLayoutSystem, new CardLayoutSystem(this));
    this.systems.set(LandlordCardLayoutSystem, new LandlordCardLayoutSystem(this));
    this.systems.set(PlayedCardsLayoutSystem, new PlayedCardsLayoutSystem(this, 1280, 720));
    this.systems.set(CardSelectionSystem, new CardSelectionSystem(this));
    this.systems.set(HintSystem, new HintSystem(this));
    this.systems.set(VisualEffectsSystem, new VisualEffectsSystem(this));
    // RenderSystem must be last!
    this.systems.set(RenderSystem, new RenderSystem(this, this.app));
  }

  private initWorld() {
    // Create game manager and get the game state component directly
    this.gameStateEntity = createGameManager(this);
    const gameState = this.getGameState();

    // Create players
    const players = [
        createPlayer(this, 0, 'Player', false),
        createPlayer(this, 1, 'AI Left', true),
        createPlayer(this, 2, 'AI Right', true)
    ];
    this.humanPlayer = players[0];

    // Create and deal cards
    const { landlordCards } = createCardDeck(this, players);

    // Set landlord cards
    gameState.landlordCards = landlordCards;

    // Set initial game state
    gameState.phase = GamePhase.Bidding;
    gameState.currentPlayerId = Math.floor(Math.random() * 3); // Random player starts bidding
    gameState.currentBid = 0;
    gameState.bidHistory = [];

    // Layout systems will run in the first update loop, no need for manual calls.

    console.log('World initialized');
    this.eventBus.emit('gameStateChanged', gameState);
    
    // 初始化调试器
    this.biddingDebugger = new BiddingDebugger(this.eventBus);
    this.biddingDebugger.attachToWindow();
  }

  public update(delta: number): void {
    // Update all systems
    for (const system of this.systems.values()) {
      system.update(delta);
    }

    // Events are emitted and handled synchronously within systems.
    // The EventBus itself doesn't need an update loop.
  }

  public getSystem<T extends System>(type: new (...args: any[]) => T): T {
    return this.systems.get(type) as T;
  }

  public getGameState(): GameState {
    return this.components.get(this.gameStateEntity, GameState);
  }

  /**
   * Debug method to check texture loading status
   */
  public debugTextureStatus(): void {
    const renderSystem = this.getSystem(RenderSystem);
    if (renderSystem && 'debugTextureStatus' in renderSystem) {
      (renderSystem as any).debugTextureStatus();
    } else {
      console.warn('[World] RenderSystem not found or doesn\'t have debugTextureStatus method');
    }
  }

  /**
   * Debug method to check card visibility states
   */
  public debugCardStates(): void {
    console.log('\n[World] Card States Debug:');
    
    // Check player hands
    const playerEntities = this.entities.with(PlayerInfo, Hand);
    for (const playerEntity of playerEntities) {
      const playerInfo = this.components.get(playerEntity, PlayerInfo);
      const playerHand = this.components.get(playerEntity, Hand);
      
      if (playerInfo && playerHand) {
        console.log(`\nPlayer ${playerInfo.id} (${playerInfo.name}) hand:`);
        playerHand.cards.forEach((cardEntity, index) => {
          const cardData = this.components.get(cardEntity, CardData);
          if (cardData) {
            console.log(`  Card ${index}: ${cardData.rank} of ${cardData.suit} - faceUp: ${cardData.faceUp}`);
          }
        });
      }
    }
    
    // Check landlord cards
    const gameState = this.getGameState();
    if (gameState && gameState.landlordCards.length > 0) {
      console.log('\nLandlord cards:');
      gameState.landlordCards.forEach((cardEntity, index) => {
        const cardData = this.components.get(cardEntity, CardData);
        if (cardData) {
          console.log(`  Card ${index}: ${cardData.rank} of ${cardData.suit} - faceUp: ${cardData.faceUp}`);
        }
      });
    }
  }

  // Helper methods to emit events
  public addBidRequest(playerId: number, amount: number) {
    this.eventBus.emit('bidRequest', { playerId, amount });
  }

  public addPlayCardsRequest(playerId: number) {
    try {
      console.log(`[World] addPlayCardsRequest called for playerId: ${playerId}`);
      
      const player = this.entities.find(e => {
        try {
          const playerInfo = this.components.tryGet(e, PlayerInfo);
          return playerInfo?.id === playerId;
        } catch (error) {
          console.warn(`[World] Error checking entity ${e} for PlayerInfo:`, error);
          return false;
        }
      });
      
      if (player) {
        const selected = this.components.get(player, SelectedCards);
        console.log(`[World] Found player ${playerId}, selected cards:`, selected ? Array.from(selected.cards) : 'none');
        
        if (selected && selected.cards.size > 0) {
          console.log(`[World] Emitting playCardsRequest with ${selected.cards.size} cards`);
          this.eventBus.emit('playCardsRequest', { playerId, cards: Array.from(selected.cards) });
          selected.cards.clear(); // Clear selection after playing
        } else {
          console.warn(`[World] No cards selected for player ${playerId}`);
        }
      } else {
        console.warn(`[World] Could not find player entity for playerId ${playerId}`);
      }
    } catch (error) {
      console.error(`[World] Error in addPlayCardsRequest for playerId ${playerId}:`, error);
    }
  }

  public addPassTurnRequest(playerId: number) {
    this.eventBus.emit('passTurnRequest', { playerId });
  }

  public passTurn() {
    this.eventBus.emit('passTurnRequest', { playerId: this.components.get(this.humanPlayer, PlayerInfo).id });
  }

  public toggleCardSelection(card: number) {
    const selectedCards = this.components.get(this.humanPlayer, SelectedCards)!;
    if (selectedCards.cards.has(card)) {
        selectedCards.cards.delete(card);
    } else {
        selectedCards.cards.add(card);
    }
  }

  /**
   * Validates and cleans up game state to ensure consistency
   * This method checks for and fixes common state inconsistencies
   */
  public validateGameState(): void {
    console.log('[World] Starting game state validation...');
    
    try {
      // Get human player
      const humanPlayerInfo = this.components.get(this.humanPlayer, PlayerInfo);
      const humanHand = this.components.get(this.humanPlayer, Hand);
      const humanSelected = this.components.tryGet(this.humanPlayer, SelectedCards);
      
      console.log(`Human player ${humanPlayerInfo.id} hand size: ${humanHand.cards.length}`);
      
      if (humanSelected) {
        console.log(`Human player selected cards: ${humanSelected.cards.size}`);
        
        // Validate that selected cards are actually in hand
        const invalidSelections = new Set<Entity>();
        for (const selectedCard of humanSelected.cards) {
          if (!humanHand.cards.includes(selectedCard)) {
            invalidSelections.add(selectedCard);
            console.warn(`[World] Selected card ${selectedCard} not in hand, removing from selection`);
          }
        }
        
        // Remove invalid selections
        for (const invalidCard of invalidSelections) {
          humanSelected.cards.delete(invalidCard);
          
          // Also clear the card's individual selection state
          const cardSelected = this.components.tryGet(invalidCard, CardSelected);
          if (cardSelected) {
            cardSelected.selected = false;
          }
        }
        
        if (invalidSelections.size > 0) {
          console.log(`[World] Cleaned up ${invalidSelections.size} invalid selections`);
        }
      }
      
      // Validate card interactivity state
      let interactiveCount = 0;
      const renderSystem = this.systems.get(RenderSystem) as RenderSystem;
      if (renderSystem) {
        humanHand.cards.forEach(cardEntity => {
          const sprite = (renderSystem as any).sprites?.get(cardEntity);
          if (sprite && sprite.interactive) {
            interactiveCount++;
          }
        });
        console.log(`[World] Interactive cards: ${interactiveCount}/${humanHand.cards.length}`);
        
        if (interactiveCount < humanHand.cards.length) {
          console.warn(`[World] Not all cards are interactive! Expected ${humanHand.cards.length}, got ${interactiveCount}`);
        }
      }
      
      console.log('[World] Game state validation completed');
      
    } catch (error) {
      console.error('[World] Error during game state validation:', error);
    }
  }

  /**
   * Forces refresh of card interactivity for all human player cards
   */
  public refreshCardInteractivity(): void {
    console.log('[World] Refreshing card interactivity...');
    
    try {
      const renderSystem = this.systems.get(RenderSystem) as RenderSystem;
      const humanHand = this.components.get(this.humanPlayer, Hand);
      
      if (renderSystem && humanHand) {
        let refreshedCount = 0;
        humanHand.cards.forEach(cardEntity => {
          const sprite = (renderSystem as any).sprites?.get(cardEntity);
          if (sprite && !sprite.interactive) {
            sprite.interactive = true;
            sprite.cursor = 'pointer';
            console.log(`[World] Refreshed interactivity for card ${cardEntity}`);
            refreshedCount++;
          }
        });
        
        console.log(`[World] Refreshed ${refreshedCount} cards`);
      }
    } catch (error) {
      console.error('[World] Error refreshing card interactivity:', error);
    }
  }

  // Force card layout recalculation
  forceCardLayoutRecalculation(): void {
      console.log('[World] Forcing card layout recalculation...');
      const cardLayoutSystem = Array.from(this.systems.keys()).find(cls => cls.name === 'CardLayoutSystem');
      if (cardLayoutSystem) {
          const system = this.systems.get(cardLayoutSystem) as any;
          if (system && typeof system.forceRecalculation === 'function') {
              system.forceRecalculation();
          }
      }
  }

  // Force interactivity refresh for all cards
  forceInteractivityRefresh(): void {
      console.log('[World] Forcing interactivity refresh...');
      const renderSystem = Array.from(this.systems.keys()).find(cls => cls.name === 'RenderSystem');
      if (renderSystem) {
          const system = this.systems.get(renderSystem) as any;
          if (system && typeof system.forceInteractivityRefresh === 'function') {
              system.forceInteractivityRefresh();
          }
      }
  }

  // Comprehensive fix for spacing and interactivity issues
  fixCardLayoutAndInteractivity(): void {
      console.log('[World] Applying comprehensive card layout and interactivity fix...');
      
      // First fix the layout
      this.forceCardLayoutRecalculation();
      
      // Then fix interactivity
      this.forceInteractivityRefresh();
      
      // Validate the results
      this.validateCardLayout();
      
      console.log('[World] Card layout and interactivity fix complete');
  }

  // Validate card layout for overlaps and spacing
  validateCardLayout(): void {
      const humanPlayer = Array.from(this.entities.with(PlayerInfo)).find(e => {
          const player = this.components.get(e, PlayerInfo) as PlayerInfo;
          return player.id === 0;
      });
      
      if (!humanPlayer) return;
      
      const hand = this.components.get(humanPlayer, Hand) as Hand;
      if (!hand || !hand.cards.length) return;
      
      let overlaps = 0;
      let unclickableCards = 0;
      
      const renderSystem = Array.from(this.systems.keys()).find(cls => cls.name === 'RenderSystem');
      const renderSystemInstance = renderSystem ? this.systems.get(renderSystem) : null;
      
      hand.cards.forEach((cardEntity: Entity, index: number) => {
          const transform = this.components.get(cardEntity, Transform) as Transform;
          if (!transform) return;
          
          // Check for overlaps with next card
          if (index < hand.cards.length - 1) {
              const nextTransform = this.components.get(hand.cards[index + 1], Transform) as Transform;
              if (nextTransform) {
                  const distance = nextTransform.x - transform.x;
                  const minRequired = 80; // Minimum spacing for card width + gap
                  if (distance < minRequired) {
                      overlaps++;
                  }
              }
          }
          
          // Check interactivity
          if (renderSystemInstance && (renderSystemInstance as any).sprites) {
              const sprite = (renderSystemInstance as any).sprites.get(cardEntity);
              if (sprite && !sprite.interactive) {
                  unclickableCards++;
              }
          }
      });
      
      console.log(`[Validation] ${hand.cards.length} cards: ${overlaps} overlaps, ${unclickableCards} unclickable`);
      
      if (overlaps > 0 || unclickableCards > 0) {
          console.warn('[Validation] Issues detected, applying fixes...');
          setTimeout(() => this.fixCardLayoutAndInteractivity(), 100);
      }
  }
}
