// World 类型定义文件
// 避免循环依赖问题

export interface IWorld {
  app?: any;
  entities?: any;
  components?: any;
  eventBus?: any;
  getGameState?(): any;
}