var ui = window.bridge.ui;
var LEVELS = [
  { size: 4, boxWidth: 2, boxHeight: 2, name: "Easy" },
  { size: 6, boxWidth: 2, boxHeight: 3, name: "Medium" },
  { size: 9, boxWidth: 3, boxHeight: 3, name: "Hard" },
];
var INSTRUCTIONS =
  "Fill the grid so that every row, column and box has each digit once. " +
  "Up and down move between empty cells. Number keys fill a cell, 0 empties it " +
  "and # empties the whole grid.";
var MENU_ITEM = {
  GAME: 0,
  LEVEL: 1,
  INSTRUCTIONS: 2,
};

/** @type {Sudoku} */
var currentGame = null;
var selectedLevel = 0;

function openMenu(selectedItem) {
  ui.list({
    title: "Sudoku",
    items: ["New game", "Level", "Instructions"],
    index: selectedItem,
    onSelect: function (index, screen) {
      if (index === MENU_ITEM.GAME) {
        screen.close();
        startGame();
      }
      if (index === MENU_ITEM.LEVEL) openLevels();
      if (index === MENU_ITEM.INSTRUCTIONS) {
        ui.text({ title: "Instructions", text: INSTRUCTIONS });
      }
    },
    onBack: function () {
      window.bridge.send(window.parent, { event: "stop" });
    },
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

function startGame() {
  if (currentGame) {
    currentGame.cleanup();
  }

  document.getElementById("screen-game").hidden = false;
  var gameLevel = LEVELS[selectedLevel];
  currentGame = new Sudoku({
    level: selectedLevel,
    size: gameLevel.size,
    boxWidth: gameLevel.boxWidth,
    boxHeight: gameLevel.boxHeight,
  });
}

var Sudoku = function (config) {
  // Game state
  this.board = [];
  this.solution = [];
  this.userInput = [];
  this.selectedCell = { row: 0, col: 0 };
  this.moves = 0;
  this.startTime = 0;
  this.gameStarted = false;
  this.puzzleNumber = 1;

  // Level configuration
  this.level = config.level;
  this.size = config.size;
  this.boxWidth = config.boxWidth;
  this.boxHeight = config.boxHeight;

  this.setup();
};

Sudoku.prototype.setup = function () {
  this.newGame();
};

Sudoku.prototype.cleanup = function () {
  this.gameStarted = false;
};

Sudoku.prototype.initializeArrays = function () {
  this.board = [];
  this.solution = [];
  this.userInput = [];
  for (var i = 0; i < this.size; i++) {
    this.board[i] = [];
    this.solution[i] = [];
    this.userInput[i] = [];
    for (var j = 0; j < this.size; j++) {
      this.board[i][j] = 0;
      this.solution[i][j] = 0;
      this.userInput[i][j] = false;
    }
  }
};

Sudoku.prototype.setupGame = function () {
  var gameBoard = document.getElementById("game");
  gameBoard.innerHTML = "";
  gameBoard.className = "level-" + LEVELS[this.level].name.toLowerCase();
  gameBoard.style.gridTemplateColumns = "repeat(" + this.size + ", 1fr)";

  for (var row = 0; row < this.size; row++) {
    for (var col = 0; col < this.size; col++) {
      var cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("data-row", row);
      cell.setAttribute("data-col", col);
      gameBoard.appendChild(cell);
    }
  }

  this.updateDisplay();
};

Sudoku.prototype.newGame = function () {
  this.initializeArrays();
  this.setupGame();
  this.generatePuzzle();
  this.startTime = Date.now();
  this.moves = 0;
  this.gameStarted = true;
  this.selectedCell = { row: 0, col: 0 };
  this.updateDisplay();
};

Sudoku.prototype.generatePuzzle = function () {
  // Generate base solution
  this.generateBaseSolution();

  // Copy solution to board and initialize userInput
  for (var row = 0; row < this.size; row++) {
    this.board[row] = this.solution[row].slice();
    for (var col = 0; col < this.size; col++) {
      this.userInput[row][col] = false;
    }
  }

  // Calculate holes based on difficulty
  var holes;
  switch (this.level) {
    case 0: // Easy
    case 1: // Medium
      holes = Math.floor(this.size * this.size * 0.55); // 55% empty
      break;
    case 2: // Hard
      holes = Math.floor(this.size * this.size * 0.65); // 65% empty
      break;
  }

  // Create array of all positions
  var positions = [];
  for (var r = 0; r < this.size; r++) {
    for (var c = 0; c < this.size; c++) {
      positions.push([r, c]);
    }
  }

  this.shuffleArray(positions);

  // Remove numbers one by one
  for (var i = 0; i < holes && i < positions.length; i++) {
    var pos = positions[i];
    this.board[pos[0]][pos[1]] = 0;
    this.userInput[pos[0]][pos[1]] = true;
  }
};

Sudoku.prototype.generateBaseSolution = function () {
  this.initializeArrays();
  return this.fillRemaining(0, 0);
};

Sudoku.prototype.fillRemaining = function (row, col) {
  // Move to next row when column reaches end
  if (col >= this.size) {
    row++;
    col = 0;
  }

  // Successfully filled all cells
  if (row >= this.size) {
    return true;
  }

  // Try numbers 1-size for current cell
  var numbers = [];
  for (var value = 1; value <= this.size; value++) {
    numbers.push(value);
  }
  this.shuffleArray(numbers);

  for (var i = 0; i < numbers.length; i++) {
    var currentNum = numbers[i];
    if (this.isValidMove(row, col, currentNum, this.solution)) {
      this.solution[row][col] = currentNum;
      if (this.fillRemaining(row, col + 1)) {
        return true;
      }
      this.solution[row][col] = 0;
    }
  }

  return false;
};

Sudoku.prototype.shuffleArray = function (array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

Sudoku.prototype.isValidMove = function (row, col, num, board) {
  // Check row
  for (var r = 0; r < this.size; r++) {
    if (board[row][r] === num) return false;
  }

  // Check column
  for (var c = 0; c < this.size; c++) {
    if (board[c][col] === num) return false;
  }

  // Check box
  var boxStartRow = Math.floor(row / this.boxHeight) * this.boxHeight;
  var boxStartCol = Math.floor(col / this.boxWidth) * this.boxWidth;

  for (var boxRow = 0; boxRow < this.boxHeight; boxRow++) {
    for (var boxCol = 0; boxCol < this.boxWidth; boxCol++) {
      if (board[boxStartRow + boxRow][boxStartCol + boxCol] === num)
        return false;
    }
  }

  return true;
};

Sudoku.prototype.handleGameKeys = function (key) {
  if (!this.gameStarted) return;

  var row = this.selectedCell.row;
  var col = this.selectedCell.col;
  var newRow = row;
  var newCol = col;

  if (key === "up") {
    do {
      newCol = (newCol - 1 + this.size) % this.size;
      if (newCol === this.size - 1) {
        newRow = (newRow - 1 + this.size) % this.size;
      }
    } while (
      !this.userInput[newRow][newCol] &&
      (newRow !== row || newCol !== col)
    );
  }

  if (key === "down") {
    do {
      newCol = (newCol + 1) % this.size;
      if (newCol === 0) {
        newRow = (newRow + 1) % this.size;
      }
    } while (
      !this.userInput[newRow][newCol] &&
      (newRow !== row || newCol !== col)
    );
  }

  if (key === "clear") {
    openMenu(MENU_ITEM.GAME);
    return;
  }

  this.selectedCell.row = newRow;
  this.selectedCell.col = newCol;
  this.updateDisplay();
};

Sudoku.prototype.handleGameNumKeys = function (key) {
  if (!this.gameStarted || key > this.size || key === "*") return;

  var row = this.selectedCell.row;
  var col = this.selectedCell.col;

  if (!this.userInput[row][col]) return;

  if (key === "#") {
    // reset the user input for the current puzzle
    for (var i = 0; i < this.size; i++) {
      for (var j = 0; j < this.size; j++) {
        if (this.userInput[i][j]) {
          this.board[i][j] = 0;
        }
      }
    }
    this.updateDisplay();
    return;
  }

  if (key !== 0) {
    this.moves++;
  }
  this.board[row][col] = key;
  this.updateDisplay();
};

Sudoku.prototype.formatTime = function (seconds) {
  var minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  return (
    (minutes < 10 ? "0" : "") +
    minutes +
    ":" +
    (seconds < 10 ? "0" : "") +
    seconds
  );
};

Sudoku.prototype.formatMoves = function (moves) {
  return ("000" + moves).slice(-3);
};

Sudoku.prototype.updateDisplay = function () {
  var self = this;
  var cells = document.querySelectorAll(".cell");

  cells.forEach(function (cell) {
    var row = parseInt(cell.getAttribute("data-row"));
    var col = parseInt(cell.getAttribute("data-col"));
    var value = self.board[row][col];

    cell.className = cell.className
      .split(" ")
      .filter(function (c) {
        return c === "cell";
      })
      .join(" ");

    if (row === self.selectedCell.row && col === self.selectedCell.col) {
      cell.classList.add("selected");
    }

    if (self.userInput[row][col]) {
      cell.classList.add("input");
    }

    if ((col + 1) % self.size === 0) {
      cell.classList.add("right");
    }

    if ((row + 1) % self.size === 0) {
      cell.classList.add("bottom");
    }

    if (value !== 0) {
      cell.textContent = value;
    } else {
      cell.textContent = "";
    }
  });

  if (this.gameStarted) {
    var timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
    document.querySelector(".timer").textContent = this.formatTime(timeElapsed);
    document.querySelector(".moves").textContent = this.formatMoves(this.moves);
    document.getElementById("level").textContent = this.puzzleNumber;

    this.checkWin();
  }
};

Sudoku.prototype.checkWin = function () {
  if (!this.gameStarted) return;

  var isComplete = true;
  for (var row = 0; row < this.size; row++) {
    for (var col = 0; col < this.size; col++) {
      if (this.board[row][col] !== this.solution[row][col]) {
        isComplete = false;
        break;
      }
    }
    if (!isComplete) break;
  }

  if (isComplete) {
    this.gameStarted = false;
    this.puzzleNumber++;
    this.newGame();
  }
};

// The menu screens take the keys while they are open, so these only run during a game.
function handleKeypress(key) {
  if (currentGame) currentGame.handleGameKeys(key);
}

function handleNumpress(key) {
  if (currentGame) currentGame.handleGameNumKeys(key);
}

openMenu(MENU_ITEM.GAME);
window.bridge.on("keypress", handleKeypress);
window.bridge.on("numpress", handleNumpress);
