package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestSharePdfFile(t *testing.T) {
	dir := t.TempDir()
	old, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(old)

	folder := filepath.Join("assets", "Slidepass", "u")
	if err := os.MkdirAll(folder, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(folder, "a(1).pdf"), []byte("%PDF"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(folder, "a.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		in   string
		name string
		ok   bool
	}{
		{"/assets/a(1).pdf", "a(1).pdf", true},
		{"/assets/../../a(1).pdf", "a(1).pdf", true}, // フォルダ名だけが使われる
		{"/assets/a.txt", "", false},
		{"/assets/none.pdf", "", false},
	}
	for _, c := range cases {
		name, _, ok := sharePdfFile("u", c.in)
		if ok != c.ok || name != c.name {
			t.Errorf("sharePdfFile(%q) = (%q, %v), want (%q, %v)", c.in, name, ok, c.name, c.ok)
		}
	}
}

func TestShareLifecycle(t *testing.T) {
	shareMu.Lock()
	defer shareMu.Unlock()

	s := &share{
		Token:     "tok",
		Folder:    "u",
		PdfName:   "a.pdf",
		ViewerID:  "viewer",
		Page:      1,
		CreatedAt: time.Now(),
		audience:  make(map[*websocket.Conn]bool),
	}
	sharesByToken[s.Token] = s
	sharesByFolder[s.Folder] = s

	if findShareLocked("tok") != s {
		t.Fatal("有効な共有が見つからない")
	}
	if findShareLocked("other") != nil {
		t.Fatal("存在しないトークンが見つかった")
	}

	// 期限切れの共有は無効になり、消える
	s.CreatedAt = time.Now().Add(-shareLifetime - time.Minute)
	if findShareLocked("tok") != nil {
		t.Fatal("期限切れの共有が有効なまま")
	}
	if _, ok := sharesByFolder["u"]; ok {
		t.Fatal("期限切れの共有が残っている")
	}
}
