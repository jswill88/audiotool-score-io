import type { RankerPlan } from './types.js';

export const rankerPlans: RankerPlan[] = [
  { grid: 16, policy: 'strict' },
  { grid: 16, policy: 'bridge-gaps' },
  { grid: 16, policy: 'trim-overlaps' },
  { grid: 16, policy: 'reconcile-jitter' },
  { grid: 16, policy: 'duration-snap-reconcile' },
  { grid: 16, policy: 'duration-ceil-reconcile' },
  { grid: 24, policy: 'strict' },
  { grid: 24, policy: 'bridge-gaps' },
  { grid: 24, policy: 'reconcile-jitter' },
  { grid: 24, policy: 'duration-snap-reconcile' },
  { grid: 24, policy: 'duration-ceil-reconcile' },
  { grid: 32, policy: 'strict' },
  { grid: 32, policy: 'bridge-gaps' },
  { grid: 32, policy: 'reconcile-jitter' },
  { grid: 32, policy: 'duration-snap-reconcile' },
  { grid: 32, policy: 'duration-ceil-reconcile' },
  { grid: 48, policy: 'strict' },
  { grid: 96, policy: 'strict' }
];
