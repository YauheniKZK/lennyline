import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import "./Game.css";
import packageJson from "../../package.json";

// Версия приложения
const APP_VERSION = packageJson.version;

// Константы игры
const GRAVITY = 600;
const JUMP_STRENGTH = -400;
const OBSTACLE_SPEED = 200;
const OBSTACLE_SPAWN_INTERVAL = 2000;
const PLATFORM_SPAWN_INTERVAL = 3000;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const OBSTACLE_WIDTH = 30;
const OBSTACLE_HEIGHT = 50;
const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 15;

// Класс игровой сцены Phaser
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.player = null;
    this.obstacles = null;
    this.platforms = null;
    this.ground = null;
    this.scoreText = null;
    this.scoreValue = 0;
    this.obstacleSpawnTimer = 0;
    this.platformSpawnTimer = 0;
    this.isGameActive = true;
    this.onScoreUpdate = null;
    this.onGameOver = null;
    this.jumpCount = 0; // Счетчик прыжков для двойного прыжка
    this.maxJumps = 2; // Максимальное количество прыжков
  }

  init(data) {
    // Получаем колбэки из data
    if (data) {
      this.onScoreUpdate = data.onScoreUpdate;
      this.onGameOver = data.onGameOver;
    }
  }

  preload() {
    // Создаем простые цветные прямоугольники для объектов
    this.add
      .graphics()
      .fillStyle(0x3390ec)
      .fillRect(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT)
      .generateTexture("player", PLAYER_WIDTH, PLAYER_HEIGHT);

    this.add
      .graphics()
      .fillStyle(0xe74c3c)
      .fillRect(0, 0, OBSTACLE_WIDTH, OBSTACLE_HEIGHT)
      .generateTexture("obstacle", OBSTACLE_WIDTH, OBSTACLE_HEIGHT);

    this.add
      .graphics()
      .fillStyle(0x4a4a4a)
      .fillRect(0, 0, PLATFORM_WIDTH, PLATFORM_HEIGHT)
      .generateTexture("platform", PLATFORM_WIDTH, PLATFORM_HEIGHT);
  }

  create() {
    const { width, height } = this.scale;
    const groundY = height * 0.6;

    // Создаем землю
    this.ground = this.add.rectangle(
      0,
      groundY,
      width * 2,
      height - groundY,
      0x4a4a4a
    );
    this.ground.setOrigin(0, 0);
    this.physics.add.existing(this.ground, true);

    // Создаем персонажа
    this.player = this.physics.add.sprite(
      width * 0.2,
      groundY - PLAYER_HEIGHT / 2,
      "player"
    );
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);

    // Группы для препятствий и платформ
    this.obstacles = this.physics.add.group();
    this.platforms = this.physics.add.group();

    // Физика столкновений
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(
      this.player,
      this.obstacles,
      this.hitObstacle,
      null,
      this
    );

    // Текст счета
    this.scoreText = this.add.text(20, 20, "Счет: 0", {
      fontSize: "24px",
      fill: "#000",
      fontFamily: "Arial",
    });

    // Управление
    this.input.keyboard.on("keydown-SPACE", this.jump, this);
    this.input.on("pointerdown", this.jump, this);

    // Убеждаемся, что физика активна (на случай перезапуска)
    this.physics.resume();
  }

  jump() {
    if (!this.isGameActive) return;

    // Проверяем, стоит ли персонаж на земле или платформе
    const isOnGround =
      this.player.body.touching.down || this.player.body.onFloor();

    // Если на земле, сбрасываем счетчик прыжков
    if (isOnGround) {
      this.jumpCount = 0;
    }

    // Разрешаем прыжок, если еще не использовали все доступные прыжки
    if (this.jumpCount < this.maxJumps) {
      this.player.setVelocityY(JUMP_STRENGTH);
      this.jumpCount++;
    }
  }

  hitObstacle() {
    if (!this.isGameActive) return;
    console.log("Hit obstacle! Game over!");
    this.isGameActive = false;
    if (this.onGameOver) {
      console.log("Calling onGameOver callback");
      this.onGameOver();
    } else {
      console.warn("onGameOver callback is not set!");
    }
    this.physics.pause();
  }

  // Метод для сброса состояния перед перезапуском
  resetState() {
    this.scoreValue = 0;
    this.obstacleSpawnTimer = 0;
    this.platformSpawnTimer = 0;
    this.isGameActive = true;
    this.jumpCount = 0; // Сбрасываем счетчик прыжков
  }

  update(time, delta) {
    if (!this.isGameActive) return;

    // Сбрасываем счетчик прыжков при приземлении
    if (
      this.player &&
      (this.player.body.touching.down || this.player.body.onFloor())
    ) {
      this.jumpCount = 0;
    }

    const { width, height } = this.scale;
    const groundY = height * 0.6;

    // Создание препятствий
    this.obstacleSpawnTimer += delta;
    if (this.obstacleSpawnTimer >= OBSTACLE_SPAWN_INTERVAL) {
      const obstacle = this.obstacles.create(
        width,
        groundY - OBSTACLE_HEIGHT / 2,
        "obstacle"
      );
      obstacle.setVelocityX(-OBSTACLE_SPEED);
      obstacle.body.setSize(OBSTACLE_WIDTH, OBSTACLE_HEIGHT);
      obstacle.body.setGravityY(0); // Отключаем гравитацию
      obstacle.body.setAllowGravity(false); // Запрещаем гравитацию
      obstacle.body.setImmovable(true); // Делаем неподвижным
      obstacle.setCollideWorldBounds(false); // Не сталкиваемся с границами мира
      this.obstacleSpawnTimer = 0;
    }

    // Создание платформ
    this.platformSpawnTimer += delta;
    if (this.platformSpawnTimer >= PLATFORM_SPAWN_INTERVAL) {
      const minHeight = height * 0.1;
      const maxHeight = height * 0.3;
      const platformHeight =
        minHeight + Math.random() * (maxHeight - minHeight);

      const platform = this.platforms.create(
        width,
        groundY - platformHeight - PLATFORM_HEIGHT / 2,
        "platform"
      );
      platform.setVelocityX(-OBSTACLE_SPEED);
      platform.body.setSize(PLATFORM_WIDTH, PLATFORM_HEIGHT);
      platform.body.setGravityY(0); // Отключаем гравитацию
      platform.body.setAllowGravity(false); // Запрещаем гравитацию
      platform.body.setImmovable(true); // Делаем неподвижным
      platform.setCollideWorldBounds(false); // Не сталкиваемся с границами мира
      this.platformSpawnTimer = 0;
    }

    // Удаление объектов за экраном и подсчет счета
    this.obstacles.children.entries.forEach((obstacle) => {
      if (obstacle.x + OBSTACLE_WIDTH < 0) {
        // Проверяем, прошел ли препятствие мимо игрока
        if (
          obstacle.x + OBSTACLE_WIDTH < this.player.x &&
          obstacle.x + OBSTACLE_WIDTH >= this.player.x - 10
        ) {
          this.scoreValue++;
          if (this.onScoreUpdate) {
            this.onScoreUpdate(this.scoreValue);
          }
          this.scoreText.setText(`Счет: ${this.scoreValue}`);
        }
        obstacle.destroy();
      }
    });

    this.platforms.children.entries.forEach((platform) => {
      if (platform.x + PLATFORM_WIDTH < 0) {
        platform.destroy();
      }
    });
  }
}

function GameRunner() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);

  // Инициализация Phaser игры
  useEffect(() => {
    if (!isGameStarted || !gameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      width: gameRef.current.clientWidth,
      height: gameRef.current.clientHeight,
      parent: gameRef.current,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: GRAVITY },
          debug: false,
        },
      },
      scene: [GameScene],
      backgroundColor: "#f0f0f0",
    };

    phaserGameRef.current = new Phaser.Game(config);

    // Передаем колбэки в сцену после её создания
    const setupCallbacks = () => {
      const scene = phaserGameRef.current?.scene.getScene("GameScene");
      if (scene) {
        scene.onScoreUpdate = setScore;
        scene.onGameOver = () => {
          console.log("Game Over callback called, setting isGameOver to true");
          setIsGameOver(true);
        };
        console.log("Callbacks set up in scene:", scene);
      } else {
        console.warn("Scene not found when setting up callbacks");
      }
    };

    // Устанавливаем колбэки после небольшой задержки, чтобы сцена успела инициализироваться
    setTimeout(() => {
      setupCallbacks();
    }, 100);

    // Также устанавливаем колбэки после события create сцены
    const scene = phaserGameRef.current.scene.getScene("GameScene");
    if (scene) {
      scene.events.once("create", () => {
        console.log("Scene created, setting up callbacks");
        setupCallbacks();
      });
    }

    // Обработка изменения размера окна
    const handleResize = () => {
      if (phaserGameRef.current && gameRef.current) {
        phaserGameRef.current.scale.resize(
          gameRef.current.clientWidth,
          gameRef.current.clientHeight
        );
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, [isGameStarted]);

  const handleStart = () => {
    setIsGameStarted(true);
    setIsGameOver(false);
    setScore(0);
  };

  const handleRestart = () => {
    // Сбрасываем состояние React
    setIsGameOver(false);
    setScore(0);

    // Перезапускаем сцену, если игра запущена
    if (phaserGameRef.current && isGameStarted) {
      const scene = phaserGameRef.current.scene.getScene("GameScene");
      if (scene) {
        // Сбрасываем состояние сцены перед перезапуском
        scene.resetState();

        // Перезапускаем сцену (Phaser автоматически очистит все объекты и вызовет create заново)
        scene.scene.restart();

        // Устанавливаем колбэки после небольшой задержки, чтобы сцена успела перезапуститься
        setTimeout(() => {
          const newScene = phaserGameRef.current?.scene.getScene("GameScene");
          if (newScene) {
            newScene.onScoreUpdate = setScore;
            newScene.onGameOver = () => setIsGameOver(true);
            // Убеждаемся, что физика активна
            if (newScene.physics) {
              newScene.physics.resume();
            }
          }
        }, 100);
      } else {
        // Если сцена не найдена, пересоздаем игру
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
        setIsGameStarted(false);
        setTimeout(() => {
          setIsGameStarted(true);
        }, 100);
      }
    } else {
      // Если игра не запущена, запускаем заново
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
      setIsGameStarted(false);
      setTimeout(() => {
        setIsGameStarted(true);
      }, 100);
    }
  };

  const handleBack = () => {
    if (phaserGameRef.current) {
      phaserGameRef.current.destroy(true);
      phaserGameRef.current = null;
    }
    setIsGameStarted(false);
    setIsGameOver(false);
    setScore(0);
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title-section">
          <h2 className="game-title">Бегун</h2>
          <span className="game-version">v{APP_VERSION}</span>
        </div>
      </div>

      <div className="game-area">
        {!isGameStarted ? (
          <div className="game-menu">
            <div className="game-menu-content">
              <h2 className="game-menu-title">Бегун</h2>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                Перепрыгивайте препятствия! Нажмите пробел или коснитесь экрана
                для прыжка.
              </p>

              <button className="game-menu-button" onClick={handleStart}>
                Старт
              </button>
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <div
              ref={gameRef}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                position: "relative",
                zIndex: 1,
              }}
            />
            {/* Отладочная информация - можно убрать после проверки */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "rgba(0,0,0,0.7)",
                color: "white",
                padding: "5px",
                zIndex: 2000,
                fontSize: "12px",
              }}
            >
              isGameOver: {isGameOver ? "true" : "false"} | score: {score}
            </div>
            {isGameOver ? (
              <div className="game-overlay" style={{ display: "flex" }}>
                <div className="game-overlay-content">
                  <h2>Игра окончена!</h2>
                  <p>Ваш счет: {score}</p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      marginTop: "20px",
                      width: "100%",
                    }}
                  >
                    <button
                      className="game-menu-button"
                      onClick={handleRestart}
                      style={{
                        backgroundColor: "#28a745",
                        fontSize: "1.1rem",
                        padding: "0.9rem 1.5rem",
                        cursor: "pointer",
                      }}
                    >
                      Начать заново
                    </button>
                    <button
                      className="game-menu-button"
                      onClick={handleBack}
                      style={{
                        backgroundColor: "#6c757d",
                        cursor: "pointer",
                      }}
                    >
                      Меню
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameRunner;
