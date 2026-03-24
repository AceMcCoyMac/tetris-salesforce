import { LightningElement, track, wire } from 'lwc';
import saveScore from '@salesforce/apex/TetrisController.saveScore';
import getHighScores from '@salesforce/apex/TetrisController.getHighScores';
import { refreshApex } from '@salesforce/apex';

// Board dimensions
const COLS = 10;
const ROWS = 20;
const BLOCK = 32;
const NEXT_BLOCK = 28;

// Colors for each tetromino
const COLORS = {
    I: '#00CFCF',
    O: '#F0D000',
    T: '#A000F0',
    S: '#00B800',
    Z: '#F00000',
    J: '#0000F0',
    L: '#F0A000'
};

// Tetromino shapes
const TETROMINOES = {
    I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: 'I' },
    O: { shape: [[1,1],[1,1]], color: 'O' },
    T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: 'T' },
    S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: 'S' },
    Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: 'Z' },
    J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: 'J' },
    L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: 'L' }
};

const TETROMINO_KEYS = Object.keys(TETROMINOES);

// Scoring
const LINE_SCORES = [0, 100, 300, 500, 800];

function randomTetromino() {
    const key = TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
    return JSON.parse(JSON.stringify(TETROMINOES[key]));
}

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function rotate(matrix) {
    const N = matrix.length;
    const result = matrix.map((row, i) => row.map((_, j) => matrix[N - 1 - j][i]));
    return result;
}

export default class Tetris extends LightningElement {
    @track playerName = '';
    @track showNameEntry = true;
    @track showGame = false;
    @track gameOver = false;
    @track score = 0;
    @track level = 1;
    @track linesCleared = 0;
    @track highScores = [];
    @track paused = false;

    board = createBoard();
    current = null;
    currentX = 0;
    currentY = 0;
    next = null;
    gameLoop = null;
    canvas = null;
    ctx = null;
    nextCanvas = null;
    nextCtx = null;
    wiredScoresResult = null;

    @wire(getHighScores)
    wiredScores(result) {
        this.wiredScoresResult = result;
        if (result.data) {
            this.highScores = result.data.map((s, i) => ({ ...s, rank: `${i + 1}.` }));
        }
    }

    handleNameChange(event) {
        this.playerName = event.target.value;
    }

    startGame() {
        if (!this.playerName || this.playerName.trim() === '') {
            this.playerName = 'Player';
        }
        this.playerName = this.playerName.trim();
        this.showNameEntry = false;
        this.showGame = true;
        this.gameOver = false;
        this.initGame();
    }

    resetGame() {
        this.gameOver = false;
        this.showGame = true;
        this.initGame();
    }

    initGame() {
        this.board = createBoard();
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.paused = false;

        // Get canvas refs after render
        setTimeout(() => {
            this.canvas = this.template.querySelector('.game-canvas');
            this.nextCanvas = this.template.querySelector('.next-canvas');
            if (!this.canvas) return;

            this.canvas.width = COLS * BLOCK;
            this.canvas.height = ROWS * BLOCK;
            this.nextCanvas.width = 4 * NEXT_BLOCK;
            this.nextCanvas.height = 4 * NEXT_BLOCK;

            this.ctx = this.canvas.getContext('2d');
            this.nextCtx = this.nextCanvas.getContext('2d');

            this.next = randomTetromino();
            this.spawnPiece();
            this.focusGame();
            this.startLoop();
        }, 100);
    }

    focusGame() {
        const wrapper = this.template.querySelector('.tetris-wrapper');
        if (wrapper) wrapper.focus();
    }

    spawnPiece() {
        this.current = this.next;
        this.next = randomTetromino();
        this.currentX = Math.floor((COLS - this.current.shape[0].length) / 2);
        this.currentY = 0;

        if (!this.isValid(this.current.shape, this.currentX, this.currentY)) {
            this.endGame();
        }
        this.drawNext();
    }

    startLoop() {
        if (this.gameLoop) clearInterval(this.gameLoop);
        const speed = Math.max(100, 800 - (this.level - 1) * 70);
        this.gameLoop = setInterval(() => {
            if (!this.paused && !this.gameOver) {
                this.tick();
            }
        }, speed);
    }

    tick() {
        if (this.isValid(this.current.shape, this.currentX, this.currentY + 1)) {
            this.currentY++;
        } else {
            this.lockPiece();
            const cleared = this.clearLines();
            this.updateScore(cleared);
            this.spawnPiece();
        }
        this.draw();
    }

    isValid(shape, offsetX, offsetY) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const newX = offsetX + c;
                const newY = offsetY + r;
                if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
                if (newY >= 0 && this.board[newY][newX]) return false;
            }
        }
        return true;
    }

    lockPiece() {
        for (let r = 0; r < this.current.shape.length; r++) {
            for (let c = 0; c < this.current.shape[r].length; c++) {
                if (!this.current.shape[r][c]) continue;
                const boardY = this.currentY + r;
                const boardX = this.currentX + c;
                if (boardY >= 0 && boardY < ROWS) {
                    this.board[boardY][boardX] = this.current.color;
                }
            }
        }
    }

    clearLines() {
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (this.board[r].every(cell => cell !== null)) {
                this.board.splice(r, 1);
                this.board.unshift(Array(COLS).fill(null));
                cleared++;
                r++;
            }
        }
        return cleared;
    }

    updateScore(cleared) {
        if (cleared > 0) {
            this.linesCleared += cleared;
            this.score += LINE_SCORES[cleared] * this.level;
            const newLevel = Math.floor(this.linesCleared / 10) + 1;
            if (newLevel !== this.level) {
                this.level = newLevel;
                this.startLoop();
            }
        }
    }

    handleKeyDown(event) {
        if (this.showNameEntry || this.gameOver) return;
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                if (this.isValid(this.current.shape, this.currentX - 1, this.currentY)) {
                    this.currentX--;
                }
                break;
            case 'ArrowRight':
                event.preventDefault();
                if (this.isValid(this.current.shape, this.currentX + 1, this.currentY)) {
                    this.currentX++;
                }
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (this.isValid(this.current.shape, this.currentX, this.currentY + 1)) {
                    this.currentY++;
                    this.score += 1;
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.rotatePiece();
                break;
            case ' ':
                event.preventDefault();
                this.hardDrop();
                break;
            case 'p':
            case 'P':
                this.paused = !this.paused;
                break;
            default:
                break;
        }
        this.draw();
    }

    rotatePiece() {
        const rotated = rotate(this.current.shape);
        // Wall kick attempts
        const kicks = [0, 1, -1, 2, -2];
        for (let kick of kicks) {
            if (this.isValid(rotated, this.currentX + kick, this.currentY)) {
                this.current.shape = rotated;
                this.currentX += kick;
                return;
            }
        }
    }

    hardDrop() {
        while (this.isValid(this.current.shape, this.currentX, this.currentY + 1)) {
            this.currentY++;
            this.score += 2;
        }
        this.lockPiece();
        const cleared = this.clearLines();
        this.updateScore(cleared);
        this.spawnPiece();
        this.draw();
    }

    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid lines
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 0.5;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
            }
        }

        // Board cells
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (this.board[r][c]) {
                    this.drawBlock(ctx, c, r, COLORS[this.board[r][c]], BLOCK);
                }
            }
        }

        // Ghost piece
        let ghostY = this.currentY;
        while (this.isValid(this.current.shape, this.currentX, ghostY + 1)) ghostY++;
        if (ghostY !== this.currentY) {
            this.drawPieceGhost(ctx, this.current.shape, this.currentX, ghostY);
        }

        // Current piece
        this.drawPiece(ctx, this.current, this.currentX, this.currentY, BLOCK);

        // Pause overlay
        if (this.paused) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawBlock(ctx, x, y, color, size) {
        ctx.fillStyle = color;
        ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
        ctx.fillRect(x * size + 1, y * size + 1, 4, size - 2);
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x * size + 1, y * size + size - 5, size - 2, 4);
    }

    drawPiece(ctx, piece, offsetX, offsetY, size) {
        const color = COLORS[piece.color];
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c]) {
                    this.drawBlock(ctx, offsetX + c, offsetY + r, color, size);
                }
            }
        }
    }

    drawPieceGhost(ctx, shape, offsetX, offsetY) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        (offsetX + c) * BLOCK + 1,
                        (offsetY + r) * BLOCK + 1,
                        BLOCK - 2, BLOCK - 2
                    );
                }
            }
        }
    }

    drawNext() {
        if (!this.nextCtx) return;
        const ctx = this.nextCtx;
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

        if (!this.next) return;
        const shape = this.next.shape;
        const color = COLORS[this.next.color];
        const offsetX = Math.floor((4 - shape[0].length) / 2);
        const offsetY = Math.floor((4 - shape.length) / 2);
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    this.drawBlock(ctx, offsetX + c, offsetY + r, color, NEXT_BLOCK);
                }
            }
        }
    }

    endGame() {
        clearInterval(this.gameLoop);
        this.gameLoop = null;
        this.gameOver = true;
        this.showGame = false;

        saveScore({
            playerName: this.playerName,
            score: this.score,
            linesCleared: this.linesCleared,
            level: this.level
        }).then(() => {
            return refreshApex(this.wiredScoresResult);
        }).catch(err => {
            console.error('Error saving score', err);
        });
    }

    disconnectedCallback() {
        if (this.gameLoop) clearInterval(this.gameLoop);
    }
}
