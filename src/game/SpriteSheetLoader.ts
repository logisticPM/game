// Sprite Sheet 加载器 - 处理新的游戏资产
import * as PIXI from 'pixi.js';

export interface SpriteSheetConfig {
  cardWidth: number;
  cardHeight: number;
  playingCardsConfig: {
    cols: number;
    rows: number;
    suits: string[];
    ranks: string[];
  };
  jokersConfig: {
    smallJokerIndex: number;
    bigJokerIndex: number;
  };
  cardBacksConfig: {
    styles: string[];
  };
}

class SpriteSheetLoader {
  private static instance: SpriteSheetLoader;
  private cardTextures: Map<string, PIXI.Texture> = new Map();
  private isLoaded: boolean = false;
  private config: SpriteSheetConfig;

  private constructor() {
    this.config = {
      cardWidth: 128,
      cardHeight: 178,
      playingCardsConfig: {
        cols: 13,
        rows: 4,
        suits: ['clubs', 'hearts', 'spades', 'diamonds'], // 梅花，红桃，黑桃，方片
        ranks: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
      },
      jokersConfig: {
        smallJokerIndex: 0, // 左边
        bigJokerIndex: 1    // 右边
      },
      cardBacksConfig: {
        styles: ['blue_pattern', 'pink_star', 'red_pattern', 'dark_blue']
      }
    };
  }

  public static getInstance(): SpriteSheetLoader {
    if (!SpriteSheetLoader.instance) {
      SpriteSheetLoader.instance = new SpriteSheetLoader();
    }
    return SpriteSheetLoader.instance;
  }

  public async loadSpriteSheets(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      console.log('[SpriteSheetLoader] Loading sprite sheets...');

      // 加载主要的扑克牌 sprite sheet
      const playingCardsTexture = await PIXI.Assets.load({
        alias: 'playingCards',
        src: '/GameAssets/images/PlayingCards 128x178.png'
      });

      // 加载王牌 sprite sheet
      const jokersTexture = await PIXI.Assets.load({
        alias: 'jokers',
        src: '/GameAssets/images/Jokers 128x178.png'
      });

      // 加载卡背 sprite sheet
      const cardBacksTexture = await PIXI.Assets.load({
        alias: 'cardBacks',
        src: '/GameAssets/images/Card Backs 128x178.png'
      });

      // 处理扑克牌
      this.processPlayingCards(playingCardsTexture);

      // 处理王牌
      this.processJokers(jokersTexture);

      // 处理卡背
      this.processCardBacks(cardBacksTexture);

      this.isLoaded = true;
      console.log('[SpriteSheetLoader] All sprite sheets loaded successfully');

    } catch (error) {
      console.error('[SpriteSheetLoader] Failed to load sprite sheets:', error);
      throw error;
    }
  }

  private processPlayingCards(baseTexture: PIXI.Texture): void {
    const { cardWidth, cardHeight, playingCardsConfig } = this.config;
    const { cols, rows, suits, ranks } = playingCardsConfig;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const suit = suits[row];
        const rank = ranks[col];
        
        // 创建纹理区域
        const rect = new PIXI.Rectangle(
          col * cardWidth,
          row * cardHeight,
          cardWidth,
          cardHeight
        );

        const texture = new PIXI.Texture(baseTexture.baseTexture, rect);
        
        // 使用原版的命名约定
        const textureKey = this.getCardTextureKey(suit, rank);
        this.cardTextures.set(textureKey, texture);
        
        // 也缓存到 PIXI.Assets 中
        PIXI.Assets.cache.set(textureKey, texture);
        
        console.log(`[SpriteSheetLoader] Created texture: ${textureKey}`);
      }
    }
  }

  private processJokers(baseTexture: PIXI.Texture): void {
    const { cardWidth, cardHeight } = this.config;

    // Debug: Check Joker sprite sheet dimensions
    console.log(`[SpriteSheetLoader] Joker sprite sheet dimensions: ${baseTexture.width}x${baseTexture.height}`);
    console.log(`[SpriteSheetLoader] Expected card dimensions: ${cardWidth}x${cardHeight}`);

    // Calculate actual dimensions from sprite sheet
    const actualJokerWidth = baseTexture.width / 2; // 2 jokers side by side
    const actualJokerHeight = baseTexture.height;
    
    console.log(`[SpriteSheetLoader] Calculated joker dimensions: ${actualJokerWidth}x${actualJokerHeight}`);

    // Use actual dimensions if they're different from config
    const jokerWidth = actualJokerWidth > 0 ? actualJokerWidth : cardWidth;
    const jokerHeight = actualJokerHeight > 0 ? actualJokerHeight : cardHeight;

    // 小王 (左边)
    const smallJokerRect = new PIXI.Rectangle(0, 0, jokerWidth, jokerHeight);
    const smallJokerTexture = new PIXI.Texture(baseTexture.baseTexture, smallJokerRect);
    this.cardTextures.set('sjoker.png', smallJokerTexture);
    PIXI.Assets.cache.set('sjoker.png', smallJokerTexture);

    // 大王 (右边)
    const bigJokerRect = new PIXI.Rectangle(jokerWidth, 0, jokerWidth, jokerHeight);
    const bigJokerTexture = new PIXI.Texture(baseTexture.baseTexture, bigJokerRect);
    this.cardTextures.set('joker.png', bigJokerTexture);
    PIXI.Assets.cache.set('joker.png', bigJokerTexture);

    console.log(`[SpriteSheetLoader] Created joker textures with dimensions: ${jokerWidth}x${jokerHeight}`);
  }

  private processCardBacks(baseTexture: PIXI.Texture): void {
    const { cardWidth, cardHeight, cardBacksConfig } = this.config;
    const { styles } = cardBacksConfig;

    styles.forEach((style, index) => {
      const rect = new PIXI.Rectangle(
        index * cardWidth,
        0,
        cardWidth,
        cardHeight
      );

      const texture = new PIXI.Texture(baseTexture.baseTexture, rect);
      const textureKey = `cardback_${style}.png`;
      
      this.cardTextures.set(textureKey, texture);
      PIXI.Assets.cache.set(textureKey, texture);
      
      // 设置默认卡背
      if (index === 0) {
        this.cardTextures.set('cardback.png', texture);
        PIXI.Assets.cache.set('cardback.png', texture);
      }
    });

    console.log('[SpriteSheetLoader] Created card back textures');
  }

  private getCardTextureKey(suit: string, rank: string): string {
    // 映射到原版的文件命名约定
    const suitMap: Record<string, string> = {
      'clubs': 'Clovers',
      'hearts': 'Hearts',
      'spades': 'Pikes',
      'diamonds': 'Tiles'
    };

    const rankMap: Record<string, string> = {
      'A': 'A',
      'K': 'King',
      'Q': 'Queen',
      'J': 'Jack',
      '10': '10',
      '9': '9',
      '8': '8',
      '7': '7',
      '6': '6',
      '5': '5',
      '4': '4',
      '3': '3',
      '2': '2'
    };

    const mappedSuit = suitMap[suit] || suit;
    const mappedRank = rankMap[rank] || rank;

    return `${mappedSuit}_${mappedRank}_white.png`;
  }

  public getTexture(textureKey: string): PIXI.Texture | null {
    return this.cardTextures.get(textureKey) || null;
  }

  public isAssetsLoaded(): boolean {
    return this.isLoaded;
  }

  public getAllTextureKeys(): string[] {
    return Array.from(this.cardTextures.keys());
  }

  public getTextureStats(): { 
    totalTextures: number; 
    memoryEstimate: number; 
  } {
    const totalTextures = this.cardTextures.size;
    // 估算内存使用 (128x178x4字节 每张)
    const memoryEstimate = totalTextures * 128 * 178 * 4;
    
    return { totalTextures, memoryEstimate };
  }
}

export const spriteSheetLoader = SpriteSheetLoader.getInstance();