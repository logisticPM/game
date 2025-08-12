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

    const layoutData = dataManager.getGameData().layout as any;
    // Support both naming styles in GameData: landlordCards or landlord_cards
    const landlordLayout = layoutData.landlordCards || layoutData.landlord_cards || {};
    const startX = landlordLayout.startX ?? landlordLayout.x ?? (this.world.app?.screen?.width || 1280) / 2;
    const y = landlordLayout.y ?? 120;
    const spacing = landlordLayout.spacing ?? (landlordLayout.landlord_cards?.spacing) ?? 40;

    // Match human player's hand card scale
    const playerLayouts = Array.isArray(layoutData.players) ? layoutData.players : [];
    const player0 = playerLayouts.find((p: any) => p.id === 0);
    const handScale = player0?.scale ?? 0.8;

    // Ensure all landlord cards have uniform size and positioning
    for (let i = 0; i < landlordCards.length; i++) {
      const card = landlordCards[i];
      const transform = this.world.components.get(card, Transform);
      if (transform) {
        transform.x = startX + i * spacing;
        transform.y = y;
        transform.rotation = 0;
        // Scale to match hand card size
        transform.scaleX = handScale;
        transform.scaleY = handScale;
        transform.zIndex = 200; // Above other cards during bidding
      }
    }
    
    console.log(`[LandlordCardLayoutSystem] Positioned ${landlordCards.length} landlord cards with scale ${handScale}`);
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
