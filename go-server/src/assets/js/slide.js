import { getDocument, GlobalWorkerOptions } from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';

// --- Functions to be exposed via window ---

function startFullscreen() {
    requestFullscreen();
    const overlay = document.getElementById('click-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function startPresenterMode() {
    const url = new URL(window.location.href);
    url.searchParams.set('presenter', 'true');
    window.open(url.toString(), 'PresenterMode', `width=${screen.availWidth},height=${screen.availHeight},menubar=no,toolbar=no,location=no,status=no`);
    const overlay = document.getElementById('click-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// Expose them to the global scope through an init function
window.initSlideFunctions = function() {
    window.startFullscreen = startFullscreen;
    window.startPresenterMode = startPresenterMode;
};

window.logout = async function() {
    try {
        await fetch('/logout', { method: 'POST' });
    } catch (err) {
        console.error('Logout request failed:', err);
    }
    localStorage.removeItem('username');
    window.location.href = '/login';
};

// Workerパスをモジュールとして設定
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

// ログインチェック
const username = localStorage.getItem('username');
if (!username) {
    window.location.href = '/login';
} else {
    const displayUsername = document.getElementById('display-username');
    if (displayUsername) displayUsername.textContent = username;
}
window.username = username; // グローバルアクセス用

// --- WebSocket Variables ---
let ws = null;
let viewerId = null;

// --- PDF.js Variables ---
let pdfDoc = null;
let currentPageNum = 0;
let currentPdfUrl = null;
const pdfCanvas = document.getElementById('pdf-canvas');
const ctx = pdfCanvas ? pdfCanvas.getContext('2d') : null;
const loadingText = document.getElementById('loading-text');

// --- PDF Rendering Functions ---

/**
 * ノートを取得して表示します
 */
async function loadNote(pageNum) {
    const noteArea = document.getElementById('slide-note');
    if (!noteArea) return;
    try {
        const response = await fetch(`/note?pdf_path=${encodeURIComponent(currentPdfUrl)}&page_index=${pageNum}`, {
            headers: { 'X-Username': localStorage.getItem('username') }
        });
        if (response.ok) {
            const data = await response.json();
            noteArea.value = data.content || '';
        }
    } catch (err) {
        console.error('Failed to load note:', err);
    }
}

/**
 * ノートを保存します
 */
let saveTimeout = null;
async function saveNote() {
    const noteArea = document.getElementById('slide-note');
    if (!noteArea) return;
    const content = noteArea.value;
    const pageNum = currentPageNum;
    const pdfPath = currentPdfUrl;

    try {
        await fetch('/note', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Username': localStorage.getItem('username')
            },
            body: JSON.stringify({
                pdf_path: pdfPath,
                page_index: pageNum,
                content: content
            })
        });
        // 保存したら状態を通知（Remote側でリロードさせるため）
        broadcastStatus();
    } catch (err) {
        console.error('Failed to save note:', err);
    }
}

/**
 * WebSocketを通じて現在の状態をRemoteに通知します
 */
function broadcastStatus() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        const status = {
            page_index: currentPageNum,
            pdf_path: currentPdfUrl
        };
        ws.send(JSON.stringify({
            type: 'viewer_update',
            data: JSON.stringify(status)
        }));
    }
}

/**
 * 指定されたページ番号のPDFをレンダリングします
 * @param {number} num 
 */
async function renderPage(num) {
    if (!pdfDoc || !ctx) return;

    // ページ番号のバリデーションと更新
    if (num < 1 || num > pdfDoc.numPages) {
        console.log(`Page number ${num} is out of bounds (1 to ${pdfDoc.numPages}).`);
        return;
    }

    currentPageNum = num;

    // ページインジケータの更新
    const currentPageNumEl = document.getElementById('current-page-num');
    if (currentPageNumEl) currentPageNumEl.textContent = currentPageNum;

    // ノートの読み込み
    loadNote(currentPageNum);
    
    // Remoteに状態を通知
    broadcastStatus();

    // ページの取得とレンダリング
    try {
        const page = await pdfDoc.getPage(num);

        const element = document.getElementById('presentation-main');
        if (!element) return;
        const aspectRatio = page.getViewport({ scale: 1 }).width / page.getViewport({ scale: 1 }).height;
        const targetWidth = element.clientWidth;
        const targetHeight = element.clientHeight;

        let viewScale = 1;
        if (targetWidth / targetHeight > aspectRatio) {
            // 画面が横長すぎるときは高さに合わせる
            viewScale = targetHeight / page.getViewport({ scale: 1 }).height;
        } else {
            // 画面が縦長すぎるときは幅に合わせる
            viewScale = targetWidth / page.getViewport({ scale: 1 }).width;
        }

        const viewport = page.getViewport({ scale: viewScale }); // 100%のスケールで表示

        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log(`Page ${num} rendered.`);
    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

// --- PDF Load Function (URLパラメータから直接ロード) ---

/**
 * 指定されたPDFを実際にロードし、プレゼンを開始します
 * @param {string} pdfURL - PDFファイルのサーバーパス (例: /assets/pr1.pdf)
 */
async function loadPdf(pdfURL) {
    if (!pdfURL) {
        if (loadingText) loadingText.textContent = 'PDFパスが指定されていません。開始画面に戻ってください。';
        return;
    }

    if (loadingText) {
        loadingText.classList.remove('hidden');
        loadingText.textContent = `${pdfURL.split('/').pop()} を読み込み中...`;
    }

    currentPdfUrl = pdfURL;
    pdfDoc = null;
    currentPageNum = 0;

    try {
        const loadingTask = getDocument({
            url: pdfURL,
            httpHeaders: { 'X-Username': localStorage.getItem('username') }
        });
        pdfDoc = await loadingTask.promise;

        const totalPagesEl = document.getElementById('total-pages');
        if (totalPagesEl) totalPagesEl.textContent = pdfDoc.numPages;
        if (loadingText) loadingText.classList.add('hidden');

        if (pdfDoc.numPages > 0) {
            renderPage(1);
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        if (loadingText) loadingText.textContent = `${pdfURL.split('/').pop()} の読み込みに失敗しました。`;
    }
}


// --- Slide Control Functions ---

function nextSlide() {
    if (pdfDoc && currentPageNum < pdfDoc.numPages) {
        renderPage(currentPageNum + 1);
    } else {
        console.log("Already on the last page.");
    }
}

function prevSlide() {
    if (currentPageNum > 1) {
        renderPage(currentPageNum - 1);
    } else {
        console.log("Already on the first page.");
    }
}

/**
 * 全画面表示を開始
 */
function requestFullscreen() {
    const element = document.getElementById('presentation-main');
    if (!element) return;

    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) { /* Firefox */
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { /* IE/Edge */
        element.msRequestFullscreen();
    } else {
        alert("お使いのブラウザは全画面表示をサポートしていません。F11キーをお試しください。");
    }
}

/**
 * 全画面表示を終了
 */
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
        document.msExitFullscreen();
    }
}

// 全画面切り替えボタンのクリックイベントハンドラ
window.handleFullscreenToggle = function () {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (isFullscreen) {
        exitFullscreen();
    } else {
        const overlay = document.getElementById('click-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }
}

// --- Event Listeners for Fullscreen State ---

/**
 * 全画面モードの切り替え時に呼び出されるハンドラ。
 */
function handleFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        console.log("Fullscreen exited. Forcing page resize/re-render.");

        const overlay = document.getElementById('click-overlay');
        if (overlay) overlay.classList.add('hidden');

        if (currentPageNum > 0) {
            renderPage(currentPageNum);
        }
    } else {
        if (currentPageNum > 0) {
            renderPage(currentPageNum);
        }
    }
}

// 全画面表示の終了イベントを監視
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

// --- WebSocket Logic ---

document.addEventListener('DOMContentLoaded', () => {
    // ノート保存のイベントリスナー
    const noteArea = document.getElementById('slide-note');
    if (noteArea) {
        noteArea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveNote, 1000); // 1秒間入力が止まったら保存
        });
    }

    // キーボード操作のイベントリスナー
    document.addEventListener('keydown', (event) => {
        // ノート入力中はスライド操作を無効化
        if (document.activeElement.id === 'slide-note') {
            return;
        }

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault();
            nextSlide();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            prevSlide();
        }
    });

    // 起動時にURLパラメータをチェックし、PDFをロードする
    const urlParams = new URLSearchParams(window.location.search);
    const initialPdfPath = urlParams.get('pdf');

    if (initialPdfPath) {
        // パスが指定されていればデコードしてロード
        loadPdf(decodeURIComponent(initialPdfPath));
    } else {
        // パスが指定されていない場合は、ユーザーにファイルを選択するよう促す
        if (loadingText) loadingText.textContent = 'PDFファイルが指定されていません。';
        alert('ファイルが指定されていません。開始画面に戻ります。');
        window.location.href = '/'; // 開始画面に戻す
        return; // WebSocket接続に進まない
    }

    // 発表者モード（別ウィンドウ）で開かれた場合の処理
    if (urlParams.get('presenter') === 'true') {
        const overlay = document.getElementById('click-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            const title = overlay.querySelector('h2');
            if (title) title.textContent = '発表者モードを全画面で開始';
            const grid = overlay.querySelector('.grid');
            if (grid) {
                grid.innerHTML = `
                    <button onclick="startFullscreen()" class="flex items-center justify-center gap-3 bg-primary hover:bg-primary/80 text-white py-6 px-6 rounded-xl font-bold transition-all transform hover:scale-105">
                        <span class="material-symbols-outlined text-3xl">fullscreen</span>
                        クリックして全画面を開始
                    </button>
                `;
            }
            // キャンセルボタンを隠す
            const cancelBtn = overlay.querySelector('button[onclick*="hidden"]');
            if (cancelBtn) cancelBtn.style.display = 'none';
        }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const uri = `${protocol}//${window.location.host}/ws`;
    ws = new WebSocket(uri);
    const statusDiv = document.getElementById('connection-status');
    const statusSpan = document.getElementById('status-text');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const viewerIdDisplay = document.getElementById('viewer-id-display');

    ws.onopen = function () {
        console.log('Viewer Connected');
    };

    ws.onmessage = function (evt) {
        try {
            // 1. 接続時にサーバーから送られるViewer IDの処理
            if (viewerId === null && evt.data.startsWith('{"type":') === false) {
                viewerId = evt.data;
                console.log('Viewer ID:', viewerId);

                // QRコード生成ロジック
                const remoteUrl = `http://${window.location.host}/remote?id=${viewerId}&user=${encodeURIComponent(username)}`;

                // qrcode.jsを使用してQRコードを生成
                if (qrCodeContainer) {
                    qrCodeContainer.innerHTML = ''; // 既存のメッセージをクリア
                    if (typeof QRCode !== 'undefined') {
                        new QRCode(qrCodeContainer, {
                            text: remoteUrl,
                            width: 256,
                            height: 256,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.H
                        });
                    } else {
                        qrCodeContainer.innerHTML = `<p class="text-xs text-red-500">QRコードライブラリのロードに失敗しました。</p>`;
                    }
                }

                if (viewerIdDisplay) viewerIdDisplay.textContent = `ID: ${viewerId}`;

                // 接続待機中メッセージを更新
                if (statusDiv && statusSpan) {
                    statusDiv.classList.remove('bg-yellow-500/20');
                    statusDiv.classList.add('bg-green-500/20');
                    const indicator = statusDiv.querySelector('.bg-yellow-500');
                    if (indicator) indicator.classList.replace('bg-yellow-500', 'bg-green-500');
                    statusSpan.textContent = '接続IDが発行されました';
                }
                return;
            }

            // 2. RemoteからのJSON操作メッセージ
            const message = JSON.parse(evt.data);
            console.log('Received JSON:', message);

            if (message.type === 'remote_control' && message.status === 200) {
                switch (message.data) {
                    case 'next':
                        nextSlide();
                        break;
                    case 'prev':
                        prevSlide();
                        break;
                    case 'fullscreen_start':
                        const overlay = document.getElementById('click-overlay');
                        if (overlay) overlay.classList.remove('hidden');
                        break;
                    case 'fullscreen_end':
                        exitFullscreen();
                        break;
                    case 'presenter_mode_start':
                        startPresenterMode();
                        break;
                    case 'ping':
                        broadcastStatus();
                        break;
                    case 'note_updated':
                        loadNote(currentPageNum);
                        break;
                    default:
                        console.log('Unknown remote command:', message.data);
                }
            } else if (message.type === 'error') {
                console.error('WebSocket Error:', message.data);
            }

        } catch (e) {
            console.error("Received unexpected message or error:", e, evt.data);
        }
    };

    ws.onclose = function () {
        console.log('Viewer Disconnected');
        if (statusSpan) statusSpan.textContent = '切断されました';
        if (statusDiv) {
            statusDiv.classList.remove('bg-green-500/20');
            statusDiv.classList.add('bg-red-500/20');
            const indicator = statusDiv.querySelector('.bg-green-500');
            if (indicator) indicator.classList.replace('bg-green-500', 'bg-red-500');
        }
    };

    ws.onerror = function (error) {
        console.error('WebSocket Error:', error);
        if (statusSpan) statusSpan.textContent = 'エラーが発生しました';
        if (statusDiv) {
            statusDiv.classList.remove('bg-green-500/20');
            statusDiv.classList.add('bg-red-500/20');
            const indicator = statusDiv.querySelector('.bg-green-500');
            if (indicator) indicator.classList.replace('bg-green-500', 'bg-red-500');
        }
    };
});
