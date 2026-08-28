export const ALLOWED_SPRITE_IDS = ['curto', 'chapeu', 'moicano', 'longo', 'careca', 'gorro'] as const;
export type SpriteId = (typeof ALLOWED_SPRITE_IDS)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  spriteId?: string | null;
};
