import { useState, useRef, useEffect } from "react";
import "./Game.css";

const OBSTACLE_TYPES = {
  PLATFORM: "platform",
  WALL: "wall",
};

const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 15;
const WALL_WIDTH = 400;
const PLAYER_HEIGHT = 60;

function MapGenerator({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [mapLength, setMapLength] = useState(5000); // Длина карты в пикселях
  const [mapHeight, setMapHeight] = useState(0); // Высота будет автоматически
  const [obstacles, setObstacles] = useState([]); // Массив препятствий [{x, y, type, ...}]
  const [selectedObstacleType, setSelectedObstacleType] = useState(OBSTACLE_TYPES.PLATFORM);
  const [scale, setScale] = useState(1); // Масштаб для отображения

  // Получаем высоту экрана устройства
  useEffect(() => {
    const updateMapHeight = () => {
      const height = window.innerHeight || document.documentElement.clientHeight;
      setMapHeight(height);
    };

    updateMapHeight();
    window.addEventListener("resize", updateMapHeight);
    return () => window.removeEventListener("resize", updateMapHeight);
  }, []);

  // Инициализация canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Устанавливаем размеры canvas
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Вычисляем масштаб для отображения всей карты
    const scaleX = containerWidth / mapLength;
    const scaleY = containerHeight / mapHeight;
    const newScale = Math.min(scaleX, scaleY, 1); // Не увеличиваем больше 1:1
    setScale(newScale);

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем фон
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Рисуем сетку для удобства
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    const gridSize = 100 * newScale;
    for (let x = 0; x < mapLength * newScale; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mapHeight * newScale);
      ctx.stroke();
    }
    for (let y = 0; y < mapHeight * newScale; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mapLength * newScale, y);
      ctx.stroke();
    }

    // Рисуем землю (60% от высоты)
    const groundY = mapHeight * 0.6;
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, groundY * newScale, mapLength * newScale, (mapHeight - groundY) * newScale);

    // Рисуем препятствия
    obstacles.forEach((obstacle) => {
      if (obstacle.type === OBSTACLE_TYPES.PLATFORM) {
        ctx.fillStyle = "#4a4a4a";
        ctx.fillRect(
          obstacle.x * newScale,
          obstacle.y * newScale,
          PLATFORM_WIDTH * newScale,
          PLATFORM_HEIGHT * newScale
        );
        // Обводим для видимости
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          obstacle.x * newScale,
          obstacle.y * newScale,
          PLATFORM_WIDTH * newScale,
          PLATFORM_HEIGHT * newScale
        );
      } else if (obstacle.type === OBSTACLE_TYPES.WALL) {
        // Стена - рисуем верхнюю и нижнюю части с отверстием
        const gapSize = obstacle.gapSize || PLAYER_HEIGHT * 5;
        const gapTop = obstacle.gapTop || mapHeight * 0.2;

        // Верхняя часть стены
        if (gapTop > 20) {
          ctx.fillStyle = "#ff6b6b";
          ctx.fillRect(
            obstacle.x * newScale,
            0,
            WALL_WIDTH * newScale,
            gapTop * newScale
          );
        }

        // Нижняя часть стены
        const gapBottom = gapTop + gapSize;
        const bottomWallHeight = groundY - gapBottom;
        if (bottomWallHeight > 20) {
          ctx.fillStyle = "#ff6b6b";
          ctx.fillRect(
            obstacle.x * newScale,
            gapBottom * newScale,
            WALL_WIDTH * newScale,
            bottomWallHeight * newScale
          );
        }

        // Обводим для видимости
        ctx.strokeStyle = "#cc0000";
        ctx.lineWidth = 2;
        if (gapTop > 20) {
          ctx.strokeRect(
            obstacle.x * newScale,
            0,
            WALL_WIDTH * newScale,
            gapTop * newScale
          );
        }
        if (bottomWallHeight > 20) {
          ctx.strokeRect(
            obstacle.x * newScale,
            gapBottom * newScale,
            WALL_WIDTH * newScale,
            bottomWallHeight * newScale
          );
        }
      }
    });

    // Рисуем линию старта
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, mapHeight * newScale);
    ctx.stroke();
    ctx.setLineDash([]);

    // Рисуем линию финиша
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(mapLength * newScale, 0);
    ctx.lineTo(mapLength * newScale, mapHeight * newScale);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [mapLength, mapHeight, obstacles, scale]);

  // Обработка клика по canvas для размещения препятствий
  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Проверяем, не кликнули ли на существующее препятствие (для удаления)
    const clickedObstacle = obstacles.find((obs) => {
      if (obs.type === OBSTACLE_TYPES.PLATFORM) {
        return (
          x >= obs.x &&
          x <= obs.x + PLATFORM_WIDTH &&
          y >= obs.y - PLATFORM_HEIGHT / 2 &&
          y <= obs.y + PLATFORM_HEIGHT / 2
        );
      } else if (obs.type === OBSTACLE_TYPES.WALL) {
        return x >= obs.x && x <= obs.x + WALL_WIDTH;
      }
      return false;
    });

    if (clickedObstacle) {
      // Удаляем препятствие
      setObstacles(obstacles.filter((obs) => obs !== clickedObstacle));
      return;
    }

    // Добавляем новое препятствие
    if (selectedObstacleType === OBSTACLE_TYPES.PLATFORM) {
      const groundY = mapHeight * 0.6;
      const platformY = Math.max(
        PLATFORM_HEIGHT / 2,
        Math.min(y, groundY - PLATFORM_HEIGHT / 2)
      );

      setObstacles([
        ...obstacles,
        {
          x: Math.max(0, Math.min(x, mapLength - PLATFORM_WIDTH)),
          y: platformY,
          type: OBSTACLE_TYPES.PLATFORM,
        },
      ]);
    } else if (selectedObstacleType === OBSTACLE_TYPES.WALL) {
      const groundY = mapHeight * 0.6;
      const gapSize = PLAYER_HEIGHT * 5; // Стандартный размер отверстия
      const gapTop = Math.max(
        50,
        Math.min(y - gapSize / 2, groundY - gapSize - 50)
      );

      setObstacles([
        ...obstacles,
        {
          x: Math.max(0, Math.min(x, mapLength - WALL_WIDTH)),
          gapTop: gapTop,
          gapSize: gapSize,
          type: OBSTACLE_TYPES.WALL,
        },
      ]);
    }
  };

  // Сохранение карты
  const handleSave = () => {
    const mapData = {
      length: mapLength,
      height: mapHeight,
      obstacles: obstacles,
      version: "1.0",
    };

    localStorage.setItem("gameMap", JSON.stringify(mapData));
    if (onSave) {
      onSave(mapData);
    }
  };

  // Очистка всех препятствий
  const handleClear = () => {
    if (window.confirm("Удалить все препятствия?")) {
      setObstacles([]);
    }
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title-section">
          <h2 className="game-title">Генератор карты</h2>
        </div>
      </div>

      <div className="game-area" style={{ display: "flex", flexDirection: "column" }}>
        {/* Панель настроек */}
        <div
          style={{
            padding: "15px",
            background: "#fff",
            borderBottom: "1px solid #ddd",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ minWidth: "120px" }}>Длина карты (px):</label>
            <input
              type="number"
              value={mapLength}
              onChange={(e) => setMapLength(Math.max(1000, parseInt(e.target.value) || 1000))}
              min="1000"
              step="100"
              style={{
                flex: 1,
                padding: "5px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ minWidth: "120px" }}>Высота карты (px):</label>
            <input
              type="number"
              value={mapHeight}
              disabled
              style={{
                flex: 1,
                padding: "5px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "#f5f5f5",
              }}
            />
            <span style={{ fontSize: "12px", color: "#666" }}>Автоматически</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ minWidth: "120px" }}>Тип препятствия:</label>
            <select
              value={selectedObstacleType}
              onChange={(e) => setSelectedObstacleType(e.target.value)}
              style={{
                flex: 1,
                padding: "5px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value={OBSTACLE_TYPES.PLATFORM}>Платформа</option>
              <option value={OBSTACLE_TYPES.WALL}>Стена</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
            <button
              className="game-menu-button"
              onClick={handleSave}
              style={{ flex: 1, backgroundColor: "#28a745" }}
            >
              Сохранить карту
            </button>
            <button
              className="game-menu-button"
              onClick={handleClear}
              style={{ flex: 1, backgroundColor: "#dc3545" }}
            >
              Очистить
            </button>
            <button
              className="game-menu-button"
              onClick={onCancel}
              style={{ flex: 1, backgroundColor: "#6c757d" }}
            >
              Отмена
            </button>
          </div>

          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Кликните на карту, чтобы добавить препятствие. Клик по существующему препятствию удалит его.
            Препятствий: {obstacles.length}
          </div>
        </div>

        {/* Canvas для карты */}
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "auto",
            background: "#e0e0e0",
          }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              display: "block",
              cursor: "crosshair",
              width: "100%",
              height: "100%",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MapGenerator;

