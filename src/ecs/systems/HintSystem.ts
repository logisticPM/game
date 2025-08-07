import { System } from './System';
import { PlayerInfo, Hand, CardData, GameState, GamePhase } from '../components';
import { CardCombinationAnalyzer, CardCombination, CombinationType } from './CardCombinationAnalyzer';
import { StrategicPlayManager, StrategicRecommendation, CombinationStrength } from './StrategicPlayManager';

export class HintSystem extends System {
  constructor(world: any) {
    super(world);
    
    // Listen for hint requests
    this.world.eventBus.on('hintRequest', this.handleHintRequest.bind(this));
  }

  /**
   * Handle hint request from player
   */
  private handleHintRequest(event: { playerId: number }) {
    const { playerId } = event;
    
    console.log(`[HintSystem] Hint requested by player ${playerId}`);
    
    // Only provide hints to human player (ID 0)
    if (playerId !== 0) {
      console.log('[HintSystem] Hints only available for human player');
      return;
    }
    
    // Check game state
    const gameState = this.world.getGameState();
    if (!gameState || gameState.phase !== GamePhase.Playing) {
      console.log('[HintSystem] Hints only available during playing phase');
      return;
    }
    
    // Only provide hints during player's turn
    if (gameState.currentPlayerId !== playerId) {
      console.log('[HintSystem] Hints only available during your turn');
      return;
    }
    
    // Find player entity
    const playerEntity = this.world.entities.find((e: number) => {
      try {
        const playerInfo = this.world.components.tryGet(e, PlayerInfo);
        return playerInfo?.id === playerId;
      } catch (error) {
        return false;
      }
    });
    
    if (!playerEntity) {
      console.log('[HintSystem] Player entity not found');
      return;
    }
    
    // Get player's hand
    const hand = this.world.components.tryGet(playerEntity, Hand);
    if (!hand || (hand.cards instanceof Set ? hand.cards.size : hand.cards.length) === 0) {
      console.log('[HintSystem] No cards in hand');
      return;
    }
    
    // Generate hint
    const cards = hand.cards instanceof Set ? Array.from(hand.cards) : hand.cards;
    this.generateHint(cards);
  }
  
  /**
   * Generate and display hint for player using strategic analysis
   */
  private generateHint(cards: number[]) {
    console.log(`[HintSystem] Analyzing ${cards.length} cards for strategic hints...`);
    
    if (cards.length === 0) {
      console.log('[HintSystem] No cards to analyze');
      return;
    }
    
    // Use the advanced card combination analyzer
    const allCombinations = CardCombinationAnalyzer.analyzeCards(cards, this.world);
    
    if (allCombinations.length === 0) {
      console.log('[HintSystem] No valid combinations found');
      this.world.eventBus.emit('hintResult', {
        playerId: 0,
        suggestion: { description: 'No valid combinations', cards: [] }
      });
      return;
    }
    
    // Analyze hand potential
    const handAnalysis = StrategicPlayManager.analyzeHandPotential(allCombinations);
    console.log(`[HintSystem] Hand potential score: ${handAnalysis.potentialScore}`);
    console.log(`[HintSystem] Strong combinations found: ${handAnalysis.strongCombinations.length}`);
    
    // Get current game state to determine what can be played
    const gameState = this.world.getGameState();
    let playableCombinations = allCombinations;
    
    // If someone has played before, filter combinations that can beat the last play
    if (gameState && gameState.lastPlay && gameState.lastPlay.length > 0) {
      const lastPlayCombination = this.analyzeLastPlay(gameState.lastPlay);
      if (lastPlayCombination) {
        playableCombinations = allCombinations.filter(combo => 
          CardCombinationAnalyzer.canBeat(combo, lastPlayCombination)
        );
        
        if (playableCombinations.length === 0) {
          console.log('[HintSystem] No combinations can beat the last play - suggest passing');
          this.world.eventBus.emit('hintResult', {
            playerId: 0,
            suggestion: { 
              description: 'Consider passing (no cards can beat last play)', 
              cards: [],
              reason: 'Keep hand cards and wait for better opportunity'
            }
          });
          return;
        }
      }
    }
    
    // Generate strategic recommendation
    const remainingCards = cards.length;
    const isOffensive = this.shouldPlayOffensively(gameState, remainingCards);
    
    const strategicRecommendation = StrategicPlayManager.generateStrategicRecommendation(
      allCombinations,
      playableCombinations,
      remainingCards,
      isOffensive
    );
    
    if (strategicRecommendation) {
      const { combination, strength, reason, preservedCombinations } = strategicRecommendation;
      
      console.log(`[HintSystem] Strategic hint: ${combination.description}`);
      console.log(`[HintSystem] Strength level: ${CombinationStrength[strength]}`);
      console.log(`[HintSystem] Reason: ${reason}`);
      console.log(`[HintSystem] Preserved combinations: ${preservedCombinations.length}`);
      
      // Enhanced suggestion with strategic information
      const enhancedSuggestion = {
        ...combination,
        reason,
        strength: CombinationStrength[strength],
        preservedCombinations: preservedCombinations.slice(0, 3), // Show top 3 preserved
        handAnalysis: {
          totalCombinations: allCombinations.length,
          strongCombinations: handAnalysis.strongCombinations.length,
          potentialScore: handAnalysis.potentialScore,
          recommendations: handAnalysis.recommendations.slice(0, 2)
        }
      };
      
      this.world.eventBus.emit('hintResult', {
        playerId: 0,
        suggestion: enhancedSuggestion
      });
    } else {
      console.log('[HintSystem] No suitable strategic combinations found - suggest passing');
      this.world.eventBus.emit('hintResult', {
        playerId: 0,
        suggestion: { 
          description: 'Consider passing',
          cards: [],
          reason: 'Current situation unfavorable, preserve strength',
          handAnalysis: {
            strongCombinations: handAnalysis.strongCombinations.length,
            recommendations: handAnalysis.recommendations
          }
        }
      });
    }
  }
  
  /**
   * Analyze the last play to determine what type of combination was played
   */
  private analyzeLastPlay(lastPlayCards: number[]): CardCombination | null {
    if (!lastPlayCards || lastPlayCards.length === 0) return null;
    
    try {
      const combinations = CardCombinationAnalyzer.analyzeCards(lastPlayCards, this.world);
      
      // Find the combination that matches the exact cards played
      for (const combo of combinations) {
        if (combo.cards.length === lastPlayCards.length) {
          const comboEntities = combo.cards.map(c => c.entity).sort();
          const playedEntities = [...lastPlayCards].sort();
          
          // Check if the entities match
          if (comboEntities.length === playedEntities.length &&
              comboEntities.every((entity, index) => entity === playedEntities[index])) {
            return combo;
          }
        }
      }
      
      // If exact match not found, return the first combination of matching length
      return combinations.find(combo => combo.cards.length === lastPlayCards.length) || null;
    } catch (error) {
      console.warn('[HintSystem] Error analyzing last play:', error);
      return null;
    }
  }

  /**
   * Determine if player should adopt an offensive playing strategy
   */
  private shouldPlayOffensively(gameState: GameState | null, remainingCards: number): boolean {
    if (!gameState) return false;
    
    // End game: be aggressive when few cards left
    if (remainingCards <= 5) {
      return true;
    }
    
    // Mid game: be aggressive if others are close to winning
    // (Check if any opponent has very few cards)
    // This would require checking other players' hand sizes
    // For now, use a simple heuristic
    
    // Be aggressive if current player is the landlord and behind
    // Or if in a good position to win
    return remainingCards <= 8;
  }

  /**
   * Choose the best combination from available options
   * Prioritizes smaller combinations to save powerful cards
   */
  private chooseBestCombination(combinations: CardCombination[]): CardCombination | null {
    if (combinations.length === 0) return null;
    
    // Sort by priority:
    // 1. Smaller power (save big cards)
    // 2. Prefer basic types over complex ones
    // 3. Fewer cards when possible
    
    const sortedCombinations = [...combinations].sort((a, b) => {
      // First, prefer combinations that use fewer cards
      if (a.cards.length !== b.cards.length) {
        return a.cards.length - b.cards.length;
      }
      
      // Then prefer lower power (smaller cards)
      if (a.power !== b.power) {
        return a.power - b.power;
      }
      
      // Finally, prefer simpler types
      const typeOrder = {
        [CombinationType.Single]: 1,
        [CombinationType.Pair]: 2,
        [CombinationType.Triple]: 3,
        [CombinationType.TripleSingle]: 4,
        [CombinationType.TriplePair]: 5,
        [CombinationType.Straight]: 6,
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
    
    return sortedCombinations[0];
  }

  update(delta: number): void {
    // HintSystem doesn't need regular updates
  }
} 