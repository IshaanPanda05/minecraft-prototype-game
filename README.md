# Block World — 3D browser prototype

A tiny first-person voxel sandbox made with Java, JavaScript, HTML, and CSS. Java runs a local web server; Three.js draws the 3D world in your browser. The world is generated fresh each time you restart the server.

## Run the game

1. Install a JDK (Java 17 or newer) and a recent browser with WebGL 2.
2. Open PowerShell in this project folder.
3. Compile the Java web server and start it:

   ```powershell
   javac -d out src\Main.java
   java -cp out Main
   ```

4. Open **http://localhost:8080** in your browser.
5. Click **ENTER THE WORLD** to capture your mouse. Press **Esc** to release it or pause.
6. To use another port, start the server with a port number, for example `java -cp out Main 9000`.

The game loads Three.js and its pointer-lock controls from jsDelivr, so an internet connection is needed when opening the page. If your browser blocks pointer lock, the game automatically falls back to mouse-movement controls.

## Controls

- **W / A / S / D:** move; hold **Shift** to walk slowly.
- **Ctrl:** crouch and move carefully. Shift and Ctrl both prevent you from walking off a ledge; release Ctrl to stand up.
- **Space:** jump.
- **Move the mouse:** look around after entering the world.
- **Hold left click:** break the block in the crosshair. Cracks and a progress bar show mining progress; releasing the mouse or changing targets resets it.
- **Right click:** place the selected block on the block you're pointing at.
- **1–6:** select grass, dirt, stone, sand, wood, or leaves.
- **Esc:** release the mouse and pause.

Blocks you mine are added to your inventory. Bedrock forms the bottom of the world and cannot be mined or placed. Block placement uses inventory and cannot put a block inside the player.

## How the project fits together

- **`src/Main.java` — Java web server:** opens `web/` on `localhost`, serves the game files with their correct content types, rejects paths outside the web folder, and allows only `GET` requests.
- **`web/index.html` — page structure:** declares the canvas container, control hints, inventory hotbar, start/pause overlay, and the Three.js import map.
- **`web/style.css` — presentation:** styles the game HUD and adapts it to smaller screens. The 3D scene itself is drawn into a canvas by Three.js.
- **`web/game.js` — game logic:** creates the 3D scene, builds a block world, handles first-person movement and collision, and implements mining, placing, and inventory.

## Learn the game code in order

1. **`src/Main.java` imports and content types:** the JDK's `HttpServer` serves pages without an extra server dependency. A content-type map tells browsers how to interpret HTML, CSS, JavaScript, and images.
2. **Java `main`:** reads the optional port (8080 by default), finds the web folder, binds only to your own computer, and starts the server.
3. **Java `serveFile`:** permits `GET`, maps `/` to `index.html`, normalizes requested paths, and checks their real paths stay inside `web/`. This prevents a URL from reading other files on your computer.
4. **HTML document:** the import map gives JavaScript short names for Three.js and its add-ons. The body provides named containers and buttons that JavaScript can update.
5. **JavaScript constants and state:** world dimensions, movement settings, blocks, inventory, and pressed keys are kept in named variables instead of scattered magic numbers.
6. **Three.js scene:** the scene, perspective camera, renderer, lights, materials, and raycaster create the 3D stage. `InstancedMesh` draws many blocks efficiently.
7. **World generation:** each ground column gets a varied height above a solid bedrock floor. Winding cave tunnels are carved below ground, and trees grow on grass; their trunks and leaves can be mined.
8. **Rendering terrain:** completely buried blocks are skipped. The visible blocks are batched by material into instance meshes, so the GPU can draw them in a few calls.
9. **Hotbar and inventory:** buttons are created from the block list. Selecting a block updates the highlight; mining and placing update the displayed block counts.
10. **Player physics:** the camera supplies forward and sideways movement directions. The player moves on each axis only when that step will not intersect a block; gravity, jumping, slow walking, and crouch-height collision update position.
11. **Targeting and editing:** a ray from the center of the camera finds the block under the crosshair. Holding left-click fills a hardness-based mining bar and draws cracks on the target; releasing or aiming at another block resets progress. Bedrock is indestructible. Right-click places a block next to the hit face if inventory allows and the player is not in the way.
12. **Input and animation:** keyboard, mouse, pointer-lock, and resize events update the game. A `requestAnimationFrame` loop advances physics and redraws the scene.

## Current prototype limitations

Worlds are not saved yet, and there is no crafting, multiplayer, or server-side game state. This is a learning project, not a clone of Minecraft.
