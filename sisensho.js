// 効果音読み込み
const seClick = new Audio("sound/click.mp3");
const seMatch = new Audio("sound/match.mp3");
const seError = new Audio("sound/error.mp3");
const seFinish = new Audio("sound/finish.mp3");

// 効果音の呼び出し関数
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
    // 先に動いているタイマーがあれば止める
    if (timerId) {
        clearInterval(timerId);
    }

    timeLeft = 80; // 初期化
    updateTimerDisplay(); // 表示を更新
    
    // タイマーを1秒ずつ減らして画面を更新
    timerId = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerId); // タイマー消去
            timeOver();
        }
    } , 1000); 
}

function updateTimerDisplay() {
    timerDisplay.textContent = `残り時間: ${timeLeft}秒`;
}

// 時間切れ処理
function timeOver() {
    playSE(seFinish);
    timeUpModal.classList.toggle("active")

    // 2秒待ったらmodal切替る
    setTimeout(() => {
        timeUpModal.classList.toggle("active")
    }, 1500);
}

// 得点関係
let score = 0;
let streak = 0;
const scoreDisplay = document.getElementById("score-display");

function updateScoreDisplay() {
    scoreDisplay.textContent = `点数: ${score}`;
}

// streakを5で割ってボーナスを計算
function calcBonus(streak) {
    return (Math.floor(streak / 5) +1) *100;
}

function addScore() {
    streak++;
    score += calcBonus(streak);
    updateScoreDisplay();
}

function subtract500() {
    // 0と"score-500"のうち大きいほうがscoreに入る
    score = Math.max(0, score - 500); 
    streak = 0;
    updateScoreDisplay();
}

// 8x17の盤面に、各4枚ずつの牌を配置。外周1マス分は空白とすれば外周を通る判定をしやすくなる。
const ROWS = 10; // 8 + 外周の2
const COLS = 19; // 17 + 外周の2
const TYPES = 34; // 34種。最大種類。
let board = []; // 牌の配置である二次元配列を入れるため
let selected = null;

// 牌を並べる
function initGame() {
    let tiles = []; // 牌の容れ物
    selected = null; // 選択されていないように直す

    // 牌を入れていく
    for (let i = 0; i < TYPES; i++) {
        for (let j = 0; j < 4; j++) { // 4枚ずつ入れるループ
            tiles.push(i); // iが牌の種類を指す
        }
    }
    // board[r][c] = 0 だと検証する時にfalseが返されることがあるので注意!!


    // フィッシャー・イェーツのシャッフル。よくわかってない。
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    // 二次元配列をまずnullで埋めて、最初と最後をnullでのこしつつタイルを配列に詰め込む
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let idx = 0;
    for (let r = 1; r < ROWS - 1; r++) {
        for (let c = 1; c < COLS - 1; c++) {
            board[r][c] = tiles[idx++];
        }
    }
    render();
    startTimer();

    score = 0;
    streak = 0;
    updateScoreDisplay();
}

// 詰め込んだ牌を描画する
function render() {
    const el = document.getElementById('board');
    // el.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`; // グリッドを決める
    el.innerHTML = ''; // 一度盤面を掃除


    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // セルを生成
            const div = document.createElement('div');
            const isTile = board[r][c] !== null; // タイルがあるかないかの真偽値
            div.className = 'cell' + (isTile ? '' : ' empty'); // board[r][c]の番地が空っぽなら class="cell empty"

            // 選択されているか
            if (selected && selected.r === r && selected.c === c) {
                div.classList.add('selected');
            }
            
            // 牌がnullでなければ画像を入れる
            if (isTile) {
                div.style.backgroundImage = `url("./ma-jong-pais/${board[r][c]}.png")`;
                div.style.backgroundSize = `contain`;
                div.style.backgroundRepeat = `no-repeat`;
                div.style.backgroundPosition = `center`;
            }

            // ここですでに引数を具体的に挿入している。
            // handleClick(0,2), 次のループは (0,3) となるから、一つ一つ違う関数がonclickに登録されていく。
            div.onclick = () => handleClick(r, c);
            el.appendChild(div);
        }
    }
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
        playSE(seClick);
        selected = null;
    }
    
    // 2枚目を選んだとき
    else if (selected) {
        // 同種の牌を選んだ場合
        if (board[selected.r][selected.c] === board[r][c]) {
            // 検証関数にわたしてtrueなら選んだ2つを消す
            if (canConnect(selected.r, selected.c, r, c)) {
                board[selected.r][selected.c] = null;
                board[r][c] = null;
                selected = null;
                
                addScore();
                playSE(seMatch);

            } else { // 同じ牌だが繋げられない場合
                selected = null;
                subtract500();
                playSE(seError);
            }
        } else { // 違う牌を選んでしまった場合
            selected = null;
            subtract500();
            playSE(seError);
        }

    // 何も選んでいない状態で選択したとき
    } else {
        selected = {r, c};
        playSE(seClick);
    }
    render();
}

// 四川省のキモのロジックの橋渡し
// checkLine()に曲がった回数0回を加えてタイルの座標を渡している。
function canConnect(r1, c1, r2, c2) {
    return checkLine(r1, c1, r2, c2, 0);
}

// 検証ロジック
// r1 が選択した牌、r2が目標の牌
function checkLine(r1, c1, r2, c2, turns) {
    if (turns > 2) return false; // ターンを3回で検出したら終わり

    // 4方向へ移動ベクトルを作る。それぞれ列と行
    //
    const dr = [0, 0, 1, -1];
    const dc = [1, -1, 0, 0];

    // ループで4方向それぞれ移動させてみる
    for (let i = 0; i < 4; i++) {
        // 次に調べるマスの座標を暫定させる
        // dr[2],dr[3]でROW方向に+1した場合、-1した場合といった具合
        let nr = r1 + dr[i];
        let nc = c1 + dc[i];

        // ループを使ってその方向に進めるだけ進ませる
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            // 目標の牌にぶつかったらOK=true
            if (nr === r2 && nc === c2) return true;

            // 途中で別の牌にぶつかったら次のループへ
            if (board[nr][nc]) break;

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

document.querySelector(".controls button").addEventListener("click", function() {playSE(seMatch)});

initGame();
