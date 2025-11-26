import { useState } from "react";
import "./Game.css";
import DestructionViewer from "./DestructionViewer";
import packageJson from "../../package.json";

// Версия приложения (из package.json)
const APP_VERSION = packageJson.version;

function GameDestruction() {
  const [isViewerStarted, setIsViewerStarted] = useState(false);
  const [removedCubes, setRemovedCubes] = useState(new Set()); // Множество удаленных кубиков
  const [cubeSize] = useState(5); // Размер куба (5x5x5)

  const handleStart = () => {
    setIsViewerStarted(true);
  };

  // Обработчик клика по кубику - удаляем его
  const handleCubeClick = (cubeId) => {
    setRemovedCubes((prev) => {
      const newSet = new Set(prev);
      newSet.add(cubeId);
      return newSet;
    });
    console.log(`Кубик ${cubeId} удален`);
  };

  // Сброс игры
  const handleReset = () => {
    setRemovedCubes(new Set());
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title-section">
          <h2 className="game-title">Разрушение куба</h2>
          <span className="game-version">v{APP_VERSION}</span>
        </div>
      </div>

      <div className="game-area">
        {isViewerStarted ? (
          <>
            <DestructionViewer
              onCubeClick={handleCubeClick}
              removedCubes={removedCubes}
              cubeSize={cubeSize}
            />
            {/* Панель управления */}
            <div className="part-info">
              <div className="part-info-content">
                <h3>Управление</h3>
                <p className="part-name">
                  Удалено кубиков: {removedCubes.size} / {cubeSize * cubeSize * cubeSize}
                </p>
                <button
                  className="clear-selection-button"
                  onClick={handleReset}
                >
                  Сбросить
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="game-menu">
            <button className="game-menu-button" onClick={handleStart}>
              Старт
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameDestruction;

