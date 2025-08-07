import { System } from './System';
import { LandlordCardComponent, Transform, GamePhase } from '../components';
import { dataManager } from '../../game/DataManager';

export class LandlordCardLayoutSystem extends System {
  private lastGamePhase: GamePhase | null = null;
  private lastLandlordCardsCount = -1;
  
  constructor(world: any) {
    super(world);
  }
  
  update(delta: number): void {
    // Check game state - show landlord cards during bidding phase and briefly after bid ends
    const gameState = this.world.getGameState();
    if (!gameState) return;
    
    const currentPhase = gameState.phase;
    
    if (currentPhase === GamePhase.Playing) {
      // Only log phase change once when entering Playing phase
      if (this.lastGamePhase !== GamePhase.Playing) {
        console.log(`[LandlordCardLayoutSystem] Entering playing phase, cleaning up landlord cards`);
        this.cleanupLandlordCards();
      }
      this.lastGamePhase = currentPhase;
      return;
    }
    
    if (currentPhase !== GamePhase.Bidding) {
      // Only log phase change once when entering non-bidding phase
      if (this.lastGamePhase !== currentPhase) {
        console.log(`[LandlordCardLayoutSystem] Skipping layout in ${currentPhase} phase`);
      }
      this.lastGamePhase = currentPhase;
      return;
    }

    const landlordCards = this.world.entities.with(LandlordCardComponent);
    
    // Only update layout if phase changed or card count changed
    if (this.lastGamePhase === currentPhase && landlordCards.length === this.lastLandlordCardsCount) {
      return; // No change, skip layout
    }
    
    this.lastGamePhase = currentPhase;
    this.lastLandlordCardsCount = landlordCards.length;
    
    if (landlordCards.length === 0) {
      return;
    }

    const layout = dataManager.getGameData().layout.landlordCards;

    // Ensure all landlord cards have uniform size and positioning
    for (let i = 0; i < landlordCards.length; i++) {
      const card = landlordCards[i];
      const transform = this.world.components.get(card, Transform);
      if (transform) {
        transform.x = layout.startX + i * layout.spacing;
        transform.y = layout.y;
        transform.rotation = 0;
        // Uniform scale for all landlord cards  
        transform.scaleX = 0.2;
        transform.scaleY = 0.2;
        transform.zIndex = 200; // Above other cards during bidding
      }
    }
    
    console.log(`[LandlordCardLayoutSystem] Positioned ${landlordCards.length} landlord cards with uniform scale 0.2`);
  }

  /**
   * Clean up any remaining LandlordCardComponents during playing phase
   */
  private cleanupLandlordCards(): void {
    const landlordCards = this.world.entities.with(LandlordCardComponent);
    
    if (landlordCards.length > 0) {
      console.log(`[LandlordCardLayoutSystem] Found ${landlordCards.length} remaining landlord cards in playing phase, removing components`);
      
      for (const cardEntity of landlordCards) {
        // Remove LandlordCardComponent to prevent rendering
        this.world.components.remove(cardEntity, LandlordCardComponent);
      }
      
      console.log(`[LandlordCardLayoutSystem] Cleaned up ${landlordCards.length} landlord card components`);
    }
  }
}
