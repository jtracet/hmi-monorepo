# HMI Editor & Viewer

Набор приложений для редактирования и просмотра HMI-файлов.

## 📦 Структура

- `editor/` – Vue3-компонент для создания HMI
- `viewer/` – Vue3-просмотрщик HMI-файлов и онлайн-сессия.

## 🚀 Быстрый старт

### 1. Установить зависимости

```bash
# из корня (если нужно)
npm install

# отдельно для editor и viewer
cd editor && npm install
cd ../viewer && npm install
````

### 2. Запустить в режиме разработки

```bash
# редактор
cd editor
npm run dev

# просмотрщик
cd ../viewer
npm run dev
```

По умолчанию оба приложения поднимаются на портах, указаных в `.env` (`VITE_PORT`) и проксируют API на `VITE_BACKEND_URL`.

## 🛠️ Сборка

```bash
# сборка редактора
cd editor && npm run build

# сборка просмотрщика
cd viewer && npm run build
```

Скомпилированные файлы попадут в папки `editor/dist` и `viewer/dist`.

## ⚙️ Переменные окружения

В каждой из папок (`editor/`, `viewer/`) создайте файл `.env`:

```dotenv
VITE_BACKEND_URL=https://api.example.com
VITE_PORT=5173
```

## 📄 Лицензия

MIT
