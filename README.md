# Block World

A small, original Minecraft-inspired block-building game written mostly in Java. It uses only Java's built-in Swing and AWT libraries, so no game engine or downloaded assets are required.

## Run it

Install a JDK (Java 17 or newer), then open PowerShell in this project folder and run:

```powershell
javac -d out src\Main.java
java -cp out Main
```

## Controls

- **A / D** or **left / right arrows**: move.
- **Space**, **W**, or **up arrow**: jump.
- **Left mouse button**: mine a block within five tiles; mined blocks go into your inventory.
- **Right mouse button**: place the selected block, if you have one.
- **1 / 2 / 3**: select dirt, stone, or grass.

The world is freshly generated each time the game starts. This prototype does not save worlds yet.

## Lesson: read `src/Main.java` in order

The source is intentionally kept in one file so it is easy to follow as a beginner. Read it from top to bottom; each section introduces one idea used by the next section.

1. **Imports (lines 1-15):** Java libraries provide colors, drawing, keyboard/mouse events, random numbers, and Swing windows. Reusing these built-ins keeps the project dependency-free.
2. **Class and constants (lines 17-35):** `Main` is both the game and its drawable panel. `implements` says it will receive timer, keyboard, and mouse events. Constants give names to screen dimensions, tile sizes, block IDs, and colors, so we avoid repeating unexplained numbers. `serialVersionUID` is Swing's serialization version marker.
3. **Game state (lines 37-46):** `world[x][y]` stores the block ID at every grid location; `inventory[blockId]` stores counts. The player position and vertical speed use `double` so motion can be smoother than whole-pixel steps. Booleans remember held keys and whether the player is standing on a block.
4. **Starting the window (lines 48-61):** `main` asks Swing to create the interface on its event thread. A `JFrame` is the window; adding the `Main` panel gives it the game screen. `pack()` uses the panel's preferred size. After showing the window, the code starts the game and requests keyboard focus.
5. **Initializing the game (lines 63-78):** the constructor sets the screen size, generates the world, positions the player, and gives a starter inventory. `startGame` registers input listeners and starts a Swing timer that ticks about every 16 milliseconds. It is called after construction so the timer/listeners cannot use a partly initialized game.
6. **Making terrain (lines 80-96):** the outer loop visits every column and the inner loop visits every row. A random surface height makes hills. Rows above it are air, the surface is grass, the next five rows are dirt, and deeper rows are stone.
7. **Finding the ground (lines 98-105):** `surfaceAt` scans downward until it finds the first non-air tile. This lets the constructor put the player above the terrain rather than inside it.
8. **Updating motion (lines 107-121):** key-state booleans decide horizontal movement. Gravity adds to vertical speed, with a cap so falling cannot accelerate forever. After each movement, collision handling corrects any overlap, and `repaint()` asks Swing to draw the next frame.
9. **Collision helpers (lines 123-153):** the player's rectangle is converted to tile coordinates using `floor`. Each overlapping tile is checked. Side collisions stop horizontal movement; landing sets `onGround`; hitting a ceiling stops upward movement. `isSolid` treats the world's sides and bottom as solid, while the sky is open.
10. **Camera (lines 155-158):** `cameraX` follows the player but clamps to the world edges. Rendering and mouse targeting both use the same camera offset, so what you click matches what you see.
11. **Drawing the game (lines 160-185):** `paintComponent` clears the old frame, paints the sky, and draws only columns visible on screen. Every block ID chooses a color. The player and HUD are drawn afterward so they appear in front of the world.
12. **HUD (lines 187-206):** text shows controls and inventory counts. The three colored squares are the hotbar; a white border marks the selected block.
13. **Reach and mining (lines 208-228):** `isWithinReach` compares squared distances, avoiding an unnecessary square root. `mineBlock` converts mouse screen coordinates back to world tiles, validates bounds and reach, adds the block to inventory, and changes its world tile to air.
14. **Placing blocks (lines 230-248):** `placeBlock` performs the same coordinate and reach checks. It only places into air when inventory is available, and it prevents placing a block inside the player's rectangle. Successful placement consumes one block.
15. **Input events (lines 250-287):** the timer calls `updateGame`. Key presses set movement and select blocks; key releases stop movement. A left mouse press mines and a right press places. Empty listener methods are required by Java's listener interfaces but have no extra behavior.

### A few Java ideas in this project

- **Arrays:** `int[][]` is a grid (an array of columns, each containing rows); `int[]` is the inventory.
- **Methods:** small named jobs such as `generateWorld`, `mineBlock`, and `drawHud` make the game easier to read and change.
- **Constants:** `static final` values are shared fixed settings, such as `TILE_SIZE`.
- **Events:** Swing calls listener methods when the timer, keyboard, or mouse produces an event.
- **Coordinates:** the world uses tile coordinates, while drawing uses pixel coordinates. Multiplying by `TILE_SIZE` converts tiles to pixels.

## Ideas for the next lesson

Add trees, caves, a save file, sound effects, or crafting. A good next step is adding a new block type: define an ID and color, generate or place it, then add it to the hotbar.
