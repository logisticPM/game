export interface CardDefinition {
  id: number;
  suit: string;
  rank: string;
  value: number;
  fileName: string;
}

export interface PlayerLayout {
  id: number;
  x: number;
  y: number;
  cardSpacing: number;
  scale: number;
}

export interface GameData {
  world: { width: number; height: number };
  layout: { 
    landlordCards: { startX: number; y: number; spacing: number };
    players: PlayerLayout[];
    player_played_cards: { x: number; y: number };
    landlord_cards: { x: number; y: number; spacing: number };
  };
  card: { width: number; height: number };
  texturePath: { 
    base: string; 
    back: string; 
    background: string; 
  };
  cards: CardDefinition[];
}

class DataManager {
  private static instance: DataManager;
  private gameData: GameData | null = null;

  private constructor() {}

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  async loadGameData(): Promise<void> {
    if (this.gameData) {
      return Promise.resolve();
    }

    try {
      // 先加载 Sprite Sheets
      const { spriteSheetLoader } = await import('./SpriteSheetLoader');
      await spriteSheetLoader.loadSpriteSheets();

      const response = await fetch('/GameAssets/GameData.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.gameData = await response.json();
      console.log('Game data and sprite sheets loaded successfully.');
    } catch (error) {
      console.error('Failed to load game data:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  public getGameData(): GameData {
    if (!this.gameData) {
      throw new Error('Game data has not been loaded yet.');
    }
    return this.gameData;
  }
}

export const dataManager = DataManager.getInstance();
