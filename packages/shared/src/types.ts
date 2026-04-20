import { z } from "zod";

export type Side = "allies" | "axis";
export type TerrainType = "open" | "woods" | "building" | "ridge";
export type UnitType = "rifle" | "machine-gun" | "leader";
export type GameStatus = "in_progress" | "finished";

export interface Position {
  x: number;
  y: number;
}

export interface MapCell extends Position {
  terrain: TerrainType;
  moveCost: number;
  cover: number;
  blocksLos: boolean;
  objective?: boolean;
}

export interface BattleMap {
  width: number;
  height: number;
  cells: MapCell[];
}

export interface UnitStats {
  movement: number;
  range: number;
  firepower: number;
  defense: number;
}

export interface UnitState {
  id: string;
  side: Side;
  platoon: string;
  name: string;
  type: UnitType;
  position: Position;
  stats: UnitStats;
  actionPoints: number;
  activatedThisRound: boolean;
  suppression: 0 | 1 | 2;
  eliminated: boolean;
}

export interface BattleLogEntry {
  id: string;
  round: number;
  side: Side;
  message: string;
}

export interface VictoryProgress {
  alliesObjectiveControl: number;
  axisObjectiveControl: number;
  alliesCasualties: number;
  axisCasualties: number;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  summary: string;
  roundLimit: number;
  map: BattleMap;
  units: UnitState[];
}

export interface ScenarioSummary {
  id: string;
  name: string;
  summary: string;
  roundLimit: number;
}

export interface GameState {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: GameStatus;
  round: number;
  roundLimit: number;
  initiative: Side;
  activeSide: Side;
  activeUnitId: string | null;
  map: BattleMap;
  units: UnitState[];
  log: BattleLogEntry[];
  winner: Side | null;
  victory: VictoryProgress;
}

export const PositionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

export const CommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("select-unit"),
    unitId: z.string(),
  }),
  z.object({
    type: z.literal("move-unit"),
    unitId: z.string(),
    destination: PositionSchema,
  }),
  z.object({
    type: z.literal("fire-at-target"),
    attackerId: z.string(),
    targetId: z.string(),
  }),
  z.object({
    type: z.literal("end-unit-activation"),
    unitId: z.string(),
  }),
  z.object({
    type: z.literal("end-round"),
  }),
  z.object({
    type: z.literal("reset-game"),
  }),
]);

export type GameCommand = z.infer<typeof CommandSchema>;

