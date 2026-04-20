import type { GameState } from "../../../packages/shared/src/index.js";

export const createMemoryGameStore = () => {
  const games = new Map<string, GameState>();

  return {
    get: (id: string) => games.get(id),
    save: (game: GameState) => {
      games.set(game.id, game);
      return game;
    },
  };
};

