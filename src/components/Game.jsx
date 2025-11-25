import { useState } from "react";
import "./Game.css";
import GameMenu from "./GameMenu";
import ModelViewer from "./ModelViewer";
import packageJson from "../../package.json";

// Версия приложения (из package.json)
const APP_VERSION = packageJson.version;

function Game() {
  const [isViewerStarted, setIsViewerStarted] = useState(false);
  // URL 3D модели - можно указать путь к модели в public/models/
  // Примеры:
  // - "/models/your-model.glb" - если модель в public/models/
  // - "https://example.com/model.glb" - если модель на сервере
  // - null - покажет куб по умолчанию
  const [modelUrl] = useState(null);

  const handleStart = () => {
    setIsViewerStarted(true);
  };

  // Функция для загрузки модели из файла (опционально)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if ((file && file.name.endsWith(".glb")) || file.name.endsWith(".gltf")) {
      const url = URL.createObjectURL(file);
      // Можно использовать setModelUrl(url) если добавить состояние
      console.log("Модель загружена:", file.name);
    }
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
          <ModelViewer modelUrl={modelUrl} />
        ) : (
          <GameMenu onStart={handleStart} />
        )}
      </div>
    </div>
  );
}

export default Game;
