// Sprite Sheet 测试组件
import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { spriteSheetLoader } from '../game/SpriteSheetLoader';

interface SpriteSheetTestProps {
  onClose: () => void;
}

export const SpriteSheetTest: React.FC<SpriteSheetTestProps> = ({ onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application>();
  const [isLoaded, setIsLoaded] = useState(false);
  const [info, setInfo] = useState<string>('初始化中...');
  const [stats, setStats] = useState<{ totalTextures: number; memoryEstimate: number } | null>(null);

  useEffect(() => {
    const initTest = async () => {
      if (!containerRef.current) return;

      try {
        // 创建 PIXI 应用
        const app = new PIXI.Application({
          width: 1000,
          height: 700,
          backgroundColor: 0x1a1a1a,
          antialias: true
        });

        containerRef.current.appendChild(app.view as HTMLCanvasElement);
        appRef.current = app;

        setInfo('加载 Sprite Sheets...');

        // 确保 Sprite Sheets 已加载
        if (!spriteSheetLoader.isAssetsLoaded()) {
          await spriteSheetLoader.loadSpriteSheets();
        }

        setInfo('创建测试卡牌...');

        // 创建测试展示
        await createTestDisplay(app);

        // 获取统计信息
        const textureStats = spriteSheetLoader.getTextureStats();
        setStats(textureStats);

        setInfo('测试完成！');
        setIsLoaded(true);

      } catch (error) {
        console.error('Sprite sheet test failed:', error);
        setInfo(`错误: ${error}`);
      }
    };

    initTest();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
      }
    };
  }, []);

  const createTestDisplay = async (app: PIXI.Application) => {
    // 创建背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2F4F2F);
    bg.drawRect(0, 0, app.screen.width, app.screen.height);
    bg.endFill();
    app.stage.addChild(bg);

    // 测试扑克牌纹理
    await displayPlayingCards(app);
    
    // 测试王牌
    await displayJokers(app);
    
    // 测试卡背
    await displayCardBacks(app);
  };

  const displayPlayingCards = async (app: PIXI.Application) => {
    const suits = ['clubs', 'hearts', 'spades', 'diamonds'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suitNames = {
      clubs: '梅花',
      hearts: '红桃', 
      spades: '黑桃',
      diamonds: '方片'
    };

    const cardWidth = 60;
    const cardHeight = 84;
    const padding = 2;
    
    let successCount = 0;
    let y = 30;

    suits.forEach((suit, suitIndex) => {
      // 花色标签
      const suitLabel = new PIXI.Text(`${suitNames[suit as keyof typeof suitNames]}:`, {
        fontSize: 12,
        fill: '#ffff00'
      });
      suitLabel.x = 10;
      suitLabel.y = y;
      app.stage.addChild(suitLabel);

      let x = 80;
      
      ranks.forEach((rank, rankIndex) => {
        // 构建纹理键名（使用我们的映射系统）
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
          'J': 'Jack'
        };

        const mappedSuit = suitMap[suit];
        const mappedRank = rankMap[rank] || rank;
        const textureKey = `${mappedSuit}_${mappedRank}_white.png`;

        const texture = spriteSheetLoader.getTexture(textureKey);
        
        if (texture) {
          const sprite = new PIXI.Sprite(texture);
          sprite.x = x;
          sprite.y = y + 20;
          sprite.width = cardWidth;
          sprite.height = cardHeight;
          app.stage.addChild(sprite);
          
          successCount++;
        } else {
          // 显示错误占位符
          const placeholder = new PIXI.Graphics();
          placeholder.beginFill(0xff0000);
          placeholder.drawRect(x, y + 20, cardWidth, cardHeight);
          placeholder.endFill();
          app.stage.addChild(placeholder);
          
          const errorText = new PIXI.Text('❌', {
            fontSize: 12,
            fill: '#ffffff'
          });
          errorText.x = x + cardWidth / 2 - 6;
          errorText.y = y + 20 + cardHeight / 2 - 6;
          app.stage.addChild(errorText);
        }
        
        x += cardWidth + padding;
      });
      
      y += cardHeight + 30;
    });

    // 显示结果统计
    const resultText = new PIXI.Text(`扑克牌: ${successCount}/52 张加载成功`, {
      fontSize: 14,
      fill: successCount === 52 ? '#00ff00' : '#ffff00'
    });
    resultText.x = 10;
    resultText.y = 10;
    app.stage.addChild(resultText);
  };

  const displayJokers = async (app: PIXI.Application) => {
    const y = 450;
    
    // 小王
    const smallJokerTexture = spriteSheetLoader.getTexture('sjoker.png');
    if (smallJokerTexture) {
      const sprite = new PIXI.Sprite(smallJokerTexture);
      sprite.x = 100;
      sprite.y = y;
      sprite.width = 60;
      sprite.height = 84;
      app.stage.addChild(sprite);
      
      const label = new PIXI.Text('小王', {
        fontSize: 12,
        fill: '#ffffff'
      });
      label.x = 110;
      label.y = y + 90;
      app.stage.addChild(label);
    }

    // 大王
    const bigJokerTexture = spriteSheetLoader.getTexture('joker.png');
    if (bigJokerTexture) {
      const sprite = new PIXI.Sprite(bigJokerTexture);
      sprite.x = 200;
      sprite.y = y;
      sprite.width = 60;
      sprite.height = 84;
      app.stage.addChild(sprite);
      
      const label = new PIXI.Text('大王', {
        fontSize: 12,
        fill: '#ffffff'
      });
      label.x = 210;
      label.y = y + 90;
      app.stage.addChild(label);
    }
  };

  const displayCardBacks = async (app: PIXI.Application) => {
    const y = 450;
    const styles = ['blue_pattern', 'pink_star', 'red_pattern', 'dark_blue'];
    const styleNames = ['蓝色花纹', '粉色星形', '红色图案', '深蓝图案'];
    
    let x = 350;
    
    styles.forEach((style, index) => {
      const textureKey = `cardback_${style}.png`;
      const texture = spriteSheetLoader.getTexture(textureKey);
      
      if (texture) {
        const sprite = new PIXI.Sprite(texture);
        sprite.x = x;
        sprite.y = y;
        sprite.width = 50;
        sprite.height = 70;
        app.stage.addChild(sprite);
        
        const label = new PIXI.Text(styleNames[index], {
          fontSize: 9,
          fill: '#ffffff'
        });
        label.x = x;
        label.y = y + 75;
        app.stage.addChild(label);
      }
      
      x += 80;
    });

    // 默认卡背
    const defaultBackTexture = spriteSheetLoader.getTexture('cardback.png');
    if (defaultBackTexture) {
      const sprite = new PIXI.Sprite(defaultBackTexture);
      sprite.x = x;
      sprite.y = y;
      sprite.width = 50;
      sprite.height = 70;
      app.stage.addChild(sprite);
      
      const label = new PIXI.Text('默认卡背', {
        fontSize: 9,
        fill: '#ffffff'
      });
      label.x = x;
      label.y = y + 75;
      app.stage.addChild(label);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: '#333',
        border: '2px solid #555',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '1100px',
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          color: '#fff'
        }}>
          <h2>Sprite Sheet 测试</h2>
          <button
            onClick={onClose}
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            关闭
          </button>
        </div>

        <div style={{ 
          color: '#fff', 
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          <p>状态: {info}</p>
          {isLoaded && stats && (
            <div>
              <p>✅ Sprite Sheet 加载完成</p>
              <p>总纹理数: {stats.totalTextures}</p>
              <p>估计内存使用: {Math.round(stats.memoryEstimate / 1024 / 1024)} MB</p>
            </div>
          )}
        </div>

        <div
          ref={containerRef}
          style={{
            border: '1px solid #555',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        />
      </div>
    </div>
  );
};
