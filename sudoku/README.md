# Sudoku

A sudoku game built for Brick 1100, drawn on the phone's 96 x 65 LCD pixels with `bridge.lcd`.

## How to play

- Fill the grid so that every row, column and box has each digit once. Every puzzle has one solution.
- Pick a level in the menu: Easy (4 x 4), Medium (6 x 6) or Hard (9 x 9).
- Use the up and down keys to move between the cells you can fill.
- Use the number keys to fill a cell, and `0` to empty it.
- Press `#` to empty the whole grid.
- Press `C` to open the menu. Choose Continue to go back to your puzzle.

## What it shows builders

- A game drawn on a canvas with `bridge.lcd.fit`, `drawText`, `drawPixels` and `inkCanvas`.
- A game menu, level picker, instructions and result from `bridge.ui`.
- A sound from `loadAudio` and `playAudio`.
