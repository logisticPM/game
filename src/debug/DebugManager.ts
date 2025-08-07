export class DebugManager {
  private static instance: DebugManager;
  private debugData: Record<string, any> = {};
  private isEnabled: boolean = false;

  private constructor() {}

  public static getInstance(): DebugManager {
    if (!DebugManager.instance) {
      DebugManager.instance = new DebugManager();
    }
    return DebugManager.instance;
  }

  public static enable(): void {
    DebugManager.getInstance().isEnabled = true;
  }

  public static disable(): void {
    DebugManager.getInstance().isEnabled = false;
  }

  public static isEnabled(): boolean {
    return DebugManager.getInstance().isEnabled;
  }

  public static setDebugData(key: string, value: any): void {
    if (DebugManager.getInstance().isEnabled) {
      DebugManager.getInstance().debugData[key] = value;
    }
  }

  public static getDebugData(key: string): any {
    return DebugManager.getInstance().debugData[key];
  }

  public static getDebugInfo(): Record<string, any> {
    return { ...DebugManager.getInstance().debugData };
  }

  public static log(message: string, data?: any): void {
    if (DebugManager.getInstance().isEnabled) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }

  public static warn(message: string, data?: any): void {
    if (DebugManager.getInstance().isEnabled) {
      console.warn(`[DEBUG] ${message}`, data || '');
    }
  }

  public static error(message: string, data?: any): void {
    if (DebugManager.getInstance().isEnabled) {
      console.error(`[DEBUG] ${message}`, data || '');
    }
  }

  public static clear(): void {
    DebugManager.getInstance().debugData = {};
  }

  /**
   * Initialize the debug manager with world and toggle function
   * @param world The game world instance
   * @param toggleFunction Function to toggle debug visibility
   */
  public initialize(world: any, toggleFunction: () => void): void {
    this.isEnabled = true;
    this.debugData.world = world;
    this.debugData.toggleFunction = toggleFunction;
    
    // Attach to window for console access
    if (typeof window !== 'undefined') {
      (window as any).debugManager = {
        toggle: toggleFunction,
        world: world,
        getData: () => this.debugData,
        log: (key: string, value: any) => DebugManager.setDebugData(key, value),
        enable: () => DebugManager.enable(),
        disable: () => DebugManager.disable(),
        clear: () => DebugManager.clear()
      };
      console.log('[DebugManager] Debug functions attached to window.debugManager');
    }
  }
}
