import React, { useState, useEffect } from 'react';
import { Game } from '../game/Game';
import { GameState, GamePhase, PlayerInfo, Hand } from '../ecs/components';
import { PlayedCardsArea } from './PlayedCardsArea';
import { PlayerAvatar } from './PlayerAvatar';

interface HudProps {
  game: Game;
}

export const Hud: React.FC<HudProps> = ({ game }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerData, setPlayerData] = useState<{id: number, name: string, cardCount: number, role: 'farmer' | 'landlord'}[]>([]);
  const [hintResult, setHintResult] = useState<{description: string, cards: any[]} | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);

  useEffect(() => {
    const updatePlayerData = () => {
      const players = [];
      const playerEntities = game.world.entities.with(PlayerInfo, Hand);
      
      for (const entity of playerEntities) {
        try {
          const playerInfo = game.world.components.tryGet(entity, PlayerInfo);
          const hand = game.world.components.tryGet(entity, Hand);
          
          if (playerInfo && hand) {
            players.push({
              id: playerInfo.id,
              name: playerInfo.name,
              cardCount: hand.cards?.length || 0,
              role: playerInfo.role.toString() as 'farmer' | 'landlord'
            });
          }
        } catch (error) {
          console.warn(`[Hud] Error getting player data for entity ${entity}:`, error);
        }
      }
      
      setPlayerData(players);
    };

    const handleStateChange = (payload: { gameState: GameState } | GameState) => {
      // Handle both payload formats for compatibility
      const newState = 'gameState' in payload ? payload.gameState : payload;
      console.log('[HUD] Received state change:', newState);
      setGameState(JSON.parse(JSON.stringify(newState))); // Deep copy for re-render
      updatePlayerData(); // Update player data when game state changes
    };

    game.world.eventBus.on('gameStateChanged', handleStateChange);

    // Initial state
    const initialGameState = game.world.getGameState();
    if (initialGameState) {
      handleStateChange(initialGameState);
    }

    return () => {
      game.world.eventBus.off('gameStateChanged', handleStateChange);
    };
  }, [game]);

  // Listen for hint results
  useEffect(() => {
    const handleHintResult = (event: { playerId: number; suggestion: { description: string; cards: any[] } }) => {
      console.log('[HUD] Hint result received:', event);
      setHintResult(event.suggestion);
      setShowHint(true);
      
      // Auto-hide hint after 5 seconds
      setTimeout(() => {
        setShowHint(false);
      }, 5000);
    };

    const unsubscribeHint = game.world.eventBus.on('hintResult', handleHintResult);

    return () => {
      unsubscribeHint();
    };
  }, [game.world]);

  const handleBid = (amount: number) => {
    if (!gameState) return;
    game.world.addBidRequest(gameState.currentPlayerId ?? 0, amount);
  };

  const handlePlay = () => {
    if (!gameState) return;
    game.world.addPlayCardsRequest(gameState.currentPlayerId ?? 0);
  };

  const handlePass = () => {
    if (!gameState) return;
    game.world.addPassTurnRequest(gameState.currentPlayerId ?? 0);
  };

  const handleHint = () => {
    if (!gameState) return;
    game.world.eventBus.emit('hintRequest', { playerId: gameState.currentPlayerId ?? 0 });
  };

  if (!gameState) {
    return <div className="react-ui-container">Loading...</div>;
  }

  const isPlayerTurn = gameState.currentPlayerId === 0; // Assuming player is ID 0
  
  // Debug logging for UI state (can be removed in production)
  // console.log(`[HUD] gameState.phase: ${gameState.phase}, isPlayerTurn: ${isPlayerTurn}, currentPlayer: ${gameState.currentPlayerId}, currentBid: ${gameState.currentBid}`);
  
  // Get AI players data - with safety checks
  const leftPlayer = playerData.find(p => p.id === 1);
  const rightPlayer = playerData.find(p => p.id === 2);
  const humanPlayer = playerData.find(p => p.id === 0); // Human player
  
  // Get bid information for each player
  const getBidAmount = (playerId: number) => {
    if (!gameState?.bidHistory || !Array.isArray(gameState.bidHistory)) return undefined;
    const bidEntry = gameState.bidHistory.find(bid => bid.playerId === playerId);
    return bidEntry ? bidEntry.bid : undefined;
  };

  return (
    <div className="react-ui-container">
      {/* Left AI Player */}
      {leftPlayer && (
        <PlayerAvatar
          playerId={leftPlayer.id}
          playerName={leftPlayer.name}
          cardCount={leftPlayer.cardCount}
          isCurrentPlayer={gameState.currentPlayerId === leftPlayer.id}
          position="left"
          bidAmount={getBidAmount(leftPlayer.id)}
          gamePhase={gameState.phase}
          role={leftPlayer.role}
        />
      )}

      {/* Right AI Player */}
      {rightPlayer && (
        <PlayerAvatar
          playerId={rightPlayer.id}
          playerName={rightPlayer.name}
          cardCount={rightPlayer.cardCount}
          isCurrentPlayer={gameState.currentPlayerId === rightPlayer.id}
          position="right"
          bidAmount={getBidAmount(rightPlayer.id)}
          gamePhase={gameState.phase}
          role={rightPlayer.role}
        />
      )}

      {/* Human Player Avatar - Bottom Center */}
      {humanPlayer && (
        <div className="human-player-avatar">
          <PlayerAvatar
            playerId={humanPlayer.id}
            playerName={humanPlayer.name}
            cardCount={humanPlayer.cardCount}
            isCurrentPlayer={gameState.currentPlayerId === humanPlayer.id}
            position="center"
            bidAmount={getBidAmount(humanPlayer.id)}
            gamePhase={gameState.phase}
            role={humanPlayer.role}
          />
        </div>
      )}

      {/* Top Game Info */}
      <div className="game-info">
        <span>Phase: {gameState.phase === GamePhase.Bidding ? 'Bidding' : gameState.phase === GamePhase.Playing ? 'Playing' : 'Finished'}</span>
        <span>Current Player: {gameState.currentPlayerId ?? 0}</span>
        {gameState.phase === GamePhase.Bidding && <span>Current Bid: {gameState.currentBid ?? 0}</span>}
      </div>

      {/* Central Played Cards Area */}
      {gameState.phase === GamePhase.Playing && (
        <PlayedCardsArea gameState={gameState} />
      )}

      {/* Bottom Controls */}
      <div className="bottom-controls">
        {gameState.phase === GamePhase.Bidding && isPlayerTurn && (
          <div className="bidding-panel">
            <button onClick={() => handleBid(1)} disabled={(gameState.currentBid ?? 0) >= 1}>Bid 1</button>
            <button onClick={() => handleBid(2)} disabled={(gameState.currentBid ?? 0) >= 2}>Bid 2</button>
            <button onClick={() => handleBid(3)} disabled={(gameState.currentBid ?? 0) >= 3}>Bid 3</button>
            <button onClick={() => handleBid(0)}>Pass</button>
          </div>
        )}
        
        {/* Debug info for troubleshooting */}
        {gameState.phase === GamePhase.Bidding && !isPlayerTurn && (
          <div className="waiting-bidding">
            Waiting for other players to bid... (Current player: {gameState.currentPlayerId})
          </div>
        )}
        
        {gameState.phase !== GamePhase.Bidding && (
          <div className="phase-info">
            Current Phase: {gameState.phase}
          </div>
        )}

        {gameState.phase === GamePhase.Playing && (
          <div className="playing-controls">
            {isPlayerTurn && (
              <div className="player-action-buttons">
                <button onClick={handlePlay} className="play-btn">Play</button>
                <button onClick={handlePass} className="pass-btn">Pass</button>
                <button onClick={handleHint} className="hint-btn">Hint</button>
              </div>
            )}
            {!isPlayerTurn && (
              <div className="waiting-indicator">
                Waiting for other players to play...
              </div>
            )}
          </div>
        )}

        {/* Hint Display Area */}
        {showHint && hintResult && (
          <div className="hint-display">
            <div className="hint-content">
              <span className="hint-icon">💡</span>
              <span className="hint-text">{hintResult.description}</span>
              {hintResult.cards && hintResult.cards.length > 0 && (
                <div className="hint-cards">
                  Suggested cards: {hintResult.cards.map(card => card.rank + card.suit).join(', ')}
                </div>
              )}
            </div>
            <button 
              className="hint-close" 
              onClick={() => setShowHint(false)}
              title="Close hint"
            >
              ×
            </button>
          </div>
        )}

        {gameState.phase === GamePhase.Finished && (
          <div className="game-over-panel">
            <h2>Game Over</h2>
            <h3>{gameState.winner?.toUpperCase()} Wins!</h3>
            <button onClick={() => window.location.reload()}>Play Again</button>
          </div>
        )}
      </div>
    </div>
  );
};
