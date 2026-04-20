import { startTransition, useEffect, useState } from "react";

import {
  getDistance,
  getSelectableUnits,
  hasLineOfSight,
  type GameState,
  type MapCell,
  type ScenarioSummary,
  type UnitState,
} from "@shared/index.js";

import { createGame, fetchScenarios, sendCommand } from "./api.js";

const terrainLabels: Record<MapCell["terrain"], string> = {
  open: "开阔地",
  woods: "树林",
  building: "建筑",
  ridge: "山脊",
};

const sideLabels = {
  allies: "Allied 侧",
  axis: "Axis 侧",
};

function getUnitStatus(unit: UnitState): string {
  if (unit.eliminated) {
    return "已消灭";
  }

  if (unit.suppression === 2) {
    return "溃散";
  }

  if (unit.suppression === 1) {
    return "受压制";
  }

  if (unit.activatedThisRound) {
    return "已行动";
  }

  return "待命";
}

function getTerrainClass(terrain: MapCell["terrain"]): string {
  return `terrain-${terrain}`;
}

function getUnitClass(unit: UnitState, selected: boolean): string {
  return [
    "unit-chip",
    unit.side === "allies" ? "unit-chip-allies" : "unit-chip-axis",
    selected ? "unit-chip-selected" : "",
    unit.eliminated ? "unit-chip-eliminated" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function App() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrap() {
      try {
        const loadedScenarios = await fetchScenarios();
        const firstScenario = loadedScenarios[0];
        const createdGame = await createGame(firstScenario?.id);

        if (isCancelled) {
          return;
        }

        startTransition(() => {
          setScenarios(loadedScenarios);
          setGame(createdGame);
          setErrorMessage(null);
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "初始化失败。");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, []);

  const selectedUnit = game?.activeUnitId
    ? game.units.find((unit) => unit.id === game.activeUnitId) ?? null
    : null;

  const selectableUnits = game ? getSelectableUnits(game) : [];

  const legalMoveTargets =
    game && selectedUnit
      ? new Set(
          game.map.cells
            .filter((cell) => {
              const occupied = game.units.some(
                (unit) =>
                  !unit.eliminated && unit.position.x === cell.x && unit.position.y === cell.y,
              );

              return (
                !occupied &&
                getDistance(selectedUnit.position, cell) === 1 &&
                cell.moveCost <= selectedUnit.actionPoints &&
                cell.moveCost <= selectedUnit.stats.movement
              );
            })
            .map((cell) => `${cell.x}-${cell.y}`),
        )
      : new Set<string>();

  const legalTargets =
    game && selectedUnit
      ? new Set(
          game.units
            .filter(
              (unit) =>
                unit.side !== selectedUnit.side &&
                !unit.eliminated &&
                getDistance(selectedUnit.position, unit.position) <= selectedUnit.stats.range &&
                hasLineOfSight(game, selectedUnit.position, unit.position),
            )
            .map((unit) => unit.id),
        )
      : new Set<string>();

  async function applyCommand(command: Parameters<typeof sendCommand>[1]) {
    if (!game) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const updated = await sendCommand(game.id, command);
      startTransition(() => {
        setGame(updated);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setIsBusy(false);
    }
  }

  async function relaunchScenario(scenarioId?: string) {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const updated = await createGame(scenarioId);
      startTransition(() => {
        setGame(updated);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "重开失败。");
    } finally {
      setIsBusy(false);
    }
  }

  function handleCellClick(cell: MapCell) {
    if (!game || game.status !== "in_progress" || isBusy) {
      return;
    }

    const occupant = game.units.find(
      (unit) =>
        !unit.eliminated && unit.position.x === cell.x && unit.position.y === cell.y,
    );

    if (occupant && occupant.side === game.activeSide) {
      void applyCommand({ type: "select-unit", unitId: occupant.id });
      return;
    }

    if (!selectedUnit) {
      return;
    }

    if (occupant && occupant.side !== selectedUnit.side && legalTargets.has(occupant.id)) {
      void applyCommand({
        type: "fire-at-target",
        attackerId: selectedUnit.id,
        targetId: occupant.id,
      });
      return;
    }

    if (legalMoveTargets.has(`${cell.x}-${cell.y}`)) {
      void applyCommand({
        type: "move-unit",
        unitId: selectedUnit.id,
        destination: { x: cell.x, y: cell.y },
      });
    }
  }

  if (isLoading) {
    return (
      <main className="app-shell loading-shell">
        <section className="loading-card">
          <h1>百码推演</h1>
          <p>正在载入场景与规则引擎…</p>
        </section>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="app-shell loading-shell">
        <section className="loading-card">
          <h1>百码推演</h1>
          <p>{errorMessage ?? "未能成功初始化对局。"}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Software Engineering Course Prototype</p>
          <h1>百码推演</h1>
          <p className="hero-copy">
            基于 The Last Hundred Yards 公开规则思想构建的排级战术兵棋 Web 原型。
            当前版本聚焦“激活、机动、射击、地形、日志”五个核心闭环。
          </p>
        </div>
        <div className="hero-metrics">
          <article>
            <span>当前回合</span>
            <strong>
              {game.round} / {game.roundLimit}
            </strong>
          </article>
          <article>
            <span>当前行动方</span>
            <strong>{sideLabels[game.activeSide]}</strong>
          </article>
          <article>
            <span>战局状态</span>
            <strong>{game.status === "finished" ? "已结束" : "进行中"}</strong>
          </article>
        </div>
      </section>

      <section className="control-grid">
        <aside className="panel briefing-panel">
          <header className="panel-header">
            <div>
              <p className="panel-kicker">Scenario</p>
              <h2>{game.scenarioName}</h2>
            </div>
            <button
              className="ghost-button"
              disabled={isBusy}
              onClick={() => void relaunchScenario(game.scenarioId)}
              type="button"
            >
              重开本局
            </button>
          </header>

          <div className="scenario-list">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={scenario.id === game.scenarioId ? "scenario-card active" : "scenario-card"}
                disabled={isBusy}
                onClick={() => void relaunchScenario(scenario.id)}
                type="button"
              >
                <strong>{scenario.name}</strong>
                <span>{scenario.summary}</span>
              </button>
            ))}
          </div>

          <div className="rule-summary">
            <h3>原型规则摘要</h3>
            <ul>
              <li>点击己方未行动单位开始激活。</li>
              <li>点击相邻空地块执行机动，当前版本按格移动。</li>
              <li>点击敌方可见单位执行射击，结果由射程、地形与掷骰共同决定。</li>
              <li>单位每次激活默认 2 AP，用完后自动结束。</li>
              <li>山脊目标区控制数与伤亡数共同决定胜利。</li>
            </ul>
          </div>

          <div className="progress-grid">
            <article>
              <span>Allied 目标控制</span>
              <strong>{game.victory.alliesObjectiveControl}</strong>
            </article>
            <article>
              <span>Axis 目标控制</span>
              <strong>{game.victory.axisObjectiveControl}</strong>
            </article>
            <article>
              <span>Allied 伤亡</span>
              <strong>{game.victory.alliesCasualties}</strong>
            </article>
            <article>
              <span>Axis 伤亡</span>
              <strong>{game.victory.axisCasualties}</strong>
            </article>
          </div>
        </aside>

        <section className="panel battlefield-panel">
          <header className="panel-header compact">
            <div>
              <p className="panel-kicker">Battlefield</p>
              <h2>战场沙盘</h2>
            </div>
            <div className="header-actions">
              <span className={game.activeSide === "allies" ? "turn-badge allies" : "turn-badge axis"}>
                {sideLabels[game.activeSide]}
              </span>
              <button
                className="ghost-button"
                disabled={isBusy || game.status !== "in_progress"}
                onClick={() => void applyCommand({ type: "end-round" })}
                type="button"
              >
                跳过剩余激活
              </button>
            </div>
          </header>

          <div className="battlefield-frame">
            <div
              className="battlefield-grid"
              style={{
                gridTemplateColumns: `repeat(${game.map.width}, minmax(0, 1fr))`,
              }}
            >
              {game.map.cells.map((cell) => {
                const occupant = game.units.find(
                  (unit) =>
                    !unit.eliminated && unit.position.x === cell.x && unit.position.y === cell.y,
                );
                const isSelected = occupant?.id === selectedUnit?.id;
                const isLegalMove = legalMoveTargets.has(`${cell.x}-${cell.y}`);
                const isLegalTarget = occupant ? legalTargets.has(occupant.id) : false;

                return (
                  <button
                    key={`${cell.x}-${cell.y}`}
                    className={[
                      "map-cell",
                      getTerrainClass(cell.terrain),
                      cell.objective ? "objective-cell" : "",
                      isSelected ? "selected-cell" : "",
                      isLegalMove ? "legal-move" : "",
                      isLegalTarget ? "legal-target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleCellClick(cell)}
                    type="button"
                  >
                    <span className="cell-coord">
                      {cell.x},{cell.y}
                    </span>
                    <span className="cell-terrain">{terrainLabels[cell.terrain]}</span>
                    {cell.objective ? <span className="objective-flag">OBJ</span> : null}
                    {occupant ? (
                      <div className={getUnitClass(occupant, isSelected)}>
                        <strong>{occupant.name}</strong>
                        <small>
                          {occupant.actionPoints} AP / {getUnitStatus(occupant)}
                        </small>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="legend-row">
            <span>
              <i className="legend-dot legend-open" />
              开阔地
            </span>
            <span>
              <i className="legend-dot legend-woods" />
              树林
            </span>
            <span>
              <i className="legend-dot legend-building" />
              建筑
            </span>
            <span>
              <i className="legend-dot legend-ridge" />
              山脊
            </span>
          </div>
        </section>

        <aside className="panel intel-panel">
          <header className="panel-header compact">
            <div>
              <p className="panel-kicker">Command Console</p>
              <h2>指挥台</h2>
            </div>
            {game.status === "finished" ? (
              <span className="winner-pill">{sideLabels[game.winner ?? "allies"]} 胜利</span>
            ) : null}
          </header>

          <section className="detail-card">
            <h3>当前激活</h3>
            {selectedUnit ? (
              <>
                <p className="detail-title">{selectedUnit.name}</p>
                <dl className="detail-list">
                  <div>
                    <dt>阵营</dt>
                    <dd>{sideLabels[selectedUnit.side]}</dd>
                  </div>
                  <div>
                    <dt>位置</dt>
                    <dd>
                      ({selectedUnit.position.x}, {selectedUnit.position.y})
                    </dd>
                  </div>
                  <div>
                    <dt>射程 / 火力</dt>
                    <dd>
                      {selectedUnit.stats.range} / {selectedUnit.stats.firepower}
                    </dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{getUnitStatus(selectedUnit)}</dd>
                  </div>
                </dl>
                <div className="detail-actions">
                  <button
                    className="primary-button"
                    disabled={isBusy || game.status !== "in_progress"}
                    onClick={() =>
                      void applyCommand({
                        type: "end-unit-activation",
                        unitId: selectedUnit.id,
                      })
                    }
                    type="button"
                  >
                    结束当前激活
                  </button>
                </div>
              </>
            ) : (
              <p className="placeholder-copy">
                从地图上点击当前行动方单位开始激活。蓝色高亮表示可机动位置，红色高亮表示可攻击目标。
              </p>
            )}
          </section>

          <section className="detail-card">
            <h3>可用单位</h3>
            <div className="unit-list">
              {selectableUnits.length === 0 ? (
                <p className="placeholder-copy">当前行动方已无可用单位，系统会自动切换阶段。</p>
              ) : (
                selectableUnits.map((unit) => (
                  <button
                    key={unit.id}
                    className={unit.id === selectedUnit?.id ? "unit-row active" : "unit-row"}
                    disabled={isBusy}
                    onClick={() => void applyCommand({ type: "select-unit", unitId: unit.id })}
                    type="button"
                  >
                    <strong>{unit.name}</strong>
                    <span>
                      ({unit.position.x}, {unit.position.y}) · {unit.actionPoints} AP
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="detail-card">
            <h3>作战日志</h3>
            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
            <ol className="log-list">
              {game.log.slice(0, 10).map((entry) => (
                <li key={entry.id}>
                  <span className="log-meta">
                    R{entry.round} · {sideLabels[entry.side]}
                  </span>
                  <p>{entry.message}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </section>
    </main>
  );
}
