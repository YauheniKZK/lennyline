import { useState } from "react";
import "./Game.css";
import GameMenu from "./GameMenu";
import ModelViewer from "./ModelViewer";
import GameDestruction from "./GameDestruction";
import GameRunner from "./GameRunner";
import packageJson from "../../package.json";

// Версия приложения (из package.json)
const APP_VERSION = packageJson.version;

function Game() {
  const [gameMode, setGameMode] = useState(null); // 'viewer' или 'destruction'
  const [isViewerStarted, setIsViewerStarted] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null); // Текущий выбранный для UI
  const [selectedParts, setSelectedParts] = useState(new Set()); // Множество всех выделенных сегментов
  const [clickedPartInfo, setClickedPartInfo] = useState(null);
  // Map для хранения URL изображений для каждого сегмента
  // Ключ: название сегмента (например, "Передняя - Сегмент (1,1)")
  // Значение: URL изображения
  const [segmentTextures, setSegmentTextures] = useState(new Map());
  // Map зависимостей: ключ - сегмент, значение - массив зависимых сегментов
  // Например: { "Сегмент1": ["Сегмент2", "Сегмент3"] } означает, что Сегмент2 и Сегмент3 зависят от Сегмента1
  const [dependencies, setDependencies] = useState(new Map());
  // Режим добавления зависимости - при клике на следующий сегмент он будет добавлен как зависимый
  const [isDependencyMode, setIsDependencyMode] = useState(false);
  const [dependencyFrom, setDependencyFrom] = useState(null);

  // URL 3D модели - можно указать путь к модели в public/models/
  // Примеры:
  // - "/models/your-model.glb" - если модель в public/models/
  // - "https://example.com/model.glb" - если модель на сервере
  // - null - покажет куб по умолчанию
  const [modelUrl] = useState(null);

  const handleModeSelect = (mode) => {
    setGameMode(mode);
  };

  const handleStart = () => {
    setIsViewerStarted(true);
  };

  // Обработчик клика по части модели
  const handlePartClick = (partName, intersect) => {
    // Если активен режим добавления зависимости
    if (isDependencyMode && dependencyFrom) {
      if (dependencyFrom !== partName) {
        // Добавляем зависимость: dependencyFrom зависит от partName
        setDependencies((prev) => {
          const newMap = new Map(prev);
          const deps = newMap.get(dependencyFrom) || [];
          if (!deps.includes(partName)) {
            newMap.set(dependencyFrom, [...deps, partName]);
          }
          return newMap;
        });
        console.log(`Добавлена зависимость: ${dependencyFrom} зависит от ${partName}`);
      }
      // Выходим из режима добавления зависимости
      setIsDependencyMode(false);
      setDependencyFrom(null);
      return;
    }
    
    // Обычный режим выбора - добавляем к выделенным
    setSelectedPart(partName);
    setSelectedParts((prev) => new Set([...prev, partName]));
    setClickedPartInfo({
      name: partName,
      position: intersect.point,
      distance: intersect.distance,
    });
    console.log("Клик по части:", partName, intersect);
  };

  // Обработчик загрузки изображения для выбранного сегмента
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file || !selectedPart) return;

    // Создаем URL для загруженного файла
    const imageUrl = URL.createObjectURL(file);

    // Обновляем Map с текстурами
    setSegmentTextures((prev) => {
      const newMap = new Map(prev);
      newMap.set(selectedPart, imageUrl);
      return newMap;
    });

    // Очищаем input
    event.target.value = "";
  };

  // Если режим не выбран, показываем меню выбора режима
  if (!gameMode) {
    return (
      <div className="game-container">
        <div className="game-header">
          <div className="game-title-section">
            <h2 className="game-title">LennyLine</h2>
            <span className="game-version">v{APP_VERSION}</span>
          </div>
        </div>
        <div className="game-area">
          <GameMenu onStart={handleStart} onModeSelect={handleModeSelect} />
        </div>
      </div>
    );
  }

  // Если выбран режим разрушения, показываем GameDestruction
  if (gameMode === 'destruction') {
    return <GameDestruction />;
  }

  // Если выбран режим бегуна, показываем GameRunner
  if (gameMode === 'runner') {
    return <GameRunner />;
  }

  // Режим viewer (текущая игра)
  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title-section">
          <h2 className="game-title">3D Model Viewer</h2>
          <span className="game-version">v{APP_VERSION}</span>
        </div>
      </div>

      <div className="game-area">
        {isViewerStarted ? (
          <>
            <ModelViewer
              modelUrl={modelUrl}
              onPartClick={handlePartClick}
              selectedPart={selectedPart}
              selectedParts={selectedParts}
              segmentTextures={segmentTextures}
              dependencies={dependencies}
            />
            {/* Информация о выбранной части */}
            {clickedPartInfo && (
              <div className="part-info">
                <div className="part-info-content">
                  <h3>Выбранная часть:</h3>
                  <p className="part-name">{clickedPartInfo.name}</p>
                  <label className="image-upload-label">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                    Загрузить изображение
                  </label>
                  {/* Отображение текущих зависимостей */}
                  {dependencies.get(clickedPartInfo.name) && (
                    <div className="dependencies-list">
                      <h4>Зависимости:</h4>
                      <ul>
                        {dependencies.get(clickedPartInfo.name).map((dep, idx) => (
                          <li key={idx}>
                            {dep}
                            <button
                              className="remove-dependency-btn"
                              onClick={() => {
                                setDependencies((prev) => {
                                  const newMap = new Map(prev);
                                  const deps = newMap.get(clickedPartInfo.name) || [];
                                  const updated = deps.filter((d) => d !== dep);
                                  if (updated.length > 0) {
                                    newMap.set(clickedPartInfo.name, updated);
                                  } else {
                                    newMap.delete(clickedPartInfo.name);
                                  }
                                  return newMap;
                                });
                              }}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    className={`connect-button ${isDependencyMode ? "active" : ""}`}
                    onClick={() => {
                      if (isDependencyMode) {
                        // Отменяем режим добавления зависимости
                        setIsDependencyMode(false);
                        setDependencyFrom(null);
                      } else {
                        // Активируем режим добавления зависимости
                        setIsDependencyMode(true);
                        setDependencyFrom(clickedPartInfo.name);
                      }
                    }}
                  >
                    {isDependencyMode ? "Отменить" : "Добавить зависимость"}
                  </button>
                  <button
                    className="clear-selection-button"
                    onClick={() => {
                      setSelectedParts(new Set());
                    }}
                  >
                    Очистить выделение
                  </button>
                  <button
                    className="part-info-close"
                    onClick={() => {
                      setSelectedPart(null);
                      setSelectedParts(new Set());
                      setClickedPartInfo(null);
                      setIsDependencyMode(false);
                      setDependencyFrom(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <GameMenu onStart={handleStart} onModeSelect={handleModeSelect} />
        )}
      </div>
    </div>
  );
}

export default Game;
