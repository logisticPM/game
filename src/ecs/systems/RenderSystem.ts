import * as PIXI from 'pixi.js';
import { System } from './System';
import { Transform, Sprite, CardData, GameState, GamePhase, CardSelected, PlayerInfo, Hand, LandlordCardComponent } from '../components';
import { EventName } from '../EventBus';
import { Entity } from '../types';

/**
 * System responsible for rendering entities with Transform and Sprite components
 */
export class RenderSystem extends System {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private sprites: Map<Entity, PIXI.Sprite> = new Map();
  private textures: Map<string, PIXI.Texture> = new Map();
  private eventListeners: Map<Entity, (() => void)[]> = new Map();
  private textureLoadPromise: Promise<void> | null = null;
  private cardBorders: Map<Entity, PIXI.Graphics> = new Map(); // Track borders for each card entity

  // Error caching to prevent spam
  private loggedErrors = new Set<string>();
  private loggedWarnings = new Set<string>();
  
  // Texture loading state
  private texturesReady = false;

  constructor(world: any, app: PIXI.Application) {
    super(world);
    this.app = app;
    this.container = new PIXI.Container();
    this.container.sortableChildren = true; // Enable z-index sorting
    if (this.app && this.app.stage) {
      this.app.stage.addChild(this.container);
    } else {
      console.error('[RenderSystem] PIXI Application or stage is not properly initialized');
    }
    this.textureLoadPromise = this.loadTextures();

    // Entity cleanup will be handled by the update loop
  }

  /**
   * Loads all card textures and returns a promise that resolves when loading is complete
   */
  private async loadTextures(): Promise<void> {
    try {
      // Create a default texture for fallback
      const defaultTexture = PIXI.Texture.WHITE;
      this.textures.set('default', defaultTexture);
      
      // Get the game data to access card information and file paths
      const gameDataResponse = await fetch('/GameAssets/GameData.json');
      if (!gameDataResponse.ok) {
        console.error(`Failed to load GameData.json: ${gameDataResponse.status}`);
        return Promise.resolve();
      }
      
      const gameData = await gameDataResponse.json();
      console.log('Game data loaded successfully');
      
      // Set up the card back texture
      if (gameData.texturePath.useSpriteSheets) {
        // Use sprite sheet card back texture
        try {
          const backTexture = PIXI.Assets.cache.get('cardback.png');
          if (backTexture) {
            this.textures.set('back', backTexture);
            console.log('Card back texture loaded from sprite sheet');
          } else {
            console.warn('Card back texture not found in sprite sheet, using default');
            this.textures.set('back', defaultTexture);
          }
        } catch (err) {
          console.warn('Failed to get card back texture from sprite sheet, using default');
          this.textures.set('back', defaultTexture);
        }
      } else {
        // Load from individual file
        try {
          const backTexture = await PIXI.Assets.load(gameData.texturePath.back);
          this.textures.set('back', backTexture);
          console.log('Card back texture loaded from:', gameData.texturePath.back);
        } catch (err) {
          console.warn('Failed to load card back texture, using default texture');
          this.textures.set('back', defaultTexture);
        }
      }
      
      // Check if we should use sprite sheets or individual files
      if (gameData.texturePath.useSpriteSheets) {
        console.log('Using sprite sheet textures (already loaded by SpriteSheetLoader)');
        // Sprite sheet textures are already loaded by DataManager->SpriteSheetLoader
        // and cached in PIXI.Assets.cache, so we can get them directly
        gameData.cards.forEach((card: any) => {
          try {
            const texture = PIXI.Assets.cache.get(card.fileName);
            if (texture) {
              this.textures.set(`card_${card.id}`, texture);
            } else {
              console.warn(`Sprite sheet texture not found for ${card.fileName}, using default`);
              this.textures.set(`card_${card.id}`, defaultTexture);
            }
          } catch (err) {
            console.warn(`Failed to get sprite sheet texture for card ${card.id}, using default`);
            this.textures.set(`card_${card.id}`, defaultTexture);
          }
        });
      } else {
        // Load all card textures from individual image files (legacy mode)
        console.log('Using individual image files for cards');
        const textureLoadPromises = gameData.cards.map(async (card: any) => {
          const filePath = `${gameData.texturePath.base}${card.fileName}`;
          
          try {
            // Use PIXI.Assets.load for proper async loading
            const texture = await PIXI.Assets.load(filePath);
          
            // Store by card ID - this is the primary lookup method
            this.textures.set(`card_${card.id}`, texture);
            
            console.log(`Loaded texture for card ${card.id} (${card.rank} of ${card.suit}) from ${filePath}`);
            return true;
          } catch (err) {
            console.warn(`Failed to load texture for card ${card.id} from ${filePath}, using default texture`);
            this.textures.set(`card_${card.id}`, defaultTexture);
            return false;
          }
        });

        // Wait for all textures to load
        await Promise.all(textureLoadPromises);
      }
      
      this.texturesReady = true;
      console.log('Textures initialized successfully, total textures:', this.textures.size);
      return Promise.resolve();
    } catch (error) {
      console.error('Error in texture initialization:', error);
      return Promise.resolve(); // Continue even if there's an error
    }
  }

  /**
   * Updates all entities with Transform and Sprite components
   * @param deltaTime Time since last update in seconds
   */
  update(deltaTime: number) {
    try {
      // Wait for textures to be loaded before processing entities
      if (!this.texturesReady) {
        return; // Textures not yet ready
      }
      
      // Update positions of all entities with Transform and Sprite components
      const entities = this.world.entities.with(Transform, Sprite);
      
      // Track which entities we've updated this frame
      const updatedEntities = new Set<Entity>();
      
      for (const entity of entities) {
        try {
          updatedEntities.add(entity);
          const transform = this.world.components.get(entity, Transform);
          const spriteComponent = this.world.components.get(entity, Sprite);
          
          if (!transform || !spriteComponent) continue;
          
          // Skip AI player hand cards - check if this card belongs to an AI player
          const cardDataCheck = this.world.components.tryGet(entity, CardData);
          if (cardDataCheck) {
            // Check if this card is in an AI player's hand
            const playerEntities = this.world.entities.with(PlayerInfo, Hand);
            let isAIPlayerCard = false;
            
            for (const playerEntity of playerEntities) {
              const playerInfo = this.world.components.tryGet(playerEntity, PlayerInfo);
              const hand = this.world.components.tryGet(playerEntity, Hand);
              
              if (playerInfo?.isAI && hand?.cards.includes(entity)) {
                isAIPlayerCard = true;
                break;
              }
            }
            
            // Skip rendering AI player cards
            // Note: Landlord cards should be integrated into hands during playing phase
            if (isAIPlayerCard) {
              continue;
            }
            
            // Handle landlord cards visibility based on game phase
            const hasLandlordComponent = this.world.components.has(entity, LandlordCardComponent);
            const gameState = this.world.getGameState?.();
            if (hasLandlordComponent) {
              if (gameState?.phase === 'playing') {
                // Hide landlord cards during playing phase (they should be integrated into landlord's hand)
                const sprite = this.sprites.get(entity);
                if (sprite) {
                  sprite.visible = false;
                }
                continue;
              } else {
                // Ensure landlord cards are visible during bidding phase
                const sprite = this.sprites.get(entity);
                if (sprite) {
                  sprite.visible = true;
                }
              }
            }
          }
          
          let sprite = this.sprites.get(entity);
          
          // Create sprite if it doesn't exist
          if (!sprite) {
            this.createSprite(entity, transform, spriteComponent);
            sprite = this.sprites.get(entity);
            if (!sprite) continue; // Skip if sprite creation failed
          }
          
          // Get card data for scale and texture processing
          const cardData = this.world.components.get(entity, CardData);
          
          // Ensure card has border (always ensure border exists and is up to date)
          if (cardData && sprite) {
            this.ensureCardBorder(entity, sprite);
            
            // FORCE border verification for debugging border issues
            if (!this.cardBorders.has(entity)) {
              console.warn(`[RenderSystem] Border missing for card entity ${entity}, forcing recreation`);
              this.ensureCardBorder(entity, sprite);
            }
          }
          
          // Update sprite properties with selection offset
          sprite.x = transform.x;
          
          // Check if card is selected and apply upward offset
          const cardSelected = this.world.components.tryGet(entity, CardSelected);
          const selectionOffset = cardSelected?.selected ? -20 : 0; // 20px upward when selected
          sprite.y = transform.y + selectionOffset;
          
          // Apply scale - treat all cards equally
          sprite.scale.set(transform.scaleX, transform.scaleY);
          sprite.rotation = transform.rotation;
          sprite.alpha = spriteComponent.alpha;
          sprite.visible = spriteComponent.visible;
          
          // Set z-index for proper layering
          if (transform.zIndex !== undefined) {
            sprite.zIndex = transform.zIndex;
          }
          
          // Ensure human player cards are always interactive
          if (cardData && this.isHumanPlayerCard(entity) && !sprite.interactive) {
            console.log(`[RenderSystem] Restoring interactivity for human player card ${entity} (${cardData.rank}${cardData.suit})`);
            this.setupInteractivity(sprite, entity);
          }
          
          // Update texture if card data changed or if texture wasn't available before
          if (cardData) {
            let texture: PIXI.Texture | undefined;
            
            // For cards, determine which texture to use based on face up/down status and card ID
            if (!cardData.faceUp) {
              // Card is face down, use the back texture
              texture = this.textures.get('back');
            } else {
              // Card is face up, use the card's specific texture by ID
              texture = this.textures.get(`card_${cardData.id}`);
              
              // If card texture not found, log it once
              if (!texture) {
                const errorKey = `missing_texture_${cardData.id}`;
                this.logWarningOnce(errorKey, `[RenderSystem] Card texture card_${cardData.id} not found for ${cardData.rank} of ${cardData.suit}`);
                texture = this.textures.get('default') || PIXI.Texture.WHITE;
              }
            }
            
            if (texture && sprite.texture !== texture) {
              try {
                sprite.texture = texture;
                spriteComponent.texture = cardData.faceUp ? `card_${cardData.id}` : 'back';
              } catch (err) {
                const errorKey = `texture_update_failed_${entity}`;
                this.logErrorOnce(errorKey, `[RenderSystem] Failed to update texture for entity ${entity}: ${err}`);
              }
            }
          }
        } catch (entityError) {
          const errorKey = `entity_update_error_${entity}`;
          this.logErrorOnce(errorKey, `[RenderSystem] Error updating entity ${entity}: ${entityError}`);
        }
      }
      
      // Clean up sprites for entities that no longer exist or no longer have required components
      for (const entity of this.sprites.keys()) {
        if (!updatedEntities.has(entity)) {
          this.removeSprite(entity);
        }
      }

      // Ensure proper container sorting for z-index layering
      this.ensureContainerSorting();
    } catch (error) {
      console.error('[RenderSystem] Error in update:', error);
    }
  }

  /**
   * Debug method to log texture loading status
   */
  public debugTextureStatus(): void {
    console.log('[RenderSystem] Texture Status:');
    console.log(`Total textures loaded: ${this.textures.size}`);
    
    // Log available textures
    for (const [key, texture] of this.textures.entries()) {
      console.log(`  ${key}: ${texture.valid ? 'valid' : 'invalid'}`);
    }
    
    // Check specific card textures
    console.log('\nCard texture check:');
    for (let i = 0; i < 10; i++) {
      const cardTextureKey = `card_${i}`;
      const hasTexture = this.textures.has(cardTextureKey);
      console.log(`  ${cardTextureKey}: ${hasTexture ? 'available' : 'missing'}`);
    }
  }

  /**
   * Adds or updates a border for a card entity
   * @param entity The card entity
   * @param sprite The PIXI sprite for the card
   */
  private ensureCardBorder(entity: Entity, sprite: PIXI.Sprite): void {
    try {
      // Check if border already exists for this entity
      let border = this.cardBorders.get(entity);
      
      if (!border) {
        // Create new border
        border = new PIXI.Graphics();
        border.name = `border_${entity}`; // Give it a unique name
        this.cardBorders.set(entity, border);
        console.log(`[RenderSystem] Created new border for entity ${entity}`);
      } else {
        // Remove border from its current parent if it has one
        if (border.parent) {
          border.parent.removeChild(border);
        }
        // Clear existing graphics
        border.clear();
      }
      
      // FORCED VALIDATION: Ensure border exists in our tracking map
      if (!this.cardBorders.has(entity)) {
        console.error(`[RenderSystem] Border tracking failed for entity ${entity}, creating emergency border`);
        border = new PIXI.Graphics();
        border.name = `emergency_border_${entity}`;
        this.cardBorders.set(entity, border);
      }
      
      // Calculate border rectangle based on original texture dimensions
      // Border will inherit sprite's scale automatically as a child
      const width = sprite.texture.width;
      const height = sprite.texture.height;
      
      // Ensure border line width is appropriate for the scale
      // Thicker line for smaller scales to maintain visibility
      const minLineWidth = Math.max(2, 4 / Math.min(sprite.scale.x, sprite.scale.y));
      border.lineStyle(minLineWidth, 0x000000, 1.0);
      
      // Draw rectangle centered around origin (matching sprite anchor)
      // No need to scale dimensions since border inherits sprite scale
      border.drawRect(-width / 2, -height / 2, width, height);
      
      // Ensure border is properly positioned and visible
      border.position.set(0, 0);
      border.visible = true;
      
      // Add border as a child of the sprite so it moves with the card
      if (!sprite.children.includes(border)) {
        sprite.addChild(border);
      }
      
      // Ensure border is on top with proper layering
      border.zIndex = 999; // High z-index to ensure it's on top
      sprite.sortableChildren = true; // Enable sorting for this sprite
      
      // Border update logging removed to prevent console spam
      
    } catch (error) {
      console.warn('[RenderSystem] Failed to ensure border for card:', error);
    }
  }

  /**
   * Creates a sprite for an entity
   * @param entity The entity to create a sprite for
   * @param transform The transform component
   * @param spriteComponent The sprite component
   */
  private createSprite(entity: Entity, transform: Transform, spriteComponent: Sprite): void {
    try {
      const cardData = this.world.components.get(entity, CardData);
      let texture: PIXI.Texture;
      
      if (cardData) {
        // For cards, determine which texture to use based on face up/down status and card ID
        if (!cardData.faceUp) {
          // Card is face down, use the back texture
          texture = this.textures.get('back') || this.textures.get('default') || PIXI.Texture.WHITE;
          // Remove console.log to reduce spam
        } else {
          // Card is face up, use the card's specific texture by ID
          texture = this.textures.get(`card_${cardData.id}`) || this.textures.get('default') || PIXI.Texture.WHITE;
          if (!this.textures.has(`card_${cardData.id}`)) {
            const errorKey = `missing_card_texture_${cardData.id}`;
            this.logWarningOnce(errorKey, `No texture found for card ${cardData.id} (${cardData.rank} of ${cardData.suit}), using default`);
          }
        }
      } else {
        // No card data, use default texture
        texture = this.textures.get('default') || PIXI.Texture.WHITE;
      }
      
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      
      // Add border to card sprites
      if (cardData) {
        this.ensureCardBorder(entity, sprite);
      }
      
      this.container.addChild(sprite);
      this.sprites.set(entity, sprite);
      
      // Force interactivity for ALL human player cards first
      if (cardData && this.isHumanPlayerCard(entity)) {
        console.log(`[RenderSystem] Setting up interactivity for human player card ${entity} (${cardData.rank}${cardData.suit})`);
        this.setupInteractivity(sprite, entity);
      } else if (spriteComponent.isInteractive || this.shouldCardBeInteractive(entity)) {
        // Fallback for other interactive elements
        this.setupInteractivity(sprite, entity);
      }
    } catch (error) {
      console.error(`[RenderSystem] Error creating sprite for entity ${entity}:`, error);
    }
  }

  /**
   * Checks if a card belongs to the human player
   * @param entity The card entity to check
   * @returns true if the card belongs to human player
   */
  private isHumanPlayerCard(entity: Entity): boolean {
    // Check if this card belongs to the human player (player ID 0)
    const playerEntities = this.world.entities.with(PlayerInfo, Hand);
    
    for (const playerEntity of playerEntities) {
      const playerInfo = this.world.components.tryGet(playerEntity, PlayerInfo);
      const hand = this.world.components.tryGet(playerEntity, Hand);
      
      // If this is the human player and the card is in their hand
      if (playerInfo && playerInfo.id === 0 && !playerInfo.isAI && hand) {
        const cards = hand.cards instanceof Set ? Array.from(hand.cards) : hand.cards;
        if (cards.includes(entity)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Determines if a card should be interactive based on game state and ownership
   * @param entity The card entity to check
   * @returns true if the card should be interactive
   */
  private shouldCardBeInteractive(entity: Entity): boolean {
    // Only make cards interactive if they have CardData (are actual cards)
    const cardData = this.world.components.tryGet(entity, CardData);
    if (!cardData) return false;

    // Check if this card belongs to the human player (player ID 0)
    const playerEntities = this.world.entities.with(PlayerInfo, Hand);
    
    for (const playerEntity of playerEntities) {
      const playerInfo = this.world.components.tryGet(playerEntity, PlayerInfo);
      const hand = this.world.components.tryGet(playerEntity, Hand);
      
      // If this is the human player and the card is in their hand
      if (playerInfo && playerInfo.id === 0 && !playerInfo.isAI && hand) {
        const cards = hand.cards instanceof Set ? Array.from(hand.cards) : hand.cards;
        if (cards.includes(entity)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Sets up interactivity for a sprite
   * @param sprite The PIXI sprite
   * @param entity The entity the sprite belongs to
   */
  private setupInteractivity(sprite: PIXI.Sprite, entity: Entity): void {
      const cardData = this.world.components.get(entity, CardData);
      const gameState = this.world.getGameState?.();
      
      // Force interactivity for all human player cards
      if (this.isHumanPlayerCard(entity)) {
          sprite.interactive = true;
          sprite.cursor = 'pointer';
          
          // Clear existing listeners to prevent duplicates
          sprite.removeAllListeners('pointerdown');
          
          // Enhanced click handler with proper state checking
          const clickHandler = () => {
              const currentGameState = this.world.getGameState?.();
              if (currentGameState && 
                  currentGameState.phase === 'playing' && 
                  currentGameState.currentPlayerId === 0) {
                  
                  console.log(`[Click] Card ${entity} (${cardData?.rank}${cardData?.suit}) clicked!`);
                  this.world.eventBus.emit('selectCardRequest', { 
                      playerId: 0, 
                      cardEntity: entity 
                  });
              } else {
                  console.log(`[Click] Ignored - wrong phase (${currentGameState?.phase}) or player (${currentGameState?.currentPlayerId})`);
              }
          };
          
          sprite.on('pointerdown', clickHandler);
          console.log(`[RenderSystem] Enhanced interactivity for human card ${entity}`);
      } else {
          sprite.interactive = false;
      }
  }

  private ensureContainerSorting(): void {
      if (this.container) {
          this.container.sortableChildren = true;
          this.container.sortChildren();
      }
  }

  private refreshAllInteractivity(): void {
      console.log('[RenderSystem] Refreshing interactivity for all sprites...');
      let refreshedCount = 0;
      
      for (const [entity, sprite] of this.sprites) {
          if (this.isHumanPlayerCard(entity)) {
              this.setupInteractivity(sprite, entity);
              refreshedCount++;
          }
      }
      
      console.log(`[RenderSystem] Refreshed interactivity for ${refreshedCount} human cards`);
  }

  /**
   * Removes a sprite and cleans up associated resources
   * @param entity The entity whose sprite should be removed
   */
  private removeSprite(entity: Entity): void {
    const sprite = this.sprites.get(entity);
    if (sprite) {
      // Remove event listeners
      const listeners = this.eventListeners.get(entity);
      if (listeners) {
        listeners.forEach(removeListener => removeListener());
        this.eventListeners.delete(entity);
      }
      
      // Clean up border mapping
      const border = this.cardBorders.get(entity);
      if (border) {
        // Border will be destroyed along with sprite children
        this.cardBorders.delete(entity);
      }
      
      // Remove and destroy sprite
      this.container.removeChild(sprite);
      sprite.destroy({ children: true, texture: false, baseTexture: false });
      this.sprites.delete(entity);
    }
  }

  /**
   * Logs an error message only once to prevent spam
   */
  private logErrorOnce(key: string, message: string) {
    if (!this.loggedErrors.has(key)) {
      console.error(message);
      this.loggedErrors.add(key);
    }
  }

  /**
   * Logs a warning message only once to prevent spam
   */
  private logWarningOnce(key: string, message: string) {
    if (!this.loggedWarnings.has(key)) {
      console.warn(message);
      this.loggedWarnings.add(key);
    }
  }

  /**
   * Clears error and warning caches
   */
  public clearErrorCache() {
    this.loggedErrors.clear();
    this.loggedWarnings.clear();
  }

  /**
   * Cleans up all resources used by the system
   */
  cleanup() {
    // Remove all event listeners
    this.eventListeners.forEach(listeners => {
      listeners.forEach(removeListener => removeListener());
    });
    this.eventListeners.clear();
    
    // Remove all sprites
    this.sprites.forEach(sprite => {
      sprite.destroy({ children: true, texture: false, baseTexture: false });
    });
    this.sprites.clear();
    
    // Destroy textures
    this.textures.forEach(texture => {
      texture.destroy(true);
    });
    this.textures.clear();
    
    // Remove container
    this.container.destroy({ children: true, texture: false, baseTexture: false });
    
    // Entity cleanup is handled in update loop, no event listener to remove
  }

  // New method to force interactivity refresh (called by debug systems)
  forceInteractivityRefresh(): void {
      this.refreshAllInteractivity();
      this.ensureContainerSorting();
  }

  private getCardTexture(cardData: CardData): PIXI.Texture {
    // Use card ID to look up texture from game data
    const gameData = this.getGameData();
    const cardDef = gameData.cards.find((c: any) => c.id === cardData.id);
    const fileName = cardDef?.fileName || 'cardback.png';
    const texturePath = `/GameAssets/images/${fileName}`;
    
    // Special handling for small joker (sjoker.png) - add white background
    if (fileName === 'sjoker.png') {
      return this.createWhiteBackgroundTexture(texturePath);
    }
    
    if (this.textures.has(texturePath)) {
      return this.textures.get(texturePath)!;
    }

    try {
      const texture = PIXI.Texture.from(texturePath);
      this.textures.set(texturePath, texture);
      return texture;
    } catch (error) {
      console.warn(`[RenderSystem] Failed to load texture ${texturePath}:`, error);
      return this.textures.get('default') || PIXI.Texture.WHITE;
    }
  }

  private getGameData(): any {
    // Access game data - this should match your data loading pattern
    return (window as any).gameData || { cards: [] };
  }

  private createWhiteBackgroundTexture(texturePath: string): PIXI.Texture {
    // Check if we already created this texture
    const whiteBackgroundPath = `${texturePath}_white_bg`;
    if (this.textures.has(whiteBackgroundPath)) {
      return this.textures.get(whiteBackgroundPath)!;
    }

    try {
      // Load the original texture
      const originalTexture = PIXI.Texture.from(texturePath);
      
      // Create a graphics object for white background
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0xFFFFFF, 1); // White background
      graphics.drawRoundedRect(0, 0, 100, 140, 8); // Standard card size with rounded corners
      graphics.endFill();
      
      // Create container to combine background and card
      const container = new PIXI.Container();
      container.addChild(graphics);
      
      // Add the original card on top
      const cardSprite = new PIXI.Sprite(originalTexture);
      cardSprite.anchor.set(0.5);
      cardSprite.x = 50; // Center horizontally
      cardSprite.y = 70; // Center vertically
      container.addChild(cardSprite);
      
      // Render to texture
      const renderTexture = PIXI.RenderTexture.create({
        width: 100,
        height: 140
      });
      
      this.app.renderer.render(container, { renderTexture });
      
      // Store and return the new texture
      this.textures.set(whiteBackgroundPath, renderTexture);
      console.log('[RenderSystem] Created white background texture for sjoker.png');
      
      return renderTexture;
    } catch (error) {
      console.warn(`[RenderSystem] Failed to create white background for ${texturePath}:`, error);
      // Fallback to original texture
      const fallbackTexture = PIXI.Texture.from(texturePath);
      this.textures.set(texturePath, fallbackTexture);
      return fallbackTexture;
    }
  }
}
