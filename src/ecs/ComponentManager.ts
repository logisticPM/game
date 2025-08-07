import { Entity, IComponent, ComponentClass } from './types';
import { EntityManager } from './EntityManager';

/**
 * Manages components for entities in the ECS architecture
 */
export class ComponentManager {
  // Map<Entity, Map<ComponentName, ComponentInstance>>
  private entityComponents = new Map<Entity, Map<string, IComponent>>();
  // Cache for quick component type lookups
  private componentTypeCache = new Map<string, Set<Entity>>();

  constructor(private entityManager: EntityManager) {}

  /**
   * Adds a component to an entity
   * @param entity The entity to add the component to
   * @param component The component instance to add
   */
  public add<T extends IComponent>(entity: Entity, component: T): void {
    const componentName = component.constructor.name;

    // Get or create the component map for the entity
    if (!this.entityComponents.has(entity)) {
      this.entityComponents.set(entity, new Map<string, IComponent>());
    }
    const components = this.entityComponents.get(entity)!;

    // Set the unique component instance for the entity
    components.set(componentName, component);
    this.entityManager.setSignature(entity, componentName);
    
    // Update the component type cache
    if (!this.componentTypeCache.has(componentName)) {
      this.componentTypeCache.set(componentName, new Set<Entity>());
    }
    this.componentTypeCache.get(componentName)!.add(entity);
  }

  /**
   * Gets a component from an entity
   * @param entity The entity to get the component from
   * @param componentClass The component class to get
   * @returns The component instance
   * @throws Error if the entity doesn't have the component
   */
  public get<T extends IComponent>(entity: Entity, componentClass: ComponentClass<T>): T {
    const components = this.entityComponents.get(entity);
    if (!components) {
      throw new Error(`Entity ${entity} has no components.`);
    }
    const component = components.get(componentClass.name) as T;
    if (!component) {
      throw new Error(`Entity ${entity} does not have component ${componentClass.name}.`);
    }
    return component;
  }

  /**
   * Safely gets a component from an entity
   * @param entity The entity to get the component from
   * @param componentClass The component class to get
   * @returns The component instance or undefined if not found
   */
  public tryGet<T extends IComponent>(entity: Entity, componentClass: ComponentClass<T>): T | undefined {
    try {
      return this.get(entity, componentClass);
    } catch {
      return undefined;
    }
  }

  /**
   * Checks if an entity has a component
   * @param entity The entity to check
   * @param componentClass The component class to check for
   * @returns True if the entity has the component, false otherwise
   */
  public has<T extends IComponent>(entity: Entity, componentClass: ComponentClass<T>): boolean {
    const components = this.entityComponents.get(entity);
    return !!components && components.has(componentClass.name);
  }

  /**
   * Removes a component from an entity
   * @param entity The entity to remove the component from
   * @param componentClass The component class to remove
   */
  public remove<T extends IComponent>(entity: Entity, componentClass: ComponentClass<T>): void {
    const componentName = componentClass.name;
    const components = this.entityComponents.get(entity);
    
    if (components && components.has(componentName)) {
      components.delete(componentName);
      this.entityManager.clearSignature(entity, componentName);
      
      // Update the component type cache
      const entitySet = this.componentTypeCache.get(componentName);
      if (entitySet) {
        entitySet.delete(entity);
        if (entitySet.size === 0) {
          this.componentTypeCache.delete(componentName);
        }
      }
      
      if (components.size === 0) {
        this.entityComponents.delete(entity);
      }
    }
  }

  /**
   * Removes all components from an entity
   * @param entity The entity to remove all components from
   */
  public removeAllComponents(entity: Entity): void {
    const components = this.entityComponents.get(entity);
    if (!components) return;
    
    // Remove each component and update caches
    for (const [componentName, _] of components.entries()) {
      this.entityManager.clearSignature(entity, componentName);
      
      // Update the component type cache
      const entitySet = this.componentTypeCache.get(componentName);
      if (entitySet) {
        entitySet.delete(entity);
        if (entitySet.size === 0) {
          this.componentTypeCache.delete(componentName);
        }
      }
    }
    
    this.entityComponents.delete(entity);
  }

  /**
   * Gets all entities with a specific component type
   * @param componentClass The component class to filter by
   * @returns An array of entities that have the component
   */
  public getEntitiesWith<T extends IComponent>(componentClass: ComponentClass<T>): Entity[] {
    const componentName = componentClass.name;
    
    // Use the cache if available
    if (this.componentTypeCache.has(componentName)) {
      return Array.from(this.componentTypeCache.get(componentName)!);
    }
    
    // Fallback to the slower method if cache is not available
    const entities: Entity[] = [];
    for (const [entity, components] of this.entityComponents.entries()) {
      if (components.has(componentName)) {
        entities.push(entity);
      }
    }
    
    // Update the cache for future queries
    this.componentTypeCache.set(componentName, new Set(entities));
    
    return entities;
  }



  /**
   * Gets entities that have all specified components
   * @param componentClasses Array of component classes
   * @returns Array of entities that have all components
   */
  public getEntitiesWithAll<T extends IComponent>(...componentClasses: ComponentClass<T>[]): Entity[] {
    const componentNames = componentClasses.map(cls => cls.name);
    const entities: Entity[] = [];
    
    for (const [entity, components] of this.entityComponents.entries()) {
      if (componentNames.every(name => components.has(name))) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
}
