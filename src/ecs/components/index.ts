import { Entity } from '../types';
import * as PIXI from 'pixi.js';

// --- DATA COMPONENTS ---

export class Transform {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public rotation: number = 0,
    public scaleX: number = 1,
    public scaleY: number = 1,
    public zIndex: number = 0
  ) {}
}

export class Sprite {
  constructor(
    public texture: string = '',
    public isInteractive: boolean = false,
    public visible: boolean = true,
    public alpha: number = 1.0
  ) {}
}

export class CardData {
  constructor(
    public id: number,
    public suit: string,
    public rank: string,
    public value: number,
    public faceUp: boolean = false
  ) {}
}

export enum Role { Farmer = 'farmer', Landlord = 'landlord' }

export class PlayerInfo {
  constructor(
    public id: number, // 0 for human, 1, 2 for AI
    public name: string,
    public isAI: boolean,
    public role: Role = Role.Farmer
  ) {}
}

export { LandlordCardComponent } from './LandlordCardComponent';

export class Hand {
  constructor(public cards: Entity[] = []) {}
}

export class SelectedCards {
  constructor(public cards: Set<number> = new Set()) {}
}

export enum GamePhase { 
  Dealing = 'dealing', 
  Bidding = 'bidding', 
  Playing = 'playing', 
  Finished = 'finished' 
}

export enum Winner {
  None = 'none',
  Landlord = 'landlord',
  Farmers = 'farmers'
}

export class GameState {
  constructor(
    public phase: GamePhase = GamePhase.Bidding,
    public currentPlayerId: number = Math.floor(Math.random() * 3),
    public lastPlay: Entity[] | null = null,
    public lastPlayOwnerId: number | null = null,
    public landlordCards: Entity[] = [],
    public winner: Winner = Winner.None,
    public passCount: number = 0,
    public bidHistory: { playerId: number; bid: number }[] = [],
    public currentBid: number = 0,
    public landlordId: number | null = null
  ) {}
}

// --- EVENT COMPONENTS ---

export class BidRequest {
  constructor(public playerId: number, public amount: number) {} // 0 for pass
}

export class PlayCardsRequest {
  constructor(public playerId: number, public cards: Entity[]) {}
}

export class PassTurnRequest {
  constructor(public playerId: number) {}
}

export class SelectCardRequest {
  constructor(public playerId: number, public cardEntity: Entity) {}
}

export class GameStateChangedEvent {
  constructor(public gameState: GameState) {}
}

export class InvalidPlayEvent {
  constructor(public playerId: number, public reason: string) {}
}

export class CardSelected {
  constructor(public selected: boolean = false) {}
}
