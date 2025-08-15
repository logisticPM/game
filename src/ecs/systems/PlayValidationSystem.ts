import { System } from './System';
import { GameState, GamePhase, Hand, CardData, PlayerInfo, CardSelected, SelectedCards, Transform, LandlordCardComponent } from '../components';
import { EventName } from '../EventBus';
import { Entity } from '../types';

/**
 * Card combination types in Landlord game
 */
enum CombinationType {
  Invalid = 'invalid',
  Single = 'single',        // 单张
  Pair = 'pair',           // 对子
  Triple = 'triple',       // 三张
  TripleSingle = 'triple_single', // 三带一
  TriplePair = 'triple_pair', // 三带一对
  Straight = 'straight',   // 顺子
  StraightPair = 'straight_pair', // 连对
  Plane = 'plane',         // 飞机（连续的三张）
  PlaneSingle = 'plane_single', // 飞机带单张
  PlanePair = 'plane_pair', // 飞机带对子
  FourSingle = 'four_single', // 四带两个单张
  FourPair = 'four_pair',   // 四带两个对子
  Bomb = 'bomb',           // 炸弹
  Rocket = 'rocket'        // 火箭（双王）
}

/**
 * Information about a card play
 */
interface PlayInfo {
  type: CombinationType;
  power: number;
  cards: Entity[];
}

/**
 * System that validates card plays according to Landlord game rules
 */
export class PlayValidationSystem extends System {
  constructor(world: any) {
    super(world);
    this.world.eventBus.on(EventName.PlayCardsRequest, this.handlePlay.bind(this));
    this.world.eventBus.on(EventName.PassTurnRequest, this.handlePass.bind(this));
  }

  /**
   * Updates the system
   */
  update() {
    // Logic is event-driven
  }

  /**
   * Handles a play cards request
   * @param payload The play cards request payload
   */
  private handlePlay({ playerId, cards }: { playerId: number, cards: Entity[] }) {
    const gameState = this.world.getGameState();
    const playerEntity = this.findPlayerById(playerId);

    if (!gameState || gameState.phase !== GamePhase.Playing || !playerEntity || playerId !== gameState.currentPlayerId) {
      console.warn(`[PlayValidationSystem] Invalid play request: phase=${gameState?.phase}, currentPlayer=${gameState?.currentPlayerId}, requestingPlayer=${playerId}`);
      return;
    }

    // Verify the player actually has these cards
    const hand = this.world.components.get(playerEntity, Hand);
    if (!hand || !this.verifyCardsInHand(cards, hand.cards)) {
      this.world.eventBus.emit(EventName.InvalidPlay, { 
        playerId, 
        reason: 'You do not have all these cards in your hand' 
      });
      return;
    }

    // Debug: log round context before analyzing
    console.log('[PlayValidationSystem] Context before validation:', {
      currentPlayerId: gameState.currentPlayerId,
      lastPlayOwnerId: gameState.lastPlayOwnerId,
      passCount: gameState.passCount,
      lastPlayCount: gameState.lastPlay ? gameState.lastPlay.length : 0
    });

    // Analyze the play
    const playInfo = this.analyzePlay(cards);
    const lastPlayInfo = gameState.lastPlay ? this.analyzePlay(gameState.lastPlay) : null;

    console.log(`[PlayValidationSystem] Play analysis result:`, {
      playerId,
      cardCount: cards.length,
      playInfoType: playInfo.type,
      playInfoPower: playInfo.power,
      cardRanks: cards.map(card => {
        const cardData = this.world.components.get(card, CardData);
        return cardData ? cardData.rank : 'unknown';
      })
    });

    // Validate the play
    const validationResult = this.validatePlay(playInfo, lastPlayInfo, gameState.lastPlayOwnerId === playerId);
    if (!validationResult.valid) {
      // Clear selected cards when play is invalid (only for human player)
      if (playerId === 0) {
        this.world.eventBus.emit('clearCardSelection', { playerId });
      }
      this.world.eventBus.emit(EventName.InvalidPlay, { 
        playerId, 
        reason: validationResult.reason 
      });
      return;
    }

    // Play is valid, update game state
    hand.cards = hand.cards.filter(cardInHand => !cards.includes(cardInHand));
    
    // Set all played cards to face up so they're visible to all players
    for (const card of cards) {
      const cardData = this.world.components.get(card, CardData);
      if (cardData) {
        cardData.faceUp = true;
        console.log(`[PlayValidationSystem] Setting played card ${card} (${cardData.rank} of ${cardData.suit}) to face up`);
      }
      
      // Remove Hand component reference from played cards
      if (this.world.components.has(card, Hand)) {
        this.world.components.remove(card, Hand);
      }
      
      // Clear selection state for played cards
      const cardSelected = this.world.components.tryGet(card, CardSelected);
      if (cardSelected) {
        cardSelected.selected = false;
        console.log(`[PlayValidationSystem] Cleared selection for played card ${card}`);
      }
    }
    
    // Clear player's selected cards state
    this.clearPlayerSelectedCards(playerEntity);
    
    // Emit card selection clear event to update UI
    this.world.eventBus.emit('clearCardSelection', { playerId });
    
    gameState.lastPlay = cards;
    gameState.lastPlayOwnerId = playerId;
    gameState.passCount = 0;
    gameState.currentPlayerId = (gameState.currentPlayerId + 1) % 3;
    
    console.log(`[PlayValidationSystem] Played ${cards.length} cards, remaining hand: ${hand.cards.length}`);
  
  // Emit validated event for visual effects with combination type
  console.log(`[PlayValidationSystem] Emitting PlayCardsValidated event:`, {
    playerId,
    cardCount: cards.length,
    combinationType: playInfo.type,
    combinationTypeString: playInfo.type?.toString() || 'undefined'
  });
  
  this.world.eventBus.emit(EventName.PlayCardsValidated, {
    playerId,
    cards,
    combinationType: playInfo.type
  });
    
    this.world.eventBus.emit(EventName.GameStateChanged, { gameState });
  }

  /**
   * Handles a pass turn request
   * @param payload The pass turn request payload
   */
  private handlePass({ playerId }: { playerId: number }) {
    const gameState = this.world.getGameState();
    if (!gameState || gameState.phase !== GamePhase.Playing || playerId !== gameState.currentPlayerId) {
      console.warn(`[PlayValidationSystem] Invalid pass request: phase=${gameState?.phase}, currentPlayer=${gameState?.currentPlayerId}, requestingPlayer=${playerId}`);
      return;
    }

    // Can't pass if you're the first player or won the last round
    if (!gameState.lastPlay || gameState.lastPlayOwnerId === playerId) {
      this.world.eventBus.emit(EventName.InvalidPlay, { 
        playerId, 
        reason: 'You cannot pass when you are the first player or won the last round' 
      });
      return;
    }

    const before = {
      currentPlayerId: gameState.currentPlayerId,
      lastPlayOwnerId: gameState.lastPlayOwnerId,
      passCount: gameState.passCount
    };
    gameState.passCount++;
    gameState.currentPlayerId = (gameState.currentPlayerId + 1) % 3;
    const afterCurrent = gameState.currentPlayerId;

    // If everyone else has passed, the last player who played gets to play again
    // Only clear the round when turn cycles back to lastPlayOwner
    if (gameState.passCount >= 2 && afterCurrent === gameState.lastPlayOwnerId) {
      // Clear all played cards from the table when round ends
      this.clearPlayedCards();
      
      gameState.lastPlay = null;
      gameState.lastPlayOwnerId = null;
      gameState.passCount = 0;
      console.log('[PlayValidationSystem] Round cleared after two passes and turn returned to lastPlayOwner', { before, afterCurrent });
    }

    this.world.eventBus.emit(EventName.GameStateChanged, { gameState });
  }

  /**
   * Analyzes a card play to determine its type and power
   * @param cards The cards being played
   * @returns Information about the play
   */
  private analyzePlay(cards: Entity[]): PlayInfo {
    if (!cards || cards.length === 0) {
      return { type: CombinationType.Invalid, power: 0, cards };
    }

    // Get card data for all cards
    const cardDataList = cards.map(card => this.world.components.get(card, CardData));
    if (cardDataList.some(data => !data)) {
      return { type: CombinationType.Invalid, power: 0, cards };
    }

    // Sort by value for easier analysis
    cardDataList.sort((a, b) => a.value - b.value);

    // Check for rocket (pair of jokers)
    if (cards.length === 2 && 
        cardDataList[0].suit === 'joker' && 
        cardDataList[1].suit === 'joker' && 
        cardDataList[0].rank !== cardDataList[1].rank) {
      return { type: CombinationType.Rocket, power: 100, cards };
    }

    // Check for bomb (four of a kind)
    if (cards.length === 4 && 
        cardDataList.every(card => card.rank === cardDataList[0].rank)) {
      return { type: CombinationType.Bomb, power: cardDataList[0].value + 50, cards };
    }

    // Check for four with two singles (6 cards: 4 same + 2 different singles)
    if (cards.length === 6) {
      const rankCounts = new Map<string, number>();
      cardDataList.forEach(card => {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      });

      if (rankCounts.size === 3) { // 3 different ranks
        let hasFour = false;
        let singleCount = 0;
        for (const count of rankCounts.values()) {
          if (count === 4) hasFour = true;
          if (count === 1) singleCount++;
        }

        if (hasFour && singleCount === 2) {
          // Find the rank with 4 cards for power calculation
          let fourRank = '';
          for (const [rank, count] of rankCounts.entries()) {
            if (count === 4) fourRank = rank;
          }
          const fourPower = cardDataList.find(card => card.rank === fourRank)!.value;
          return { type: CombinationType.FourSingle, power: fourPower, cards };
        }
      }
    }

    // Check for four with two pairs (8 cards: 4 same + 2 different pairs)
    if (cards.length === 8) {
      const rankCounts = new Map<string, number>();
      cardDataList.forEach(card => {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      });

      if (rankCounts.size === 3) { // 3 different ranks
        let hasFour = false;
        let pairCount = 0;
        for (const count of rankCounts.values()) {
          if (count === 4) hasFour = true;
          if (count === 2) pairCount++;
        }

        if (hasFour && pairCount === 2) {
          // Find the rank with 4 cards for power calculation
          let fourRank = '';
          for (const [rank, count] of rankCounts.entries()) {
            if (count === 4) fourRank = rank;
          }
          const fourPower = cardDataList.find(card => card.rank === fourRank)!.value;
          return { type: CombinationType.FourPair, power: fourPower, cards };
        }
      }
    }

    // Check for single card
    if (cards.length === 1) {
      return { type: CombinationType.Single, power: cardDataList[0].value, cards };
    }

    // Check for pair
    if (cards.length === 2 && cardDataList[0].rank === cardDataList[1].rank) {
      return { type: CombinationType.Pair, power: cardDataList[0].value, cards };
    }

    // Check for triple
    if (cards.length === 3 && 
        cardDataList[0].rank === cardDataList[1].rank && 
        cardDataList[1].rank === cardDataList[2].rank) {
      return { type: CombinationType.Triple, power: cardDataList[0].value, cards };
    }

    // Check for triple with single
    if (cards.length === 4) {
      // Count occurrences of each rank
      const rankCounts = new Map<string, number>();
      cardDataList.forEach(card => {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      });

      // Check if we have a triple and a single
      if (rankCounts.size === 2) {
        let hasTriple = false;
        let hasSingle = false;
        for (const count of rankCounts.values()) {
          if (count === 3) hasTriple = true;
          if (count === 1) hasSingle = true;
        }

        if (hasTriple && hasSingle) {
          // Find the rank with 3 cards for power calculation
          let tripleRank = '';
          for (const [rank, count] of rankCounts.entries()) {
            if (count === 3) tripleRank = rank;
          }
          const triplePower = cardDataList.find(card => card.rank === tripleRank)!.value;
          return { type: CombinationType.TripleSingle, power: triplePower, cards };
        }
      }
    }

    // Check for triple with pair
    if (cards.length === 5) {
      // Count occurrences of each rank
      const rankCounts = new Map<string, number>();
      cardDataList.forEach(card => {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      });

      // Check if we have a triple and a pair
      if (rankCounts.size === 2) {
        let hasTriple = false;
        let hasPair = false;
        for (const count of rankCounts.values()) {
          if (count === 3) hasTriple = true;
          if (count === 2) hasPair = true;
        }

        if (hasTriple && hasPair) {
          // Find the rank with 3 cards for power calculation
          let tripleRank = '';
          for (const [rank, count] of rankCounts.entries()) {
            if (count === 3) tripleRank = rank;
          }
          const triplePower = cardDataList.find(card => card.rank === tripleRank)!.value;
          return { type: CombinationType.TriplePair, power: triplePower, cards };
        }
      }
    }

    // Check for straight (5+ consecutive cards)
    if (cards.length >= 5) {
      // Check if all cards have different ranks
      const uniqueRanks = new Set(cardDataList.map(card => card.rank));
      if (uniqueRanks.size === cards.length) {
        // Check for jokers first (jokers cannot be in straights)
        const hasJokers = cardDataList.some(card => card.suit === 'joker');
        if (hasJokers) {
          return { type: CombinationType.Invalid, power: 0, cards };
        }

        // For regular straights, exclude 2 (value 15 cannot connect normally)
        const validForStraight = cardDataList.filter(card => card.value < 15);
        if (validForStraight.length !== cardDataList.length) {
          // Contains 2 but not the special J-Q-K-A-2 case
          return { type: CombinationType.Invalid, power: 0, cards };
        }

        // Check if values are consecutive for regular straights
        let isConsecutive = true;
        for (let i = 1; i < validForStraight.length; i++) {
          if (validForStraight[i].value !== validForStraight[i-1].value + 1) {
            isConsecutive = false;
            break;
          }
        }

        if (isConsecutive) {
          return { type: CombinationType.Straight, power: validForStraight[validForStraight.length - 1].value, cards };
        }
      }
    }

    // Check for straight pairs (3+ consecutive pairs)
    if (cards.length >= 6 && cards.length % 2 === 0) {
      // Group cards by rank
      const rankGroups = new Map<string, CardData[]>();
      cardDataList.forEach(card => {
        if (!rankGroups.has(card.rank)) {
          rankGroups.set(card.rank, []);
        }
        rankGroups.get(card.rank)!.push(card);
      });

      // Check if all groups are pairs
      if (Array.from(rankGroups.values()).every(group => group.length === 2)) {
        // Get ranks sorted by value  
        const sortedRanks = Array.from(rankGroups.keys())
          .map(rank => rankGroups.get(rank)![0])
          .sort((a, b) => a.value - b.value);

        // Exclude 2, jokers from straight pairs (value >= 15 are 2, small/big joker)
        const validForStraightPair = sortedRanks.filter(card => card.value < 15);
        if (validForStraightPair.length !== sortedRanks.length) {
          // Contains 2 or jokers, not a valid straight pair
          return { type: CombinationType.Invalid, power: 0, cards };
        }

        // Check if values are consecutive
        let isConsecutive = true;
        for (let i = 1; i < sortedRanks.length; i++) {
          if (sortedRanks[i].value !== sortedRanks[i-1].value + 1) {
            isConsecutive = false;
            break;
          }
        }

        if (isConsecutive && sortedRanks.length >= 3) { // At least 3 pairs
          return { type: CombinationType.StraightPair, power: sortedRanks[sortedRanks.length - 1].value, cards };
        }
      }
    }

    // Check for plane (consecutive triples), plane with singles, or plane with pairs
    if (cards.length >= 6) {
      const rankCounts = new Map<string, number>();
      cardDataList.forEach(card => {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      });

      // Find triples
      const tripleRanks = [];
      const nonTripleCards = [];
      for (const [rank, count] of rankCounts.entries()) {
        if (count === 3) {
          tripleRanks.push(cardDataList.find(card => card.rank === rank)!);
        } else {
          // Collect non-triple cards for wings
          const cardsOfThisRank = cardDataList.filter(card => card.rank === rank);
          nonTripleCards.push(...cardsOfThisRank);
        }
      }

      // Need at least 2 consecutive triples for a plane
      if (tripleRanks.length >= 2) {
        tripleRanks.sort((a, b) => a.value - b.value);

        // Exclude 2, jokers from planes (value >= 15 are 2, small/big joker)
        const validTriples = tripleRanks.filter(card => card.value < 15);
        if (validTriples.length !== tripleRanks.length) {
          // Contains 2 or jokers, not a valid plane
          return { type: CombinationType.Invalid, power: 0, cards };
        }

        // Check if triples are consecutive
        let isConsecutive = true;
        for (let i = 1; i < tripleRanks.length; i++) {
          if (tripleRanks[i].value !== tripleRanks[i-1].value + 1) {
            isConsecutive = false;
            break;
          }
        }

        if (isConsecutive) {
          const planeLength = tripleRanks.length;
          const planePower = tripleRanks[tripleRanks.length - 1].value;

          // Pure plane (only triples)
          if (cards.length === planeLength * 3) {
            return { type: CombinationType.Plane, power: planePower, cards };
          }

          // Plane with singles (triples + same number of singles)
          if (cards.length === planeLength * 4) {
            // Check if we have exactly the right number of singles
            const singleCounts = new Map<string, number>();
            nonTripleCards.forEach(card => {
              singleCounts.set(card.rank, (singleCounts.get(card.rank) || 0) + 1);
            });

            if (Array.from(singleCounts.values()).every(count => count === 1) && 
                singleCounts.size === planeLength) {
              return { type: CombinationType.PlaneSingle, power: planePower, cards };
            }
          }

          // Plane with pairs (triples + same number of pairs)
          if (cards.length === planeLength * 5) {
            // Check if we have exactly the right number of pairs
            const pairCounts = new Map<string, number>();
            nonTripleCards.forEach(card => {
              pairCounts.set(card.rank, (pairCounts.get(card.rank) || 0) + 1);
            });

            if (Array.from(pairCounts.values()).every(count => count === 2) && 
                pairCounts.size === planeLength) {
              return { type: CombinationType.PlanePair, power: planePower, cards };
            }
          }
        }
      }
    }

    // If we get here, the play is invalid
    return { type: CombinationType.Invalid, power: 0, cards };
  }

  /**
   * Validates if a play is legal according to the game rules
   * @param play The current play
   * @param lastPlay The last play
   * @param isLastPlayer Whether the current player is the last player who played
   * @returns Validation result
   */
  private validatePlay(play: PlayInfo, lastPlay: PlayInfo | null, isLastPlayer: boolean): { valid: boolean, reason: string } {
    // Invalid play
    if (play.type === CombinationType.Invalid) {
      return { valid: false, reason: 'Invalid card combination' };
    }

    // First play or player won last round
    if (!lastPlay || isLastPlayer) {
      return { valid: true, reason: '' };
    }

    // Rocket beats everything
    if (play.type === CombinationType.Rocket) {
      return { valid: true, reason: '' };
    }

    // Bomb beats everything except rocket
    if (play.type === CombinationType.Bomb) {
      if (lastPlay.type === CombinationType.Rocket) {
        return { valid: false, reason: 'Rocket beats bomb' };
      }
      if (lastPlay.type === CombinationType.Bomb && play.power <= lastPlay.power) {
        return { valid: false, reason: 'Need a higher bomb' };
      }
      return { valid: true, reason: '' };
    }

    // For regular plays, type must match and power must be higher
    if (play.type !== lastPlay.type) {
      return { valid: false, reason: `Must play the same combination type (${lastPlay.type})` };
    }

    // For straights and straight pairs, the length must match
    if ((play.type === CombinationType.Straight || play.type === CombinationType.StraightPair) && play.cards.length !== lastPlay.cards.length) {
      return { valid: false, reason: 'Straight length must match the previous play' };
    }

    if (play.power <= lastPlay.power) {
      return { valid: false, reason: 'Must play higher value cards' };
    }

    return { valid: true, reason: '' };
  }

  /**
   * Verifies that all cards in a play are in the player's hand
   * @param playCards The cards being played
   * @param handCards The cards in the player's hand
   * @returns True if all cards are in the hand
   */
  private verifyCardsInHand(playCards: Entity[], handCards: Entity[]): boolean {
    return playCards.every(card => handCards.includes(card));
  }

  /**
   * Clears all selected cards for a player
   * @param playerEntity The player entity whose selections to clear
   */
  private clearPlayerSelectedCards(playerEntity: Entity): void {
    // Clear the SelectedCards component
    const selectedCards = this.world.components.tryGet(playerEntity, SelectedCards);
    if (selectedCards) {
      selectedCards.cards.clear();
      console.log(`[PlayValidationSystem] Cleared SelectedCards component for player ${playerEntity}`);
    }
    
    // Also clear individual card selection states for remaining hand cards
    const hand = this.world.components.tryGet(playerEntity, Hand);
    if (hand) {
      hand.cards.forEach((cardEntity: Entity) => {
        const cardSelected = this.world.components.tryGet(cardEntity, CardSelected);
        if (cardSelected && cardSelected.selected) {
          cardSelected.selected = false;
          console.log(`[PlayValidationSystem] Cleared selection for remaining card ${cardEntity}`);
        }
      });
    }
  }

  /**
   * Finds a player entity by ID
   * @param playerId The player ID to find
   * @returns The player entity or undefined if not found
   */
  private findPlayerById(playerId: number): number | undefined {
    return this.world.entities.find((entity, getComponent) => {
      const playerInfo = getComponent?.(PlayerInfo);
      return playerInfo?.id === playerId;
    }, this.world.components);
  }

  /**
   * Clear all played cards from the table when a round ends
   */
  private clearPlayedCards(): void {
    const allCards = this.world.entities.with(CardData, Transform);
    const playedCards: Entity[] = [];
    
    // Find all played cards (face up cards that are not in hands or landlord area)
    for (const cardEntity of allCards) {
      const cardData = this.world.components.get(cardEntity, CardData);
      const hasHand = this.world.components.has(cardEntity, Hand);
      const hasLandlordComponent = this.world.components.has(cardEntity, LandlordCardComponent);
      
      // Card is "played" if it's face up and not in a hand or landlord card area
      if (cardData && cardData.faceUp && !hasHand && !hasLandlordComponent) {
        playedCards.push(cardEntity);
      }
    }
    
    // Remove all played cards from the game
    for (const cardEntity of playedCards) {
      this.world.entities.destroy(cardEntity);
    }
    
    if (playedCards.length > 0) {
      console.log(`[PlayValidationSystem] Cleared ${playedCards.length} played cards from the table after round end`);
    }
  }
}
