package main

// 傾聴者共有: 発表者が共有を始めると、ログイン不要の共有リンク(トークン)が発行される。
// 傾聴者は /watch/<token> を開いて PDF を見て、発表者のページ移動を WebSocket で受け取る。
// 共有は発表者が止めるまで続く(サーバーを再起動すると消える。メモリ上だけで持つ)。

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"rimodeck/controllers"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

// 共有の最長時間(止め忘れても、これを過ぎると無効になる)
const shareLifetime = 12 * time.Hour

type share struct {
	Token     string
	UserID    string // 発表者のユーザーID (質問の保存先)
	Folder    string // 発表者の Slidepass フォルダ名
	PdfName   string // ファイル名のみ
	ViewerID  string // 発表者の Viewer ID (ページの更新を受け取る相手)
	Page      int
	CreatedAt time.Time
	audience  map[*websocket.Conn]bool
	lastAsked map[string]time.Time // 傾聴者(IP)ごとの、最後に質問を送った時刻
}

var (
	shareMu        sync.Mutex
	sharesByToken  = make(map[string]*share)
	sharesByFolder = make(map[string]*share) // 1人につき共有は1つ
)

func newShareToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// shareRequest は POST /share のリクエスト
type shareRequest struct {
	PdfPath  string `json:"pdf_path"`  // 例: /assets/my_presentation.pdf
	ViewerID string `json:"viewer_id"` // 発表者の Viewer ID
	Page     int    `json:"page"`      // 発表者がいま表示しているページ
}

// sharePdfFile は共有する PDF の実ファイルパス(ファイル名だけを使い、フォルダの外には出さない)
func sharePdfFile(folder, pdfPath string) (name string, full string, ok bool) {
	name = filepath.Base(pdfPath)
	if !strings.HasSuffix(strings.ToLower(name), ".pdf") {
		return "", "", false
	}
	full = filepath.Join("assets", "Slidepass", folder, name)
	if info, err := os.Stat(full); err != nil || info.IsDir() {
		return "", "", false
	}
	return name, full, true
}

// 期限切れの共有を片付ける(shareMu を持った状態で呼ぶ)
func purgeExpiredSharesLocked() {
	for _, s := range sharesByToken {
		if time.Since(s.CreatedAt) > shareLifetime {
			stopShareLocked(s)
		}
	}
}

// 共有を止めて、傾聴者に知らせて切断する(shareMu を持った状態で呼ぶ)
func stopShareLocked(s *share) {
	msg, _ := json.Marshal(ReturnMessage{Type: "share_ended", Status: 200})
	for ws := range s.audience {
		_ = ws.WriteMessage(websocket.TextMessage, msg)
		ws.Close()
	}
	s.audience = make(map[*websocket.Conn]bool)
	delete(sharesByToken, s.Token)
	if sharesByFolder[s.Folder] == s {
		delete(sharesByFolder, s.Folder)
	}
	notifyAudienceCountLocked(s)
}

// 発表者の Viewer に、メッセージを送る(shareMu を持った状態で呼ぶ)
func notifyViewerLocked(s *share, message ReturnMessage) {
	msg, _ := json.Marshal(message)
	mu.Lock()
	defer mu.Unlock()
	for ws := range wsMap[s.ViewerID] {
		_ = ws.WriteMessage(websocket.TextMessage, msg)
	}
}

// 発表者の Viewer に、傾聴者の人数を知らせる(shareMu を持った状態で呼ぶ)
func notifyAudienceCountLocked(s *share) {
	notifyViewerLocked(s, ReturnMessage{
		Type:   "audience_count",
		Status: 200,
		Data:   strconv.Itoa(len(s.audience)),
	})
}

// 有効な共有をトークンで探す(shareMu を持った状態で呼ぶ)
func findShareLocked(token string) *share {
	s, ok := sharesByToken[token]
	if !ok {
		return nil
	}
	if time.Since(s.CreatedAt) > shareLifetime {
		stopShareLocked(s)
		return nil
	}
	return s
}

// POST /share (ログイン必須): 共有を始める。同じ PDF を共有中なら、同じトークンを返す(ページの再読み込み対策)
func startShareHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	folder := user.Slidepass
	req := new(shareRequest)
	if err := c.Bind(req); err != nil || req.PdfPath == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "無効なリクエストです。"})
	}
	name, _, ok := sharePdfFile(folder, req.PdfPath)
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "共有する PDF が見つかりません。"})
	}
	page := req.Page
	if page < 1 {
		page = 1
	}

	shareMu.Lock()
	defer shareMu.Unlock()
	purgeExpiredSharesLocked()

	if s, ok := sharesByFolder[folder]; ok {
		if s.PdfName == name {
			// 作り直さず、新しい Viewer につなぎ替える
			s.ViewerID = req.ViewerID
			s.UserID = user.UserID
			s.Page = page
			notifyAudienceCountLocked(s)
			broadcastSharePageLocked(s)
			return c.JSON(http.StatusOK, map[string]string{"token": s.Token})
		}
		stopShareLocked(s)
	}

	token, err := newShareToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "共有リンクを作れませんでした。"})
	}
	s := &share{
		Token:     token,
		UserID:    user.UserID,
		Folder:    folder,
		PdfName:   name,
		ViewerID:  req.ViewerID,
		Page:      page,
		CreatedAt: time.Now(),
		audience:  make(map[*websocket.Conn]bool),
		lastAsked: make(map[string]time.Time),
	}
	sharesByToken[token] = s
	sharesByFolder[folder] = s
	notifyAudienceCountLocked(s)
	return c.JSON(http.StatusOK, map[string]string{"token": token})
}

// POST /share/stop (ログイン必須): 共有を止める
func stopShareHandler(c echo.Context) error {
	folder, err := getUserSlidepass(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	shareMu.Lock()
	defer shareMu.Unlock()
	if s, ok := sharesByFolder[folder]; ok {
		stopShareLocked(s)
	}
	return c.NoContent(http.StatusNoContent)
}

// GET /shared/:token/pdf (ログイン不要): 共有中の PDF を返す
func sharedPdfHandler(c echo.Context) error {
	shareMu.Lock()
	s := findShareLocked(c.Param("token"))
	var full string
	if s != nil {
		full = filepath.Join("assets", "Slidepass", s.Folder, s.PdfName)
	}
	shareMu.Unlock()
	if s == nil {
		return c.String(http.StatusNotFound, "Not Found")
	}
	return c.File(full)
}

// 傾聴者に、いまのページを知らせる(shareMu を持った状態で呼ぶ)
func broadcastSharePageLocked(s *share) {
	msg, _ := json.Marshal(ReturnMessage{Type: "share_page", Status: 200, Data: strconv.Itoa(s.Page)})
	for ws := range s.audience {
		if err := ws.WriteMessage(websocket.TextMessage, msg); err != nil {
			delete(s.audience, ws)
			ws.Close()
		}
	}
}

// 発表者の Viewer からページの更新が届いたとき、その Viewer の共有の傾聴者に知らせる
func updateSharePage(viewerID string, page int) {
	if page < 1 {
		return
	}
	shareMu.Lock()
	defer shareMu.Unlock()
	for _, s := range sharesByFolder {
		if s.ViewerID == viewerID && s.Page != page {
			s.Page = page
			broadcastSharePageLocked(s)
		}
	}
}

// GET /ws/watch?token=... (ログイン不要): 傾聴者の WebSocket
func watchWsHandler(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}

	token := c.QueryParam("token")
	shareMu.Lock()
	s := findShareLocked(token)
	if s == nil {
		shareMu.Unlock()
		msg, _ := json.Marshal(ReturnMessage{Type: "share_ended", Status: 404})
		_ = ws.WriteMessage(websocket.TextMessage, msg)
		ws.Close()
		return nil
	}
	s.audience[ws] = true
	state, _ := json.Marshal(map[string]any{"page": s.Page, "pdf": s.PdfName})
	msg, _ := json.Marshal(ReturnMessage{Type: "share_state", Status: 200, Data: string(state)})
	_ = ws.WriteMessage(websocket.TextMessage, msg)
	notifyAudienceCountLocked(s)
	shareMu.Unlock()

	defer func() {
		shareMu.Lock()
		if _, ok := s.audience[ws]; ok {
			delete(s.audience, ws)
			notifyAudienceCountLocked(s)
		}
		shareMu.Unlock()
		ws.Close()
	}()

	// 傾聴者からのメッセージは使わない。切断を待つだけ
	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
	}
	return nil
}
