import * as PIXI from 'pixi.js';
import { System } from './System';
import { PlayerInfo, Role, GameState, GamePhase } from '../components';
import { EventName } from '../EventBus';
import { CombinationType } from './CardCombinationAnalyzer';
import { Entity } from '../types';

/**
 * Visual effects for special card combinations
 */
interface SpecialEffect {
  type: 'bomb' | 'rocket' | 'plane' | 'train';
  sourcePlayerId: number;
  targetPlayerIds: number[];
  projectileSprite: PIXI.Sprite;
  startTime: number;
  duration: number;
  completed: boolean;
}

/**
 * Avatar shake effect
 */
interface ShakeEffect {
  playerId: number;
  avatar: PIXI.DisplayObject;
  originalX: number;
  originalY: number;
  startTime: number;
  duration: number;
  intensity: number;
  completed: boolean;
}

/**
 * System that handles visual effects for special card combinations
 * (Bombs, Rockets, Planes attacking opponents)
 */
export class VisualEffectsSystem extends System {
  private activeEffects: SpecialEffect[] = [];
  private activeShakes: ShakeEffect[] = [];
  private effectTextures: Map<string, PIXI.Texture> = new Map();
  private playerAvatars: Map<number, PIXI.DisplayObject> = new Map();

  constructor(world: any) {
    super(world);
    
    // Listen for validated card play events for visual effects
    this.world.eventBus.on(EventName.PlayCardsValidated, this.handleCardPlay.bind(this));
    this.world.eventBus.on('gameStateChanged', this.handleGameStateChange.bind(this));
    
    this.loadEffectTextures();
  }

  /**
   * Load effect textures
   */
  private async loadEffectTextures(): Promise<void> {
    try {
      const bombTexture = await PIXI.Assets.load('/GameAssets/images/bomb.png');
      const rocketTexture = await PIXI.Assets.load('/GameAssets/images/rocket.png');
      const planeTexture = await PIXI.Assets.load('/GameAssets/images/plane.png');
      const trainTexture = await PIXI.Assets.load('/GameAssets/images/train.png');
      
      this.effectTextures.set('bomb', bombTexture);
      this.effectTextures.set('rocket', rocketTexture);
      this.effectTextures.set('plane', planeTexture);
      this.effectTextures.set('train', trainTexture);
      
      console.log('[VisualEffectsSystem] Effect textures loaded successfully');
    } catch (error) {
      console.warn('[VisualEffectsSystem] Failed to load effect textures:', error);
    }
  }

  /**
   * Handle card play events to trigger special effects
   */
  private handleCardPlay(event: { playerId: number; cards: Entity[]; combinationType?: CombinationType }): void {
    const { playerId, combinationType } = event;
    
    console.log(`[VisualEffectsSystem] PlayCardsValidated event received:`, {
      playerId,
      cardCount: event.cards?.length || 0,
      combinationType: combinationType || 'undefined'
    });
    
    // Check if combination type is provided
    if (!combinationType) {
      console.log(`[VisualEffectsSystem] No combination type provided, skipping effect`);
      return;
    }
    
    // List of special combinations that trigger effects
    const specialCombinations = [CombinationType.Bomb, CombinationType.Rocket, CombinationType.Plane, CombinationType.PlaneSingle, CombinationType.PlanePair, CombinationType.TriplePair, CombinationType.TripleSingle];
    
    console.log(`[VisualEffectsSystem] Checking if ${combinationType} is in special combinations:`, specialCombinations);
    
    // Only trigger effects for special combinations
    if (!specialCombinations.includes(combinationType)) {
      console.log(`[VisualEffectsSystem] Combination ${combinationType} is not a special type, skipping effect`);
      return;
    }

    console.log(`[VisualEffectsSystem] ✅ Special combination detected: ${combinationType} by player ${playerId}`);
    
    // Determine effect type
    let effectType: 'bomb' | 'rocket' | 'plane' | 'train';
    if (combinationType === CombinationType.Bomb) {
      effectType = 'bomb';
    } else if (combinationType === CombinationType.Rocket) {
      effectType = 'rocket';
    } else if (combinationType === CombinationType.TriplePair || combinationType === CombinationType.TripleSingle) {
      effectType = 'train';
      console.log(`[VisualEffectsSystem] 🚂 TRIPLE combination detected, using TRAIN effect for ${combinationType}`);
    } else {
      effectType = 'plane'; // For Plane, PlaneSingle, PlanePair
    }
    
    console.log(`[VisualEffectsSystem] Effect type determined: ${effectType}`);
    
    // Determine target players
    const targetPlayerIds = this.getTargetPlayers(playerId);
    console.log(`[VisualEffectsSystem] Target players: ${targetPlayerIds}`);
    
    if (targetPlayerIds.length > 0) {
      this.createSpecialEffect(effectType, playerId, targetPlayerIds);
    } else {
      console.warn(`[VisualEffectsSystem] No target players found for effect`);
    }
  }

  /**
   * Handle game state changes to update player avatars
   */
  private handleGameStateChange(event: { gameState: GameState }): void {
    // Update player avatar references when game state changes
    this.updatePlayerAvatars();
  }

  /**
   * Update player avatar references - FIXED: Use screen coordinates instead of PIXI scene search
   * React DOM avatars are not in PIXI scene, so we use predefined screen positions
   */
  private updatePlayerAvatars(): void {
    // React avatars are not in PIXI scene, so we use screen coordinate positions
    // These coordinates match the CSS positioning in styles.css
    console.log(`[VisualEffectsSystem] ✅ Using screen coordinates for React DOM avatars`);
    
    // All avatars are "found" since we use coordinate-based positioning
    for (let playerId = 0; playerId < 3; playerId++) {
      // Create a dummy display object to represent avatar positions
      const dummyAvatar = new PIXI.Container();
      dummyAvatar.name = `react_avatar_${playerId}`;
      this.playerAvatars.set(playerId, dummyAvatar);
      console.log(`[VisualEffectsSystem] ✅ Avatar coordinates ready for player ${playerId}`);
    }
  }

  /**
   * Find avatar in the PIXI scene - DEPRECATED: React avatars are not in PIXI scene
   * This method is kept for compatibility but will always return null
   */
  private findAvatarInScene(avatarName: string): PIXI.DisplayObject | null {
    // React DOM avatars are not in PIXI scene, return null
    console.log(`[VisualEffectsSystem] ⚠️ DEPRECATED: findAvatarInScene called for ${avatarName} - React avatars not in PIXI scene`);
    return null;
  }

  /**
   * Debug helper to log scene objects
   */
  private logSceneObjects(container: PIXI.Container, depth: number = 0, maxDepth: number = 2): void {
    if (depth > maxDepth) return;
    
    const indent = '  '.repeat(depth);
    console.log(`[VisualEffectsSystem] ${indent}${container.constructor.name}: "${container.name || 'unnamed'}"`);
    
    if (container.children) {
      for (const child of container.children) {
        if (child instanceof PIXI.Container) {
          this.logSceneObjects(child, depth + 1, maxDepth);
        } else {
          console.log(`[VisualEffectsSystem] ${indent}  ${child.constructor.name}: "${child.name || 'unnamed'}"`);
        }
      }
    }
  }

  /**
   * Recursively search for display object by name
   */
  private searchDisplayObject(container: PIXI.Container, targetName: string): PIXI.DisplayObject | null {
    if (container.name === targetName) {
      return container;
    }
    
    for (const child of container.children) {
      if (child.name === targetName) {
        return child;
      }
      
      if (child instanceof PIXI.Container) {
        const result = this.searchDisplayObject(child, targetName);
        if (result) return result;
      }
    }
    
    return null;
  }

  /**
   * Determine target players based on the attacking player's role
   */
  private getTargetPlayers(attackingPlayerId: number): number[] {
    const gameState = this.world.getGameState();
    if (!gameState) return [];

    // Find attacking player's role
    const attackingPlayerEntity = this.findPlayerById(attackingPlayerId);
    if (!attackingPlayerEntity) return [];
    
    const attackingPlayerInfo = this.world.components.get(attackingPlayerEntity, PlayerInfo);
    if (!attackingPlayerInfo) return [];

    const isAttackerLandlord = attackingPlayerInfo.role === Role.Landlord;
    const targetPlayerIds: number[] = [];

    // Find all other players and determine targets
    for (let playerId = 0; playerId < 3; playerId++) {
      if (playerId === attackingPlayerId) continue;
      
      const playerEntity = this.findPlayerById(playerId);
      if (!playerEntity) continue;
      
      const playerInfo = this.world.components.get(playerEntity, PlayerInfo);
      if (!playerInfo) continue;

      const isTargetLandlord = playerInfo.role === Role.Landlord;
      
      // Landlord attacks peasants, peasants attack landlord
      if ((isAttackerLandlord && !isTargetLandlord) || (!isAttackerLandlord && isTargetLandlord)) {
        targetPlayerIds.push(playerId);
      }
    }

    return targetPlayerIds;
  }

  /**
   * Create special effect animation
   */
  private createSpecialEffect(effectType: 'bomb' | 'rocket' | 'plane' | 'train', sourcePlayerId: number, targetPlayerIds: number[]): void {
    const texture = this.effectTextures.get(effectType);
    if (!texture) {
      console.warn(`[VisualEffectsSystem] No texture found for effect: ${effectType}`);
      return;
    }

    // Create projectile for each target
    targetPlayerIds.forEach(targetPlayerId => {
      const projectileSprite = new PIXI.Sprite(texture);
      projectileSprite.anchor.set(0.5);
      projectileSprite.scale.set(0.3); // Adjust size as needed
      
      // Configure sprite appearance for better visibility
      projectileSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
      projectileSprite.alpha = 0.9;
      
      // Use a simple approach without complex filters for compatibility
      // The sprite should already have proper transparency from the texture
      console.log(`[VisualEffectsSystem] Configured ${effectType} projectile sprite`);
      
      // If filters are needed in the future, check PIXI version compatibility
      // projectileSprite.filters = [];
      
      // Position at source player location
      const sourcePosition = this.getPlayerPosition(sourcePlayerId);
      projectileSprite.x = sourcePosition.x;
      projectileSprite.y = sourcePosition.y;
      
      // Add to stage
      this.world.app.stage.addChild(projectileSprite);
      
      // Create effect object
      const effect: SpecialEffect = {
        type: effectType,
        sourcePlayerId,
        targetPlayerIds: [targetPlayerId],
        projectileSprite,
        startTime: Date.now(),
        duration: 1000, // 1 second animation
        completed: false
      };
      
      this.activeEffects.push(effect);
      
      console.log(`[VisualEffectsSystem] Created ${effectType} effect from player ${sourcePlayerId} to player ${targetPlayerId}`);
    });
  }

  /**
   * Get player position for effect placement - FIXED: Use accurate React DOM avatar coordinates
   */
  private getPlayerPosition(playerId: number): { x: number; y: number } {
    // Accurate screen coordinates matching CSS positioning of React DOM avatars
    // Based on actual CSS classes: .player-avatar.left, .player-avatar.right, .player-avatar.center
    const positions = {
      0: { x: 640, y: 600 },  // Player 0 (human, bottom center) - matches .player-avatar.center
      1: { x: 120, y: 200 },  // Player 1 (AI left) - matches .player-avatar.left 
      2: { x: 1160, y: 200 } // Player 2 (AI right) - matches .player-avatar.right
    };
    
    const position = positions[playerId as keyof typeof positions] || { x: 640, y: 360 };
    console.log(`[VisualEffectsSystem] ✅ Using React DOM avatar position for player ${playerId}: (${position.x}, ${position.y})`);
    return position;
  }

  /**
   * Create shake effect for target avatar
   */
  private createShakeEffect(playerId: number, intensity: number = 10): void {
    const avatar = this.playerAvatars.get(playerId);
    if (!avatar) {
      console.warn(`[VisualEffectsSystem] No avatar found for player ${playerId} to shake`);
      return;
    }

    const shakeEffect: ShakeEffect = {
      playerId,
      avatar,
      originalX: avatar.x,
      originalY: avatar.y,
      startTime: Date.now(),
      duration: 500, // 0.5 second shake
      intensity,
      completed: false
    };

    this.activeShakes.push(shakeEffect);
    console.log(`[VisualEffectsSystem] Started shake effect for player ${playerId}`);
  }

  /**
   * Update system - handle all active effects
   */
  update(delta: number): void {
    const currentTime = Date.now();
    
    // Update projectile effects
    this.updateProjectileEffects(currentTime);
    
    // Update shake effects
    this.updateShakeEffects(currentTime);
    
    // Clean up completed effects
    this.cleanupCompletedEffects();
  }

  /**
   * Update projectile animations
   */
  private updateProjectileEffects(currentTime: number): void {
    this.activeEffects.forEach(effect => {
      if (effect.completed) return;
      
      const elapsed = currentTime - effect.startTime;
      const progress = Math.min(elapsed / effect.duration, 1);
      
      if (progress >= 1) {
        // Effect completed - trigger shake and cleanup
        effect.targetPlayerIds.forEach(targetId => {
          this.createShakeEffect(targetId, 15);
        });
        
        effect.completed = true;
        if (effect.projectileSprite.parent) {
          effect.projectileSprite.parent.removeChild(effect.projectileSprite);
        }
        return;
      }
      
      // Animate projectile towards target
      const targetPlayerId = effect.targetPlayerIds[0];
      const targetPosition = this.getPlayerPosition(targetPlayerId);
      const sourcePosition = this.getPlayerPosition(effect.sourcePlayerId);
      
      // Interpolate position for straight-line flight
      effect.projectileSprite.x = sourcePosition.x + (targetPosition.x - sourcePosition.x) * progress;
      effect.projectileSprite.y = sourcePosition.y + (targetPosition.y - sourcePosition.y) * progress;
      
      // No rotation - projectiles fly straight
    });
  }

  /**
   * Update shake animations
   */
  private updateShakeEffects(currentTime: number): void {
    this.activeShakes.forEach(shake => {
      if (shake.completed) return;
      
      const elapsed = currentTime - shake.startTime;
      const progress = elapsed / shake.duration;
      
      if (progress >= 1) {
        // Shake completed - restore original position
        shake.avatar.x = shake.originalX;
        shake.avatar.y = shake.originalY;
        shake.completed = true;
        return;
      }
      
      // Apply shake offset
      const shakeIntensity = shake.intensity * (1 - progress); // Fade out shake
      const offsetX = (Math.random() - 0.5) * shakeIntensity;
      const offsetY = (Math.random() - 0.5) * shakeIntensity;
      
      shake.avatar.x = shake.originalX + offsetX;
      shake.avatar.y = shake.originalY + offsetY;
    });
  }

  /**
   * Clean up completed effects
   */
  private cleanupCompletedEffects(): void {
    this.activeEffects = this.activeEffects.filter(effect => !effect.completed);
    this.activeShakes = this.activeShakes.filter(shake => !shake.completed);
  }

  /**
   * Find player entity by ID
   */
  private findPlayerById(playerId: number): Entity | undefined {
    return this.world.entities.find((entity: Entity) => {
      try {
        const playerInfo = this.world.components.tryGet(entity, PlayerInfo);
        return playerInfo?.id === playerId;
      } catch (error) {
        return false;
      }
    });
  }
}
