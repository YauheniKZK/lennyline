import { useState } from "react";
import "./Game.css";
import DestructionViewer from "./DestructionViewer";
import packageJson from "../../package.json";

// Версия приложения (из package.json)
const APP_VERSION = packageJson.version;

function GameDestruction() {
  const [isViewerStarted, setIsViewerStarted] = useState(false);
  // Map для хранения степени разрушения каждого кубика
  // Ключ: cubeId, Значение: количество кликов (0 = нетронутый, maxHits = разрушен)
  const [cubeDamage, setCubeDamage] = useState(new Map());
  const [cubeSize] = useState(5); // Размер куба (5x5x5)
  const [hitsToDestroy] = useState(10); // Количество кликов для разрушения кубика

  const handleStart = () => {
    setIsViewerStarted(true);
  };

  // Обработчик клика по кубику - увеличиваем степень разрушения
  const handleCubeClick = (cubeId) => {
    setCubeDamage((prev) => {
      const newMap = new Map(prev);
      const currentHits = newMap.get(cubeId) || 0;
      
      // Если кубик уже разрушен, не обрабатываем клик
      if (currentHits >= hitsToDestroy) {
        return newMap;
      }
      
      const newHits = currentHits + 1;
      
      if (newHits >= hitsToDestroy) {
        // Кубик полностью разрушен - устанавливаем максимальное значение
        newMap.set(cubeId, hitsToDestroy);
        console.log(`Кубик ${cubeId} полностью разрушен`);
      } else {
        // Увеличиваем степень разрушения
        newMap.set(cubeId, newHits);
        console.log(`Кубик ${cubeId}: ${newHits}/${hitsToDestroy} кликов`);
      }
      return newMap;
    });
  };

  // Сброс игры
  const handleReset = () => {
    setCubeDamage(new Map());
  };

  // Подсчет удаленных кубиков (те, у которых damageLevel >= hitsToDestroy)
  const removedCubesCount = Array.from(cubeDamage.values()).filter(
    (damage) => damage >= hitsToDestroy
  ).length;

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
              cubeDamage={cubeDamage}
              cubeSize={cubeSize}
              hitsToDestroy={hitsToDestroy}
            />
            {/* Панель управления */}
            <div className="part-info">
              <div className="part-info-content">
                <h3>Управление</h3>
                <p className="part-name">
                  Удалено кубиков: {removedCubesCount} / {cubeSize * cubeSize * cubeSize}
                </p>
                <p className="part-name" style={{ fontSize: "0.9rem", color: "#666" }}>
                  Кликов для разрушения: {hitsToDestroy}
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

