let ws = null;
let viewerId = null; 
// 状態管理: 現在Remoteが全画面モードをアクティブにしているか
let isFullscreen = false; 
const statusDiv = document.getElementById('remote-status');
const statusSpan = statusDiv ? statusDiv.querySelector('span:last-child') : null;
const statusDot = statusDiv ? statusDiv.querySelector('span:first-child') : null;
const fullscreenButton = document.getElementById('fullscreen-toggle-button');


document.addEventListener('DOMContentLoaded', () => {
    // Viewer IDをURLパラメータから取得 (例: /remote?id=xxx)
    const urlParams = new URLSearchParams(window.location.search);
    viewerId = urlParams.get('id');

    // ★全画面ボタンのイベントリスナー
    if (fullscreenButton) {
        fullscreenButton.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN && viewerId) {
                // 送信するコマンドを決定
                const command = isFullscreen ? 'fullscreen_end' : 'fullscreen_start';
                
                sendSlideCommand(command);
                
                // Remote側のボタンの状態をトグル（Viewer側の全画面状態を模倣）
                isFullscreen = !isFullscreen;
                updateFullscreenButton();
                console.log(`Fullscreen command sent: ${command}.`);
            } else {
                alert('接続されていないため、全画面コマンドを送信できません。QRコードを再読み込みしてください。');
            }
        });
    }

    if (!viewerId) {
        console.error("Viewer ID is missing. Please scan the QR code.");
        if (statusDiv) statusDiv.classList.replace('bg-yellow-500/20', 'bg-red-500/20');
        if (statusDot) statusDot.classList.replace('bg-yellow-500', 'bg-red-500');
        if (statusSpan) statusSpan.textContent = '接続エラー: QRコードを再読み込みしてください。';
        if (fullscreenButton) fullscreenButton.disabled = true;
        return;
    }
    
    // 接続中を表示
    if (statusSpan) statusSpan.textContent = `接続中...`;
    if (fullscreenButton) fullscreenButton.disabled = true; // 接続するまで無効化

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const uri = `${protocol}//${window.location.host}/ws`;
    ws = new WebSocket(uri);

    ws.onopen = function () {
        console.log('Remote Connected to server.');
        if (statusDiv) statusDiv.classList.replace('bg-yellow-500/20', 'bg-green-500/20');
        if (statusDot) statusDot.classList.replace('bg-yellow-500', 'bg-green-500');
        if (statusSpan) statusSpan.textContent = `接続済み`;
        if (fullscreenButton) fullscreenButton.disabled = false; // 接続したら有効化
    };

    ws.onmessage = function (evt) {
        try {
            const message = JSON.parse(evt.data);
            console.log('Received from Viewer/Server:', message);
            
            if (message.type === 'error') {
                alert(message.data);
            }

        } catch (e) {
            console.log("Received raw message, ignoring:", evt.data);
        }
    };

    ws.onclose = function () {
        console.log('Remote Disconnected');
        if (statusDiv) statusDiv.classList.replace('bg-green-500/20', 'bg-red-500/20');
        if (statusDot) statusDot.classList.replace('bg-yellow-500', 'bg-red-500');
        if (statusSpan) statusSpan.textContent = 'サーバーから切断されました';
        if (fullscreenButton) fullscreenButton.disabled = true;
    };

    ws.onerror = function (error) {
        console.error('WebSocket Error:', error);
        if (statusDiv) statusDiv.classList.replace('bg-green-500/20', 'bg-red-500/20');
        if (statusDot) statusDot.classList.replace('bg-yellow-500', 'bg-red-500');
        if (statusSpan) statusSpan.textContent = '接続エラーが発生しました';
        if (fullscreenButton) fullscreenButton.disabled = true;
    };

    /**
     * スライド操作コマンドまたは全画面コマンドをViewerに送信します
     * @param {string} command - 'next', 'prev', 'fullscreen_start', または 'fullscreen_end'
     */
    function sendSlideCommand(command) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !viewerId) {
            console.error('WebSocket not connected or ID missing.');
            alert('サーバーに接続されていないか、正しく読み込まれていません。');
            return;
        }

        const messageObject = {
            type: 'user_message', // main.goのMessage型に合わせる
            id:   viewerId,       // 送信先のViewer ID
            data: command,        // 新しいコマンド
        };

        ws.send(JSON.stringify(messageObject));
        console.log(`Command sent: ${command}`);
    }

    // ★ボタンの表示を切り替える関数
    function updateFullscreenButton() {
        if (!fullscreenButton) return;
        if (isFullscreen) {
            fullscreenButton.textContent = 'プレゼンテーションモードを終了';
            fullscreenButton.classList.replace('bg-primary', 'bg-red-500');
            fullscreenButton.classList.replace('hover:bg-primary/80', 'hover:bg-red-600');
        } else {
            fullscreenButton.textContent = 'プレゼンテーションモードに変更';
            fullscreenButton.classList.replace('bg-red-500', 'bg-primary');
            fullscreenButton.classList.replace('hover:bg-red-600', 'hover:bg-primary/80');
        }
    }

    // スライド操作ボタンにイベントリスナーを追加 (変更なし)
    const prevBtn = document.getElementById('prev-button');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            sendSlideCommand('prev');
        });
    }

    const nextBtn = document.getElementById('next-button');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            sendSlideCommand('next');
        });
    }
});
