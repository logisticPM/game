import { System } from './System';
import { Hand, PlayerInfo, Transform, LandlordCardComponent, CardData, GameState, GamePhase } from '../components';
import { dataManager, PlayerLayout } from '../../game/DataManager';
import { Entity } from '../types';

export class CardLayoutSystem extends System {
  private layoutCalculated = false;
  private lastPlayerCardCounts: Map<number, number> = new Map();
  private lastGamePhase: GamePhase | null = null;
  private lastLayoutInfo: any = null; // Store layout verification info

  constructor(world: any) {
    super(world);
    
    // Listen for game state changes that require layout recalculation
    this.world.eventBus.on('gameStateChanged', this.onGameStateChanged.bind(this));
  }

  /**
   * Forces a layout recalculation on the next update
   */
  public forceRecalculation(): void {
    this.layoutCalculated = false;
    this.lastPlayerCardCounts.clear();
    console.log('[CardLayoutSystem] Forced layout recalculation requested');
  }

  /**
   * Smart layout recalculation based on game state changes
   */
  onGameStateChanged() {
    const gameState = this.world.getGameState();
    if (!gameState) return;

    const needsRecalculation = this.shouldRecalculateLayout(gameState);
    
    if (needsRecalculation) {
      this.layoutCalculated = false;
      this.lastPlayerCardCounts.clear();
      console.log(`[CardLayoutSystem] Layout recalculation triggered: phase changed to ${gameState.phase}`);
    } else {
      console.log(`[CardLayoutSystem] Skipping layout recalculation during ${gameState.phase} phase`);
    }
    
    // Handle transition to Playing phase - landlord cards are now part of hand
    if (gameState.phase === GamePhase.Playing && this.lastGamePhase === GamePhase.Bidding) {
      console.log(`[CardLayoutSystem] Detected transition to Playing phase, landlord cards integrated into hand`);
    }
    
    this.lastGamePhase = gameState.phase;
  }

  /**
   * Determines if layout recalculation is needed based on game state changes
   */
  private shouldRecalculateLayout(gameState: GameState): boolean {
    // Always recalculate if this is the first calculation
    if (!this.layoutCalculated) return true;
    
    // Recalculate when transitioning from Bidding to Playing (landlord cards need repositioning)
    if (this.lastGamePhase === GamePhase.Bidding && gameState.phase === GamePhase.Playing) {
      return true;
    }
    
    // Recalculate when transitioning to Finished phase (game end state)
    if (gameState.phase === GamePhase.Finished) {
      return true;
    }
    
    // Allow recalculation during bidding phase for initial layout and config changes
    // Skip only if layout was already calculated and no other changes occurred
    if (gameState.phase === GamePhase.Bidding && this.layoutCalculated) {
      return false;
    }
    
    // For other cases, defer to card count changes (handled in update method)
    return false;
  }

  /**
   * Sort cards by value from high to low for proper display
   */
  private sortCardsByValue(cards: Entity[]): Entity[] {
    return [...cards].sort((a, b) => {
      const cardA = this.world.components.get(a, CardData) as CardData;
      const cardB = this.world.components.get(b, CardData) as CardData;
      
      if (!cardA || !cardB) return 0;
      
      // Sort by value (high to low), then by suit for consistency
      if (cardA.value !== cardB.value) {
        return cardB.value - cardA.value; // High to low
      }
      
      // If same value, sort by suit (spades > hearts > diamonds > clubs)
      const suitOrder: Record<string, number> = { 'spades': 4, 'hearts': 3, 'diamonds': 2, 'clubs': 1, 'joker': 5 };
      return (suitOrder[cardB.suit] || 0) - (suitOrder[cardA.suit] || 0);
    });
  }

  private calculateConsistentSpacing(cardCount: number, playerId: number = 0): number {
    if (cardCount <= 1) return 0;
    
    const screenWidth = 1280;
    const usableWidth = screenWidth * 0.85; // Use 85% of screen width to avoid overflow
    
    // Fixed spacing for consistency - adjusted for larger cards
    const FIXED_CARD_SPACING = 35; // 35px between card centers for larger cards
    
    // Calculate total width needed
    const totalWidth = (cardCount - 1) * FIXED_CARD_SPACING;
    
    // If total width exceeds screen bounds, use adaptive spacing as fallback
    const finalSpacing = totalWidth > usableWidth ? 
      Math.floor(usableWidth / (cardCount - 1)) : 
      FIXED_CARD_SPACING;
    
    // Get layout configuration for minimum spacing validation
    const layoutData = dataManager.getGameData().layout;
    const layoutConfig = layoutData.players.find((p: PlayerLayout) => p.id === playerId);
    
    // Calculate minimum spacing needed to prevent card overlap
    const baseCardWidth = 100; // Base card width
    const actualCardWidth = baseCardWidth * (layoutConfig?.scale || 0.25);
    const minGapBetweenCards = 8; // Minimum gap between card edges
    const minCenterToCenter = actualCardWidth + minGapBetweenCards;
    
    // Use the larger of consistent or minimum spacing
    const validatedSpacing = Math.max(finalSpacing, minCenterToCenter);
    
    console.log(`[CardLayout] Consistent spacing for ${cardCount} cards: ${validatedSpacing}px (fixed: ${FIXED_CARD_SPACING}px, min: ${minCenterToCenter.toFixed(1)}px)`);
    
    return validatedSpacing;
  }

  update(delta: number): void {
    const layoutData = dataManager.getGameData().layout;
    const playerEntities = this.world.entities.with(PlayerInfo, Hand);

    // Check if we need to recalculate layout
    let needsRecalculation = !this.layoutCalculated;
    
    if (!needsRecalculation) {
      // Check if any player's card count has changed
      for (const playerEntity of playerEntities) {
        const playerHand = this.world.components.get(playerEntity, Hand)!;
        const playerInfo = this.world.components.get(playerEntity, PlayerInfo)!;
        
        const currentCount = playerHand.cards?.length || 0;
        const lastCount = this.lastPlayerCardCounts.get(playerInfo.id) || 0;
        
        if (currentCount !== lastCount) {
          needsRecalculation = true;
          console.log(`[CardLayoutSystem] Player ${playerInfo.id} card count changed: ${lastCount} -> ${currentCount}`);
          break;
        }
      }
    }

    if (!needsRecalculation) {
      return; // Skip layout calculation if nothing has changed
    }

    console.log('[CardLayoutSystem] Recalculating layout...');

    for (const playerEntity of playerEntities) {
      const playerHand = this.world.components.get(playerEntity, Hand)!;
      const playerInfo = this.world.components.get(playerEntity, PlayerInfo)!;

      // Update card count tracking
      this.lastPlayerCardCounts.set(playerInfo.id, playerHand.cards?.length || 0);

      // Skip AI players - only layout human player cards (id === 0)
      if (playerInfo.isAI) {
        console.log(`[CardLayoutSystem] Skipping AI player ${playerInfo.id} card layout.`);
        continue;
      }

      if (!playerHand.cards || playerHand.cards.length === 0) {
        console.log(`[CardLayoutSystem] Player ${playerInfo.id} has no cards, skipping.`);
        continue;
      }

      const layoutConfig = layoutData.players.find((p: PlayerLayout) => p.id === playerInfo.id);
      if (!layoutConfig) continue;

      // In playing phase, include landlord cards in hand layout
      // In bidding phase, exclude landlord cards from regular hand layout
      const gameState = this.world.getGameState();
      const isPlayingPhase = gameState && gameState.phase === GamePhase.Playing;
      
      const handCards = isPlayingPhase 
        ? playerHand.cards // Include all cards during playing phase
        : playerHand.cards.filter(card => !this.world.components.has(card, LandlordCardComponent));
      
      const landlordCards = playerHand.cards.filter(card => this.world.components.has(card, LandlordCardComponent));
      
      console.log(`[CardLayoutSystem] Player ${playerInfo.id}: ${handCards.length} hand cards, ${landlordCards.length} landlord cards. Phase: ${gameState?.phase}`);
      
      // Different layout for different players
      if (playerInfo.id === 0) {
        // Human player: horizontal linear layout at bottom with consistent spacing
        
        // Sort cards by value (high to low) for proper display order
        const sortedCards = this.sortCardsByValue(handCards);
        
        // Fixed spacing calculation for consistent gaps regardless of card count
        const cardCount = sortedCards.length;
        const screenWidth = 1280; // Game world width
        
        // Use fixed spacing for consistency - adjusted for larger cards
        const FIXED_CARD_SPACING = 35; // 35px between card centers for larger cards
        
        // Calculate total width needed for the cards
        const totalWidth = cardCount > 1 ? (cardCount - 1) * FIXED_CARD_SPACING : 0;
        
        // If total width exceeds screen bounds, use adaptive spacing as fallback
        const usableWidth = screenWidth * 0.85;
        const finalSpacing = totalWidth > usableWidth ? 
          Math.floor(usableWidth / Math.max(cardCount - 1, 1)) : 
          FIXED_CARD_SPACING;
        
        // Force true centering - always use screen center regardless of config
        const trueCenterX = screenWidth / 2; // 640px
        const actualTotalWidth = cardCount > 1 ? (cardCount - 1) * finalSpacing : 0;
        const startX = trueCenterX - actualTotalWidth / 2; // Perfect centering
        
        // Position cards further down to avoid bidding panel overlap and closer to avatar
        const cardY = 660; // move lower
        
        console.log(`[CardLayoutSystem] Human player CONSISTENT layout:`);
        console.log(`  - Cards: ${cardCount}, spacing: ${finalSpacing}px (fixed: ${FIXED_CARD_SPACING}px)`);
        console.log(`  - Total width: ${actualTotalWidth}px (usable: ${usableWidth}px)`);
        console.log(`  - Position: startX=${startX.toFixed(1)}, endX=${(startX + actualTotalWidth).toFixed(1)}, y=${cardY}`);
        console.log(`  - Center: ${trueCenterX}, Hand center: ${(startX + actualTotalWidth / 2).toFixed(1)}`);
        
        // Apply positions in sequential order with fan effect
        sortedCards.forEach((cardEntity, index) => {
          const transform = this.world.components.get(cardEntity, Transform);
          const cardData = this.world.components.get(cardEntity, CardData) as CardData;
          if (transform) {
            // Sequential positioning for perfect alignment
            transform.x = startX + index * finalSpacing;
            transform.y = cardY; // Position above player info
            
            // No rotation - keep cards parallel
            transform.rotation = 0;
            
            // Keep cards at same Y level - no vertical offset
            transform.y = cardY;
            
            // Consistent scale and layering
            transform.scaleX = layoutConfig.scale;
            transform.scaleY = layoutConfig.scale;
            transform.zIndex = index + 10; // Sequential z-index
            
            // Log first few cards for verification
            if (index < 5) {
              console.log(`    Card ${index} (${cardData?.rank}${cardData?.suit}): x=${transform.x.toFixed(1)}, y=${transform.y}`);
            }
          }
        });
        
        // Store layout verification info
        this.lastLayoutInfo = {
          cardCount: sortedCards.length,
          spacing: finalSpacing,
          totalWidth: actualTotalWidth,
          startX: startX,
          endX: startX + actualTotalWidth,
          centerX: trueCenterX,
          actualCenter: startX + actualTotalWidth / 2
        };
        

      } else {
        // AI players: vertical layout on sides (player 1: left, player 2: right)
        const totalHeight = (handCards.length - 1) * layoutConfig.cardSpacing;
        const startY = layoutConfig.y - totalHeight / 2;
        
        handCards.forEach((cardEntity, index) => {
          const transform = this.world.components.get(cardEntity, Transform);
          if (transform) {
            transform.x = layoutConfig.x;
            transform.y = startY + index * layoutConfig.cardSpacing;
            transform.scaleX = layoutConfig.scale;
            transform.scaleY = layoutConfig.scale;
            transform.zIndex = index;
            
            // Only log summary for AI players to avoid spam
            if (index === 0) {
              console.log(`[CardLayoutSystem] Player ${playerInfo.id} vertical layout: ${handCards.length} cards`);
            }
          }
        });
      }
    }

    // Layout landlord cards at the top (only during bidding phase)
    const gameState = this.world.getGameState();
    if (gameState && gameState.phase === GamePhase.Bidding) {
      this.layoutLandlordCards();
    }

    // Mark layout as calculated
    this.layoutCalculated = true;
    console.log('[CardLayoutSystem] Layout calculation completed');
  }

  /**
   * Layout landlord cards at the top of the screen
   */
  private layoutLandlordCards() {
    const landlordCardEntities = this.world.entities.with(LandlordCardComponent, Transform);
    
    if (landlordCardEntities.length === 0) return;

    const landlordConfig = dataManager.getGameData().layout.landlord_cards;
    const player0Config = dataManager.getGameData().layout.players.find((p: PlayerLayout) => p.id === 0);
    const handScale = player0Config?.scale ?? 0.8; // Match human hand card size
    
    let index = 0;
    for (const cardEntity of landlordCardEntities) {
      const transform = this.world.components.get(cardEntity, Transform);
      if (transform) {
        // Position landlord cards horizontally at the top
        transform.x = landlordConfig.x + (index - 1) * landlordConfig.spacing; // Center around x
        transform.y = landlordConfig.y;
        // Match hand card scale per request
        transform.scaleX = handScale;
        transform.scaleY = handScale;
        transform.zIndex = 100 + index; // High z-index to appear on top
        
        console.log(`[CardLayoutSystem] Landlord card ${index} positioned at (${transform.x}, ${transform.y}) with scale ${transform.scaleX}`);
        index++;
      }
    }
  }
}
