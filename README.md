# 🎮 Landlord Game (Dou Dizhu)

A modern Dou Dizhu (Chinese poker game) built with React + TypeScript + PIXI.js + ECS architecture.

## ✨ Features

### 🎯 Core Functionality
- **Complete Dou Dizhu game logic** - Including landlord bidding, card playing, and win/lose determination
- **Intelligent AI opponents** - Multiple difficulty levels with strategic AI
- **Real-time game state** - Smooth gameplay experience and state management
- **Card animations** - Rich visual effects and smooth transitions

### 🛠️ Technical Architecture
- **React 18** - Modern UI framework
- **TypeScript** - Type-safe development experience
- **PIXI.js 7** - High-performance 2D rendering engine
- **ECS Architecture** - Entity-Component-System game architecture
- **Vite** - Fast build tool

### 🎨 Visual Features
- **Sprite Sheet optimization** - Efficient asset loading and memory usage
- **Responsive design** - Adapts to different screen sizes
- **Debug tools** - Complete development debugging interface

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 🎮 Game Instructions

### Basic Rules
1. **Landlord Bidding Phase** - 3 players take turns bidding, highest bidder becomes the landlord
2. **Card Distribution** - Each player gets 17 cards, remaining 3 cards go to the landlord
3. **Playing Phase** - Landlord plays first, other players take turns to follow or pass
4. **Win Condition** - Landlord wins if they play all cards first, otherwise farmers win

### How to Play
- **Select Cards** - Click on cards to select/deselect them
- **Play Cards** - After selecting cards, click the "Play" button
- **Pass** - Click the "Pass" button to skip your turn
- **Bid for Landlord** - During bidding phase, click the corresponding bid buttons

## 🔧 Development Guide

### Project Structure
```
landlord/
├── public/                 # Static assets
│   ├── GameAssets/         # Game assets
│   │   ├── images/         # Image resources (Sprite Sheets)
│   │   └── GameData.json   # Game configuration
│   └── vite.svg           # Website icon
├── src/
│   ├── components/         # React components
│   ├── debug/              # Debug tools
│   ├── ecs/                # ECS architecture
│   │   ├── components/     # ECS components
│   │   ├── entities/       # Entity factories
│   │   └── systems/        # Game systems
│   ├── game/               # Game core
│   │   ├── Game.ts         # Main game class
│   │   ├── DataManager.ts  # Data management
│   │   └── SpriteSheetLoader.ts # Asset loading
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── styles.css          # Global styles
```

### ECS Architecture Overview

#### Entities
- **Player Entities** - Contains player info, hand cards, selection state
- **Card Entities** - Contains card data, transform, rendering info
- **Game Manager** - Contains game state, turn information

#### Components
- **Transform** - Position, rotation, scale
- **Sprite** - Texture, visibility, interactivity
- **CardData** - Card data (suit, rank, value)
- **PlayerInfo** - Player information (ID, name, role)
- **GameState** - Game state (phase, current player, last play)

#### Systems
- **RenderSystem** - Rendering management
- **BiddingSystem** - Landlord bidding logic
- **PlayValidationSystem** - Card play validation
- **AISystem** - AI decision making
- **WinConditionSystem** - Win/lose determination

### Asset Management

#### Sprite Sheet Configuration
The game uses efficient Sprite Sheet technology:

- **PlayingCards 128x178.png** - 52 playing cards (13×4 layout)
- **Jokers 128x178.png** - Big and small jokers (2×1 layout)  
- **Card Backs 128x178.png** - 4 card back styles (4×1 layout)

#### Configuration Files
All game configuration is in `public/GameAssets/GameData.json`:
- Layout configuration (player positions, card spacing)
- Card definitions (suits, ranks, values, filenames)
- Sprite Sheet paths and configurations

## 🔍 Debug Tools

### Development Debugging
- **F1** - Toggle debug panel
- **Sprite Sheet Testing** - Verify all card asset loading
- **ECS State Viewer** - Real-time component and system state viewing

### Performance Monitoring
- **Memory Usage** - Monitor texture memory consumption
- **Rendering Performance** - FPS and rendering statistics
- **Loading Statistics** - Asset loading time and status

## 📋 Technical Highlights

### 🚀 Performance Optimization
- **Sprite Sheet** - Reduce HTTP requests (54→3)
- **Object Pooling** - Reduce garbage collection
- **Batch Rendering** - Improve GPU utilization

### 🛡️ Type Safety
- **Full TypeScript** - Compile-time error checking
- **Interface Definitions** - Clear data structures
- **Generic Components** - Reusable type-safe components

### 🎯 Extensibility
- **ECS Architecture** - Easy to add new features
- **Modular Design** - Independent systems and components
- **Configuration-Driven** - Configurable game rules

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- **PIXI.js** - Powerful 2D rendering engine
- **React** - Excellent UI framework  
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool

---

🎮 **Start your Dou Dizhu journey!** 🚀