var board = document.getElementById("board");
var result = document.getElementById("result");

var currentPlayer = "X";
var gridSize = 3;
var gameState = Array(gridSize * 3).fill(null);
var cursor = [0, 0];

var winningConditions = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function init() {
  board.innerHTML = "";
  board.hidden = false;
  result.hidden = true;
  currentPlayer = "X";
  gameState.fill(null);
  cursor = [0, 0];

  // populate board
  for (var i = 0; i < gameState.length; i++) {
    var cell = document.createElement("div");
    if (i === 0) cell.classList.add("active");
    cell.classList.add("cell");
    cell.dataset.index = i;
    board.appendChild(cell);
  }
}

function moveCursor(direction) {
  var cells = document.querySelectorAll(".cell");
  var row = cursor[0];
  var col = cursor[1];
  var cell = cells[row * gridSize + col];
  cell.classList.remove("active");

  if (direction === "up") row = (row - 1 + gridSize) % gridSize;
  if (direction === "down") row = (row + 1) % gridSize;
  if (direction === "left") col = (col - 1 + gridSize) % gridSize;
  if (direction === "right") col = (col + 1) % gridSize;
  if (direction === "prev") {
    row = col === 0 ? (row - 1 + gridSize) % gridSize : row;
    col = (col - 1 + gridSize) % gridSize;
  }
  if (direction === "next") {
    col = (col + 1) % gridSize;
    row = col === 0 ? (row + 1) % gridSize : row;
  }

  cursor = [row, col];
  cell = cells[row * gridSize + col];
  cell.classList.add("active");
}

function hasWinner() {
  return winningConditions.some(function (combination) {
    return combination.every(function (index) {
      return gameState[index] === currentPlayer;
    });
  });
}

function showResult(message) {
  result.textContent = message + " Press 0 to restart.";
  result.hidden = false;
  board.hidden = true;
}

function playAudio(audioId) {
  window.bridge.send(window.parent, { event: "playAudio", data: audioId });
}

function markCell() {
  var cells = document.querySelectorAll(".cell");
  var index = cursor[0] * gridSize + cursor[1];

  if (gameState[index]) return;

  gameState[index] = currentPlayer;
  cells[index].textContent = currentPlayer;

  var allCellsFilled = gameState.every(function (cell) {
    return cell !== null;
  });

  if (hasWinner()) {
    showResult(currentPlayer + " wins!");
    playAudio("over");
  } else if (allCellsFilled) {
    showResult("It's a draw!");
  } else {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    playAudio("pop");
  }
}

function handleKeyPress(key) {
  if (key === 0) init();
  if (key === 5 || key === "ok") markCell();
  if (key === 2) moveCursor("up");
  if (key === 4) moveCursor("left");
  if (key === 6) moveCursor("right");
  if (key === 8) moveCursor("down");
  if (key === "up") moveCursor("prev");
  if (key === "down") moveCursor("next");
  if (key === "clear") window.bridge.send(window.parent, { event: "stop" });
}

init();

window.bridge.on("keypress", handleKeyPress);
window.bridge.on("numpress", handleKeyPress);
window.bridge.send(window.parent, {
  event: "loadAudio",
  data: ["pop.mp3", "over.mp3"].map(function (src) {
    return location.origin + "/audio/" + src;
  }),
});
