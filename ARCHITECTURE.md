# HMI Editor — Техническая документация

## Обзор системы

Проект представляет собой веб-приложение для создания и отображения HMI-экранов (Human-Machine Interface). Состоит из двух независимых SPA-приложений в рамках npm workspaces монорепо:

- **editor** — редактор экранов. Позволяет создавать многостраничные HMI-экраны, настраивать элементы и тестировать привязки к переменным бэкенда в реальном времени.
- **viewer** — просмотрщик. Загружает готовый `.hmi.json` файл и отображает экран в режиме реального времени без возможности редактирования.

Оба приложения построены на **Vue 3 + TypeScript + Vite**. Для рендеринга элементов на холсте используется **fabric.js**. Состояние управляется через **Pinia**.

---

## Структура монорепо

```
hmi-monorepo/
├── editor/          # Редактор
│   └── src/
│       ├── components/   # Vue-компоненты интерфейса
│       ├── elements/     # Классы HMI-элементов
│       ├── store/        # Pinia-сторы
│       ├── composables/  # useCanvas и др.
│       └── utils/
├── viewer/          # Просмотрщик
│   └── src/
│       ├── components/
│       ├── elements/     # Копии классов элементов (без логики редактора)
│       ├── runtime/      # Логика рантайма (привязки, tick)
│       └── store/
└── package.json     # Корневой workspace
```

---

## Архитектура элементов

Каждый HMI-элемент — это класс, наследующий `BaseElement<TProps>`, который в свою очередь наследует `fabric.Group`.

```
fabric.Group
    └── BaseElement<TProps>
            ├── LedIndicator
            ├── ToggleButton
            ├── NumberInput
            ├── NumberControl
            ├── NumberDisplay
            ├── GraphElement
            ├── Tank
            ├── LineElement
            └── ImageElement
```

`BaseElement` предоставляет:
- `customProps` — типизированные свойства элемента
- `bindingsData` — привязки входов/выходов к переменным бэкенда
- `label` — текстовая подпись (fabric.Text)
- `setState(state)` — обновление визуального состояния по данным из бэкенда
- `updateFromProps()` — перерисовка при изменении свойств
- `toObject()` — сериализация для сохранения в JSON (включает `bindingsData`, `customProps`, `elementType`)

Реестр элементов (`ElementRegistry`) — словарь `elementType → класс`, используется при загрузке файла для восстановления объектов по типу.

---

## Формат файла `.hmi.json`

```jsonc
{
  "meta": { "version": "2.0", "created": "ISO-дата" },
  "activePageId": "uuid",
  "pages": [
    {
      "id": "uuid",
      "name": "Page 1",
      "canvasJson": {          
        "objects": [
          {
            "elementType": "numDisplay",
            "customProps": { "value": 0, "fontSize": 24, ... },
            "bindingsData": {
              "inputs":  { "value": "outputs.outputs.sensor1" },
              "outputs": {}
            },
            "left": 100, "top": 200, ...
          }
        ]
      },
      "view": { "zoom": 1, "offsetX": 0, "offsetY": 0 }
    }
  ],
  "grid": { "showGrid": false, "snapToGrid": false, "showGuides": false }
}
```

Путь привязки имеет формат `<dataset>.<section>.<varName>`:
- `outputs.outputs.x` — выход контроллера (PLC)
- `outputs.inputs.x` — вход контроллера
- `outputs.global_vars.x` — глобальная переменная контроллера
- `plant_outputs.outputs.x` — выход модели объекта (plant)

---

## Взаимодействие с бэкендом

Оба приложения общаются с бэкендом через HTTP REST API. Базовый URL задаётся через переменную окружения `VITE_BACKEND_URL` (editor) или фиксирован как относительный путь (viewer).

### Чтение данных

Каждую секунду приложение опрашивает два эндпоинта:

```
GET /sessions/{sessionId}/outputs        → состояние PLC
GET /sessions/{sessionId}/plant_outputs  → состояние модели объекта
```

Ответ — JSON-объект с полями `inputs`, `outputs`, `global_vars` и т.д.

### Запись данных

При взаимодействии пользователя с управляющим элементом:

```
POST /sessions/{sessionId}/load_inputs
Content-Type: multipart/form-data

action=loadInputs
inputs={"varName": value}
plant_inputs={"varName": value}
global_inputs={"varName": value}
```

---

## Рантайм во Viewer

Логика рантайма сосредоточена в `viewer/src/runtime/useHmiRuntime.ts`.

1. При загрузке HMI-файла объекты canvas восстанавливаются через `ElementRegistry`
2. `attachStoreWatcher` подписывается на изменения Pinia-стора (`ss.plc`, `ss.plant`)
3. При каждом изменении вызывается `tick()` — проходит по всем привязкам и вызывает `el.setState(state)` для каждого элемента
4. Дополнительно `tick()` вызывается по таймеру раз в секунду как гарантия обновления

### Граф (Time Graph)

`GraphElement` хранит текущее значение в `_currentValue`. Компонент `GraphTimeSeries.vue` рендерится поверх canvas как абсолютно позиционированный div и читает значение через `getCurrentValue()`. Реактивность обеспечивается счётчиком `graphsVersion`, инкрементируемым при каждом `after:render` canvas.

---

## Добавление нового элемента

1. Создать класс в `editor/src/elements/MyElement.ts`, наследующий `BaseElement<MyProps>`
2. Задать `static elementType`, `static category`, `static meta`
3. Реализовать `setState()` и `updateFromProps()`
4. Зарегистрировать в `editor/src/elements/index.ts`
5. Добавить отображаемое имя в `elementDisplayNames` в `LeftSidebar.vue`
6. Продублировать класс в `viewer/src/elements/` (без логики редактора) и зарегистрировать в `viewer/src/elements/index.ts`
