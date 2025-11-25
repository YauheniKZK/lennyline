import { useState } from "react";
import "./Game.css";
import GameMenu from "./GameMenu";
import ModelViewer from "./ModelViewer";
import packageJson from "../../package.json";

// Версия приложения (из package.json)
const APP_VERSION = packageJson.version;

function Game() {
  const [isViewerStarted, setIsViewerStarted] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [clickedPartInfo, setClickedPartInfo] = useState(null);
  // Map для хранения URL изображений для каждого сегмента
  // Ключ: название сегмента (например, "Передняя - Сегмент (1,1)")
  // Значение: URL изображения
  const [segmentTextures, setSegmentTextures] = useState(new Map());

  // URL 3D модели - можно указать путь к модели в public/models/
  // Примеры:
  // - "/models/your-model.glb" - если модель в public/models/
  // - "https://example.com/model.glb" - если модель на сервере
  // - null - покажет куб по умолчанию
  const [modelUrl] = useState(null);

  const handleStart = () => {
    setIsViewerStarted(true);
  };

  // Обработчик клика по части модели
  const handlePartClick = (partName, intersect) => {
    setSelectedPart(partName);
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
              segmentTextures={segmentTextures}
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
                  <button
                    className="part-info-close"
                    onClick={() => {
                      setSelectedPart(null);
                      setClickedPartInfo(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <GameMenu onStart={handleStart} />
        )}
      </div>
    </div>
  );
}

export default Game;
