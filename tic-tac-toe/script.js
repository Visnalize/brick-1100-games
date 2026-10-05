var ui = window.bridge.ui;
var lcd = window.bridge.lcd;

var WIDTH = 96;
var HEIGHT = 65;
var GRID_SIZE = 3;
var CELL = 19;
var BLINK_MS = 450;
var WIN_SHOW_MS = 1200;

// The board is a "#" of 1-pixel lines, with no outer frame, as tic-tac-toe is drawn on paper
var BOARD = GRID_SIZE * CELL + GRID_SIZE - 1;
var TOP = Math.floor((HEIGHT - BOARD) / 2);
var LEFT = TOP;

var MARKS = {
  X: [
    "##.........##",
    "###.......###",
    ".###.....###.",
    "..###...###..",
    "...###.###...",
    "....#####....",
    ".....###.....",
    "....#####....",
    "...###.###...",
    "..###...###..",
    ".###.....###.",
    "###.......###",
    "##.........##",
  ],
  O: [
    "....#####....",
    "..#########..",
    ".####...####.",
    ".###.....###.",
    "###.......###",
    "##.........##",
    "##.........##",
    "##.........##",
    "###.......###",
    ".###.....###.",
    ".####...####.",
    "..#########..",
    "....#####....",
  ],
};
// The same marks, smaller, for whose turn it is
var SMALL_MARKS = {
  X: [
    "##.....##",
    "###...###",
    ".###.###.",
    "..#####..",
    "...###...",
    "..#####..",
    ".###.###.",
    "###...###",
    "##.....##",
  ],
  O: [
    "..#####..",
    ".#######.",
    "###...###",
    "##.....##",
    "##.....##",
    "##.....##",
    "###...###",
    ".#######.",
    "..#####..",
  ],
};

var WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
canvas.width = WIDTH;
canvas.height = HEIGHT;
lcd.fit(canvas, WIDTH, HEIGHT);

var currentPlayer = "X";
var gameState = [];
var cursor = 0;
/** The three cells of the winning line, shown dark until the result opens */
var winningLine = null;
var isOver = false;
var blinkStart = Date.now();

function init() {
  currentPlayer = "X";
  gameState = [];
  for (var i = 0; i < GRID_SIZE * GRID_SIZE; i++) gameState.push(null);
  cursor = 0;
  winningLine = null;
  isOver = false;
}

function stop() {
  window.bridge.send(window.parent, { event: "stop" });
}

function playAudio(audioId) {
  window.bridge.send(window.parent, { event: "playAudio", data: audioId });
}

function hasMarks() {
  return gameState.some(function (cell) {
    return cell !== null;
  });
}

function moveCursor(direction) {
  var row = Math.floor(cursor / GRID_SIZE);
  var col = cursor % GRID_SIZE;
  var count = GRID_SIZE * GRID_SIZE;

  if (direction === "up") row = (row - 1 + GRID_SIZE) % GRID_SIZE;
  if (direction === "down") row = (row + 1) % GRID_SIZE;
  if (direction === "left") col = (col - 1 + GRID_SIZE) % GRID_SIZE;
  if (direction === "right") col = (col + 1) % GRID_SIZE;
  cursor = row * GRID_SIZE + col;

  if (direction === "prev") cursor = (cursor - 1 + count) % count;
  if (direction === "next") cursor = (cursor + 1) % count;
}

function findWinningLine() {
  for (var i = 0; i < WINNING_LINES.length; i++) {
    var line = WINNING_LINES[i];
    var isWin = line.every(function (index) {
      return gameState[index] === currentPlayer;
    });
    if (isWin) return line;
  }
  return null;
}

function showResult(message) {
  ui.confirm({
    text: message,
    action: "Again",
    onDone: function (screen) {
      screen.close();
      init();
    },
    onBack: stop,
  });
}

function markCell() {
  if (gameState[cursor]) return;

  gameState[cursor] = currentPlayer;
  winningLine = findWinningLine();
  var isFull = gameState.every(function (cell) {
    return cell !== null;
  });

  if (winningLine || isFull) {
    isOver = true;
    playAudio("over");
    var message = winningLine ? currentPlayer + " wins!" : "It's a draw!";
    // The board stays on screen for a moment, with the winning line shown, before the result
    setTimeout(function () {
      showResult(message);
    }, WIN_SHOW_MS);
  } else {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    playAudio("pop");
  }
}

/** Asks before a key would throw away a game in progress. */
function confirmIfPlaying(text, onDone) {
  if (!hasMarks()) return onDone();
  ui.confirm({
    text: text,
    onDone: function (screen) {
      screen.close();
      onDone();
    },
  });
}

function handleKeyPress(key) {
  blinkStart = Date.now();
  if (isOver) return;
  if (key === 0) confirmIfPlaying("Start over?", init);
  if (key === 5 || key === "ok") markCell();
  if (key === 2) moveCursor("up");
  if (key === 4) moveCursor("left");
  if (key === 6) moveCursor("right");
  if (key === 8) moveCursor("down");
  if (key === "up") moveCursor("prev");
  if (key === "down") moveCursor("next");
  if (key === "clear") confirmIfPlaying("Quit the game?", stop);
}

function cellX(index) {
  return LEFT + (index % GRID_SIZE) * (CELL + 1);
}

function cellY(index) {
  return TOP + Math.floor(index / GRID_SIZE) * (CELL + 1);
}

/** Draws a picture dark, or cuts it out of a dark area when `cut` is set. */
function drawPicture(picture, x, y, cut) {
  ctx.globalCompositeOperation = cut ? "destination-out" : "source-over";
  lcd.drawPixels(ctx, picture, x, y);
  ctx.globalCompositeOperation = "source-over";
}

function drawBoard(blinkOn) {
  for (var line = 1; line < GRID_SIZE; line++) {
    var offset = line * (CELL + 1) - 1;
    ctx.fillRect(LEFT + offset, TOP, 1, BOARD);
    ctx.fillRect(LEFT, TOP + offset, BOARD, 1);
  }

  var markOffset = Math.floor((CELL - MARKS.X.length) / 2);
  for (var i = 0; i < gameState.length; i++) {
    var dark = winningLine ? winningLine.indexOf(i) !== -1 : i === cursor && blinkOn && !isOver;
    if (dark) ctx.fillRect(cellX(i), cellY(i), CELL, CELL);
    if (gameState[i]) {
      drawPicture(MARKS[gameState[i]], cellX(i) + markOffset, cellY(i) + markOffset, dark);
    }
  }
}

/** Both marks down the right side, the one whose turn it is in a dark box. */
function drawTurn() {
  var box = SMALL_MARKS.X.length + 4;
  var gap = 4;
  var x = LEFT + BOARD + Math.floor((WIDTH - LEFT - BOARD - box) / 2);
  var y = Math.floor((HEIGHT - box * 2 - gap) / 2);

  ["X", "O"].forEach(function (player, i) {
    var boxY = y + i * (box + gap);
    var isTurn = player === currentPlayer && !isOver;
    if (isTurn) {
      ctx.fillRect(x, boxY, box, box);
    } else {
      ctx.fillRect(x, boxY, box, 1);
      ctx.fillRect(x, boxY + box - 1, box, 1);
      ctx.fillRect(x, boxY + 1, 1, box - 2);
      ctx.fillRect(x + box - 1, boxY + 1, 1, box - 2);
    }
    drawPicture(SMALL_MARKS[player], x + 2, boxY + 2, isTurn);
  });
}

// One loop draws the cursor's blink. A key press restarts it dark, so the cursor shows as it moves.
setInterval(function () {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBoard(Math.floor((Date.now() - blinkStart) / BLINK_MS) % 2 === 0);
  drawTurn();
  lcd.inkCanvas(ctx);
}, 50);

init();

window.bridge.on("keypress", handleKeyPress);
window.bridge.on("numpress", handleKeyPress);
window.bridge.send(window.parent, {
  event: "loadAudio",
  data: ["pop.mp3", "over.mp3"].map(function (src) {
    return location.origin + "/tic-tac-toe/audio/" + src;
  }),
});
