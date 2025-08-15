# 测试无效出牌修复

## 修复内容
1. **问题1**: 单机版PlayValidationSystem检测到无效出牌后，UI没有显示错误信息
2. **问题2**: 无效出牌时，选中的卡牌不会返回手牌（不会取消选中状态）
3. **修复**: 
   - 在Hud组件添加InvalidPlay事件监听器
   - 添加错误状态管理 (errorMessage, showError)
   - 添加错误显示UI组件
   - 添加CSS样式
   - **新增**: 在PlayValidationSystem中添加选中卡牌清理逻辑

## 测试步骤
1. 启动单机版游戏
2. 进入Playing阶段
3. 选择无效牌型（如7张随机牌：3♠, 4♠, 4♥, 5♥, 6♥, 7♦, 8♦）
4. 点击"Play"按钮
5. **期望结果**: 
   - 应该显示红色错误提示框，显示"Invalid card combination"
   - **选中的卡牌应该自动取消选中，返回手牌**
   - 4秒后错误提示自动消失

## 验证方式
查看控制台日志：
- `[PlayValidationSystem] Play analysis result: ...playInfoType: 'invalid'...`
- `[CardSelectionSystem] Deselected card X for player 0` (对每张选中的卡)
- `[HUD] Invalid play detected: {playerId: 0, reason: "Invalid card combination"}`
- 看到红色错误提示框出现
- **看到选中的卡牌视觉上回到正常位置**

## 文件修改
- `src/components/Hud.tsx`: 添加InvalidPlay事件处理
- `src/styles.css`: 添加错误显示样式
- **`src/ecs/systems/PlayValidationSystem.ts`**: 添加选中卡牌清理逻辑
