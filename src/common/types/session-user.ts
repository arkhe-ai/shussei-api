export const ALLOWED_SPRITE_IDS = [
  'aventureiro', 'aventureira', 'dev', 'mago', 'cavaleiro', 'arqueiro',
  'gato', 'cachorro', 'raposa', 'sapo', 'robo', 'pato',
  'alienigena', 'dinossauro', 'feiticeiro', 'panda', 'panda-vermelho', 'androide',
  'paladino', 'bruxa', 'cacador', 'clerigo', 'diabinho', 'mago-do-gelo',
] as const;
export type SpriteId = (typeof ALLOWED_SPRITE_IDS)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  spriteId?: string | null;
};
