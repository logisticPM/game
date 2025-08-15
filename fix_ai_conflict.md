# AI系统冲突修复

## 问题描述
AI试图用5张牌顺子应对6张牌顺子，违反了"顺子长度必须匹配"规则，导致：
1. 无效出牌检测触发
2. 新的clearCardSelection机制错误地应用到AI
3. AI陷入选择错误牌型的循环

## 根本原因
1. **AI分析上次出牌错误**: `analyzeLastPlay`选择了5张牌的顺子而不是6张牌的顺子
2. **清理机制设计问题**: `clearCardSelection`不应该应用到AI玩家

## 修复方案

### 1. 修复AI出牌分析逻辑 ✅
**文件**: `src/ecs/systems/AISystem.ts`
**问题**: AI优先选择复杂度高的组合，而不是使用全部卡牌的组合
**修复**: 在combination选择时，优先选择使用**全部卡牌**的组合

```typescript
// 新逻辑：优先选择使用全部卡牌的组合
const bestUsesAllCards = best.cards.length === lastPlayCards.length;
const currentUsesAllCards = current.cards.length === lastPlayCards.length;

if (currentUsesAllCards && !bestUsesAllCards) {
  return current; // 优先选择使用全部卡牌的组合
}
```

### 2. 限制清理机制仅对人类玩家 ✅
**文件**: `src/ecs/systems/PlayValidationSystem.ts`
**问题**: `clearCardSelection`事件错误地应用到AI玩家
**修复**: 只对人类玩家(playerId === 0)执行清理

```typescript
// 只对人类玩家清理选中卡牌
if (playerId === 0) {
  this.world.eventBus.emit('clearCardSelection', { playerId });
}
```

### 3. AI安全机制 ✅
AI系统已有3次无效尝试后强制pass的安全机制（第228-234行）

## 期望结果
1. AI正确识别6张牌顺子，选择匹配长度的应对牌型
2. AI无效出牌时不会触发clearCardSelection
3. 人类玩家无效出牌时仍正常显示错误和清理选中状态
4. AI在无法应对时会正确pass而不是循环尝试

## 测试验证
出6张牌顺子，观察AI是否：
- 选择6张牌的更大顺子应对，或
- 正确pass而不是选择5张牌顺子
