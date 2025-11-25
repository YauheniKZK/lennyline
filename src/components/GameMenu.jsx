import './GameMenu.css'

function GameMenu({ onStart }) {
  const handleClick = (e) => {
    // Останавливаем всплытие события, чтобы оно не дошло до game-area
    e.stopPropagation();
    onStart();
  };

  const handleTouchStart = (e) => {
    // Останавливаем всплытие для touch событий
    e.stopPropagation();
  };

  return (
    <div className="game-menu" onTouchStart={handleTouchStart}>
      <button className="game-menu-button" onClick={handleClick} onTouchStart={handleTouchStart}>
        Старт
      </button>
    </div>
  )
}

export default GameMenu

