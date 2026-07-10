export type ActorKind = 'robber' | 'police' | 'civilian';
export type AttackKind = 'stomp' | 'web';

export function canDefeatActor(actor: ActorKind, attack: AttackKind): boolean {
  return actor === 'robber' && (attack === 'stomp' || attack === 'web');
}

export function actorCanDamagePlayer(actor: ActorKind): boolean {
  return actor === 'robber' || actor === 'police';
}

export function actorStartsAtScore(actor: ActorKind): number {
  if (actor === 'robber') return 5_000;
  if (actor === 'civilian') return 5_400;
  return 6_500;
}
