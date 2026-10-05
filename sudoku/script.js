var ui = window.bridge.ui;
var lcd = window.bridge.lcd;

// Each level's grid fits the 65-pixel height: `cell` is the space inside a cell, in LCD pixels, and
// `scale` the size of its digits (1 is the 3 x 5 font). A 9 x 9 cell is too small for lines between
// cells, which would sit a pixel from its digits and read as colons, so it has only box edges and
// a dot in each empty cell.
var LEVELS = [
  { name: "Easy", size: 4, boxWidth: 2, boxHeight: 2, holes: 0.55, cell: 14, scale: 2 },
  { name: "Medium", size: 6, boxWidth: 3, boxHeight: 2, holes: 0.55, cell: 9, scale: 1 },
  { name: "Hard", size: 9, boxWidth: 3, boxHeight: 3, holes: 0.65, cell: 6, scale: 1, dots: true },
];
var INSTRUCTIONS =
  "Fill the grid so that every row, column and box has each digit once. " +
  "Up and down move between the cells you can fill. Number keys fill a cell, 0 empties it " +
  "and # empties the whole grid. C opens the menu, where you can continue.";
var MENU = { CONTINUE: "Continue", GAME: "New game", LEVEL: "Level", INSTRUCTIONS: "Instructions" };
var WIDTH = 96;
var HEIGHT = 65;
var BLINK_MS = 450;

// Pictures for drawPixels, beside the digits of lcd.drawText
var HASH = [".#.#.", "#####", ".#.#.", "#####", ".#.#."];
var COLON = ["#", "."];

var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
canvas.width = WIDTH;
canvas.height = HEIGHT;
lcd.fit(canvas, WIDTH, HEIGHT);

/** @type {Sudoku} */
var currentGame = null;
var selectedLevel = 0;

function stop() {
  window.bridge.send(window.parent, { event: "stop" });
}

function playAudio(audioId) {
  window.bridge.send(window.parent, { event: "playAudio", data: audioId });
}

function openMenu() {
  var items = [MENU.GAME, MENU.LEVEL, MENU.INSTRUCTIONS];
  if (currentGame && !currentGame.solved) items.unshift(MENU.CONTINUE);

  ui.list({
    title: "Sudoku",
    items: items,
    onSelect: function (index, screen) {
      var item = items[index];
      if (item === MENU.CONTINUE) screen.close();
      if (item === MENU.GAME) {
        screen.close();
        currentGame = new Sudoku(LEVELS[selectedLevel], 1);
      }
      if (item === MENU.LEVEL) openLevels();
      if (item === MENU.INSTRUCTIONS) ui.text({ title: "Instructions", text: INSTRUCTIONS });
    },
    onBack: stop,
  });
}

function openLevels() {
  ui.list({
    title: "Level",
    items: LEVELS.map(function (level) {
      return level.name;
    }),
    index: selectedLevel,
    onSelect: function (index, screen) {
      selectedLevel = index;
      screen.close();
    },
  });
}

function shuffle(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function range(from, to) {
  var values = [];
  for (var i = from; i <= to; i++) values.push(i);
  return values;
}

/**
 * @param {object} level One of LEVELS
 * @param {number} number The puzzle's number in this run, shown beside the grid
 */
var Sudoku = function (level, number) {
  this.level = level;
  this.size = level.size;
  this.number = number;
  this.board = [];
  this.fixed = [];
  this.cursor = 0;
  this.moves = 0;
  this.elapsed = 0;
  this.solved = false;

  var gridSize = this.size * (level.cell + 1) + 1;
  this.top = Math.floor((HEIGHT - gridSize) / 2);
  this.left = this.top;
  this.hudLeft = this.left + gridSize + 3;

  this.generate();
  this.cursor = this.fixed.indexOf(false);
};

/** Whether `num` can go at `index` without repeating in its row, column or box. */
Sudoku.prototype.canPlace = function (board, index, num) {
  var size = this.size;
  var row = Math.floor(index / size);
  var col = index % size;
  var boxRow = row - (row % this.level.boxHeight);
  var boxCol = col - (col % this.level.boxWidth);

  for (var i = 0; i < size; i++) {
    if (i !== col && board[row * size + i] === num) return false;
    if (i !== row && board[i * size + col] === num) return false;
  }
  for (var r = boxRow; r < boxRow + this.level.boxHeight; r++) {
    for (var c = boxCol; c < boxCol + this.level.boxWidth; c++) {
      if ((r !== row || c !== col) && board[r * size + c] === num) return false;
    }
  }
  return true;
};

/** Fills the empty cells of `board` with a random solution, in place. */
Sudoku.prototype.fill = function (board) {
  var index = board.indexOf(0);
  if (index === -1) return true;

  var nums = shuffle(range(1, this.size));
  for (var i = 0; i < nums.length; i++) {
    if (this.canPlace(board, index, nums[i])) {
      board[index] = nums[i];
      if (this.fill(board)) return true;
    }
  }
  board[index] = 0;
  return false;
};

/**
 * Counts the solutions of `board`, stopping at `limit`. It always fills the empty cell with the
 * fewest candidates first, which keeps a 9 x 9 count fast.
 */
Sudoku.prototype.countSolutions = function (board, limit) {
  var best = -1;
  var bestNums = null;
  for (var index = 0; index < board.length; index++) {
    if (board[index]) continue;
    var nums = [];
    for (var num = 1; num <= this.size; num++) {
      if (this.canPlace(board, index, num)) nums.push(num);
    }
    if (!nums.length) return 0;
    if (!bestNums || nums.length < bestNums.length) {
      best = index;
      bestNums = nums;
    }
  }
  if (best === -1) return 1;

  var count = 0;
  for (var i = 0; i < bestNums.length && count < limit; i++) {
    board[best] = bestNums[i];
    count += this.countSolutions(board, limit - count);
  }
  board[best] = 0;
  return count;
};

/** Makes a puzzle with one solution, so it never needs a guess. */
Sudoku.prototype.generate = function () {
  var cells = this.size * this.size;
  var board = range(1, cells).map(function () {
    return 0;
  });
  this.fill(board);

  var holes = Math.floor(cells * this.level.holes);
  var positions = shuffle(range(0, cells - 1));
  for (var i = 0; i < positions.length && holes > 0; i++) {
    var value = board[positions[i]];
    board[positions[i]] = 0;
    if (this.countSolutions(board, 2) === 1) holes--;
    else board[positions[i]] = value;
  }

  this.board = board;
  this.fixed = board.map(function (value) {
    return value !== 0;
  });
};

/** The grid follows the rules when it is full and no digit repeats. */
Sudoku.prototype.isSolved = function () {
  for (var i = 0; i < this.board.length; i++) {
    if (!this.board[i] || !this.canPlace(this.board, i, this.board[i])) return false;
  }
  return true;
};

Sudoku.prototype.hasInput = function () {
  var self = this;
  return this.board.some(function (value, i) {
    return value && !self.fixed[i];
  });
};

/** Moves the cursor to the previous or next cell that can be filled. */
Sudoku.prototype.moveCursor = function (step) {
  var count = this.board.length;
  var index = this.cursor;
  do {
    index = (index + step + count) % count;
  } while (this.fixed[index] && index !== this.cursor);
  this.cursor = index;
};

Sudoku.prototype.clearInput = function () {
  for (var i = 0; i < this.board.length; i++) {
    if (!this.fixed[i]) this.board[i] = 0;
  }
};

Sudoku.prototype.handleKey = function (key) {
  if (key === "up") this.moveCursor(-1);
  if (key === "down") this.moveCursor(1);
  if (key === "clear") openMenu();
};

Sudoku.prototype.handleNum = function (key) {
  var self = this;
  if (key === "#") {
    if (!this.hasInput()) return;
    ui.confirm({
      text: "Empty the grid?",
      onDone: function (screen) {
        screen.close();
        self.clearInput();
      },
    });
    return;
  }
  if (typeof key !== "number" || key > this.size || this.board[this.cursor] === key) return;

  if (key !== 0) this.moves++;
  this.board[this.cursor] = key;
  if (this.isSolved()) this.finish();
};

Sudoku.prototype.finish = function () {
  var self = this;
  this.solved = true;
  playAudio("solved");

  // The solved grid stays on screen for a moment before the result covers it
  setTimeout(function () {
    ui.confirm({
      text: "Solved!",
      info: formatTime(self.elapsed) + ", " + self.moves + " moves",
      action: "Next",
      onDone: function (screen) {
        screen.close();
        currentGame = new Sudoku(self.level, self.number + 1);
      },
      onBack: function (screen) {
        screen.close();
        openMenu();
      },
    });
  }, 800);
};

/** Counts the time while the grid is on screen and the phone's screen is on. */
Sudoku.prototype.tick = function (ms) {
  if (!this.solved && !ui.isOpen() && !document.body.classList.contains("inactive")) {
    this.elapsed += ms;
  }
};

Sudoku.prototype.cellX = function (col) {
  return this.left + 1 + col * (this.level.cell + 1);
};

Sudoku.prototype.cellY = function (row) {
  return this.top + 1 + row * (this.level.cell + 1);
};

/** Box edges are solid lines and the lines between cells are dotted, unless the level has dots. */
Sudoku.prototype.drawLines = function () {
  var size = this.size;
  var gridSize = size * (this.level.cell + 1) + 1;

  for (var i = 0; i <= size; i++) {
    var offset = i * (this.level.cell + 1);
    var solidRow = i % this.level.boxHeight === 0;
    var solidCol = i % this.level.boxWidth === 0;
    var dotted = !this.level.dots;
    for (var p = 0; p < gridSize; p++) {
      var dot = dotted && p % 2 === 0;
      if (solidRow || dot) ctx.fillRect(this.left + p, this.top + offset, 1, 1);
      if (solidCol || dot) ctx.fillRect(this.left + offset, this.top + p, 1, 1);
    }
  }
};

/** Draws `text` in the digit font, `scale` times its size. */
function drawDigits(text, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  lcd.drawText(ctx, text, 0, 0);
  ctx.restore();
}

/**
 * Givens are dark with a clear digit, as is the cursor's cell on every other blink. A dark cell
 * covers the lines around it too, so dark cells side by side join into one dark area, as a selected
 * row does on the phone, rather than showing a row of dots between them.
 */
Sudoku.prototype.drawCells = function (blinkOn) {
  var cell = this.level.cell;
  var scale = this.level.scale;
  var digitX = Math.floor((cell - 3 * scale) / 2);
  var digitY = Math.floor((cell - 5 * scale) / 2);

  for (var i = 0; i < this.board.length; i++) {
    var x = this.cellX(i % this.size);
    var y = this.cellY(Math.floor(i / this.size));
    var dark = this.fixed[i] || (i === this.cursor && blinkOn && !this.solved);

    if (dark) ctx.fillRect(x - 1, y - 1, cell + 2, cell + 2);
    if (!this.board[i]) {
      if (this.level.dots && !dark) ctx.fillRect(x + digitX + 1, y + 2, 1, 1);
      continue;
    }
    ctx.globalCompositeOperation = dark ? "destination-out" : "source-over";
    drawDigits(this.board[i], x + digitX, y + digitY, scale);
    ctx.globalCompositeOperation = "source-over";
  }
};

function formatTime(ms) {
  var seconds = Math.floor(ms / 1000);
  var minutes = Math.min(99, Math.floor(seconds / 60));
  seconds = seconds % 60;
  return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

/** A 1-pixel frame around a `width` x 9 box, with its top left at `x`, `y`. */
function drawFrame(x, y, width) {
  ctx.fillRect(x, y, width, 1);
  ctx.fillRect(x, y + 8, width, 1);
  ctx.fillRect(x, y + 1, 1, 7);
  ctx.fillRect(x + width - 1, y + 1, 1, 7);
}

/** The puzzle's number, the time in a frame and the moves in a frame, down the right side. */
Sudoku.prototype.drawHud = function () {
  var width = WIDTH - this.hudLeft;
  var frameWidth = 21;
  var frameX = this.hudLeft + Math.floor((width - frameWidth) / 2);
  var number = String(this.number);
  var numberWidth = 5 + 2 + lcd.textWidth(number);
  var y = Math.floor((HEIGHT - 30) / 2);

  var numberX = this.hudLeft + Math.floor((width - numberWidth) / 2);
  lcd.drawPixels(ctx, HASH, numberX, y);
  lcd.drawText(ctx, number, numberX + 7, y);

  var time = formatTime(this.elapsed).split(":");
  drawFrame(frameX, y + 9, frameWidth);
  lcd.drawText(ctx, time[0], frameX + 2, y + 11);
  lcd.drawPixels(ctx, COLON, frameX + 10, y + 12);
  lcd.drawPixels(ctx, COLON, frameX + 10, y + 14);
  lcd.drawText(ctx, time[1], frameX + 12, y + 11);

  var moves = ("000" + Math.min(999, this.moves)).slice(-3);
  drawFrame(frameX, y + 21, frameWidth);
  lcd.drawText(ctx, moves, frameX + 5, y + 23);
};

Sudoku.prototype.draw = function (blinkOn) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  this.drawLines();
  this.drawCells(blinkOn);
  this.drawHud();
  lcd.inkCanvas(ctx);
};

// The menu screens take the keys while they are open, so these only run during a game.
function handleKeypress(key) {
  if (currentGame && !currentGame.solved) currentGame.handleKey(key);
}

function handleNumpress(key) {
  if (currentGame && !currentGame.solved) currentGame.handleNum(key);
}

// One loop draws the blink and the time. Drawing the cursor dark at once after a key press keeps it
// visible while it moves.
var lastTick = Date.now();
var blinkStart = lastTick;
setInterval(function () {
  var now = Date.now();
  if (currentGame) {
    currentGame.tick(now - lastTick);
    currentGame.draw(Math.floor((now - blinkStart) / BLINK_MS) % 2 === 0);
  }
  lastTick = now;
}, 50);

function restartBlink() {
  blinkStart = Date.now();
}

openMenu();
window.bridge.on("keypress", function (key) {
  restartBlink();
  handleKeypress(key);
});
window.bridge.on("numpress", function (key) {
  restartBlink();
  handleNumpress(key);
});
window.bridge.send(window.parent, {
  event: "loadAudio",
  data: [location.origin + "/sudoku/audio/solved.mp3"],
});
