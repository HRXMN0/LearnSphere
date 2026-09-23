/**
 * Canonical mastery calculation and thresholds shared across the application.
 * Thresholds:
 * - >= 85%: 'Mastered'
 * - 60% - 84%: 'In Progress'
 * - < 60%: 'Needs Review'
 */
export type MasteryStatus = 'Mastered' | 'In Progress' | 'Needs Review';

export function getMasteryStatus(percentage: number): MasteryStatus {
  if (percentage >= 85) return 'Mastered';
  if (percentage >= 60) return 'In Progress';
  return 'Needs Review';
}
