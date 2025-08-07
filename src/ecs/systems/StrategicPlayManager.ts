import { CardCombination, CombinationType } from './CardCombinationAnalyzer';
import { Entity } from '../types';
import { CardData } from '../components';

/**
 * 组合强度等级
 */
export enum CombinationStrength {
  WEAK = 1,      // 弱势组合 - 优先打出
  MODERATE = 2,  // 中等组合 - 谨慎使用
  STRONG = 3,    // 强势组合 - 保留
  ULTRA = 4      // 超强组合 - 紧急情况才用
}

/**
 * 策略性出牌建议
 */
export interface StrategicRecommendation {
  combination: CardCombination;
  strength: CombinationStrength;
  priority: number;
  reason: string;
  preservedCombinations: CardCombination[]; // 保留的强力组合
}

/**
 * 策略性出牌管理器
 * 实现基于贪心算法的智能出牌策略
 */
export class StrategicPlayManager {

  /**
   * Evaluate the strength level of a combination
   */
  public static evaluateCombinationStrength(combo: CardCombination): CombinationStrength {
    // Ultra combinations - bombs and rockets
    if (combo.type === CombinationType.Bomb || combo.type === CombinationType.Rocket) {
      return CombinationStrength.ULTRA;
    }

    // Strong combinations - planes, four-with etc.
    if ([
      CombinationType.Plane,
      CombinationType.PlaneSingle, 
      CombinationType.PlanePair,
      CombinationType.FourSingle,
      CombinationType.FourPair
    ].includes(combo.type)) {
      return CombinationStrength.STRONG;
    }

    // Moderate combinations - straight pairs, long straights
    if (combo.type === CombinationType.StraightPair || 
        (combo.type === CombinationType.Straight && combo.cards.length >= 7)) {
      return CombinationStrength.MODERATE;
    }

    // Special handling for triple combinations - judge by main card size
    if (combo.type === CombinationType.TriplePair || combo.type === CombinationType.TripleSingle) {
      const mainCardValue = combo.power;
      if (mainCardValue >= 14) { // A或更大
        return CombinationStrength.STRONG;
      } else if (mainCardValue >= 11) { // J, Q, K
        return CombinationStrength.MODERATE;
      }
      return CombinationStrength.WEAK;
    }

    // Special handling for pairs - keep high pairs
    if (combo.type === CombinationType.Pair) {
      if (combo.power >= 14) { // A pairs or higher
        return CombinationStrength.STRONG;
      } else if (combo.power >= 12) { // Q, K pairs
        return CombinationStrength.MODERATE;
      }
      return CombinationStrength.WEAK;
    }

    // Special handling for singles - keep high singles
    if (combo.type === CombinationType.Single) {
      if (combo.power >= 15) { // 2 or jokers
        return CombinationStrength.ULTRA;
      } else if (combo.power >= 14) { // A
        return CombinationStrength.STRONG;
      } else if (combo.power >= 12) { // Q, K
        return CombinationStrength.MODERATE;
      }
      return CombinationStrength.WEAK;
    }

    // Default to weak combination
    return CombinationStrength.WEAK;
  }

  /**
   * 基于贪心算法生成策略性出牌建议
   * 原理：保留强力组合，优先使用弱势组合，最大化手牌整体价值
   */
  public static generateStrategicRecommendation(
    allCombinations: CardCombination[],
    playableCombinations: CardCombination[],
    remainingCards: number,
    isOffensive: boolean = false
  ): StrategicRecommendation | null {
    
    if (playableCombinations.length === 0) {
      return null;
    }

    // 分析所有可能的组合强度
    const combinationAnalysis = playableCombinations.map(combo => ({
      combination: combo,
      strength: this.evaluateCombinationStrength(combo),
      priority: this.calculatePriority(combo, remainingCards, isOffensive)
    }));

    // 根据策略排序
    combinationAnalysis.sort((a, b) => {
      // 1. 优先级高的在前
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // 2. 同优先级时，优先使用弱势组合
      if (a.strength !== b.strength) {
        return a.strength - b.strength;
      }
      
      // 3. 同强度时，使用较小的牌
      return a.combination.power - b.combination.power;
    });

    const bestChoice = combinationAnalysis[0];
    
    // 分析保留的强力组合
    const preservedCombinations = this.analyzePreservedCombinations(
      allCombinations, 
      bestChoice.combination
    );

    return {
      combination: bestChoice.combination,
      strength: bestChoice.strength,
      priority: bestChoice.priority,
      reason: this.generateRecommendationReason(bestChoice, remainingCards, preservedCombinations),
      preservedCombinations
    };
  }

  /**
   * 计算组合的出牌优先级
   */
  private static calculatePriority(
    combo: CardCombination, 
    remainingCards: number, 
    isOffensive: boolean
  ): number {
    let priority = 0;

    // 基于卡牌数量的策略调整
    if (remainingCards <= 5) {
      // 终局阶段：优先使用能清理更多牌的组合
      priority += combo.cards.length * 10;
    } else if (remainingCards <= 10) {
      // 中局阶段：平衡效率和保留
      priority += combo.cards.length * 5;
    } else {
      // 开局阶段：优先清理弱势单牌
      if (combo.type === CombinationType.Single && combo.power < 8) {
        priority += 15; // 鼓励打出小单牌
      }
    }

    // 基于组合强度的策略调整
    const strength = this.evaluateCombinationStrength(combo);
    switch (strength) {
      case CombinationStrength.WEAK:
        priority += 20; // 大力鼓励使用弱势组合
        break;
      case CombinationStrength.MODERATE:
        priority += isOffensive ? 10 : 5;
        break;
      case CombinationStrength.STRONG:
        priority += isOffensive ? 5 : -10; // 通常不建议使用
        break;
      case CombinationStrength.ULTRA:
        priority += isOffensive ? 0 : -20; // 强烈不建议使用
        break;
    }

    // 特殊牌型的策略调整
    if (combo.type === CombinationType.Straight && combo.cards.length >= 5) {
      priority += Math.min(combo.cards.length - 4, 5); // 长顺子有额外加分
    }

    return priority;
  }

  /**
   * 分析打出指定组合后保留的强力组合
   */
  private static analyzePreservedCombinations(
    allCombinations: CardCombination[],
    playedCombination: CardCombination
  ): CardCombination[] {
    // 模拟打出指定组合后剩余的牌
    const playedCardIds = new Set(playedCombination.cards.map(c => c.entity));
    
    // 过滤出不包含已打出牌的组合
    const preserved = allCombinations.filter(combo => {
      return !combo.cards.some(c => playedCardIds.has(c.entity));
    });

    // 只返回强力组合
    return preserved.filter(combo => 
      this.evaluateCombinationStrength(combo) >= CombinationStrength.MODERATE
    );
  }

  /**
   * Generate recommendation reason explanation
   */
  private static generateRecommendationReason(
    choice: { combination: CardCombination; strength: CombinationStrength; priority: number },
    remainingCards: number,
    preservedCombinations: CardCombination[]
  ): string {
    const { combination, strength } = choice;
    
    let reason = `Recommend playing ${combination.description}`;

    // Strength-based reasoning
    switch (strength) {
      case CombinationStrength.WEAK:
        reason += " (clear weak cards)";
        break;
      case CombinationStrength.MODERATE:
        reason += " (moderate value cards)";
        break;
      case CombinationStrength.STRONG:
        reason += " (strong cards, use carefully)";
        break;
      case CombinationStrength.ULTRA:
        reason += " (critical cards, consider keeping)";
        break;
    }

    // Game phase reasoning
    if (remainingCards <= 5) {
      reason += ", end game quickly";
    } else if (remainingCards <= 10) {
      reason += ", maintain rhythm";
    } else {
      reason += ", clean up hand";
    }

    // Preserved combination information
    if (preservedCombinations.length > 0) {
      const strongTypes = preservedCombinations.map(c => c.type).slice(0, 2);
      reason += `, preserving ${strongTypes.join(', ')}`;
    }

    return reason;
  }

  /**
   * 分析手牌中的潜在强力组合
   */
  public static analyzeHandPotential(allCombinations: CardCombination[]): {
    strongCombinations: CardCombination[];
    potentialScore: number;
    recommendations: string[];
  } {
    const strongCombinations = allCombinations.filter(combo => 
      this.evaluateCombinationStrength(combo) >= CombinationStrength.MODERATE
    );

    // Calculate potential score
    let potentialScore = 0;
    const recommendations: string[] = [];

    strongCombinations.forEach(combo => {
      const strength = this.evaluateCombinationStrength(combo);
      potentialScore += strength * combo.cards.length;
      
      if (strength >= CombinationStrength.STRONG) {
        recommendations.push(`Keep ${combo.description}`);
      }
    });

    return {
      strongCombinations,
      potentialScore,
      recommendations
    };
  }
}
