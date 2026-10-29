package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestResolveAssetPath(t *testing.T) {
	cases := []struct {
		in     string
		want   string
		status int
	}{
		{"/assets/slide.pdf", filepath.Join("assets", "Slidepass", "u", "slide.pdf"), http.StatusOK},
		{"/assets/どうぶつ(1).pdf", filepath.Join("assets", "Slidepass", "u", "どうぶつ(1).pdf"), http.StatusOK},
		{"/assets/a b'!&+,;=@.PDF", filepath.Join("assets", "Slidepass", "u", "a b'!&+,;=@.PDF"), http.StatusOK},
		{"/assets/a.txt", "", http.StatusForbidden},
		{"/assets/../x.pdf", "", http.StatusForbidden},
		{"/assets/a/../../x.pdf", "", http.StatusForbidden},
	}
	for _, c := range cases {
		got, status, _ := resolveAssetPath(c.in, "u")
		if status != c.status || got != c.want {
			t.Errorf("resolveAssetPath(%q) = (%q, %d), want (%q, %d)", c.in, got, status, c.want, c.status)
		}
	}
}

// 括弧入りファイル名を、ブラウザと同じ「括弧を%エンコードしない」URL で
// 取得しても配信できること (以前は 404 になっていた)
func TestServeParenthesizedPDF(t *testing.T) {
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
	if err := os.WriteFile(filepath.Join(folder, "どうぶつ(1).pdf"), []byte("%PDF-test"), 0o644); err != nil {
		t.Fatal(err)
	}

	e := echo.New()
	e.GET("/assets/*", func(c echo.Context) error {
		p, status, msg := resolveAssetPath(c.Request().URL.Path, "u")
		if status != http.StatusOK {
			return c.String(status, msg)
		}
		return c.File(p)
	})

	for _, target := range []string{
		"/assets/%E3%81%A9%E3%81%86%E3%81%B6%E3%81%A4(1).pdf",     // 括弧そのまま (RawPath が設定される)
		"/assets/%E3%81%A9%E3%81%86%E3%81%B6%E3%81%A4%281%29.pdf", // 括弧もエンコード
	} {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", target, rec.Code)
		}
	}
}
