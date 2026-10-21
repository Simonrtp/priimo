/** Un seul pipeline d’agence : plus de vue « mes leads » / « toute l’agence ». */

export function leadsDuPipeline<T>(leads: readonly T[]): T[] {
  return [...leads];
}
