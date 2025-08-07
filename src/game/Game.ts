import * as PIXI from 'pixi.js';
import { World } from '../ecs';
import { dataManager } from './DataManager';

export class Game {
  public app: PIXI.Application;
  public world!: World;

  private constructor(parent: HTMLElement) {
    const gameData = dataManager.getGameData();
    
    // 获取容器尺寸或使用窗口尺寸
    const containerWidth = parent.clientWidth || window.innerWidth;
    const containerHeight = parent.clientHeight || window.innerHeight;
    
    this.app = new PIXI.Application({
      width: containerWidth,
      height: containerHeight,
      backgroundColor: 0x1a1a1a,
      resizeTo: parent, // 自动调整到父容器大小
    });
    
    parent.appendChild(this.app.view as HTMLCanvasElement);
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize() {
    // 强制重新调整canvas尺寸
    const parent = (this.app.view as HTMLCanvasElement).parentElement;
    if (parent) {
      this.app.renderer.resize(parent.clientWidth || window.innerWidth, parent.clientHeight || window.innerHeight);
      
      // 重新调整背景大小
      this.resizeBackground();
    }
  }

  private resizeBackground() {
    // 查找背景精灵并调整大小
    const background = this.app.stage.children.find(child => child.name === 'background') as PIXI.Sprite;
    if (background) {
      background.width = this.app.screen.width;
      background.height = this.app.screen.height;
    }
  }

  private init() {
    const gameData = dataManager.getGameData();

    // Add background
    const background = PIXI.Sprite.from(PIXI.Texture.from((gameData as any).texturePath.background));
    background.name = 'background'; // 给背景一个名称便于查找
    background.width = this.app.screen.width;
    background.height = this.app.screen.height;
    this.app.stage.addChild(background);

    this.world = new World(this.app, this);
    this.app.ticker.add((delta) => {
      // Convert PIXI delta (frames) to milliseconds
      // PIXI delta is frame-based, typically around 0.016 for 60fps
      const deltaMS = delta * (1000 / 60); // Convert to milliseconds
      this.world.update(deltaMS);
    });
  }

  public static async create(parent: HTMLElement): Promise<Game> {
    await dataManager.loadGameData();
    const game = new Game(parent);
    game.init();
    return game;
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize.bind(this));
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
}
