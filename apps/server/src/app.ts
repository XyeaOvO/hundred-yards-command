import cors from "cors";
import express from "express";
import { z } from "zod";

import {
  CommandSchema,
  createGameState,
  listScenarios,
  reduceGameState,
  type GameCommand,
} from "../../../packages/shared/src/index.js";
import { createMemoryGameStore } from "./store.js";

const createGameRequestSchema = z.object({
  scenarioId: z.string().optional(),
});

export const createApp = () => {
  const app = express();
  const store = createMemoryGameStore();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      service: "hundred-yards-ops-server",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/scenarios", (_request, response) => {
    response.json({
      scenarios: listScenarios(),
    });
  });

  app.post("/api/games", (request, response) => {
    const parsed = createGameRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      response.status(400).json({
        message: "Invalid request body.",
        issues: parsed.error.issues,
      });
      return;
    }

    const game = createGameState(parsed.data.scenarioId);
    store.save(game);
    response.status(201).json({ game });
  });

  app.get("/api/games/:gameId", (request, response) => {
    const game = store.get(request.params.gameId);

    if (!game) {
      response.status(404).json({ message: "Game not found." });
      return;
    }

    response.json({ game });
  });

  app.post("/api/games/:gameId/commands", (request, response) => {
    const game = store.get(request.params.gameId);

    if (!game) {
      response.status(404).json({ message: "Game not found." });
      return;
    }

    const parsed = CommandSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      response.status(400).json({
        message: "Invalid command.",
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const updated = reduceGameState(game, parsed.data as GameCommand);
      store.save(updated);
      response.json({ game: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown rule engine error.";
      response.status(400).json({ message });
    }
  });

  return app;
};

