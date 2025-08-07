import { EventBus } from '../ecs/EventBus';
import { DebugManager } from './DebugManager';

export class BiddingDebugger {
  private eventBus: EventBus;
  private biddingHistory: Array<{
    playerId: number;
    bid: number;
    timestamp: number;
  }> = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventBus.on('BidPlaced', this.handleBidPlaced.bind(this));
    this.eventBus.on('BiddingPhaseStarted', this.handleBiddingStarted.bind(this));
    this.eventBus.on('BiddingPhaseEnded', this.handleBiddingEnded.bind(this));
    this.eventBus.on('LandlordSelected', this.handleLandlordSelected.bind(this));
  }

  private handleBidPlaced(data: { playerId: number; bid: number }): void {
    const { playerId, bid } = data;
    
    this.biddingHistory.push({
      playerId,
      bid,
      timestamp: Date.now()
    });

    DebugManager.log(`Player ${playerId} bid ${bid}`);
    DebugManager.setDebugData('biddingHistory', this.biddingHistory);
    DebugManager.setDebugData('lastBid', { playerId, bid });
  }

  private handleBiddingStarted(): void {
    this.biddingHistory = [];
    DebugManager.log('Bidding phase started');
    DebugManager.setDebugData('biddingPhase', 'active');
  }

  private handleBiddingEnded(): void {
    DebugManager.log('Bidding phase ended');
    DebugManager.setDebugData('biddingPhase', 'ended');
    DebugManager.setDebugData('finalBiddingHistory', [...this.biddingHistory]);
  }

  private handleLandlordSelected(data: { playerId: number; finalBid: number }): void {
    const { playerId, finalBid } = data;
    DebugManager.log(`Player ${playerId} selected as landlord with bid ${finalBid}`);
    DebugManager.setDebugData('landlord', { playerId, finalBid });
  }

  public getBiddingHistory(): Array<{ playerId: number; bid: number; timestamp: number }> {
    return [...this.biddingHistory];
  }

  public getLastBid(): { playerId: number; bid: number } | null {
    if (this.biddingHistory.length === 0) return null;
    const lastBid = this.biddingHistory[this.biddingHistory.length - 1];
    return { playerId: lastBid.playerId, bid: lastBid.bid };
  }

  public getCurrentHighestBid(): number {
    return Math.max(0, ...this.biddingHistory.map(h => h.bid));
  }

  public getPlayerBids(playerId: number): number[] {
    return this.biddingHistory
      .filter(h => h.playerId === playerId)
      .map(h => h.bid);
  }

  public reset(): void {
    this.biddingHistory = [];
    DebugManager.setDebugData('biddingHistory', []);
    DebugManager.setDebugData('biddingPhase', 'inactive');
  }

  /**
   * Attaches debugging functions to the global window object for console access
   */
  public attachToWindow(): void {
    if (typeof window !== 'undefined') {
      (window as any).biddingDebugger = {
        getHistory: () => this.biddingHistory,
        getPlayerBids: (playerId: number) => this.getPlayerBids(playerId),
        getCurrentBid: () => this.getCurrentBid(),
        reset: () => this.reset(),
        getBiddingStats: () => ({
          totalBids: this.biddingHistory.length,
          players: [...new Set(this.biddingHistory.map(h => h.playerId))],
          currentBid: this.getCurrentBid()
        })
      };
      console.log('[BiddingDebugger] Debugging functions attached to window.biddingDebugger');
    }
  }
}
