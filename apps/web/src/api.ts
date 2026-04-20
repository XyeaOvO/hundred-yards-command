import type { GameCommand, GameState, ScenarioSummary } from "../../../packages/shared/src/index.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message ?? "Request failed.");
  }

  return response.json() as Promise<T>;
}

export async function fetchScenarios(): Promise<ScenarioSummary[]> {
  const payload = await readJson<{ scenarios: ScenarioSummary[] }>(`${API_BASE_URL}/scenarios`);
  return payload.scenarios;
}

export async function createGame(scenarioId?: string): Promise<GameState> {
  const payload = await readJson<{ game: GameState }>(`${API_BASE_URL}/games`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scenarioId }),
  });

  return payload.game;
}

export async function sendCommand(gameId: string, command: GameCommand): Promise<GameState> {
  const payload = await readJson<{ game: GameState }>(`${API_BASE_URL}/games/${gameId}/commands`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  return payload.game;
}
