import { getScenarioDefinition } from "./scenario.js";
import type {
  BattleLogEntry,
  GameCommand,
  GameState,
  MapCell,
  Position,
  Side,
  UnitState,
  VictoryProgress,
} from "./types.js";

function cloneGameState(game: GameState): GameState {
  return {
    ...game,
    map: {
      ...game.map,
      cells: game.map.cells.map((cell) => ({ ...cell })),
    },
    units: game.units.map((unit) => ({
      ...unit,
      position: { ...unit.position },
      stats: { ...unit.stats },
    })),
    log: game.log.map((entry) => ({ ...entry })),
    victory: { ...game.victory },
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLogEntry(round: number, side: Side, message: string): BattleLogEntry {
  return {
    id: generateId("log"),
    round,
    side,
    message,
  };
}

export function createGameState(scenarioId?: string): GameState {
  const scenario = getScenarioDefinition(scenarioId);

  const game: GameState = {
    id: generateId("game"),
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: "in_progress",
    round: 1,
    roundLimit: scenario.roundLimit,
    initiative: "allies",
    activeSide: "allies",
    activeUnitId: null,
    map: {
      ...scenario.map,
      cells: scenario.map.cells.map((cell) => ({ ...cell })),
    },
    units: scenario.units.map((unit) => ({
      ...unit,
      position: { ...unit.position },
      stats: { ...unit.stats },
    })),
    log: [
      createLogEntry(
        1,
        "allies",
        `对局初始化完成：${scenario.name}。由 Allied 侧取得先手并开始第 1 回合。`,
      ),
    ],
    winner: null,
    victory: {
      alliesObjectiveControl: 0,
      axisObjectiveControl: 0,
      alliesCasualties: 0,
      axisCasualties: 0,
    },
  };

  game.victory = evaluateVictoryProgress(game);
  return game;
}

function assertInProgress(game: GameState) {
  if (game.status !== "in_progress") {
    throw new Error("Game has already finished.");
  }
}

export function getCell(game: GameState, position: Position): MapCell {
  const cell = game.map.cells.find((item) => item.x === position.x && item.y === position.y);

  if (!cell) {
    throw new Error(`Unknown map cell (${position.x}, ${position.y}).`);
  }

  return cell;
}

export function getUnit(game: GameState, unitId: string): UnitState {
  const unit = game.units.find((item) => item.id === unitId);

  if (!unit) {
    throw new Error(`Unknown unit: ${unitId}`);
  }

  return unit;
}

export function isAdjacent(source: Position, target: Position): boolean {
  const dx = Math.abs(source.x - target.x);
  const dy = Math.abs(source.y - target.y);
  return dx + dy === 1;
}

export function getDistance(source: Position, target: Position): number {
  return Math.abs(source.x - target.x) + Math.abs(source.y - target.y);
}

function getLineCells(source: Position, target: Position): Position[] {
  const steps = Math.max(Math.abs(target.x - source.x), Math.abs(target.y - source.y));

  if (steps <= 1) {
    return [];
  }

  return Array.from({ length: steps - 1 }, (_, index) => {
    const t = (index + 1) / steps;
    return {
      x: Math.round(source.x + (target.x - source.x) * t),
      y: Math.round(source.y + (target.y - source.y) * t),
    };
  });
}

export function hasLineOfSight(game: GameState, source: Position, target: Position): boolean {
  const intermediateCells = getLineCells(source, target);

  return intermediateCells.every((position) => {
    const cell = getCell(game, position);
    return !cell.blocksLos;
  });
}

function findUnitAt(game: GameState, position: Position): UnitState | undefined {
  return game.units.find(
    (unit) =>
      !unit.eliminated && unit.position.x === position.x && unit.position.y === position.y,
  );
}

export function getSelectableUnits(game: GameState, side = game.activeSide): UnitState[] {
  return game.units.filter(
    (unit) =>
      unit.side === side &&
      !unit.eliminated &&
      !unit.activatedThisRound &&
      unit.actionPoints > 0 &&
      unit.suppression < 2,
  );
}

function ensureActiveFriendlyUnit(game: GameState, unitId: string): UnitState {
  const unit = getUnit(game, unitId);

  if (unit.side !== game.activeSide) {
    throw new Error("只能操作当前行动方的单位。");
  }

  if (unit.eliminated) {
    throw new Error("该单位已被消灭。");
  }

  if (unit.activatedThisRound) {
    throw new Error("该单位本回合已完成激活。");
  }

  if (unit.suppression >= 2) {
    throw new Error("溃散单位不能执行行动。");
  }

  return unit;
}

function countRemainingActivations(game: GameState, side: Side): number {
  return getSelectableUnits(game, side).length;
}

function setNextSideOrRound(game: GameState) {
  const opposingSide: Side = game.activeSide === "allies" ? "axis" : "allies";
  const activeSideHasUnits = countRemainingActivations(game, game.activeSide) > 0;
  const opposingSideHasUnits = countRemainingActivations(game, opposingSide) > 0;

  if (activeSideHasUnits) {
    return;
  }

  if (opposingSideHasUnits) {
    game.activeSide = opposingSide;
    game.activeUnitId = null;
    game.log.unshift(
      createLogEntry(game.round, game.activeSide, `${formatSideLabel(game.activeSide)} 开始新的激活序列。`),
    );
    return;
  }

  game.round += 1;
  game.initiative = opposingSide;
  game.activeSide = game.initiative;
  game.activeUnitId = null;

  for (const unit of game.units) {
    if (unit.eliminated) {
      continue;
    }

    unit.activatedThisRound = false;
    unit.actionPoints = 2;
    if (unit.suppression === 1) {
      unit.suppression = 0;
    }
  }

  game.log.unshift(
    createLogEntry(game.round, game.activeSide, `第 ${game.round} 回合开始，${formatSideLabel(game.activeSide)} 获得先手。`),
  );
}

function formatSideLabel(side: Side): string {
  return side === "allies" ? "Allied 侧" : "Axis 侧";
}

function evaluateVictoryProgress(game: GameState): VictoryProgress {
  const objectiveCells = game.map.cells.filter((cell) => cell.objective);
  const alliedObjectiveControl = objectiveCells.filter((cell) => {
    const occupant = findUnitAt(game, cell);
    return occupant?.side === "allies";
  }).length;
  const axisObjectiveControl = objectiveCells.filter((cell) => {
    const occupant = findUnitAt(game, cell);
    return occupant?.side === "axis";
  }).length;
  const alliesCasualties = game.units.filter((unit) => unit.side === "allies" && unit.eliminated).length;
  const axisCasualties = game.units.filter((unit) => unit.side === "axis" && unit.eliminated).length;

  return {
    alliesObjectiveControl: alliedObjectiveControl,
    axisObjectiveControl,
    alliesCasualties,
    axisCasualties,
  };
}

function determineWinner(game: GameState): Side | null {
  const alliedAlive = game.units.some((unit) => unit.side === "allies" && !unit.eliminated);
  const axisAlive = game.units.some((unit) => unit.side === "axis" && !unit.eliminated);

  if (!alliedAlive) {
    return "axis";
  }

  if (!axisAlive) {
    return "allies";
  }

  if (game.round <= game.roundLimit) {
    return null;
  }

  if (game.victory.alliesObjectiveControl > game.victory.axisObjectiveControl) {
    return "allies";
  }

  if (game.victory.axisObjectiveControl > game.victory.alliesObjectiveControl) {
    return "axis";
  }

  if (game.victory.axisCasualties > game.victory.alliesCasualties) {
    return "allies";
  }

  if (game.victory.alliesCasualties > game.victory.axisCasualties) {
    return "axis";
  }

  return game.initiative === "allies" ? "axis" : "allies";
}

function finalizeIfNeeded(game: GameState) {
  game.victory = evaluateVictoryProgress(game);
  const winner = determineWinner(game);

  if (winner) {
    game.status = "finished";
    game.winner = winner;
    game.activeUnitId = null;
    game.log.unshift(
      createLogEntry(game.round, winner, `对局结束，${formatSideLabel(winner)} 获胜。`),
    );
  }
}

function spendActionPoint(unit: UnitState) {
  unit.actionPoints = Math.max(0, unit.actionPoints - 1);
}

function autoFinishUnit(game: GameState, unit: UnitState) {
  if (unit.actionPoints > 0) {
    return;
  }

  unit.activatedThisRound = true;
  if (game.activeUnitId === unit.id) {
    game.activeUnitId = null;
  }
  setNextSideOrRound(game);
}

function resolveFire(game: GameState, attacker: UnitState, target: UnitState) {
  const attackerCell = getCell(game, attacker.position);
  const targetCell = getCell(game, target.position);
  const distance = getDistance(attacker.position, target.position);

  if (distance > attacker.stats.range) {
    throw new Error("目标超出当前射程。");
  }

  if (!hasLineOfSight(game, attacker.position, target.position)) {
    throw new Error("当前地形阻断视线，无法射击。");
  }

  const roll = Math.floor(Math.random() * 6) + 1;
  const attackValue =
    attacker.stats.firepower -
    Math.max(0, distance - 1) -
    targetCell.cover -
    target.stats.defense -
    attacker.suppression +
    (attackerCell.terrain === "ridge" ? 1 : 0);
  const total = attackValue + roll;

  spendActionPoint(attacker);

  let outcome = "未造成有效结果";

  if (total >= 8) {
    target.eliminated = true;
    target.actionPoints = 0;
    target.activatedThisRound = true;
    outcome = "命中并消灭目标";
  } else if (total >= 6) {
    target.suppression = Math.min(2, (target.suppression + 1) as 0 | 1 | 2);
    outcome = target.suppression === 2 ? "目标被压制至溃散" : "目标受到压制";
  }

  game.log.unshift(
    createLogEntry(
      game.round,
      attacker.side,
      `${attacker.name} 对 ${target.name} 射击：距离 ${distance}，掷骰 ${roll}，总值 ${total}，结果：${outcome}。`,
    ),
  );

  autoFinishUnit(game, attacker);
}

export function reduceGameState(current: GameState, command: GameCommand): GameState {
  if (command.type === "reset-game") {
    return createGameState(current.scenarioId);
  }

  const game = cloneGameState(current);

  assertInProgress(game);

  switch (command.type) {
    case "select-unit": {
      const unit = ensureActiveFriendlyUnit(game, command.unitId);
      game.activeUnitId = unit.id;
      game.log.unshift(
        createLogEntry(game.round, game.activeSide, `${unit.name} 被选为当前激活单位。`),
      );
      break;
    }

    case "move-unit": {
      const unit = ensureActiveFriendlyUnit(game, command.unitId);
      const destination = command.destination;

      if (game.activeUnitId !== unit.id) {
        throw new Error("请先选择当前要激活的单位。");
      }

      if (!isAdjacent(unit.position, destination)) {
        throw new Error("课程原型阶段只支持相邻格移动。");
      }

      const cell = getCell(game, destination);
      const occupied = findUnitAt(game, destination);

      if (occupied) {
        throw new Error("目标地块已有单位占据。");
      }

      if (cell.moveCost > unit.actionPoints || cell.moveCost > unit.stats.movement) {
        throw new Error("当前剩余行动点不足以移动到目标地块。");
      }

      unit.position = destination;
      unit.actionPoints = Math.max(0, unit.actionPoints - cell.moveCost);

      game.log.unshift(
        createLogEntry(
          game.round,
          unit.side,
          `${unit.name} 机动至 (${destination.x}, ${destination.y})，地形 ${cell.terrain}，消耗 ${cell.moveCost} AP。`,
        ),
      );

      autoFinishUnit(game, unit);
      break;
    }

    case "fire-at-target": {
      const attacker = ensureActiveFriendlyUnit(game, command.attackerId);
      const target = getUnit(game, command.targetId);

      if (attacker.side === target.side) {
        throw new Error("不能攻击友军单位。");
      }

      if (target.eliminated) {
        throw new Error("目标已被消灭。");
      }

      if (game.activeUnitId !== attacker.id) {
        throw new Error("请先选择当前要激活的单位。");
      }

      resolveFire(game, attacker, target);
      break;
    }

    case "end-unit-activation": {
      const unit = ensureActiveFriendlyUnit(game, command.unitId);
      unit.activatedThisRound = true;
      unit.actionPoints = 0;
      if (game.activeUnitId === unit.id) {
        game.activeUnitId = null;
      }
      game.log.unshift(
        createLogEntry(game.round, unit.side, `${unit.name} 结束本次激活。`),
      );
      setNextSideOrRound(game);
      break;
    }

    case "end-round": {
      for (const unit of game.units) {
        if (unit.side === game.activeSide && !unit.eliminated) {
          unit.activatedThisRound = true;
          unit.actionPoints = 0;
        }
      }
      game.activeUnitId = null;
      game.log.unshift(
        createLogEntry(game.round, game.activeSide, `${formatSideLabel(game.activeSide)} 主动结束本轮剩余激活。`),
      );
      setNextSideOrRound(game);
      break;
    }
  }

  finalizeIfNeeded(game);
  return game;
}
