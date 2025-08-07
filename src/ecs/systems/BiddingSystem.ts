import { System } from './System';
import { GameState, GamePhase, PlayerInfo, Role, Hand, CardData, LandlordCardComponent, Sprite } from '../components';
import { EventName } from '../EventBus';
import { World } from '..';

/**
 * System that handles the bidding phase of the game
 */
export class BiddingSystem extends System {
  constructor(world: World) {
    super(world);
    this.world.eventBus.on(EventName.BidRequest, this.handleBidRequest.bind(this));
    this.world.eventBus.on(EventName.GameReset, this.handleGameReset.bind(this));
  }

  /**
   * Handles a bid request from a player
   * @param payload The bid request payload
   */
  private handleBidRequest({ playerId, amount }: { playerId: number; amount: number }) {
    const gameState = this.world.getGameState();
    if (!gameState || gameState.phase !== GamePhase.Bidding || playerId !== gameState.currentPlayerId) {
      console.warn(`[BiddingSystem] Invalid bid request: phase=${gameState?.phase}, currentPlayer=${gameState?.currentPlayerId}, requestingPlayer=${playerId}`);
      return;
    }

    // Validate bid amount (0 = pass, 1-3 = bid points)
    if (amount < 0 || amount > 3) {
      console.warn(`[BiddingSystem] Invalid bid amount: ${amount}. Must be 0 (pass), 1, 2, or 3.`);
      return;
    }

    // Check if player has already bid
    const hasAlreadyBid = gameState.bidHistory.some(bid => bid.playerId === playerId);
    if (hasAlreadyBid) {
      console.warn(`[BiddingSystem] Player ${playerId} has already bid.`);
      return;
    }

    // Validate bid must be higher than current bid (unless passing)
    if (amount > 0 && amount <= gameState.currentBid) {
      console.warn(`[BiddingSystem] Bid ${amount} must be higher than current bid ${gameState.currentBid}`);
      return;
    }

    // Process bid
    if (amount > gameState.currentBid) {
      gameState.currentBid = amount;
      gameState.landlordId = playerId;
      console.log(`[BiddingSystem] Player ${playerId} bid ${amount} points`);
    } else {
      console.log(`[BiddingSystem] Player ${playerId} passed`);
    }
    
    gameState.bidHistory.push({ playerId, bid: amount });

    // Check for end of bidding
    const allPlayersBid = gameState.bidHistory.length === 3;
    const someoneCalledThree = amount === 3;

    console.log(`[BiddingSystem] After bid by player ${playerId}: allPlayersBid=${allPlayersBid}, someoneCalledThree=${someoneCalledThree}, bidHistory.length=${gameState.bidHistory.length}`);
    
    if (someoneCalledThree || allPlayersBid) {
      // End bidding if someone called 3 (max bid) or all players have bid
      console.log(`[BiddingSystem] Ending bidding. Reason: ${someoneCalledThree ? 'someone called 3' : 'all players bid'}`);
      this.endBidding(gameState);
    } else {
      // Next player
      const nextPlayer = (gameState.currentPlayerId + 1) % 3;
      console.log(`[BiddingSystem] Moving to next player: ${gameState.currentPlayerId} -> ${nextPlayer}`);
      gameState.currentPlayerId = nextPlayer;
    }

    this.world.eventBus.emit(EventName.GameStateChanged, { gameState });
  }

  /**
   * Handles a game reset event
   */
  private handleGameReset() {
    const gameState = this.world.getGameState();
    if (!gameState) return;

    // Reset bidding state
    gameState.phase = GamePhase.Bidding;
    gameState.currentPlayerId = Math.floor(Math.random() * 3);
    gameState.currentBid = 0;
    gameState.landlordId = null;
    gameState.bidHistory = [];

    // Reset player roles
    const players = this.world.entities.with(PlayerInfo);
    for (const player of players) {
      const playerInfo = this.world.components.get(player, PlayerInfo);
      playerInfo.role = Role.Farmer;
    }

    this.world.eventBus.emit(EventName.GameStateChanged, { gameState });
  }

  /**
   * Updates the bidding system
   */
  update() {
    // Bidding logic is event-driven, so update can be empty
  }

  /**
   * Ends the bidding phase and transitions to the playing phase
   * @param gameState The current game state
   */
  private endBidding(gameState: GameState) {
    console.log(`[BiddingSystem] endBidding called. bidHistory:`, gameState.bidHistory, `landlordId:`, gameState.landlordId);
    
    // Check if anyone actually bid (amount > 0)
    const anyValidBids = gameState.bidHistory.some(bid => bid.bid > 0);
    
    console.log(`[BiddingSystem] anyValidBids: ${anyValidBids}, landlordId: ${gameState.landlordId}`);
    
    if (anyValidBids && gameState.landlordId !== null) {
      // We have a landlord
      const landlord = this.findPlayerById(gameState.landlordId);
      if (!landlord) {
        console.error(`[BiddingSystem] Could not find landlord entity with ID ${gameState.landlordId}`);
        return;
      }

      const landlordInfo = this.world.components.get(landlord, PlayerInfo);
      landlordInfo.role = Role.Landlord;

      // First, reveal landlord cards to all players (flip face up)
      this.revealLandlordCards(gameState);
      
      // Immediately transition to playing phase and integrate cards
      // The reveal will be brief but visible
      setTimeout(() => {
        this.integrateLandlordCards(gameState, landlord, landlordInfo);
      }, 1000); // Reduced from 2.5s to 1s for better UX
      
      // Update card visibility after bidding ends (only call once, after integration)
      this.updateCardVisibilityAfterBidding();
      
      // Emit game state changed event to update UI
      this.world.eventBus.emit(EventName.GameStateChanged, { gameState });
    } else {
      // No one bid (everyone passed), reset the game according to rules
      console.log("Everyone passed. Redealing according to landlord game rules...");
      this.resetGame(gameState);
    }
  }

  /**
   * Resets the game state for a new round
   * @param gameState The current game state
   */
  private resetGame(gameState: GameState) {
    // In a real implementation, we would redeal cards and reset the game state
    // For now, we'll just emit a game reset event
    this.world.eventBus.emit(EventName.GameReset, {});
  }

  /**
   * Updates card visibility after bidding phase ends
   * Ensures human player cards remain face up, AI cards remain face down
   */
  private updateCardVisibilityAfterBidding() {
    const playerEntities = this.world.entities.with(PlayerInfo, Hand);
    
    for (const playerEntity of playerEntities) {
      const playerInfo = this.world.components.get(playerEntity, PlayerInfo);
      const playerHand = this.world.components.get(playerEntity, Hand);
      
      if (!playerInfo || !playerHand) continue;
      
      // Ensure correct visibility: human player cards face up, AI cards face down
      const shouldShowCards = !playerInfo.isAI; // Only human player (ID 0) can see cards
      
      for (const cardEntity of playerHand.cards) {
        const cardData = this.world.components.get(cardEntity, CardData);
        const sprite = this.world.components.get(cardEntity, Sprite) as Sprite;
        
        if (cardData) {
          // Set card face up/down status
          cardData.faceUp = shouldShowCards;
          
          // Also ensure sprite visibility is correct
          if (sprite) {
            sprite.visible = true; // All cards should be visible (face up/down handled by texture)
          }
          
          console.log(`[BiddingSystem] Card ${cardData.rank}_${cardData.suit} faceUp: ${cardData.faceUp}, sprite.visible: ${sprite?.visible}`);
        }
      }
      
      console.log(`[BiddingSystem] Updated visibility for player ${playerInfo.id}: ${playerHand.cards.length} cards, shouldShowCards: ${shouldShowCards}`);
    }
  }

  /**
   * Note: Landlord cards are now integrated directly into the landlord's hand.
   * No separate reveal logic is needed as they follow normal hand card visibility rules.
   */

  /**
   * Reveals landlord cards by setting them face up for all players to see
   * @param gameState The current game state
   */
  private revealLandlordCards(gameState: GameState) {
    console.log(`[BiddingSystem] Revealing ${gameState.landlordCards.length} landlord cards to all players`);
    
    for (const cardEntity of gameState.landlordCards) {
      const cardData = this.world.components.get(cardEntity, CardData);
      if (cardData) {
        // Set face up so all players can see the landlord cards
        cardData.faceUp = true;
        console.log(`[BiddingSystem] Revealed landlord card: ${cardData.rank} of ${cardData.suit}`);
      }
    }
    
    // Emit game state changed to update the UI
    this.world.eventBus.emit(EventName.GameStateChanged, { gameState });
  }

  /**
   * Integrates landlord cards into the landlord's hand and transitions to playing phase
   * @param gameState The current game state
   * @param landlord The landlord entity
   * @param landlordInfo The landlord's player info
   */
  private integrateLandlordCards(gameState: GameState, landlord: number, landlordInfo: PlayerInfo) {
    console.log(`[BiddingSystem] Integrating landlord cards into landlord's hand`);
    
    const landlordHand = this.world.components.get(landlord, Hand);
    if (landlordHand) {
      // Add landlord cards to hand
      landlordHand.cards.push(...gameState.landlordCards);
      
      // Process landlord cards as part of hand
      for (const card of gameState.landlordCards) {
        // Add Hand component if not already present
        if (!this.world.components.has(card, Hand)) {
          this.world.components.add(card, new Hand());
        }
        
        // Remove LandlordCardComponent so these cards are no longer displayed separately
        if (this.world.components.has(card, LandlordCardComponent)) {
          this.world.components.remove(card, LandlordCardComponent);
        }
        
        const cardData = this.world.components.get(card, CardData);
        const sprite = this.world.components.get(card, Sprite) as Sprite;
        if (cardData) {
          // Set visibility based on landlord type (human visible, AI hidden)
          cardData.faceUp = landlordInfo.id === 0; // Only human player (ID 0) sees cards
          
          // Ensure sprite is visible
          if (sprite) {
            sprite.visible = true;
          }
          
          console.log(`[BiddingSystem] Landlord card ${card} (${cardData.rank} of ${cardData.suit}) added to landlord hand, faceUp: ${cardData.faceUp}, sprite.visible: ${sprite?.visible}`);
        }
      }
      
      // Sort all cards (including new landlord cards) by value
      landlordHand.cards.sort((a, b) => {
        const cardA = this.world.components.get(a, CardData);
        const cardB = this.world.components.get(b, CardData);
        return (cardA?.value || 0) - (cardB?.value || 0);
      });
      
      console.log(`[BiddingSystem] Landlord now has ${landlordHand.cards.length} cards (17 original + 3 landlord cards)`);
    }

    // Transition to playing phase
    gameState.phase = GamePhase.Playing;
    gameState.currentPlayerId = gameState.landlordId!; // Non-null assertion safe here
    
    console.log(`[BiddingSystem] Game phase set to Playing, landlord is player ${gameState.landlordId}`);
    console.log(`[BiddingSystem] Landlord cards have been integrated into landlord's hand`);
    
    // Emit game state changed to update the UI
    this.world.eventBus.emit(EventName.GameStateChanged, { gameState });
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
}
