# 接口设计

## 1. 设计原则

- 接口尽量少而清晰
- 所有状态变更都通过命令接口完成
- 前端只负责请求与展示，不直接改写规则状态

## 2. 接口列表

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/scenarios` | 获取可用场景列表 |
| `POST` | `/api/games` | 创建新对局 |
| `GET` | `/api/games/:gameId` | 获取指定对局状态 |
| `POST` | `/api/games/:gameId/commands` | 提交对局命令 |

## 3. 请求与响应示例

### 3.1 创建对局

请求：

```json
{
  "scenarioId": "probe-at-hill-402"
}
```

响应：

```json
{
  "game": {
    "id": "game-abc123",
    "scenarioId": "probe-at-hill-402",
    "scenarioName": "Hill 402 Probe",
    "status": "in_progress"
  }
}
```

### 3.2 选择单位

请求：

```json
{
  "type": "select-unit",
  "unitId": "a-rifle-1"
}
```

### 3.3 移动单位

请求：

```json
{
  "type": "move-unit",
  "unitId": "a-rifle-1",
  "destination": {
    "x": 0,
    "y": 3
  }
}
```

### 3.4 射击目标

请求：

```json
{
  "type": "fire-at-target",
  "attackerId": "a-rifle-1",
  "targetId": "x-rifle-1"
}
```

## 4. 错误处理

当规则校验失败时，服务返回 `400`，并包含消息文本。例如：

```json
{
  "message": "目标超出当前射程。"
}
```

常见错误包括：

- 单位不存在
- 操作非当前行动方单位
- 目标地块被占据
- 目标超出射程
- 当前地形阻断视线

## 5. 命令式接口的优势

相比“直接覆盖整局状态”的接口设计，命令式接口更适合兵棋推演系统：

- 更符合规则引擎思维
- 更适合记录回放事件流
- 更利于后续多人同步
- 更容易控制非法状态写入

