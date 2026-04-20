import type { ScenarioDefinition, ScenarioSummary, Side, TerrainType, UnitState } from "./types.js";

function createUnit(
  id: string,
  side: Side,
  name: string,
  type: UnitState["type"],
  platoon: string,
  x: number,
  y: number,
  overrides?: Partial<UnitState["stats"]>,
): UnitState {
  const baseStats =
    type === "leader"
      ? { movement: 3, range: 2, firepower: 1, defense: 1 }
      : type === "machine-gun"
        ? { movement: 2, range: 5, firepower: 4, defense: 1 }
        : { movement: 3, range: 4, firepower: 3, defense: 1 };

  return {
    id,
    side,
    platoon,
    name,
    type,
    position: { x, y },
    stats: { ...baseStats, ...overrides },
    actionPoints: 2,
    activatedThisRound: false,
    suppression: 0,
    eliminated: false,
  };
}

function createMap() {
  const terrainLayout: TerrainType[][] = [
    ["open", "woods", "open", "open", "ridge", "ridge", "open", "open"],
    ["open", "woods", "open", "building", "ridge", "ridge", "open", "open"],
    ["open", "open", "open", "building", "ridge", "open", "woods", "open"],
    ["open", "open", "woods", "open", "open", "open", "woods", "open"],
    ["open", "open", "woods", "open", "open", "building", "open", "open"],
    ["open", "open", "open", "open", "open", "building", "open", "open"],
  ];

  const terrainRules: Record<TerrainType, { moveCost: number; cover: number; blocksLos: boolean }> = {
    open: { moveCost: 1, cover: 0, blocksLos: false },
    woods: { moveCost: 2, cover: 2, blocksLos: true },
    building: { moveCost: 2, cover: 3, blocksLos: true },
    ridge: { moveCost: 2, cover: 1, blocksLos: false },
  };

  return {
    width: 8,
    height: 6,
    cells: terrainLayout.flatMap((row, y) =>
      row.map((terrain, x) => ({
        x,
        y,
        terrain,
        ...terrainRules[terrain],
        objective: x >= 4 && x <= 5 && y <= 1,
      })),
    ),
  };
}

const probeAtHill: ScenarioDefinition = {
  id: "probe-at-hill-402",
  name: "Hill 402 Probe",
  summary: "课程原型示例场景：双方围绕山脊高地展开排级接敌与压制。",
  roundLimit: 6,
  map: createMap(),
  units: [
    createUnit("a-rifle-1", "allies", "A1 Rifle", "rifle", "1st Platoon", 0, 4),
    createUnit("a-rifle-2", "allies", "A2 Rifle", "rifle", "1st Platoon", 1, 5),
    createUnit("a-mg-1", "allies", "A MG", "machine-gun", "Weapons", 0, 5),
    createUnit("a-leader-1", "allies", "A Leader", "leader", "HQ", 1, 4),
    createUnit("x-rifle-1", "axis", "X1 Rifle", "rifle", "Forward Squad", 6, 1),
    createUnit("x-rifle-2", "axis", "X2 Rifle", "rifle", "Forward Squad", 7, 1),
    createUnit("x-mg-1", "axis", "X MG", "machine-gun", "Support", 6, 2),
    createUnit("x-leader-1", "axis", "X Leader", "leader", "HQ", 7, 2),
  ],
};

const scenarios = [probeAtHill];

export function getScenarioDefinition(scenarioId?: string): ScenarioDefinition {
  if (!scenarioId) {
    return scenarios[0];
  }

  const scenario = scenarios.find((item) => item.id === scenarioId);

  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  return scenario;
}

export function listScenarios(): ScenarioSummary[] {
  return scenarios.map(({ id, name, summary, roundLimit }) => ({
    id,
    name,
    summary,
    roundLimit,
  }));
}

