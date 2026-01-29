document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const msgEl = document.getElementById('message');
    
    btn.disabled = true;
    btn.textContent = '処理中...';
    msgEl.classList.add('hidden');

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            msgEl.textContent = '登録が完了しました！ログイン画面へ移動します。';
            msgEl.className = 'text-green-500 text-sm';
            msgEl.classList.remove('hidden');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            const msg = await response.text();
            msgEl.textContent = '登録に失敗しました: ' + msg;
            msgEl.className = 'text-red-500 text-sm';
            msgEl.classList.remove('hidden');
        }
    } catch (err) {
        msgEl.textContent = 'ネットワークエラーが発生しました。';
        msgEl.className = 'text-red-500 text-sm';
        msgEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'アカウント作成';
    }
});
