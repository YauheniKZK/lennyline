# Где найти и как использовать 3D модели

## Бесплатные источники 3D моделей:

### 1. **Sketchfab** (https://sketchfab.com)
   - Огромная библиотека бесплатных моделей
   - Форматы: GLTF, GLB, OBJ
   - Фильтр по лицензии (CC0, CC-BY - бесплатные)
   - Как использовать:
     - Зарегистрируйтесь
     - Найдите модель с лицензией CC0 или CC-BY
     - Скачайте в формате GLB или GLTF
     - Положите в папку `public/models/`

### 2. **Poly Haven** (https://polyhaven.com/models)
   - Полностью бесплатные модели (CC0)
   - Высокое качество
   - Форматы: GLTF, GLB, FBX

### 3. **TurboSquid Free** (https://www.turbosquid.com/Search/3D-Models/free)
   - Бесплатные модели
   - Различные форматы

### 4. **Free3D** (https://free3d.com)
   - Большая коллекция бесплатных моделей
   - Различные форматы

### 5. **CGTrader Free** (https://www.cgtrader.com/free-3d-models)
   - Бесплатные модели
   - Хорошее качество

## Создание собственных моделей:

### 1. **Blender** (https://www.blender.org) - БЕСПЛАТНО
   - Мощный 3D редактор
   - Экспорт в GLTF/GLB:
     - File → Export → glTF 2.0
     - Выберите формат GLB (рекомендуется)

### 2. **Tinkercad** (https://www.tinkercad.com) - БЕСПЛАТНО
   - Простой онлайн редактор
   - Хорошо для начинающих
   - Экспорт в OBJ (нужно конвертировать в GLB)

### 3. **SketchUp Free** (https://www.sketchup.com)
   - Простой инструмент
   - Нужна конвертация в GLB

## Конвертация моделей:

### Онлайн конвертеры:
- **glTF.report** (https://gltf.report) - конвертация различных форматов в GLB
- **AnyConv** (https://anyconv.com) - конвертация 3D форматов

### Рекомендуемый формат:
- **GLB** - лучший выбор (один файл, содержит текстуры)
- **GLTF** - тоже хорошо, но может требовать отдельные файлы текстур

## Как добавить модель в приложение:

1. Создайте папку для моделей:
   ```bash
   mkdir -p public/models
   ```

2. Положите модель в `public/models/your-model.glb`

3. Обновите `Game.jsx`:
   ```javascript
   const [modelUrl] = useState("/models/your-model.glb");
   ```

4. Или сделайте загрузку динамической:
   ```javascript
   const [modelUrl, setModelUrl] = useState(null);
   
   const handleFileSelect = (e) => {
     const file = e.target.files[0];
     if (file) {
       const url = URL.createObjectURL(file);
       setModelUrl(url);
     }
   };
   ```

## Примеры простых моделей для тестирования:

1. **Простой куб** - уже встроен в компонент
2. **Скачайте тестовую модель** с Sketchfab:
   - Поиск: "test model glb"
   - Выберите модель с лицензией CC0
   - Скачайте GLB формат

## Оптимизация моделей:

- Используйте GLB формат (один файл)
- Оптимизируйте полигоны (меньше = быстрее)
- Сжимайте текстуры
- Используйте инструменты:
  - **glTF-Pipeline** для оптимизации
  - **Draco compression** для сжатия геометрии

