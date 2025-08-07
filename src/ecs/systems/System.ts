export abstract class System {
  constructor(protected world: any) {}

  abstract update(delta: number): void;
}
