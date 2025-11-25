import { useEffect, useRef, useState, useCallback } from "react";
import "./Game.css";
import GameMenu from "./GameMenu";
import packageJson from "../../package.json";

// Версия приложения (из package.json)
const APP_VERSION = packageJson.version;

// Класс круглой кнопки с номером
class NumberButton {
  constructor(canvas, number, x, y, radius = 40) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.number = number;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.isClicked = false;
    this.alpha = 1.0; // Прозрачность для анимации появления/исчезновения
    this.timeVisible = 0; // Время с момента появления
    this.lifetime = 3000; // Время жизни кнопки в миллисекундах (3 секунды)
    this.isExpired = false;
  }

  // Обновление кнопки
  update(deltaTime) {
    if (this.isClicked || this.isExpired) {
      return;
    }

    this.timeVisible += deltaTime;

    // Анимация появления (первые 200мс)
    if (this.timeVisible < 200) {
      this.alpha = this.timeVisible / 200;
    }

    // Проверка истечения времени жизни
    if (this.timeVisible >= this.lifetime) {
      this.isExpired = true;
      this.alpha = 0;
      return true; // Возвращаем true, если кнопка истекла
    }

    // Анимация исчезновения (последние 500мс)
    const timeUntilExpire = this.lifetime - this.timeVisible;
    if (timeUntilExpire < 500) {
      this.alpha = timeUntilExpire / 500;
    }

    return false;
  }

  // Отрисовка кнопки
  draw() {
    if (this.alpha <= 0) return;

    this.ctx.save();
    this.ctx.globalAlpha = this.alpha;

    // Рисуем круг
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = "#3390ec";
    this.ctx.fill();
    this.ctx.strokeStyle = "#1e5faa";
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Рисуем номер
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = `bold ${this.radius * 0.6}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(this.number.toString(), this.x, this.y);

    this.ctx.restore();
  }

  // Проверка попадания клика в кнопку
  isPointInside(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  // Обработка клика
  click() {
    if (!this.isClicked && !this.isExpired && this.alpha > 0.5) {
      this.isClicked = true;
      return true;
    }
    return false;
  }
}

// Менеджер кнопок
class ButtonManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.buttons = [];
    this.nextButtonNumber = 1;
    this.expectedButtonNumber = 1; // Ожидаемый номер следующей кнопки для нажатия
    this.lastSpawnTime = 0;
    this.initialSpawnInterval = 2000; // Начальный интервал: 2 секунды
    this.minSpawnInterval = 300; // Минимальный интервал: 0.3 секунды
    this.spawnIntervalDecrease = 50; // Уменьшение интервала на каждую кнопку (мс)
    this.currentSpawnInterval = this.initialSpawnInterval;
    this.gameStarted = false;
  }

  // Начать игру
  start() {
    this.buttons = [];
    this.nextButtonNumber = 1;
    this.expectedButtonNumber = 1; // Начинаем с кнопки №1
    this.lastSpawnTime = 0;
    this.currentSpawnInterval = this.initialSpawnInterval;
    this.gameStarted = true;
  }

  // Остановить игру
  stop() {
    this.gameStarted = false;
  }

  // Очистить все кнопки
  clear() {
    this.buttons = [];
    this.nextButtonNumber = 1;
    this.expectedButtonNumber = 1;
  }

  // Обновление
  update(currentTime, deltaTime) {
    if (!this.gameStarted) return;

    // Генерация новой кнопки
    if (
      this.buttons.length === 0 ||
      currentTime - this.lastSpawnTime >= this.currentSpawnInterval
    ) {
      this.spawnButton();
      this.lastSpawnTime = currentTime;

      // Уменьшаем интервал для следующей кнопки
      this.currentSpawnInterval = Math.max(
        this.minSpawnInterval,
        this.currentSpawnInterval - this.spawnIntervalDecrease
      );
    }

    // Обновление существующих кнопок
    this.buttons = this.buttons.filter((button) => {
      const expired = button.update(deltaTime);
      return !expired && !button.isClicked;
    });

    // Проверка: если на экране больше 3 кнопок - проигрыш
    const activeButtons = this.buttons.filter(
      (b) => !b.isClicked && !b.isExpired
    );
    if (activeButtons.length > 3) {
      return true; // Сигнал о проигрыше
    }

    return false;
  }

  // Создание новой кнопки
  spawnButton() {
    const radius = 40;
    const margin = radius + 10; // Отступ от краев

    // Случайная позиция
    const x = margin + Math.random() * (this.canvas.width - margin * 2);
    const y = margin + Math.random() * (this.canvas.height - margin * 2);

    const button = new NumberButton(
      this.canvas,
      this.nextButtonNumber,
      x,
      y,
      radius
    );

    this.buttons.push(button);
    this.nextButtonNumber++;
  }

  // Отрисовка всех кнопок
  draw() {
    this.buttons.forEach((button) => button.draw());
  }

  // Проверка клика по кнопкам
  // Возвращает: true - правильный клик, false - неправильный клик (не в последовательности), null - не попали в кнопку
  handleClick(x, y) {
    // Находим все кнопки, в которые попали
    const clickedButtons = [];
    for (const button of this.buttons) {
      if (
        button.isPointInside(x, y) &&
        !button.isClicked &&
        !button.isExpired
      ) {
        clickedButtons.push(button);
      }
    }

    if (clickedButtons.length === 0) {
      return null; // Не попали ни в одну кнопку
    }

    // Сортируем по номеру, чтобы проверить первую в последовательности
    clickedButtons.sort((a, b) => a.number - b.number);
    const clickedButton = clickedButtons[0];

    // Проверяем, что нажали на правильную кнопку (ожидаемую по порядку)
    if (clickedButton.number === this.expectedButtonNumber) {
      // Правильный клик - нажимаем на ожидаемую кнопку
      const wasClicked = clickedButton.click();
      if (wasClicked) {
        // Удаляем нажатую кнопку
        this.buttons = this.buttons.filter((b) => b !== clickedButton);
        // Увеличиваем ожидаемый номер следующей кнопки
        this.expectedButtonNumber++;
        return true;
      }
    } else {
      // Неправильный клик - нажали не в последовательности
      return false;
    }

    return null;
  }

  // Получить количество активных кнопок
  getActiveButtonsCount() {
    return this.buttons.filter((b) => !b.isClicked && !b.isExpired).length;
  }

  // Проверка, есть ли больше 3 активных кнопок (проигрыш)
  hasTooManyButtons() {
    return this.getActiveButtonsCount() > 3;
  }

  // Проверка, есть ли не нажатые кнопки (проигрыш)
  hasExpiredButtons() {
    return this.buttons.some((b) => b.isExpired);
  }
}

function Game() {
  const canvasRef = useRef(null);
  const buttonManagerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isGameStartedRef = useRef(false);
  const isGameOverRef = useRef(false);
  const [score, setScore] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Синхронизируем refs с состояниями
  useEffect(() => {
    isGameStartedRef.current = isGameStarted;
  }, [isGameStarted]);

  useEffect(() => {
    isGameOverRef.current = isGameOver;
  }, [isGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Фиксированное внутреннее разрешение игры
    const GAME_WIDTH = 375;
    const GAME_HEIGHT = 667;

    // Установка размеров canvas
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const scaleX = containerWidth / GAME_WIDTH;
      const scaleY = containerHeight / GAME_HEIGHT;
      const scale = Math.min(scaleX, scaleY);

      canvas.width = GAME_WIDTH;
      canvas.height = GAME_HEIGHT;

      const scaledWidth = GAME_WIDTH * scale;
      const scaledHeight = GAME_HEIGHT * scale;
      canvas.style.width = `${scaledWidth}px`;
      canvas.style.height = `${scaledHeight}px`;
      canvas.style.imageRendering = "pixelated";
    };

    resizeCanvas();

    // Инициализируем менеджер кнопок
    if (!buttonManagerRef.current) {
      buttonManagerRef.current = new ButtonManager(canvas);
    }

    // Обработка изменения размера окна
    window.addEventListener("resize", resizeCanvas);

    // Для расчета deltaTime
    let lastFrameTime = performance.now();

    // Оптимизация canvas
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Функция отрисовки
    const render = () => {
      const currentTime = performance.now();

      // Вычисляем deltaTime
      let deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Ограничиваем deltaTime
      if (deltaTime > 100) {
        deltaTime = 100;
      }
      if (deltaTime < 1) {
        deltaTime = 1;
      }

      // Очистка canvas
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Обновление и отрисовка кнопок (только если игра запущена)
      if (
        buttonManagerRef.current &&
        isGameStartedRef.current &&
        !isGameOverRef.current
      ) {
        // Обновление возвращает true, если на экране больше 3 кнопок
        const tooManyButtons = buttonManagerRef.current.update(
          currentTime,
          deltaTime
        );
        buttonManagerRef.current.draw();

        // Проверка проигрыша
        // 1. Если на экране больше 3 кнопок одновременно
        // 2. Если кнопка истекла (не успели нажать)
        if (
          tooManyButtons ||
          buttonManagerRef.current.hasExpiredButtons() ||
          buttonManagerRef.current.hasTooManyButtons()
        ) {
          setIsGameOver(true);
          setIsGameStarted(false);
          buttonManagerRef.current.stop();
        }
      }

      // Продолжаем анимацию
      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Запуск анимации
    render();

    // Очистка при размонтировании
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Обработчик кликов на canvas
  const handleCanvasClick = useCallback(
    (e) => {
      if (!isGameStarted || isGameOver || !buttonManagerRef.current) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      // Получаем координаты относительно canvas
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      // Проверяем клик по кнопкам
      const clicked = buttonManagerRef.current.handleClick(x, y);
      if (clicked === true) {
        // Правильный клик - увеличиваем счет
        setScore((prev) => prev + 1);
      } else if (clicked === false) {
        // Неправильный клик - проигрыш
        setIsGameOver(true);
        setIsGameStarted(false);
        if (buttonManagerRef.current) {
          buttonManagerRef.current.stop();
        }
      }
    },
    [isGameStarted, isGameOver]
  );

  // Обработчик touch событий
  const handleTouchStart = useCallback(
    (e) => {
      if (
        e.target.closest(".game-menu") ||
        e.target.closest(".game-menu-button")
      ) {
        return;
      }

      if (!isGameStarted || isGameOver || !buttonManagerRef.current) {
        return;
      }

      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      // Обрабатываем каждое касание
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        const clicked = buttonManagerRef.current.handleClick(x, y);
        if (clicked === true) {
          // Правильный клик - увеличиваем счет
          setScore((prev) => prev + 1);
        } else if (clicked === false) {
          // Неправильный клик - проигрыш
          setIsGameOver(true);
          setIsGameStarted(false);
          if (buttonManagerRef.current) {
            buttonManagerRef.current.stop();
          }
        }
      }
    },
    [isGameStarted, isGameOver]
  );

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (
      e.target.closest(".game-menu") ||
      e.target.closest(".game-menu-button")
    ) {
      return;
    }
    e.preventDefault();
  }, []);

  // Запуск игры
  const handleStart = () => {
    if (buttonManagerRef.current) {
      buttonManagerRef.current.start();
    }
    setIsGameOver(false);
    setIsGameStarted(true);
    setScore(0);
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title-section">
          <h2 className="game-title">LennyLine</h2>
          <span className="game-version">v{APP_VERSION}</span>
        </div>
        <div className="game-stats">
          <div className="score">Счет: {score}</div>
        </div>
      </div>

      <div
        className="game-area"
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="game-canvas" />
        {(!isGameStarted || isGameOver) && <GameMenu onStart={handleStart} />}
      </div>
    </div>
  );
}

export default Game;
