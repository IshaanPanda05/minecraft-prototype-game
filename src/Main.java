import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.util.Random;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.Timer;

public final class Main extends JPanel implements ActionListener, KeyListener, MouseListener {
    private static final long serialVersionUID = 1L;
    private static final int SCREEN_WIDTH = 960;
    private static final int SCREEN_HEIGHT = 640;
    private static final int TILE_SIZE = 32;
    private static final int WORLD_WIDTH = 100;
    private static final int WORLD_HEIGHT = 40;
    private static final int PLAYER_WIDTH = 22;
    private static final int PLAYER_HEIGHT = 48;
    private static final int AIR = 0;
    private static final int GRASS = 1;
    private static final int DIRT = 2;
    private static final int STONE = 3;
    private static final Color[] BLOCK_COLORS = {
        new Color(135, 206, 235),
        new Color(76, 175, 80),
        new Color(130, 82, 45),
        new Color(110, 110, 120)
    };

    private final int[][] world = new int[WORLD_WIDTH][WORLD_HEIGHT];
    private final int[] inventory = new int[4];
    private Timer gameTimer;
    private double playerX;
    private double playerY;
    private double velocityY;
    private boolean movingLeft;
    private boolean movingRight;
    private boolean onGround;
    private int selectedBlock = DIRT;

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            JFrame window = new JFrame("Block World");
            Main game = new Main();
            window.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            window.setResizable(false);
            window.add(game);
            window.pack();
            window.setLocationRelativeTo(null);
            window.setVisible(true);
            game.startGame();
            game.requestFocusInWindow();
        });
    }

    public Main() {
        setPreferredSize(new Dimension(SCREEN_WIDTH, SCREEN_HEIGHT));
        generateWorld();
        playerX = 5 * TILE_SIZE;
        playerY = (surfaceAt(5) - 2) * TILE_SIZE;
        inventory[DIRT] = 20;
        inventory[STONE] = 10;
    }

    private void startGame() {
        setFocusable(true);
        addKeyListener(this);
        addMouseListener(this);
        gameTimer = new Timer(16, this);
        gameTimer.start();
    }

    private void generateWorld() {
        Random random = new Random();
        for (int x = 0; x < WORLD_WIDTH; x++) {
            int surface = 18 + random.nextInt(5) - 2;
            for (int y = 0; y < WORLD_HEIGHT; y++) {
                if (y < surface) {
                    world[x][y] = AIR;
                } else if (y == surface) {
                    world[x][y] = GRASS;
                } else if (y < surface + 5) {
                    world[x][y] = DIRT;
                } else {
                    world[x][y] = STONE;
                }
            }
        }
    }

    private int surfaceAt(int x) {
        for (int y = 0; y < WORLD_HEIGHT; y++) {
            if (world[x][y] != AIR) {
                return y;
            }
        }
        return WORLD_HEIGHT - 1;
    }

    private void updateGame() {
        double horizontalSpeed = 4.0;
        double horizontalMovement = 0;
        if (movingLeft) horizontalMovement -= horizontalSpeed;
        if (movingRight) horizontalMovement += horizontalSpeed;

        playerX += horizontalMovement;
        resolveCollisions(true);

        velocityY = Math.min(velocityY + 0.45, 10);
        playerY += velocityY;
        onGround = false;
        resolveCollisions(false);
        repaint();
    }

    private void resolveCollisions(boolean horizontal) {
        int firstX = (int) Math.floor(playerX / TILE_SIZE);
        int lastX = (int) Math.floor((playerX + PLAYER_WIDTH - 1) / TILE_SIZE);
        int firstY = (int) Math.floor(playerY / TILE_SIZE);
        int lastY = (int) Math.floor((playerY + PLAYER_HEIGHT - 1) / TILE_SIZE);

        for (int x = firstX; x <= lastX; x++) {
            for (int y = firstY; y <= lastY; y++) {
                if (!isSolid(x, y)) continue;
                if (horizontal && playerX + PLAYER_WIDTH / 2.0 < (x + 0.5) * TILE_SIZE) {
                    playerX = x * TILE_SIZE - PLAYER_WIDTH;
                } else if (horizontal) {
                    playerX = (x + 1) * TILE_SIZE;
                } else if (velocityY > 0) {
                    playerY = y * TILE_SIZE - PLAYER_HEIGHT;
                    velocityY = 0;
                    onGround = true;
                } else if (velocityY < 0) {
                    playerY = (y + 1) * TILE_SIZE;
                    velocityY = 0;
                }
            }
        }
        playerX = Math.max(0, Math.min(playerX, WORLD_WIDTH * TILE_SIZE - PLAYER_WIDTH));
    }

    private boolean isSolid(int x, int y) {
        if (x < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return true;
        if (y < 0) return false;
        return world[x][y] != AIR;
    }

    private int cameraX() {
        int maximum = WORLD_WIDTH * TILE_SIZE - SCREEN_WIDTH;
        return Math.max(0, Math.min((int) playerX - SCREEN_WIDTH / 2, maximum));
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        graphics.setColor(new Color(135, 206, 235));
        graphics.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        int camera = cameraX();
        int firstColumn = camera / TILE_SIZE;
        int lastColumn = Math.min(WORLD_WIDTH - 1, (camera + SCREEN_WIDTH) / TILE_SIZE);
        for (int x = firstColumn; x <= lastColumn; x++) {
            for (int y = 0; y < WORLD_HEIGHT; y++) {
                int block = world[x][y];
                if (block == AIR) continue;
                int screenX = x * TILE_SIZE - camera;
                int screenY = y * TILE_SIZE;
                graphics.setColor(BLOCK_COLORS[block]);
                graphics.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                graphics.setColor(new Color(0, 0, 0, 35));
                graphics.drawRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            }
        }

        graphics.setColor(new Color(180, 90, 60));
        graphics.fillRect((int) playerX - camera, (int) playerY, PLAYER_WIDTH, PLAYER_HEIGHT);
        drawHud(graphics);
    }

    private void drawHud(Graphics graphics) {
        graphics.setFont(new Font("SansSerif", Font.BOLD, 15));
        graphics.setColor(Color.BLACK);
        graphics.drawString("A/D or arrows: move    SPACE: jump    Left click: mine    Right click: place", 16, 24);
        graphics.drawString("Choose block: 1 Dirt (" + inventory[DIRT] + ")   2 Stone (" + inventory[STONE]
                + ")   3 Grass (" + inventory[GRASS] + ")", 16, 48);

        int[] blockTypes = {DIRT, STONE, GRASS};
        for (int index = 0; index < blockTypes.length; index++) {
            int block = blockTypes[index];
            int x = 16 + index * 54;
            int y = SCREEN_HEIGHT - 54;
            graphics.setColor(block == selectedBlock ? Color.WHITE : Color.DARK_GRAY);
            graphics.fillRect(x - 3, y - 3, 46, 42);
            graphics.setColor(BLOCK_COLORS[block]);
            graphics.fillRect(x, y, 40, 30);
            graphics.setColor(Color.BLACK);
            graphics.drawString(Integer.toString(index + 1), x + 15, y + 48);
        }
    }

    private boolean isWithinReach(int tileX, int tileY) {
        double playerCenterX = playerX + PLAYER_WIDTH / 2.0;
        double playerCenterY = playerY + PLAYER_HEIGHT / 2.0;
        double blockCenterX = (tileX + 0.5) * TILE_SIZE;
        double blockCenterY = (tileY + 0.5) * TILE_SIZE;
        double reach = TILE_SIZE * 5.0;
        double distanceX = playerCenterX - blockCenterX;
        double distanceY = playerCenterY - blockCenterY;
        return distanceX * distanceX + distanceY * distanceY <= reach * reach;
    }

    private void mineBlock(int screenX, int screenY) {
        int tileX = (screenX + cameraX()) / TILE_SIZE;
        int tileY = screenY / TILE_SIZE;
        if (!isInsideWorld(tileX, tileY) || !isWithinReach(tileX, tileY)) return;
        int block = world[tileX][tileY];
        if (block != AIR) {
            inventory[block]++;
            world[tileX][tileY] = AIR;
        }
    }

    private void placeBlock(int screenX, int screenY) {
        int tileX = (screenX + cameraX()) / TILE_SIZE;
        int tileY = screenY / TILE_SIZE;
        if (!isInsideWorld(tileX, tileY) || !isWithinReach(tileX, tileY)) return;
        if (world[tileX][tileY] != AIR || inventory[selectedBlock] <= 0) return;

        boolean overlapsPlayer = playerX < (tileX + 1) * TILE_SIZE
                && playerX + PLAYER_WIDTH > tileX * TILE_SIZE
                && playerY < (tileY + 1) * TILE_SIZE
                && playerY + PLAYER_HEIGHT > tileY * TILE_SIZE;
        if (!overlapsPlayer) {
            world[tileX][tileY] = selectedBlock;
            inventory[selectedBlock]--;
        }
    }

    private boolean isInsideWorld(int x, int y) {
        return x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT;
    }

    @Override
    public void actionPerformed(ActionEvent event) {
        updateGame();
    }

    @Override
    public void keyPressed(KeyEvent event) {
        int key = event.getKeyCode();
        if (key == KeyEvent.VK_A || key == KeyEvent.VK_LEFT) movingLeft = true;
        if (key == KeyEvent.VK_D || key == KeyEvent.VK_RIGHT) movingRight = true;
        if ((key == KeyEvent.VK_SPACE || key == KeyEvent.VK_W || key == KeyEvent.VK_UP) && onGround) {
            velocityY = -9;
            onGround = false;
        }
        if (key == KeyEvent.VK_1) selectedBlock = DIRT;
        if (key == KeyEvent.VK_2) selectedBlock = STONE;
        if (key == KeyEvent.VK_3) selectedBlock = GRASS;
    }

    @Override
    public void keyReleased(KeyEvent event) {
        int key = event.getKeyCode();
        if (key == KeyEvent.VK_A || key == KeyEvent.VK_LEFT) movingLeft = false;
        if (key == KeyEvent.VK_D || key == KeyEvent.VK_RIGHT) movingRight = false;
    }

    @Override
    public void mousePressed(MouseEvent event) {
        if (event.getButton() == MouseEvent.BUTTON1) mineBlock(event.getX(), event.getY());
        if (event.getButton() == MouseEvent.BUTTON3) placeBlock(event.getX(), event.getY());
        repaint();
    }

    @Override public void keyTyped(KeyEvent event) {}
    @Override public void mouseClicked(MouseEvent event) {}
    @Override public void mouseReleased(MouseEvent event) {}
    @Override public void mouseEntered(MouseEvent event) {}
    @Override public void mouseExited(MouseEvent event) {}
}
