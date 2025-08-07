import { ComponentManager } from './ComponentManager';
import { Entity, IComponent, ComponentClass } from './types';

export class EntityManager {
  private nextEntityId = 0;
  private entities = new Set<Entity>();
  private entitySignatures = new Map<Entity, Set<string>>();

  /**
   * Creates a new entity
   * @returns The newly created entity ID
   */
  public create(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    this.entitySignatures.set(entity, new Set());
    return entity;
  }

  /**
   * Destroys an entity and removes all its signatures
   * @param entity The entity to destroy
   */
  public destroy(entity: Entity): void {
    this.entities.delete(entity);
    this.entitySignatures.delete(entity);
  }

  /**
   * Gets all entities
   * @returns A set of all entities
   */
  public all(): Set<Entity> {
    return new Set(this.entities); // Return a copy to prevent direct modification
  }

  /**
   * Finds an entity based on a predicate function
   * @param predicate A function that evaluates entities
   * @param componentManager Optional component manager to provide components to the predicate
   * @returns The first entity that matches the predicate or undefined if none found
   */
  public find(
    predicate: (entity: Entity, getComponent?: <T extends IComponent>(componentClass: ComponentClass<T>) => T | undefined) => boolean,
    componentManager?: ComponentManager
  ): Entity | undefined {
    for (const entity of this.entities) {
      if (!this.entitySignatures.has(entity)) continue;
      
      // Create a helper function to get components if a component manager is provided
      const getComponent = componentManager ? 
        <T extends IComponent>(componentClass: ComponentClass<T>): T | undefined => {
          try {
            return componentManager.has(entity, componentClass) ? 
              componentManager.get(entity, componentClass) : undefined;
          } catch {
            return undefined;
          }
        } : undefined;
      
      if (predicate(entity, getComponent)) {
        return entity;
      }
    }
    return undefined;
  }

  /**
   * Sets a component signature for an entity
   * @param entity The entity to set the signature for
   * @param componentName The component name to add to the signature
   */
  public setSignature(entity: Entity, componentName: string): void {
    if (!this.entitySignatures.has(entity)) {
      this.entitySignatures.set(entity, new Set());
    }
    this.entitySignatures.get(entity)!.add(componentName);
  }

  /**
   * Clears a component signature for an entity
   * @param entity The entity to clear the signature for
   * @param componentName The component name to remove from the signature
   */
  public clearSignature(entity: Entity, componentName: string): void {
    if (this.entitySignatures.has(entity)) {
      this.entitySignatures.get(entity)!.delete(componentName);
    }
  }

  /**
   * Checks if an entity has all the specified component types
   * @param entity The entity to check
   * @param componentClasses The component classes to check for
   * @returns True if the entity has all the specified component types, false otherwise
   */
  public hasComponents(entity: Entity, ...componentClasses: Function[]): boolean {
    if (!this.entitySignatures.has(entity)) return false;
    
    const signature = this.entitySignatures.get(entity)!;
    for (const componentClass of componentClasses) {
      if (!signature.has(componentClass.name)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Gets all entities that have all the specified component types
   * @param componentClasses The component classes to filter by
   * @returns An array of entities that have all the specified component types
   */
  public with(...componentClasses: Function[]): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities) {
      if (this.hasComponents(entity, ...componentClasses)) {
        result.push(entity);
      }
    }
    return result;
  }
}
