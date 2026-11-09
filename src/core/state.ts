import { UPGRADES, type UpgradeId } from './config';

/** The part of the club that is worth saving. Plain data only. */
export interface ClubState {
  money: number;
  totalEarned: number;
  guestsEntered: number;
  upgrades: Record<UpgradeId, number>; // current level of each upgrade
}

export function createInitialState(): ClubState {
  return {
    money: 0,
    totalEarned: 0,
    guestsEntered: 0,
    upgrades: { bartenders: 0, doorPrice: 0 },
  };
}

export function maxLevel(id: UpgradeId): number {
  return UPGRADES.find((u) => u.id === id)!.costs.length;
}

/** One simple number for "how good is the club". Grows with every upgrade. */
export function clubRating(state: ClubState): number {
  return 1 + state.upgrades.bartenders + state.upgrades.doorPrice;
}
