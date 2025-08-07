import React from 'react';

interface PlayerAvatarProps {
  playerId: number;
  playerName?: string;
  isLandlord?: boolean;
  isCurrentPlayer?: boolean;
  cardCount?: number;
  position?: 'top' | 'left' | 'right' | 'bottom';
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  playerId,
  playerName = `Player ${playerId}`,
  isLandlord = false,
  isCurrentPlayer = false,
  cardCount = 0,
  position = 'bottom'
}) => {
  const getPositionStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '5px',
      padding: '10px',
      borderRadius: '8px',
      backgroundColor: isCurrentPlayer ? 'rgba(255, 255, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)',
      border: isCurrentPlayer ? '2px solid yellow' : '1px solid rgba(255, 255, 255, 0.3)',
      color: 'white',
      fontSize: '12px',
      minWidth: '80px'
    };

    switch (position) {
      case 'top':
        return { ...baseStyles, top: '20px', left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { ...baseStyles, left: '20px', top: '50%', transform: 'translateY(-50%)' };
      case 'right':
        return { ...baseStyles, right: '20px', top: '50%', transform: 'translateY(-50%)' };
      case 'bottom':
      default:
        return { ...baseStyles, bottom: '20px', left: '50%', transform: 'translateX(-50%)' };
    }
  };

  return (
    <div style={getPositionStyles()}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: isLandlord ? '#FFD700' : '#4A90E2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '16px',
        color: isLandlord ? '#000' : '#fff'
      }}>
        {isLandlord ? '地' : playerId}
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 'bold' }}>
          {playerName}
        </div>
        <div style={{ fontSize: '10px', opacity: 0.8 }}>
          {cardCount} cards
        </div>
        {isLandlord && (
          <div style={{ 
            fontSize: '10px', 
            color: '#FFD700',
            fontWeight: 'bold'
          }}>
            LANDLORD
          </div>
        )}
      </div>
    </div>
  );
};
