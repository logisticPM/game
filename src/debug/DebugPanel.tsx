import React from 'react';
import { DebugManager } from './DebugManager';

interface DebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  const debugInfo = DebugManager.getDebugInfo();

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '300px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Debug Panel</h3>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>
      
      <div>
        <h4>Game State</h4>
        <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>
    </div>
  );
};
