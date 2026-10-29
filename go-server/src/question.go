package main

// 傾聴者から発表者への質問。
// - 傾聴者が送る(ログイン不要。共有リンクのトークンが鍵)
// - 発表者が見る・「回答済み」にする・削除する(ログイン必須)

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"rimodeck/controllers"
	"rimodeck/models"
	"rimodeck/repositories"

	"github.com/labstack/echo/v4"
)

const (
	maxQuestionRunes = 200             // 質問の最大文字数
	maxQuestionPage  = 10000           // ページ番号の上限(明らかに大きすぎる値を弾く)
	askInterval      = 5 * time.Second // 同じ傾聴者が続けて質問できる間隔
)

type askRequest struct {
	Page    int    `json:"page"`
	Content string `json:"content"`
}

// POST /shared/:token/question (ログイン不要): 傾聴者が質問を送る
func sharedQuestionHandler(c echo.Context) error {
	req := new(askRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "無効なリクエストです。"})
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "質問を入力してください。"})
	}
	if utf8.RuneCountInString(content) > maxQuestionRunes {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "質問は200文字以内で入力してください。"})
	}
	if req.Page < 1 || req.Page > maxQuestionPage {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ページが正しくありません。"})
	}

	shareMu.Lock()
	defer shareMu.Unlock()
	s := findShareLocked(c.Param("token"))
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "共有は終了しました。"})
	}

	// 連続投稿の制限(傾聴者は匿名なので、接続元のアドレスで見分ける)
	ip := c.RealIP()
	now := time.Now()
	if last, ok := s.lastAsked[ip]; ok && now.Sub(last) < askInterval {
		return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "少し待ってから、もう一度送ってください。"})
	}
	if len(s.lastAsked) > 1000 {
		s.lastAsked = make(map[string]time.Time)
	}

	q := &models.Question{
		UserID:    s.UserID,
		PdfName:   s.PdfName,
		PageIndex: req.Page,
		Content:   content,
	}
	if err := repositories.CreateQuestion(q); err != nil {
		c.Logger().Error("Failed to save question: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "質問を保存できませんでした。"})
	}
	s.lastAsked[ip] = now

	// 発表者の Viewer に、新着を知らせる
	if data, err := json.Marshal(q); err == nil {
		notifyViewerLocked(s, ReturnMessage{Type: "question_new", Status: 200, Data: string(data)})
	}
	return c.JSON(http.StatusCreated, map[string]uint{"id": q.ID})
}

// GET /questions?pdf_path=... (ログイン必須): ある PDF への質問の一覧
func listQuestionsHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	pdfName := filepath.Base(c.QueryParam("pdf_path"))
	if pdfName == "" || pdfName == "." {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "PDFパスが指定されていません。"})
	}
	questions, err := repositories.ListQuestions(user.UserID, pdfName)
	if err != nil {
		c.Logger().Error("Failed to list questions: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "質問を取得できませんでした。"})
	}
	return c.JSON(http.StatusOK, questions)
}

type questionIDRequest struct {
	ID       uint `json:"id"`
	Answered bool `json:"answered"`
}

// POST /question/answered (ログイン必須): 「回答済み」の印を付ける・外す
func answerQuestionHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	req := new(questionIDRequest)
	if err := c.Bind(req); err != nil || req.ID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "無効なリクエストです。"})
	}
	return questionResult(c, repositories.SetQuestionAnswered(user.UserID, req.ID, req.Answered))
}

// POST /question/delete (ログイン必須): 質問を削除する
func deleteQuestionHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	req := new(questionIDRequest)
	if err := c.Bind(req); err != nil || req.ID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "無効なリクエストです。"})
	}
	return questionResult(c, repositories.DeleteQuestion(user.UserID, req.ID))
}

func questionResult(c echo.Context, err error) error {
	if err == nil {
		return c.NoContent(http.StatusNoContent)
	}
	if repositories.IsNotFound(err) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "質問が見つかりません。"})
	}
	c.Logger().Error("Question operation failed: ", err)
	return c.JSON(http.StatusInternalServerError, map[string]string{"error": "操作に失敗しました。"})
}
