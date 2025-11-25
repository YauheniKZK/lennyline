import './GameMenu.css'

function GameMenu({ onStart }) {
  return (
    <div className="game-menu">
      <button className="game-menu-button" onClick={onStart}>
        Старт
      </button>
    </div>
  )
}

export default GameMenu

