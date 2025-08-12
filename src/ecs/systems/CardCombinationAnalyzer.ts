import { CardData } from '../components';

// Canonical combination types used across systems (camelCase)
export enum CombinationType {
  Single = 'single',
  Pair = 'pair',
  Triple = 'triple',
  TripleSingle = 'triple_single',
  TriplePair = 'triple_pair',
  Straight = 'straight',
  StraightPair = 'straight_pair',
  Plane = 'plane',
  PlaneSingle = 'plane_single',
  PlanePair = 'plane_pair',
  FourSingle = 'four_single',
  FourPair = 'four_pair',
  Bomb = 'bomb',
  Rocket = 'rocket',
  Invalid = 'invalid'
}

export interface CombinationAnalysis {
  type: CombinationType;
  power: number; // alias of strength for compatibility
  strength: number;
  isValid: boolean;
  description: string;
  mainCards?: CardData[];
  attachedCards?: CardData[];
}

export interface CardCombination {
  cards: CardData[];
  type: CombinationType;
  power: number; // primary power field for AI/Hint systems
  strength: number; // kept for compatibility
  isValid: boolean;
  description: string;
  entities: number[]; // Entity IDs for the cards
}

export class CardCombinationAnalyzer {
  static analyzeCombination(cards: CardData[]): CombinationAnalysis {
    if (!cards || cards.length === 0) {
      return {
        type: CombinationType.INVALID,
        strength: 0,
        isValid: false,
        description: 'No cards provided'
      };
    }

    // Sort cards by value for analysis
    const sortedCards = [...cards].sort((a, b) => a.value - b.value);
    const cardCount = cards.length;

    // Check for rocket (Black Joker + Red Joker)
    if (cardCount === 2) {
      const hasBlackJoker = cards.some(card => card.value === 16);
      const hasRedJoker = cards.some(card => card.value === 17);
      if (hasBlackJoker && hasRedJoker) {
        return {
        type: CombinationType.Rocket,
        power: 1000,
        strength: 1000, // Highest possible strength
          isValid: true,
          description: 'Rocket (Joker pair)',
          mainCards: sortedCards
        };
      }
    }

    // Check for bomb (4 of a kind)
    if (cardCount === 4) {
      const valueGroups = this.groupByValue(sortedCards);
      if (valueGroups.size === 1) {
        const value = Array.from(valueGroups.keys())[0];
      return {
        type: CombinationType.Bomb,
        power: 100 + value,
        strength: 100 + value, // Bombs are very strong
        isValid: true,
        description: `Bomb (${this.getValueName(value)})`,
        mainCards: sortedCards
      };
      }
    }

    // Analyze based on card count
    switch (cardCount) {
      case 1:
        return this.analyzeSingle(sortedCards[0]);
      case 2:
        return this.analyzePair(sortedCards);
      case 3:
        return this.analyzeTriple(sortedCards);
      case 4:
        return this.analyzeQuadruple(sortedCards);
      case 5:
        return this.analyzeFiveCards(sortedCards);
      default:
        if (cardCount >= 5) {
          return this.analyzeComplexCombination(sortedCards);
        }
        break;
    }

    return {
      type: CombinationType.Invalid,
      power: 0,
      strength: 0,
      isValid: false,
      description: 'Invalid combination'
    };
  }

  private static analyzeSingle(card: CardData): CombinationAnalysis {
    return {
      type: CombinationType.Single,
      power: card.value,
      strength: card.value,
      isValid: true,
      description: `Single ${this.getValueName(card.value)}`,
      mainCards: [card]
    };
  }

  private static analyzePair(cards: CardData[]): CombinationAnalysis {
    const valueGroups = this.groupByValue(cards);
    if (valueGroups.size === 1) {
      const value = Array.from(valueGroups.keys())[0];
      return {
        type: CombinationType.Pair,
        power: value,
        strength: value,
        isValid: true,
        description: `Pair of ${this.getValueName(value)}`,
        mainCards: cards
      };
    }

    return {
      type: CombinationType.Invalid,
      power: 0,
      strength: 0,
      isValid: false,
      description: 'Invalid pair'
    };
  }

  private static analyzeTriple(cards: CardData[]): CombinationAnalysis {
    const valueGroups = this.groupByValue(cards);
    if (valueGroups.size === 1) {
      const value = Array.from(valueGroups.keys())[0];
      return {
        type: CombinationType.Triple,
        power: value,
        strength: value,
        isValid: true,
        description: `Triple ${this.getValueName(value)}`,
        mainCards: cards
      };
    }

    return {
      type: CombinationType.Invalid,
      power: 0,
      strength: 0,
      isValid: false,
      description: 'Invalid triple'
    };
  }

  private static analyzeQuadruple(cards: CardData[]): CombinationAnalysis {
    const valueGroups = this.groupByValue(cards);
    
    // Check for triple with single
    if (valueGroups.size === 2) {
      const values = Array.from(valueGroups.keys());
      const counts = values.map(v => valueGroups.get(v)!.length);
      
      if (counts.includes(3) && counts.includes(1)) {
        const tripleValue = values[counts.indexOf(3)];
        const singleValue = values[counts.indexOf(1)];
        
        return {
          type: CombinationType.TripleSingle,
          power: tripleValue,
          strength: tripleValue,
          isValid: true,
          description: `Triple ${this.getValueName(tripleValue)} with ${this.getValueName(singleValue)}`,
          mainCards: valueGroups.get(tripleValue)!,
          attachedCards: valueGroups.get(singleValue)!
        };
      }
    }

    return {
      type: CombinationType.Invalid,
      power: 0,
      strength: 0,
      isValid: false,
      description: 'Invalid 4-card combination'
    };
  }

  private static analyzeFiveCards(cards: CardData[]): CombinationAnalysis {
    const valueGroups = this.groupByValue(cards);
    
    // Check for straight (5 consecutive cards)
    if (this.isStraight(cards)) {
      return {
        type: CombinationType.Straight,
        power: Math.min(...cards.map(c => c.value)),
        strength: Math.min(...cards.map(c => c.value)),
        isValid: true,
        description: 'Straight',
        mainCards: cards
      };
    }

    // Check for triple with pair
    if (valueGroups.size === 2) {
      const values = Array.from(valueGroups.keys());
      const counts = values.map(v => valueGroups.get(v)!.length);
      
      if (counts.includes(3) && counts.includes(2)) {
        const tripleValue = values[counts.indexOf(3)];
        const pairValue = values[counts.indexOf(2)];
        
        return {
          type: CombinationType.TriplePair,
          power: tripleValue,
          strength: tripleValue,
          isValid: true,
          description: `Triple ${this.getValueName(tripleValue)} with pair of ${this.getValueName(pairValue)}`,
          mainCards: valueGroups.get(tripleValue)!,
          attachedCards: valueGroups.get(pairValue)!
        };
      }
    }

    return {
      type: CombinationType.Invalid,
      power: 0,
      strength: 0,
      isValid: false,
      description: 'Invalid 5-card combination'
    };
  }

  private static analyzeComplexCombination(cards: CardData[]): CombinationAnalysis {
    // Check for straight
    if (this.isStraight(cards)) {
      return {
        type: CombinationType.Straight,
        power: Math.min(...cards.map(c => c.value)),
        strength: Math.min(...cards.map(c => c.value)),
        isValid: true,
        description: `${cards.length}-card straight`,
        mainCards: cards
      };
    }

    // Check for pair straight
    if (this.isPairStraight(cards)) {
      const minValue = Math.min(...cards.map(c => c.value));
      return {
        type: CombinationType.StraightPair,
        power: minValue,
        strength: minValue,
        isValid: true,
        description: `Pair straight starting from ${this.getValueName(minValue)}`,
        mainCards: cards
      };
    }

    return {
      type: CombinationType.Invalid,
      power: 0,
      strength: 0,
      isValid: false,
      description: 'Invalid combination'
    };
  }

  private static groupByValue(cards: CardData[]): Map<number, CardData[]> {
    const groups = new Map<number, CardData[]>();
    for (const card of cards) {
      if (!groups.has(card.value)) {
        groups.set(card.value, []);
      }
      groups.get(card.value)!.push(card);
    }
    return groups;
  }

  private static isStraight(cards: CardData[]): boolean {
    if (cards.length < 5) return false;
    
    const values = [...new Set(cards.map(c => c.value))].sort((a, b) => a - b);
    if (values.length !== cards.length) return false;
    
    // Check for consecutive values
    for (let i = 1; i < values.length; i++) {
      if (values[i] - values[i - 1] !== 1) {
        return false;
      }
    }
    
    return true;
  }

  private static isPairStraight(cards: CardData[]): boolean {
    if (cards.length < 6 || cards.length % 2 !== 0) return false;
    
    const valueGroups = this.groupByValue(cards);
    const values = Array.from(valueGroups.keys()).sort((a, b) => a - b);
    
    // Each value should appear exactly twice
    for (const value of values) {
      if (valueGroups.get(value)!.length !== 2) {
        return false;
      }
    }
    
    // Values should be consecutive
    for (let i = 1; i < values.length; i++) {
      if (values[i] - values[i - 1] !== 1) {
        return false;
      }
    }
    
    return true;
  }

  private static getValueName(value: number): string {
    const names: { [key: number]: string } = {
      3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
      11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: 'Black Joker', 17: 'Red Joker'
    };
    return names[value] || value.toString();
  }

  // Determines if combination a can beat combination b according to basic rules
  static canBeat(a: CardCombination, b: CardCombination): boolean {
    if (!a || !b) return false;
    // Rocket beats everything
    if (a.type === CombinationType.Rocket) return true;
    if (b.type === CombinationType.Rocket) return false;
    // Bomb beats non-bombs
    if (a.type === CombinationType.Bomb && b.type !== CombinationType.Bomb) return true;
    if (a.type !== CombinationType.Bomb && b.type === CombinationType.Bomb) return false;
    // For same type, higher power wins
    if (a.type === b.type) {
      return (a.power ?? a.strength) > (b.power ?? b.strength);
    }
    // Otherwise cannot beat
    return false;
  }

  /**
   * Analyze all possible card combinations from hand cards
   * This method is used by AI to find all playable combinations
   */
  static analyzeCards(cardEntities: number[], world: any): CardCombination[] {
    if (!cardEntities || cardEntities.length === 0) {
      return [];
    }

    // Convert entities to CardData with mapping
    const cardDataMap: Map<CardData, number> = new Map();
    const cards: CardData[] = [];
    
    for (const entity of cardEntities) {
      const cardData = world.components.get(entity, CardData);
      if (cardData) {
        cards.push(cardData);
        cardDataMap.set(cardData, entity);
      }
    }

    if (cards.length === 0) {
      return [];
    }

    const combinations: CardCombination[] = [];
    
    // Generate basic combinations: singles, pairs, triples, triple+single, triple+pair, bombs
    // Single cards
    for (const card of cards) {
      const entities = [cardDataMap.get(card)!];
      combinations.push({
        cards: [card],
        type: CombinationType.Single,
        power: card.value,
        strength: card.value,
        isValid: true,
        description: `Single ${this.getValueName(card.value)}`,
        entities: entities
      });
    }
    
    // Pairs
    const valueGroups = this.groupByValue(cards);
    for (const [value, groupCards] of valueGroups.entries()) {
      if (groupCards.length >= 2) {
        for (let i = 0; i < groupCards.length - 1; i++) {
          for (let j = i + 1; j < groupCards.length; j++) {
            const pairCards = [groupCards[i], groupCards[j]];
            const entities = pairCards.map(card => cardDataMap.get(card)!);
            combinations.push({
              cards: pairCards,
              type: CombinationType.Pair,
              power: value,
              strength: value,
              isValid: true,
              description: `Pair of ${this.getValueName(value)}`,
              entities: entities
            });
          }
        }
      }
    }

    // Triples
    for (const [value, groupCards] of valueGroups.entries()) {
      if (groupCards.length >= 3) {
        // Choose first 3 for a canonical triple
        const tripleCards = [groupCards[0], groupCards[1], groupCards[2]];
        const tripleEntities = tripleCards.map(card => cardDataMap.get(card)!);
        combinations.push({
          cards: tripleCards,
          type: CombinationType.Triple,
          power: value,
          strength: value,
          isValid: true,
          description: `Triple ${this.getValueName(value)}`,
          entities: tripleEntities
        });
      }
    }

    // Triple with single
    for (const [tripleValue, tripleGroup] of valueGroups.entries()) {
      if (tripleGroup.length >= 3) {
        const tripleCards = [tripleGroup[0], tripleGroup[1], tripleGroup[2]];
        const tripleEntities = tripleCards.map(card => cardDataMap.get(card)!);
        // For each single card with different value
        for (const [singleValue, singleGroup] of valueGroups.entries()) {
          if (singleValue === tripleValue) continue;
          for (const singleCard of singleGroup) {
            const entities = [...tripleEntities, cardDataMap.get(singleCard)!];
            combinations.push({
              cards: [...tripleCards, singleCard],
              type: CombinationType.TripleSingle,
              power: tripleValue,
              strength: tripleValue,
              isValid: true,
              description: `Triple ${this.getValueName(tripleValue)} with ${this.getValueName(singleValue)}`,
              entities
            });
          }
        }
      }
    }

    // Triple with pair
    for (const [tripleValue, tripleGroup] of valueGroups.entries()) {
      if (tripleGroup.length >= 3) {
        const tripleCards = [tripleGroup[0], tripleGroup[1], tripleGroup[2]];
        const tripleEntities = tripleCards.map(card => cardDataMap.get(card)!);
        for (const [pairValue, pairGroup] of valueGroups.entries()) {
          if (pairValue === tripleValue || pairGroup.length < 2) continue;
          // Use first 2 cards of the pair group
          const pairCards = [pairGroup[0], pairGroup[1]];
          const pairEntities = pairCards.map(card => cardDataMap.get(card)!);
          combinations.push({
            cards: [...tripleCards, ...pairCards],
            type: CombinationType.TriplePair,
            power: tripleValue,
            strength: tripleValue,
            isValid: true,
            description: `Triple ${this.getValueName(tripleValue)} with pair of ${this.getValueName(pairValue)}`,
            entities: [...tripleEntities, ...pairEntities]
          });
        }
      }
    }

    // Bombs (four of a kind)
    for (const [value, groupCards] of valueGroups.entries()) {
      if (groupCards.length >= 4) {
        const bombCards = [groupCards[0], groupCards[1], groupCards[2], groupCards[3]];
        const entities = bombCards.map(card => cardDataMap.get(card)!);
        const power = 100 + value;
        combinations.push({
          cards: bombCards,
          type: CombinationType.Bomb,
          power,
          strength: power,
          isValid: true,
          description: `Bomb (${this.getValueName(value)})`,
          entities
        });
      }
    }

    // Sort by strength (strongest first)
    combinations.sort((a, b) => (b.power ?? b.strength) - (a.power ?? a.strength));
    
    return combinations;
  }

  /**
   * Generate all combinations of cards with specified length
   */
  private static generateCombinations<T>(arr: T[], length: number): T[][] {
    if (length === 0) return [[]];
    if (length > arr.length) return [];
    
    const combinations: T[][] = [];
    
    function backtrack(start: number, current: T[]) {
      if (current.length === length) {
        combinations.push([...current]);
        return;
      }
      
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    }
    
    backtrack(0, []);
    return combinations;
  }
}
