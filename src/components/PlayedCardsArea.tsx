import React from 'react';

interface PlayedCardsAreaProps {
  playedCards?: {
    playerId: number;
    cards: any[];
  }[];
}

export const PlayedCardsArea: React.FC<PlayedCardsAreaProps> = ({ playedCards = [] }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '400px',
      height: '200px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      {playedCards.map((playerCards, index) => (
        <div key={playerCards.playerId} style={{
          margin: '5px 0',
          display: 'flex',
          gap: '5px'
        }}>
          <span style={{ 
            color: 'white', 
            fontSize: '12px',
            minWidth: '60px'
          }}>
            Player {playerCards.playerId}:
          </span>
          <div style={{ display: 'flex', gap: '2px' }}>
            {playerCards.cards.map((card, cardIndex) => (
              <div key={cardIndex} style={{
                width: '30px',
                height: '40px',
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 'bold'
              }}>
                {card.suit}{card.rank}
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {playedCards.length === 0 && (
        <div style={{
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          No cards played yet
        </div>
      )}
    </div>
  );
};
