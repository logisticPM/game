export type Entity = number;

export interface IComponent {}

export type ComponentClass<T extends IComponent> = new (...args: any[]) => T;
