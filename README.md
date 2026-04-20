# 百码推演 / Hundred Yards Ops

基于 **The Last Hundred Yards** 公开规则思想抽象出的软件工程课程原型项目。  
本仓库包含：

- 一套适合课程初期汇报的文档体系
- 一个可运行的 Web 原型
- 一个独立的简化规则引擎
- 清晰的前后端分层结构

## 1. 项目定位

本项目不是对商业兵棋内容的完整数字复刻，而是基于公开规则资料提炼出：

- 单位激活
- 机动与射击
- 地形与视线
- 回合与胜利进度

并将其实现为面向课程展示的 Web 原型。

## 2. 目录结构

```text
.
├── apps
│   ├── server          # Express API，房间状态与命令分发
│   └── web             # React + Vite 前端演示界面
├── packages
│   └── shared          # 规则抽象、类型、示例场景、纯函数引擎
├── docs                # 软件工程文档
├── figures             # Mermaid 图与渲染产物
└── docs/research       # 已收集的规则资料
```

## 3. 快速启动

```bash
npm install
npm run dev
```

默认：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 4. 构建与测试

```bash
npm run build
npm test
```

## 5. 当前原型能力

- 载入示例战场
- 创建对局
- 选择己方单位
- 相邻格机动
- 视线检查与射击判定
- 压制 / 消灭结果
- 回合推进与事件日志
- 关键地域控制进度显示

## 6. 主要文档

- [初期汇报总览](./docs/00-initial-report.md)
- [项目章程](./docs/01-project-charter.md)
- [需求规格说明](./docs/02-requirements-specification.md)
- [总体设计说明](./docs/03-architecture-design.md)
- [接口设计](./docs/04-api-design.md)
- [迭代计划](./docs/05-iteration-plan.md)
- [测试计划](./docs/06-test-plan.md)
- [风险登记册](./docs/07-risk-register.md)

## 7. 规则边界

- 只使用公开资料中的机制思想进行抽象
- 不复制完整商业任务文本、卡表或地图包
- 当前实现为课程原型的最小可演示版本

