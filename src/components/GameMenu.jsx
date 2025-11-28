import './GameMenu.css'

function GameMenu({ onStart, onModeSelect }) {
  const handleModeClick = (mode) => (e) => {
    // Останавливаем всплытие события, чтобы оно не дошло до game-area
    e.stopPropagation();
    if (onModeSelect) {
      onModeSelect(mode);
    }
    if (onStart) {
      onStart();
    }
  };

  const handleTouchStart = (e) => {
    // Останавливаем всплытие для touch событий
    e.stopPropagation();
  };

  return (
    <div className="game-menu" onTouchStart={handleTouchStart}>
      <div className="game-menu-content">
        <h2 className="game-menu-title">Выберите режим игры</h2>
        <div className="game-menu-buttons">
          <button 
            className="game-menu-button" 
            onClick={handleModeClick('viewer')} 
            onTouchStart={handleTouchStart}
          >
            3D Model Viewer
          </button>
          <button 
            className="game-menu-button" 
            onClick={handleModeClick('destruction')} 
            onTouchStart={handleTouchStart}
          >
            Разрушение куба
          </button>
          <button 
            className="game-menu-button" 
            onClick={handleModeClick('runner')} 
            onTouchStart={handleTouchStart}
          >
            Бегун
          </button>
        </div>
      </div>
    </div>
  )
}

export default GameMenu

