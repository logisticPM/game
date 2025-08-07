export class KeyboardShortcuts {
  private static instance: KeyboardShortcuts;
  private shortcuts: Map<string, () => void> = new Map();
  private isEnabled: boolean = false;

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public static getInstance(): KeyboardShortcuts {
    if (!KeyboardShortcuts.instance) {
      KeyboardShortcuts.instance = new KeyboardShortcuts();
    }
    return KeyboardShortcuts.instance;
  }

  public static enable(): void {
    const instance = KeyboardShortcuts.getInstance();
    if (!instance.isEnabled) {
      instance.isEnabled = true;
      document.addEventListener('keydown', instance.handleKeyDown);
    }
  }

  public static disable(): void {
    const instance = KeyboardShortcuts.getInstance();
    if (instance.isEnabled) {
      instance.isEnabled = false;
      document.removeEventListener('keydown', instance.handleKeyDown);
    }
  }

  public static registerShortcut(key: string, callback: () => void): void {
    KeyboardShortcuts.getInstance().shortcuts.set(key.toLowerCase(), callback);
  }

  public static unregisterShortcut(key: string): void {
    KeyboardShortcuts.getInstance().shortcuts.delete(key.toLowerCase());
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;

    const key = this.getKeyString(event);
    const callback = this.shortcuts.get(key);
    
    if (callback) {
      event.preventDefault();
      callback();
    }
  }

  private getKeyString(event: KeyboardEvent): string {
    let key = event.key.toLowerCase();
    
    if (event.ctrlKey) key = `ctrl+${key}`;
    if (event.altKey) key = `alt+${key}`;
    if (event.shiftKey) key = `shift+${key}`;
    
    return key;
  }

  public static getRegisteredShortcuts(): string[] {
    return Array.from(KeyboardShortcuts.getInstance().shortcuts.keys());
  }

  /**
   * Initialize keyboard shortcuts with default shortcuts
   */
  public initialize(): void {
    // Register default shortcuts
    KeyboardShortcuts.registerShortcut('f12', () => {
      console.log('[KeyboardShortcuts] F12 pressed - Debug mode');
    });
    
    KeyboardShortcuts.registerShortcut('ctrl+d', () => {
      console.log('[KeyboardShortcuts] Ctrl+D pressed - Toggle debug');
    });
    
    // Enable keyboard shortcuts
    KeyboardShortcuts.enable();
    
    console.log('[KeyboardShortcuts] Initialized with shortcuts:', KeyboardShortcuts.getRegisteredShortcuts());
  }
}
