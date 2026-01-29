import { getDocument, GlobalWorkerOptions } from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';

// Workerパスを設定
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

let allPdfs = []; // 全てのPDFリストを保持する変数
let viewMode = 'grid'; // 表示モード ('grid' or 'list')

// ログインチェック
const username = localStorage.getItem('username');
if (!username) {
    window.location.href = '/login';
} else {
    const displayUsername = document.getElementById('display-username');
    if (displayUsername) displayUsername.textContent = username + ' さん';
}

window.logout = function() {
    localStorage.removeItem('username');
    window.location.href = '/login';
};

document.addEventListener('DOMContentLoaded', () => {
    getAndShowPdfList();
    
    // 検索入力イベント
    const searchInput = document.getElementById('pdf-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allPdfs.filter(pdfUrl => {
                const fileName = pdfUrl.split('/').pop().toLowerCase();
                return fileName.includes(query);
            });
            renderPdfList(filtered);
        });
    }

    // 表示切り替えイベント
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');

    if (gridBtn && listBtn) {
        gridBtn.addEventListener('click', () => {
            viewMode = 'grid';
            gridBtn.classList.add('bg-gray-100', 'text-primary-blue');
            listBtn.classList.remove('bg-gray-100', 'text-primary-blue');
            renderPdfList(getCurrentFilteredPdfs());
        });

        listBtn.addEventListener('click', () => {
            viewMode = 'list';
            listBtn.classList.add('bg-gray-100', 'text-primary-blue');
            gridBtn.classList.remove('bg-gray-100', 'text-primary-blue');
            renderPdfList(getCurrentFilteredPdfs());
        });
    }
});

/**
 * 現在の検索クエリに基づいたPDFリストを取得
 */
function getCurrentFilteredPdfs() {
    const searchInput = document.getElementById('pdf-search-input');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    return allPdfs.filter(pdfUrl => {
        const fileName = pdfUrl.split('/').pop().toLowerCase();
        return fileName.includes(query);
    });
}

// ドキュメント全体をクリックしたときに、開いているメニューを閉じる
document.addEventListener('click', function(e) {
    // プロフィールドロップダウンの制御
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileButton = document.getElementById('profile-menu-button');
    if (profileButton && profileButton.contains(e.target)) {
        profileDropdown.classList.toggle('hidden');
    } else if (profileDropdown && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.add('hidden');
    }

    // クリックされた要素がドロップダウンメニューやそのトリガーボタンの一部でない場合
    if (!e.target.closest('.pdf-card-menu')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('dropdown-menu-visible');
        });
    }
});


/**
 * 指定されたPDFの最初のページをレンダリングし、Canvas IDに挿入します。
 * @param {string} pdfUrl 
 * @param {string} canvasId 
 */
async function renderPdfThumbnail(pdfUrl, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const container = canvas.parentElement;
    const targetWidth = container.clientWidth || 200;
    const targetHeight = container.clientHeight || 150;
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    try {
        const loadingTask = getDocument({
            url: pdfUrl,
            httpHeaders: { 'X-Username': localStorage.getItem('username') }
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(targetWidth / unscaledViewport.width, targetHeight / unscaledViewport.height);
        const viewport = page.getViewport({ scale: scale });

        const offsetX = (targetWidth - viewport.width) / 2;
        const offsetY = (targetHeight - viewport.height) / 2;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
            // transformを直接指定して位置を調整
            transform: [1, 0, 0, 1, offsetX, offsetY]
        };

        await page.render(renderContext).promise;
    } catch (error) {
        console.error(`Error rendering thumbnail for ${pdfUrl}:`, error);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

/**
 * サーバーからPDF一覧を取得し、カードとして表示します。
 */
async function getAndShowPdfList() {
    const listContainer = document.getElementById('pdf-list-container');
    if (!listContainer) return;
    const loadingElement = document.getElementById('loading-pdfs');
    const errorMessage = document.getElementById('pdf-error-message');
    
    // loadingElementが存在し、かつ listContainer の子である場合のみ切り離す
    if (loadingElement && loadingElement.parentNode === listContainer) {
        listContainer.removeChild(loadingElement);
    }

    // コンテナをクリアする
    listContainer.innerHTML = ''; 
    
    // ローディング要素を再追加し、表示を元に戻す
    if (loadingElement) {
        listContainer.appendChild(loadingElement);
        loadingElement.style.display = 'block';
    }
    
    if (errorMessage) errorMessage.classList.add('hidden');

    try {
        const response = await fetch('/pdfs', {
            headers: { 'X-Username': localStorage.getItem('username') }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allPdfs = await response.json(); // グローバル変数に保存
        
        renderPdfList(allPdfs);

    } catch (error) {
        console.error('Failed to fetch PDF list:', error);
        
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        listContainer.innerHTML = '';
        if (errorMessage) {
            errorMessage.textContent = 'PDFファイルをアップロードしてください';
            errorMessage.classList.remove('hidden');
        }
    }
}

/**
 * PDFリストを受け取ってHTMLを描画します
 */
function renderPdfList(pdfFiles) {
    const listContainer = document.getElementById('pdf-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (viewMode === 'grid') {
        listContainer.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6';
    } else {
        listContainer.className = 'flex flex-col gap-3 max-w-4xl mx-auto';
    }

    if (pdfFiles.length === 0) {
        listContainer.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">PDFファイルが見つかりません。</div>';
        return;
    }

    const renderPromises = [];

    pdfFiles.forEach((pdfUrl, index) => {
        const fileName = pdfUrl.split('/').pop(); 
        const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
        const canvasId = `pdf-canvas-${index}`;
        
        const card = document.createElement('div');
        
        if (viewMode === 'grid') {
            card.className = 'bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 relative cursor-pointer'; 
            card.innerHTML = `
                <div class="pdf-placeholder">
                    <canvas id="${canvasId}" class="pdf-canvas-thumb"></canvas>
                </div>
                <div class="p-4">
                    <div class="absolute top-2 right-2 pdf-card-menu">
                        <button class="p-1 text-gray-400 hover:text-gray-600 rounded-full bg-white/70 hover:bg-white transition menu-trigger">
                            <span class="material-symbols-outlined text-base pointer-events-none">more_vert</span>
                        </button>
                        <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 hidden dropdown-menu z-10">
                            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 delete-action">
                                <span class="material-symbols-outlined text-sm mr-2 align-middle text-red-500">delete</span>
                                <span class="align-middle">ファイルを削除</span>
                            </a>
                        </div>
                    </div>
                    <p class="text-sm font-medium text-text-dark truncate">${fileNameWithoutExt}</p>
                    <p class="text-xs text-gray-500 mt-0.5">
                        ${Math.floor(Math.random() * 4) + 1}週間前
                    </p>
                </div>
            `;
        } else {
            card.className = 'bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-300 relative cursor-pointer flex items-center p-3 gap-4';
            card.innerHTML = `
                <div class="w-20 h-14 bg-gray-100 flex-shrink-0 rounded overflow-hidden flex items-center justify-center">
                    <canvas id="${canvasId}" class="w-full h-full object-cover"></canvas>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-dark truncate">${fileNameWithoutExt}</p>
                    <p class="text-xs text-gray-500 mt-0.5">最終更新: ${Math.floor(Math.random() * 4) + 1}週間前</p>
                </div>
                <div class="pdf-card-menu">
                    <button class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition menu-trigger">
                        <span class="material-symbols-outlined text-base pointer-events-none">more_vert</span>
                    </button>
                    <div class="absolute right-2 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 hidden dropdown-menu z-10">
                        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 delete-action">
                            <span class="material-symbols-outlined text-sm mr-2 align-middle text-red-500">delete</span>
                            <span class="align-middle">ファイルを削除</span>
                        </a>
                    </div>
                </div>
            `;
        }
        
        card.onclick = (e) => {
            if (e.target.closest('.pdf-card-menu')) return;
            window.location.href = `/viewer?pdf=${encodeURIComponent(pdfUrl)}`;
        };

        listContainer.appendChild(card);

        const menuTrigger = card.querySelector('.menu-trigger');
        const dropdownMenu = card.querySelector('.dropdown-menu');

        if (menuTrigger && dropdownMenu) {
            menuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    if (menu !== dropdownMenu) menu.classList.remove('dropdown-menu-visible');
                });
                dropdownMenu.classList.toggle('dropdown-menu-visible');
            });
        }
        
        const deleteButton = card.querySelector('.delete-action');
        if (deleteButton) {
            deleteButton.onclick = (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                deletePdfFile(pdfUrl);
            };
        }

        renderPromises.push(renderPdfThumbnail(pdfUrl, canvasId));
    });
    
    Promise.allSettled(renderPromises).then(() => {
        console.log('PDF thumbnails updated.');
    });
}

/**
 * 指定されたPDFファイルをサーバーに削除リクエストを送ります。
 * @param {string} pdfUrl 削除対象のPDFファイルのパス (例: 'assets/file.pdf')
 */
window.deletePdfFile = async function(pdfUrl) {
    if (!confirm(`「${pdfUrl.split('/').pop()}」を本当に削除しますか？`)) {
        return;
    }

    try {
        const response = await fetch('/delete-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Username': localStorage.getItem('username')
            },
            body: JSON.stringify({ pdf_path: pdfUrl }), // サーバーにパスを送信
        });

        if (response.ok) {
            // 削除成功後、リストを更新
            getAndShowPdfList();
        } else {
            const errorText = await response.text();
            alert(`削除失敗: ${errorText}`);
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('ネットワークエラーにより削除に失敗しました。');
    }
};

/**
 * 選択されたファイルをサーバーにアップロードします。
 * @param {File} file 
 */
window.uploadFile = async function(file) {
    if (!file) return;

    const originalButtonText = "プレゼンテーションをアップロード";
    const uploadLabel = document.getElementById('upload-label');
    if (!uploadLabel) return;
    
    // UIを更新してアップロード中であることを示す
    uploadLabel.innerHTML = '<span class="material-symbols-outlined text-base mr-1 animate-spin">progress_activity</span> アップロード中...';
    uploadLabel.classList.remove('bg-primary-blue', 'hover:bg-blue-700');
    uploadLabel.classList.add('bg-gray-500');

    const formData = new FormData();
    formData.append('pdf_file', file); // サーバー側の "pdf_file" と一致

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            headers: {
                'X-Username': localStorage.getItem('username')
            },
            body: formData,
        });

        if (response.ok) {
            // 成功したらPDF一覧を再取得して画面を更新
            getAndShowPdfList(); 
        } else {
            const errorText = await response.text();
            alert(`アップロード失敗: ${errorText}`);
        }

    } catch (error) {
        console.error('Upload failed:', error);
        alert(`ネットワークエラーによりアップロードに失敗しました。`);
    } finally {
        // UIを元に戻す
        uploadLabel.innerHTML = `<span class="material-symbols-outlined text-base mr-1">cloud_upload</span> ${originalButtonText}`;
        uploadLabel.classList.remove('bg-gray-500');
        uploadLabel.classList.add('bg-primary-blue', 'hover:bg-blue-700');
        
        // inputをリセット
        const uploadInput = document.getElementById('pdf-upload-input');
        if (uploadInput) uploadInput.value = null; 
    }
}
