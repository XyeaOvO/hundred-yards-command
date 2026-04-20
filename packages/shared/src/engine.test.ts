import { describe, expect, it } from "vitest";

import { createGameState, hasLineOfSight, reduceGameState } from "./index.js";

describe("shared rule engine", () => {
  it("creates a playable initial state", () => {
    const game = createGameState();

    expect(game.units).toHaveLength(8);
    expect(game.status).toBe("in_progress");
    expect(game.activeSide).toBe("allies");
  });

  it("allows selecting and moving a unit to an adjacent open cell", () => {
    const game = createGameState();
    const selected = reduceGameState(game, {
      type: "select-unit",
      unitId: "a-rifle-1",
    });
    const moved = reduceGameState(selected, {
      type: "move-unit",
      unitId: "a-rifle-1",
      destination: { x: 0, y: 3 },
    });

    const unit = moved.units.find((item) => item.id === "a-rifle-1");
    expect(unit?.position).toEqual({ x: 0, y: 3 });
    expect(unit?.actionPoints).toBe(1);
  });

  it("blocks line of sight through woods", () => {
    const game = createGameState();

    expect(hasLineOfSight(game, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });
});
