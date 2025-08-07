import { System } from './System';
import { GameState, GamePhase, PlayerInfo, Hand, CardData, Role } from '../components';
import { EventName } from '../EventBus';
import { CardCombinationAnalyzer, CardCombination, CombinationType } from './CardCombinationAnalyzer';
import { StrategicPlayManager, StrategicRecommendation, CombinationStrength } from './StrategicPlayManager';

/**
 * System that controls AI player behavior
 */
export class AISystem extends System {
  private aiThinkingTime: number = 1000; // milliseconds
  private lastThinkTime: number = 0;
  private isThinking: boolean = false;
  private lastInvalidPlay: Map<number, { cards: string; attempts: number }> = new Map();
  
  constructor(world: any) {
    super(world);
    
    // Listen for invalid play events to prevent infinite loops
    this.world.eventBus.on('invalidPlay', this.handleInvalidPlay.bind(this));
  }

  /**
   * Handle invalid play events to track repeated failures
   */
  private handleInvalidPlay(event: { playerId: number; reason: string; cards?: number[] }): void {
    const { playerId, reason, cards } = event;
    
    // Only track AI players
    const playerEntity = this.findCurrentPlayerEntity(playerId);
    const playerInfo = playerEntity ? this.world.components.tryGet(playerEntity, PlayerInfo) : null;
    if (!playerInfo?.isAI) return;
    
    const cardsString = cards ? cards.join(',') : '';
    const existing = this.lastInvalidPlay.get(playerId);
    
    if (existing && existing.cards === cardsString) {
      // Same cards attempted again
      existing.attempts++;
      console.log(`[AISystem] AI Player ${playerId} repeated invalid play attempt ${existing.attempts}: ${reason}`);
    } else {
      // New invalid play
      this.lastInvalidPlay.set(playerId, { cards: cardsString, attempts: 1 });
      console.log(`[AISystem] AI Player ${playerId} invalid play attempt 1: ${reason}`);
    }
  }

  /**
   * Updates the AI system
   * @param delta Time since last update in milliseconds
   */
  update(delta: number): void {
    const gameState = this.world.getGameState();
    if (!gameState || gameState.phase === GamePhase.Finished) return;
    if (this.isThinking) return; // Already processing an AI decision

    // Find the current player entity
    const currentPlayerEntity = this.findCurrentPlayerEntity(gameState.currentPlayerId);
    if (!currentPlayerEntity) return;

    // Check if it's an AI's turn
    const currentPlayerInfo = this.world.components.get(currentPlayerEntity, PlayerInfo);
    if (!currentPlayerInfo || !currentPlayerInfo.isAI) return;

    // Debug: Log AI thinking process
    if (this.lastThinkTime === 0) {
      console.log(`[AISystem] AI Player ${currentPlayerInfo.id} (${currentPlayerInfo.name}) is thinking... Phase: ${gameState.phase}`);
    }

    // Accumulate thinking time
    this.lastThinkTime += delta;
    if (this.lastThinkTime < this.aiThinkingTime) return;

    // Reset thinking time and mark as thinking
    this.lastThinkTime = 0;
    this.isThinking = true;

    // Process AI decision after a delay
    setTimeout(() => {
      try {
        const currentGameState = this.world.getGameState();
        if (!currentGameState) return;

        if (currentGameState.phase === GamePhase.Bidding) {
          this.handleAIBidding(currentPlayerInfo.id, currentPlayerEntity);
        } else if (currentGameState.phase === GamePhase.Playing) {
          this.handleAIPlaying(currentPlayerInfo.id, currentPlayerEntity, currentGameState);
        }
      } catch (error) {
        console.error('[AISystem] Error during AI processing:', error);
      } finally {
        this.isThinking = false;
      }
    }, 500); // Reduced delay for better responsiveness
  }

  /**
   * Finds the entity for a player by ID
   * @param playerId The player ID to find
   * @returns The player entity or undefined if not found
   */
  private findCurrentPlayerEntity(playerId: number): number | undefined {
    return this.world.entities.find((entity, getComponent) => {
      const playerInfo = getComponent?.(PlayerInfo);
      return playerInfo?.id === playerId;
    }, this.world.components);
  }

  /**
   * Handles AI bidding decisions
   * @param playerId The AI player ID
   * @param playerEntity The AI player entity
   */
  private handleAIBidding(playerId: number, playerEntity: number): void {
    const gameState = this.world.getGameState();
    if (!gameState) return;

    // Simple AI bidding strategy
    const hand = this.world.components.get(playerEntity, Hand);
    if (!hand) return;

    // Count high value cards to determine bid
    let highValueCards = 0;
    for (const cardEntity of hand.cards) {
      const cardData = this.world.components.get(cardEntity, CardData);
      if (cardData && cardData.value >= 11) { // Face cards and aces
        highValueCards++;
      }
    }

    // Determine bid based on hand strength
    let bidAmount = 0;
    if (highValueCards >= 5) {
      bidAmount = Math.min(3, gameState.currentBid + 1);
    } else if (highValueCards >= 3 && Math.random() > 0.5) {
      bidAmount = Math.min(2, gameState.currentBid + 1);
    } else if (highValueCards >= 2 && Math.random() > 0.7) {
      bidAmount = Math.min(1, gameState.currentBid + 1);
    }

    // Only bid if it's higher than current bid
    if (bidAmount > gameState.currentBid) {
      this.world.eventBus.emit(EventName.BidRequest, { playerId, amount: bidAmount });
    } else {
      // Pass
      this.world.eventBus.emit(EventName.BidRequest, { playerId, amount: 0 });
    }
  }

  /**
   * Handles AI playing decisions
   * @param playerId The AI player ID
   * @param playerEntity The AI player entity
   * @param gameState The current game state
   */
  private handleAIPlaying(playerId: number, playerEntity: number, gameState: GameState): void {
    const hand = this.world.components.get(playerEntity, Hand);
    if (!hand || hand.cards.length === 0) return;

    console.log(`[AISystem] AI Player ${playerId} analyzing ${hand.cards.length} cards...`);

    // Debug: Show hand details
    const handDetails = hand.cards.map(cardEntity => {
      const cardData = this.world.components.get(cardEntity, CardData);
      return cardData ? `${cardData.rank}${cardData.suit}(${cardData.value})` : 'Unknown';
    }).join(', ');
    console.log(`[AISystem] AI Player ${playerId} hand: ${handDetails}`);

    // Use the advanced card combination analyzer
    const allCombinations = CardCombinationAnalyzer.analyzeCards(hand.cards, this.world);
    
    console.log(`[AISystem] AI Player ${playerId} found ${allCombinations.length} total combinations`);
    
    if (allCombinations.length === 0) {
      console.log(`[AISystem] AI Player ${playerId} has no valid combinations, passing`);
      this.world.eventBus.emit(EventName.PassTurnRequest, { playerId });
      return;
    }

    // Debug: Show first 5 combinations
    console.log(`[AISystem] AI Player ${playerId} top combinations:`);
    allCombinations.slice(0, 5).forEach((combo, index) => {
      const cardNames = combo.cards.map((c: { rank: string; suit: string }) => `${c.rank}${c.suit}`).join(',');
      console.log(`  ${index + 1}. ${combo.description} (power:${combo.power}) [${cardNames}]`);
    });

    let playableCombinations = allCombinations;

    // If someone has played before, filter combinations that can beat the last play
    if (gameState.lastPlay && gameState.lastPlay.length > 0 && gameState.lastPlayOwnerId !== playerId) {
      console.log(`[AISystem] AI Player ${playerId} analyzing last play: ${gameState.lastPlay.length} cards from player ${gameState.lastPlayOwnerId}`);
      
      const lastPlayCombination = this.analyzeLastPlay(gameState.lastPlay);
      console.log(`[AISystem] Last play analyzed as:`, lastPlayCombination ? `${lastPlayCombination.type} (power: ${lastPlayCombination.power})` : 'null');
      
      if (lastPlayCombination) {
        console.log(`[AISystem] Filtering ${allCombinations.length} combinations to find ones that can beat ${lastPlayCombination.type}`);
        
        playableCombinations = allCombinations.filter(combo => {
          const canBeat = CardCombinationAnalyzer.canBeat(combo, lastPlayCombination);
          if (combo.type === CombinationType.Rocket || combo.type === CombinationType.Bomb) {
            console.log(`[AISystem] ${combo.description} vs ${lastPlayCombination.type}: ${canBeat ? 'CAN BEAT' : 'CANNOT BEAT'}`);
          }
          return canBeat;
        });
        
        console.log(`[AISystem] After filtering: ${playableCombinations.length} playable combinations remain`);
        
        if (playableCombinations.length === 0) {
          console.log(`[AISystem] AI Player ${playerId} cannot beat last play (${lastPlayCombination.type}), passing`);
          this.world.eventBus.emit(EventName.PassTurnRequest, { playerId });
          return;
        }
      }
    }

    console.log(`[AISystem] AI Player ${playerId} has ${playableCombinations.length} playable combinations`);

    // Safety check: prevent infinite loops by forcing pass if AI keeps trying the same invalid move
    const lastInvalid = this.lastInvalidPlay.get(playerId);
    if (lastInvalid && lastInvalid.attempts >= 3) {
      console.log(`[AISystem] AI Player ${playerId} has made ${lastInvalid.attempts} invalid attempts, forcing pass to break loop`);
      this.lastInvalidPlay.delete(playerId);
      this.world.eventBus.emit(EventName.PassTurnRequest, { playerId });
      return;
    }

    // Choose the best combination using AI strategy
    const chosenCombination = this.chooseAICombination(playableCombinations, gameState, playerId);
    
    if (chosenCombination) {
      const cardEntities = chosenCombination.cards.map((c: { entity: number }) => c.entity);
      console.log(`[AISystem] AI Player ${playerId} CHOSEN: ${chosenCombination.description} (power:${chosenCombination.power})`);
      console.log(`[AISystem] Cards:`, chosenCombination.cards.map((c: { rank: string; suit: string }) => `${c.rank}${c.suit}`));
      
      // Clear any invalid play tracking for this player since we're attempting a valid play
      this.lastInvalidPlay.delete(playerId);
      
      this.world.eventBus.emit(EventName.PlayCardsRequest, { 
        playerId, 
        cards: cardEntities
      });
    } else {
      console.log(`[AISystem] AI Player ${playerId} no suitable play found, passing`);
      // Clear invalid play tracking when passing
      this.lastInvalidPlay.delete(playerId);
      this.world.eventBus.emit(EventName.PassTurnRequest, { playerId });
    }
  }

  /**
   * Analyze the last play to determine what type of combination was played
   */
  private analyzeLastPlay(lastPlayCards: number[]): CardCombination | null {
    if (!lastPlayCards || lastPlayCards.length === 0) return null;
    
    try {
      console.log(`[AISystem] Analyzing last play cards:`, lastPlayCards);
      
      // Get card data for the played cards
      const playedCardData = lastPlayCards.map(entity => {
        const cardData = this.world.components.get(entity, CardData);
        return cardData ? { entity, rank: cardData.rank, suit: cardData.suit, value: cardData.value } : null;
      }).filter(Boolean);
      
      console.log(`[AISystem] Last play card data:`, playedCardData.map(c => `${c?.rank}${c?.suit}`));
      
      const combinations = CardCombinationAnalyzer.analyzeCards(lastPlayCards, this.world);
      console.log(`[AISystem] Found ${combinations.length} possible combinations for last play`);
      
      if (combinations.length > 0) {
        // Log all possible combinations
        combinations.forEach((combo, index) => {
          console.log(`[AISystem] Combination ${index + 1}: ${combo.type} (${combo.description}) power: ${combo.power}`);
        });
        
        // Select the best combination based on card count and priority
        // For multi-card plays, prefer complex combinations over simple ones
        let bestCombination = combinations[0];
        
        if (lastPlayCards.length > 1) {
          // For multi-card combinations, prefer the one that uses the most cards
          // and has the highest complexity (e.g., triple_pair > triple_single > triple > pair > single)
                     const complexityOrder: Record<string, number> = {
             [CombinationType.Rocket]: 1000,
             [CombinationType.Bomb]: 900,
             [CombinationType.PlanePair]: 800,
             [CombinationType.PlaneSingle]: 700,
             [CombinationType.FourPair]: 600,
             [CombinationType.FourSingle]: 500,
             [CombinationType.TriplePair]: 400,
             [CombinationType.TripleSingle]: 300,
             [CombinationType.StraightPair]: 200,
             [CombinationType.Straight]: 100,
             [CombinationType.Plane]: 80,
             [CombinationType.Triple]: 70,
             [CombinationType.Pair]: 60,
             [CombinationType.Single]: 10
           };
           
           bestCombination = combinations.reduce((best, current) => {
             const bestComplexity = complexityOrder[best.type as string] || 0;
             const currentComplexity = complexityOrder[current.type as string] || 0;
            
            // Prefer higher complexity first, then higher power
            if (currentComplexity > bestComplexity) {
              return current;
            } else if (currentComplexity === bestComplexity && current.power > best.power) {
              return current;
            }
            return best;
          });
        }
        
        console.log(`[AISystem] Selected combination: ${bestCombination.type} (${bestCombination.description})`);
        return bestCombination;
      }
      
      console.log(`[AISystem] No valid combinations found for last play`);
      return null;
    } catch (error) {
      console.warn('[AISystem] Error analyzing last play:', error);
      return null;
    }
  }

  /**
   * Choose the best combination for AI using advanced strategic logic
   * Uses StrategicPlayManager for consistent greedy algorithm approach
   */
  private chooseAICombination(combinations: CardCombination[], gameState: GameState, playerId: number): CardCombination | null {
    if (combinations.length === 0) return null;
    
    const playerEntity = this.findCurrentPlayerEntity(playerId);
    const hand = playerEntity ? this.world.components.get(playerEntity, Hand) : null;
    const remainingCards = hand ? hand.cards.length : 0;
    const allHandCards = hand ? hand.cards : [];
    
    console.log(`[AISystem] AI Player ${playerId} choosing from ${combinations.length} combinations, ${remainingCards} cards remaining`);
    
    // Analyze all possible combinations from AI's hand for strategic context
    const allPossibleCombinations = CardCombinationAnalyzer.analyzeCards(allHandCards, this.world);
    
    // Debug: Log all possible combinations
    console.log(`[AISystem] AI Player ${playerId} has ${allPossibleCombinations.length} total combinations:`);
    allPossibleCombinations.forEach((combo, index) => {
      if (index < 10) { // Show first 10 combinations
        console.log(`  ${index + 1}. ${combo.type}: ${combo.description} (power: ${combo.power})`);
      }
    });
    
    console.log(`[AISystem] AI Player ${playerId} can play ${combinations.length} valid combinations:`);
    combinations.forEach((combo, index) => {
      console.log(`  ${index + 1}. ${combo.type}: ${combo.description} (power: ${combo.power})`);
    });
    
    // Determine AI aggressiveness based on game situation
    const isOffensive = this.shouldAIPlayOffensively(gameState, playerId, remainingCards);
    
    // Use StrategicPlayManager for consistent decision making
    const strategicRecommendation = StrategicPlayManager.generateStrategicRecommendation(
      allPossibleCombinations,
      combinations,
      remainingCards,
      isOffensive
    );
    
    if (strategicRecommendation) {
      const { combination, strength, reason, preservedCombinations } = strategicRecommendation;
      
      console.log(`[AISystem] AI Player ${playerId} strategic choice: ${combination.description}`);
      console.log(`[AISystem] Combination strength: ${CombinationStrength[strength]}`);
      console.log(`[AISystem] Strategy reason: ${reason}`);
      console.log(`[AISystem] Preserved strong combinations: ${preservedCombinations.length}`);
      
      // Additional AI-specific validation to prevent repeated invalid plays
      if (this.validateAIChoice(combination, playerId)) {
        return combination;
      } else {
        console.log(`[AISystem] Strategic choice failed validation, falling back to simple strategy`);
        return this.fallbackAIChoice(combinations, remainingCards);
      }
    } else {
      console.log(`[AISystem] No strategic recommendation available, using fallback strategy`);
      return this.fallbackAIChoice(combinations, remainingCards);
    }
  }

  /**
   * Determine if AI should adopt an offensive playing strategy
   */
  private shouldAIPlayOffensively(gameState: GameState, playerId: number, remainingCards: number): boolean {
    // End game: be aggressive when few cards left
    if (remainingCards <= 5) {
      return true;
    }
    
    // Check if AI is the landlord
    const playerEntity = this.findCurrentPlayerEntity(playerId);
    const playerInfo = playerEntity ? this.world.components.get(playerEntity, PlayerInfo) : null;
    const isLandlord = playerInfo?.role === Role.Landlord;
    
    // Landlord should be more aggressive in mid-game
    if (isLandlord && remainingCards <= 10) {
      return true;
    }
    
    // Peasants should be aggressive when close to winning
    if (!isLandlord && remainingCards <= 8) {
      return true;
    }
    
    // Check game pressure (TODO: could analyze other players' hand sizes)
    // For now, use simple heuristic
    return remainingCards <= 6;
  }

  /**
   * Validate AI choice to prevent repeated invalid plays
   */
  private validateAIChoice(combination: CardCombination, playerId: number): boolean {
    const cardsString = combination.cards.map(c => c.entity).join(',');
    const existing = this.lastInvalidPlay.get(playerId);
    
    // If this exact combination failed before, reject it
    if (existing && existing.cards === cardsString && existing.attempts >= 2) {
      console.log(`[AISystem] Rejecting previously failed combination for AI Player ${playerId}`);
      return false;
    }
    
    return true;
  }

  /**
   * Fallback AI choice when strategic recommendation fails
   */
  private fallbackAIChoice(combinations: CardCombination[], remainingCards: number): CardCombination | null {
    if (combinations.length === 0) return null;
    
    // Simple fallback strategy: prefer smaller, safer plays
    const sortedCombinations = [...combinations].sort((a, b) => {
      // 1. Prefer combinations that use fewer cards (safer)
      if (a.cards.length !== b.cards.length) {
        return a.cards.length - b.cards.length;
      }
      
      // 2. Prefer lower power (smaller cards)
      if (a.power !== b.power) {
        return a.power - b.power;
      }
      
      // 3. Prefer simpler types
      const typeOrder = {
        [CombinationType.Single]: 1,
        [CombinationType.Pair]: 2,
        [CombinationType.Triple]: 3,
        [CombinationType.Straight]: 4,
        [CombinationType.TripleSingle]: 5,
        [CombinationType.TriplePair]: 6,
        [CombinationType.StraightPair]: 7,
        [CombinationType.Plane]: 8,
        [CombinationType.PlaneSingle]: 9,
        [CombinationType.PlanePair]: 10,
        [CombinationType.FourSingle]: 11,
        [CombinationType.FourPair]: 12,
        [CombinationType.Bomb]: 13,
        [CombinationType.Rocket]: 14,
        [CombinationType.Invalid]: 99
      };
      
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
    
    const fallback = sortedCombinations[0];
    console.log(`[AISystem] Fallback choice: ${fallback.description} (power: ${fallback.power})`);
    return fallback;
  }

  /**
   * Calculate strategic value for different combination types
   * Higher value = higher priority
   */
  private getTypeStrategicValue(type: CombinationType, remainingCards: number): number {
    // Early game (many cards): prefer efficient combinations that clear multiple cards
    if (remainingCards > 10) {
      const earlyGameValues: Record<CombinationType, number> = {
        [CombinationType.TriplePair]: 0.9,     // 3带2 - excellent for clearing 5 cards
        [CombinationType.PlanePair]: 0.95,     // 飞机带对 - great for clearing many cards
        [CombinationType.PlaneSingle]: 0.85,   // 飞机带单 - good efficiency
        [CombinationType.FourSingle]: 0.8,     // 四带二单 - clears 6 cards
        [CombinationType.FourPair]: 0.9,       // 四带二对 - clears 8 cards
        [CombinationType.StraightPair]: 0.75,  // 连对 - decent efficiency
        [CombinationType.Straight]: 0.7,       // 顺子 - good for clearing
        [CombinationType.TripleSingle]: 0.6,   // 三带一 - moderate efficiency
        [CombinationType.Plane]: 0.5,          // 纯飞机 - less efficient alone
        [CombinationType.Triple]: 0.4,         // 三张 - low efficiency
        [CombinationType.Pair]: 0.2,           // 对子 - poor efficiency
        [CombinationType.Single]: 0.1,         // 单张 - worst efficiency
        [CombinationType.Bomb]: 0.3,           // 炸弹 - save for later
        [CombinationType.Rocket]: 0.2,         // 火箭 - save for endgame
        [CombinationType.Invalid]: 0,          // Invalid combinations
      };
      return earlyGameValues[type];
    }
    
    // Mid game (6-10 cards): balance between efficiency and flexibility
    else if (remainingCards > 5) {
      const midGameValues: Record<CombinationType, number> = {
        [CombinationType.TriplePair]: 0.8,     // Still good for clearing
        [CombinationType.TripleSingle]: 0.7,   // More flexible
        [CombinationType.PlanePair]: 0.85,     // Good if available
        [CombinationType.FourSingle]: 0.75,    
        [CombinationType.FourPair]: 0.8,       
        [CombinationType.Straight]: 0.6,       
        [CombinationType.StraightPair]: 0.65,  
        [CombinationType.Plane]: 0.4,          
        [CombinationType.PlaneSingle]: 0.7,    
        [CombinationType.Triple]: 0.5,         
        [CombinationType.Pair]: 0.4,           
        [CombinationType.Single]: 0.3,         
        [CombinationType.Bomb]: 0.5,           // More valuable now
        [CombinationType.Rocket]: 0.4,         
        [CombinationType.Invalid]: 0,
      };
      return midGameValues[type];
    }
    
    // End game (≤5 cards): prioritize finishing combinations
    else {
      const endGameValues: Record<CombinationType, number> = {
        [CombinationType.Bomb]: 0.95,          // Use bombs to finish
        [CombinationType.Rocket]: 0.99,        // Use rocket to win
        [CombinationType.TriplePair]: 0.9,     // Great finisher
        [CombinationType.FourSingle]: 0.85,    
        [CombinationType.FourPair]: 0.87,      
        [CombinationType.PlanePair]: 0.8,      
        [CombinationType.PlaneSingle]: 0.75,   
        [CombinationType.TripleSingle]: 0.7,   
        [CombinationType.Straight]: 0.6,       
        [CombinationType.StraightPair]: 0.65,  
        [CombinationType.Plane]: 0.5,          
        [CombinationType.Triple]: 0.5,         
        [CombinationType.Pair]: 0.4,           
        [CombinationType.Single]: 0.3,         
        [CombinationType.Invalid]: 0,
      };
      return endGameValues[type];
    }
  }

  /**
   * Calculate efficiency: how well this combination uses cards relative to hand size
   */
  private calculateEfficiency(combination: CardCombination, remainingCards: number): number {
    const cardsUsed = combination.cards.length;
    const baseEfficiency = cardsUsed / Math.max(remainingCards, 1);
    
    // Bonus for complex combinations that clear problematic cards
    const complexityBonus: Record<CombinationType, number> = {
      [CombinationType.TriplePair]: 0.3,      // Helps clear triples + pairs
      [CombinationType.PlanePair]: 0.4,       // Clears multiple triples + pairs
      [CombinationType.FourPair]: 0.35,       // Clears four + pairs
      [CombinationType.TripleSingle]: 0.2,    // Moderate bonus
      [CombinationType.FourSingle]: 0.25,     // Good for clearing singles
      [CombinationType.PlaneSingle]: 0.25,    // Good efficiency
      [CombinationType.StraightPair]: 0.15,   // Decent bonus
      [CombinationType.Straight]: 0.1,        // Small bonus
      [CombinationType.Plane]: 0.15,          // Moderate bonus
      [CombinationType.Triple]: 0.05,         // Small bonus
      [CombinationType.Pair]: 0,              // No bonus
      [CombinationType.Single]: 0,            // No bonus
      [CombinationType.Bomb]: 0.1,            // Small bonus
      [CombinationType.Rocket]: 0.2,          // Moderate bonus
      [CombinationType.Invalid]: 0,           // No bonus
    };
    
    return baseEfficiency + complexityBonus[combination.type];
  }

  /**
   * Finds the lowest value card in a hand
   * @param cards Array of card entities
   * @returns The lowest card entity or undefined if none found
   */
  private findLowestCard(cards: number[]): number | undefined {
    let lowestCard: number | undefined;
    let lowestValue = Infinity;

    for (const card of cards) {
      const cardData = this.world.components.get(card, CardData);
      if (cardData && cardData.value < lowestValue) {
        lowestValue = cardData.value;
        lowestCard = card;
      }
    }

    return lowestCard;
  }
}
