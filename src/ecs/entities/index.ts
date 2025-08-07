import { World } from '..';
import { dataManager } from '../../game/DataManager';
import {
  CardData,
  GameState,
  Hand,
  LandlordCardComponent, // Import the new component
  PlayerInfo,
  Role,
  SelectedCards,
  Sprite,
  Transform,
} from '../components';

// A simple factory for creating a player entity
export function createPlayer(world: World, id: number, name: string, isAI: boolean) {
  const player = world.entities.create();
  world.components.add(player, new PlayerInfo(id, name, isAI, Role.Farmer));
  world.components.add(player, new Hand());
  world.components.add(player, new SelectedCards());
  return player;
}

// A factory for creating the deck and dealing
export function createCardDeck(world: World, players: number[]) {
  console.log(`[createCardDeck] Starting deck creation for ${players.length} players`);
  const cardDefs = dataManager.getGameData().cards;
  const deck: number[] = [];

  // Create all cards (reduced logging)
  for (const def of cardDefs) {
    const card = world.entities.create();
    world.components.add(card, new CardData(def.id, def.suit, def.rank, def.value));
    world.components.add(card, new Transform());
    world.components.add(card, new Sprite());
    deck.push(card);
  }

  console.log(`[createCardDeck] Created ${deck.length} cards, shuffling...`);

  // Shuffle the deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  console.log(`[createCardDeck] Shuffled deck, dealing cards to players...`);

  // Deal cards to players (51 cards total: 17 per player)
  for (let i = 0; i < 51; i++) {
    const card = deck.shift()!;
    const playerIndex = i % players.length;
    const player = players[playerIndex];
    
    const playerHand = world.components.get(player, Hand)!;
    const cardData = world.components.get(card, CardData)!;
    const playerInfo = world.components.get(player, PlayerInfo)!;
    
    // Human player cards are face up, AI cards are face down
    cardData.faceUp = playerInfo.id === 0;
    
    // Add the card to player's hand array
    playerHand.cards.push(card);
    
    // Add Hand component to the card entity itself so RenderSystem can identify it as a hand card
    world.components.add(card, new Hand());
    
    // Log only when a complete hand is dealt (every 17 cards)
    if ((i + 1) % 17 === 0) {
      const faceStatus = cardData.faceUp ? "face up" : "face down";
      console.log(`[createCardDeck] Dealt 17 cards to player ${playerInfo.id} (${playerInfo.name}) - cards are ${faceStatus}`);
    }
  }

  // Summary log for final card counts
  const playerSummary = players.map(p => {
      const hand = world.components.get(p, Hand)!;
      const playerInfo = world.components.get(p, PlayerInfo)!;
      return `Player ${playerInfo.id} (${playerInfo.name}): ${hand.cards.length} cards`;
  }).join(', ');
  console.log(`[createCardDeck] Final hand sizes - ${playerSummary}`);

  const landlordCards = deck; // Remaining 3 cards
  console.log(`[createCardDeck] Remaining ${landlordCards.length} cards designated as landlord cards`);

  // Tag the landlord cards with a component so a system can find them
  for (const card of landlordCards) {
    world.components.add(card, new LandlordCardComponent());
    
    // Initially landlord cards are face down
    // They will be revealed later when the landlord is determined
    const cardData = world.components.get(card, CardData)!;
    cardData.faceUp = false;
  }
  
  console.log(`[createCardDeck] Deck creation completed successfully`);

  return { landlordCards };
}

export function createGameManager(world: World): number {
    const manager = world.entities.create();
    const gameState = new GameState();
    world.components.add(manager, gameState);
    return manager;
}
