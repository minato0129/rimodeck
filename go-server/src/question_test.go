package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

// 質問の送信: DB に触る前の入力チェックと、共有トークンの確認
func TestSharedQuestionValidation(t *testing.T) {
	e := echo.New()
	e.POST("/shared/:token/question", sharedQuestionHandler)

	cases := []struct {
		name   string
		body   string
		status int
	}{
		{"空の質問", `{"page":1,"content":"   "}`, http.StatusBadRequest},
		{"長すぎる質問", `{"page":1,"content":"` + strings.Repeat("あ", maxQuestionRunes+1) + `"}`, http.StatusBadRequest},
		{"ページが0", `{"page":0,"content":"質問"}`, http.StatusBadRequest},
		{"ページが大きすぎる", `{"page":999999,"content":"質問"}`, http.StatusBadRequest},
		{"共有が存在しない", `{"page":1,"content":"質問"}`, http.StatusNotFound},
		{"JSONではない", `not json`, http.StatusBadRequest},
	}
	for _, c := range cases {
		req := httptest.NewRequest(http.MethodPost, "/shared/nope/question", strings.NewReader(c.body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != c.status {
			t.Errorf("%s: status = %d, want %d (%s)", c.name, rec.Code, c.status, rec.Body.String())
		}
	}

	// ちょうど上限の文字数は、入力チェックを通る(共有が無いので 404 になる)
	body := `{"page":1,"content":"` + strings.Repeat("あ", maxQuestionRunes) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/shared/nope/question", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("上限ちょうど: status = %d, want 404", rec.Code)
	}
}
