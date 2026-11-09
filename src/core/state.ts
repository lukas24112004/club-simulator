import { UPGRADES, type UpgradeId } from './config';

/** The part of the club that is worth saving. Plain data only. */
export interface ClubState {
  money: number;
  totalEarned: number;
  guestsEntered: number;
  upgrades: Record<UpgradeId, number>; // current level of each upgrade
}

export function createInitialState(): ClubState {
  const upgrades = {} as Record<UpgradeId, number>;
  for (const u of UPGRADES) upgrades[u.id] = 0;
  return { money: 0, totalEarned: 0, guestsEntered: 0, upgrades };
}

export function maxLevel(id: UpgradeId): number {
  return UPGRADES.find((u) => u.id === id)!.costs.length;
}

/** One number for "how good is the club". Every upgrade raises it, and a higher rating brings bigger crowds. */
export function clubRating(state: ClubState): number {
  return UPGRADES.reduce((sum, u) => sum + state.upgrades[u.id] * u.appeal, 1);
}
