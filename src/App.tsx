import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { Hud } from './components/Hud';
import { DebugPanel } from './debug';
import { DebugManager } from './debug/DebugManager';
import { KeyboardShortcuts } from './debug/KeyboardShortcuts';
import { SpriteSheetTest } from './debug/SpriteSheetTest';

// Global flag to prevent multiple game initializations in React Strict Mode
let gameInitialized = false;
let globalGameInstance: Game | null = null;

function App() {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Game | null>(null);
  const [isGameReady, setGameReady] = useState(false);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [showSpriteSheetTest, setShowSpriteSheetTest] = useState(false);

  useEffect(() => {
    // Check if game is already initialized globally (React Strict Mode protection)
    if (gameInitialized && globalGameInstance) {
      gameInstanceRef.current = globalGameInstance;
      setGameReady(true);
      return;
    }

    if (gameInstanceRef.current || !pixiContainerRef.current) {
        return;
    }

    const initGame = async () => {
        if (pixiContainerRef.current && !gameInitialized) {
            console.log('[App] Initializing game...');
            gameInitialized = true;
            
            const game = await Game.create(pixiContainerRef.current);
            gameInstanceRef.current = game;
            globalGameInstance = game;
            
            // 暴露world和game对象到全局作用域以便debugging
            (window as any).world = game.world;
            (window as any).gameInstance = game;
            
            // 暴露组件类以便debugging
            const { PlayerInfo, Hand, CardData, Transform, Sprite, LandlordCardComponent, SelectedCards, CardSelected } = await import('./ecs/components');
            (window as any).Components = {
              PlayerInfo,
              Hand, 
              CardData,
              Transform,
              Sprite,
              LandlordCardComponent,
              SelectedCards,
              CardSelected
            };
            
            console.log('[App] World object and component classes exposed for debugging');
            
            setGameReady(true); // Use a boolean state to trigger HUD rendering
            
            // Initialize debug manager
            const debugManager = DebugManager.getInstance();
            debugManager.initialize(game.world, () => setIsDebugVisible(!isDebugVisible));
            
            // Initialize keyboard shortcuts
            const keyboardShortcuts = KeyboardShortcuts.getInstance();
            keyboardShortcuts.initialize();
            
            console.log('[App] Game initialized successfully');
        }
    };

    initGame();

    return () => {
        // Only cleanup on final unmount - preserve global state for Strict Mode
        console.log('[App] Component unmounting...');
        // Don't reset global state immediately as React Strict Mode might remount
    };
  }, []);

  // Cleanup function for final app shutdown
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (globalGameInstance) {
        console.log('[App] Final cleanup on page unload');
        globalGameInstance.destroy();
        globalGameInstance = null;
        gameInitialized = false;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <>
      <div ref={pixiContainerRef} className="pixi-canvas-container" />
      {isGameReady && gameInstanceRef.current && <Hud game={gameInstanceRef.current} />}
      {isGameReady && gameInstanceRef.current && (
        <DebugPanel 
          world={gameInstanceRef.current.world}
          isVisible={isDebugVisible}
          onToggle={() => setIsDebugVisible(!isDebugVisible)}
        />
      )}
      
      {/* Sprite Sheet 测试按钮 */}
      {isGameReady && (
        <button
          onClick={() => setShowSpriteSheetTest(true)}
          style={{
            position: 'fixed',
            top: '10px',
            right: '120px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 1000
          }}
        >
          测试 Sprite Sheet
        </button>
      )}
      
      {/* Sprite Sheet 测试界面 */}
      {showSpriteSheetTest && (
        <SpriteSheetTest onClose={() => setShowSpriteSheetTest(false)} />
      )}
    </>
  );
}

export default App;
