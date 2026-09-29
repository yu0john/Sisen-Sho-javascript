// 効果音読み込み
const seClick = new Audio("sound/click.mp3");
const seMatch = new Audio("sound/match.mp3");
const seError = new Audio("sound/error.mp3");
const seFinish = new Audio("sound/finish.mp3");

function playSE(sound) {
    sound.pause();
    sound.currentTime = 0;
    sound.play();
}

// タイマー関係
let timeLeft = 80;
let timerId = null;
const timerDisplay = document.getElementById("timer-display");
const timeUpModal = document.getElementById("time-up-modal");

function startTimer() {
    // 初期化
    if (timerId) {
        clearInterval(timerId);
    }
    timeLeft = 80;
    updateTimerDisplay();
    
    // 1秒ずつ減らして画面を更新
    timerId = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerId);
            timeOver();
        }
    } , 1000); 
}

function updateTimerDisplay() {
    timerDisplay.textContent = `残り時間: ${timeLeft}秒`;
}

function stopTimer() {
    clearInterval(timerId);
}

function timeOver() {
    isScoreLocked = true;
    playSE(seFinish);
    timeUpModal.classList.toggle("active")

    setTimeout(() => {
        timeUpModal.classList.toggle("active")
    }, 1000);
}

// 得点関係
let score = 0;
let streak = 0;
let isScoreLocked = false;
const scoreDisplay = document.getElementById("score-display");

function updateScoreDisplay() {
    scoreDisplay.textContent = `点数: ${score}`;
}

function calcBonus(streak) {
    return (Math.floor(streak / 5) +1) *100;
}

function addScore() {
    if (isScoreLocked) return; 
    streak++;
    score += calcBonus(streak);
    updateScoreDisplay();
}

function subtract500() {
    if (isScoreLocked) return;
    score = Math.max(0, score - 500); 
    streak = 0;
    updateScoreDisplay();
}

// 8x17の盤面+外周
const ROWS = 10;
const COLS = 19;
const TYPES = 34;
let board = []; // Javascript用
let cells = []; // 牌のHTML用
let selected = null;

// 牌を並べる
function shuffleTiles() {
    let tiles = [];
    selected = null;

    // 牌を4枚ずつ配列
    for (let i = 0; i < TYPES; i++) {
        for (let j = 0; j < 4; j++) {
            tiles.push(i);
        }
    }

    // フィッシャー・イェーツのシャッフル
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    // 二次元配列をまずnullで埋め、外周用のnullを残しつつ牌を詰め込む
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let idx = 0;
    for (let r = 1; r < ROWS - 1; r++) {
        for (let c = 1; c < COLS - 1; c++) {
            board[r][c] = tiles[idx++];
        }
    }
}

// HTML用の配列を用意する
function createHtmlBoard() {
    const el = document.getElementById("board");
    cells = Array.from({ length: ROWS }, () => []);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const div = document.createElement("div");
            div.className = "cell";
            div.dataset.r = r;
            div.dataset.c = c;
            if (board[r][c] != null) {
                div.style.backgroundImage = `url("./ma-jong-pais/${board[r][c]}.png")`;
            } else {
                div.style.border = "none";
            }
            div.onclick = () => handleClick(r, c);
            el.appendChild(div);
            cells[r][c] = div;
        }
    }
}

function hideTile(r, c) {
    cells[r][c].classList.add("empty");
    cells[r][c].classList.remove("selected");
    cells[r][c].style.backgroundImage = `none`;
    // cells[r][c] = null;
    
    cells[selected.r][selected.c].classList.add("empty");
    cells[selected.r][selected.c].classList.remove("selected");
    cells[selected.r][selected.c].style.backgroundImage = `none`;
    // cells[selected.r][selected.c] = null;

    board[r][c] = null;
    board[selected.r][selected.c] = null;
    selected = null;
}

function selectTile(r, c) {
    cells[r][c].classList.add("selected");
    selected = {r, c};
}

function deselectTile(r, c) {
    cells[r][c].classList.remove("selected");
    selected = null;
}


// クリックしたときの判定
function handleClick(r, c) {
    // 空のマスをクリックしたとき
    if (board[r][c] === null) {
        playSE(seClick);
        return;
    }

    // ひとつ選んでいて、次のクリックがそれ自身だったら選択解除
    if (selected && selected.r === r && selected.c === c) {
        deselectTile(r, c);
        playSE(seClick);
    }
    
    // 2枚目を選んだとき
    else if (selected) {
        // 同種の牌を選んだ場合
        if (board[selected.r][selected.c] === board[r][c]) {
            // 検証関数にわたしてtrueなら選んだ2つを消す
            if (canConnect(selected.r, selected.c, r, c)) {
                hideTile(r, c);
                addScore();
                playSE(seMatch);
                if (isDeadLock()) {
                    enableDeadLockModal();
                    stopTimer();
                    isScoreLocked = true;
                }
            } else { // 同じ牌だが繋げられない場合
                deselectTile(selected.r, selected.c);
                subtract500();
                playSE(seError);
            }
        } else { // 違う牌を選んでしまった場合
            deselectTile(selected.r, selected.c);
            subtract500();
            playSE(seError);
        }

    // 何も選んでいない状態で選択したとき
    } else {
        selectTile(r, c);
        playSE(seClick);
    }
}

// 四川省のキモのロジックの橋渡し
// checkLine()に曲がった回数0回を加えてタイルの座標を渡している。
function canConnect(r1, c1, r2, c2) {
    return checkLine(r1, c1, r2, c2, 0);
}

// 検証ロジック
// r1 が選択した牌、r2が目標の牌
function checkLine(r1, c1, r2, c2, turns) {
    if (turns > 2) return false; // 曲がった数が3回だと終わり

    // 4方向へ移動ベクトルを作る。それぞれ列と行
    const dr = [0, 0, 1, -1];
    const dc = [1, -1, 0, 0];

    // ループで4方向それぞれ移動させてみる
    for (let i = 0; i < 4; i++) {
        // 次に調べるマスの座標を暫定させる
        let nr = r1 + dr[i];
        let nc = c1 + dc[i];

        // ループを使ってその方向に進めるだけ進ませる
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            // 目標の牌にぶつかったらOK=true
            if (nr === r2 && nc === c2) return true;

            // 途中で別の牌にぶつかったら次のループへ
            if (board[nr][nc] != null) break;

            // もう一度checkLine()を呼び出し移動を開始させる。
            // 空きマスなら、そこから更に曲がって目標に到達するか試す。
            if (checkLine(nr, nc, r2, c2, turns + 1)) return true;

            // 進める
            nr += dr[i];
            nc += dc[i];
        }
    }

    // ループしてtrueがでなければ失敗
    return false;
}

// 手詰まり判定
// true -> 消せる組み合わせが残っていない
function isDeadLock() {
    const map = new Map();
    
    // 残っている牌の種類とそれらの
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] == null) continue;
            let tileId = board[r][c];
            if (!map.has(tileId)) {
                map.set(tileId, [{r, c}]);
            } else {
                map.get(tileId).push({r, c});
            }
        }
    }

    for (let content of map) {
        let key = content[0];
        for (let i = 0; i < map.get(key).length; i++) {
            for (let j = i + 1; j < map.get(key).length; j++) {
                let r1 = map.get(key)[i].r;
                let c1 = map.get(key)[i].c;
                let r2 = map.get(key)[j].r;
                let c2 = map.get(key)[j].c;

                // console.log(`Checking tileID:${key}, point(${r1}, ${c1}) and point(${r2}, ${c2})`);
                if (canConnect(r1, c1, r2, c2)) {
                    // console.log("at least one more pair can be deleted.");
                    return false;
                }
            }
        }
    }
    
    // console.log("no more pairs to be deleted");
    return true;
}

const deadlockModal = document.getElementById("deadlock-modal");
function enableDeadLockModal() {
    deadlockModal.classList.add("active");
}

function disableDeadLockModal() {
    deadlockModal.classList.remove("active");
}

function startGame() {
    startTimer();
    score = 0;
    streak = 0;
    updateScoreDisplay();
}

function resetGame() {
    shuffleTiles();

    // CSSをもとに戻してcellsに再度格納
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            cells[r][c].classList.remove("selected");
            cells[r][c].classList.remove("empty");
            cells[r][c].style.backgroundImage = `url("./ma-jong-pais/${board[r][c]}.png")`
        }
    }

    selected = null;
    disableDeadLockModal();
    isScoreLocked = false;
    startGame();
}

document.querySelector(".controls button").addEventListener("click", function() {resetGame()});
document.querySelector(".controls button").addEventListener("click", function() {playSE(seMatch)});

shuffleTiles();
createHtmlBoard();
startGame();