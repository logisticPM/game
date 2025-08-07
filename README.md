# 🎮 Landlord Game (斗地主)

一个基于 React + TypeScript + PIXI.js + ECS 架构的现代化斗地主游戏。

## ✨ 特性

### 🎯 核心功能
- **完整的斗地主游戏逻辑** - 包括叫地主、出牌、胜负判定
- **智能 AI 对手** - 多种难度的 AI 策略
- **实时游戏状态** - 流畅的游戏体验和状态管理
- **卡牌动画** - 丰富的视觉效果和过渡动画

### 🛠️ 技术架构
- **React 18** - 现代化的 UI 框架
- **TypeScript** - 类型安全的开发体验
- **PIXI.js 7** - 高性能的 2D 渲染引擎
- **ECS 架构** - 实体-组件-系统的游戏架构
- **Vite** - 快速的构建工具

### 🎨 视觉特性
- **Sprite Sheet 优化** - 高效的资产加载和内存使用
- **响应式设计** - 适配不同屏幕尺寸
- **调试工具** - 完整的开发调试界面

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 预览生产版本
```bash
npm run preview
```

## 🎮 游戏说明

### 基本规则
1. **叫地主阶段** - 3名玩家轮流叫地主，最高叫价者成为地主
2. **发牌阶段** - 每人17张牌，剩余3张为地主牌
3. **出牌阶段** - 地主先出牌，其他玩家轮流跟牌或过牌
4. **胜负判定** - 地主先出完牌则地主胜，否则农民胜

### 操作方式
- **选择卡牌** - 点击卡牌进行选择/取消选择
- **出牌** - 选择卡牌后点击"出牌"按钮
- **过牌** - 点击"过"按钮跳过当前回合
- **叫地主** - 在叫地主阶段点击相应的叫价按钮

## 🔧 开发指南

### 项目结构
```
landlord/
├── public/                 # 静态资源
│   ├── GameAssets/         # 游戏资产
│   │   ├── images/         # 图片资源 (Sprite Sheets)
│   │   └── GameData.json   # 游戏配置
│   └── vite.svg           # 网站图标
├── src/
│   ├── components/         # React 组件
│   ├── debug/              # 调试工具
│   ├── ecs/                # ECS 架构
│   │   ├── components/     # ECS 组件
│   │   ├── entities/       # 实体工厂
│   │   └── systems/        # 游戏系统
│   ├── game/               # 游戏核心
│   │   ├── Game.ts         # 游戏主类
│   │   ├── DataManager.ts  # 数据管理
│   │   └── SpriteSheetLoader.ts # 资产加载
│   ├── App.tsx             # 主应用组件
│   ├── main.tsx            # 应用入口
│   └── styles.css          # 全局样式
```

### ECS 架构说明

#### 实体 (Entities)
- **玩家实体** - 包含玩家信息、手牌、选择状态
- **卡牌实体** - 包含卡牌数据、变换、渲染信息
- **游戏管理器** - 包含游戏状态、回合信息

#### 组件 (Components)
- **Transform** - 位置、旋转、缩放
- **Sprite** - 纹理、可见性、交互性
- **CardData** - 卡牌数据 (花色、点数、值)
- **PlayerInfo** - 玩家信息 (ID、姓名、角色)
- **GameState** - 游戏状态 (阶段、当前玩家、上次出牌)

#### 系统 (Systems)
- **RenderSystem** - 渲染管理
- **BiddingSystem** - 叫地主逻辑
- **PlayValidationSystem** - 出牌验证
- **AISystem** - AI 决策
- **WinConditionSystem** - 胜负判定

### 资产管理

#### Sprite Sheet 配置
游戏使用高效的 Sprite Sheet 技术：

- **PlayingCards 128x178.png** - 52张扑克牌 (13×4 布局)
- **Jokers 128x178.png** - 大王小王 (2×1 布局)  
- **Card Backs 128x178.png** - 4种卡背样式 (4×1 布局)

#### 配置文件
所有游戏配置在 `public/GameAssets/GameData.json` 中：
- 布局配置 (玩家位置、卡牌间距)
- 卡牌定义 (花色、点数、值、文件名)
- Sprite Sheet 路径和配置

## 🔍 调试工具

### 开发调试
- **F1** - 切换调试面板
- **Sprite Sheet 测试** - 验证所有卡牌资产加载
- **ECS 状态查看** - 实时查看组件和系统状态

### 性能监控
- **内存使用** - 监控纹理内存占用
- **渲染性能** - FPS 和渲染统计
- **加载统计** - 资产加载时间和状态

## 📋 技术特点

### 🚀 性能优化
- **Sprite Sheet** - 减少 HTTP 请求数量 (54→3)
- **对象池** - 减少垃圾回收
- **批量渲染** - 提高 GPU 利用率

### 🛡️ 类型安全
- **完整 TypeScript** - 编译时错误检查
- **接口定义** - 明确的数据结构
- **泛型组件** - 可复用的类型安全组件

### 🎯 可扩展性
- **ECS 架构** - 易于添加新功能
- **模块化设计** - 独立的系统和组件
- **配置驱动** - 游戏规则可配置

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🎉 致谢

- **PIXI.js** - 强大的 2D 渲染引擎
- **React** - 优秀的 UI 框架  
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速的构建工具

---

🎮 **开始您的斗地主之旅吧！** 🚀