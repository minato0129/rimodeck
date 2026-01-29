document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const errorEl = document.getElementById('error-message');
    
    btn.disabled = true;
    btn.textContent = 'ログイン中...';
    errorEl.classList.add('hidden');

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            // ログイン成功
            localStorage.setItem('username', username);
            window.location.href = '/';
        } else {
            const msg = await response.text();
            errorEl.textContent = 'ログインに失敗しました。ユーザー名またはパスワードが正しくありません。';
            errorEl.classList.remove('hidden');
        }
    } catch (err) {
        errorEl.textContent = 'ネットワークエラーが発生しました。';
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'ログイン';
    }
});
