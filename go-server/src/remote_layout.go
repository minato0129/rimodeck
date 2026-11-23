package main

// スマホのリモート画面の配置(ボタンの並び・大きさ・色)の保存。
// スマホはログインしていないので、QR に入っている Viewer ID から持ち主(ログイン中の PC のユーザー)を引く。
// 操作の安全性は、これまでの「Viewer ID を知っていれば操作できる」と同じ水準。

import (
	"encoding/json"
	"net/http"

	"rimodeck/controllers"
	"rimodeck/repositories"

	"github.com/labstack/echo/v4"
)

const (
	maxLayoutButtons = 12
	maxLayoutBytes   = 4096
)

// 配置に使える値。画面側(react-app/src/lib/remoteLayout.ts)と合わせる
var (
	layoutButtonIDs = map[string]bool{"prev": true, "next": true, "first": true, "last": true, "blank": true}
	layoutWidths    = map[string]bool{"half": true, "full": true}
	layoutHeights   = map[string]bool{"s": true, "m": true, "l": true}
	layoutColors    = map[string]bool{"white": true, "gray": true, "blue": true, "green": true, "red": true, "dark": true}
	layoutTextSizes = map[string]bool{"s": true, "m": true, "l": true}
)

type layoutButton struct {
	ID       string `json:"id"`
	Width    string `json:"width"`
	Height   string `json:"height"`
	Color    string `json:"color"`
	TextSize string `json:"textSize"`
}

type remoteLayout struct {
	Buttons []layoutButton `json:"buttons"`
}

// 配置が正しいか確かめる(ボタンの種類・値の範囲・重複・個数)
func validateLayout(l *remoteLayout) bool {
	if len(l.Buttons) > maxLayoutButtons {
		return false
	}
	seen := map[string]bool{}
	for _, b := range l.Buttons {
		if !layoutButtonIDs[b.ID] || seen[b.ID] {
			return false
		}
		seen[b.ID] = true
		if !layoutWidths[b.Width] || !layoutHeights[b.Height] || !layoutColors[b.Color] || !layoutTextSizes[b.TextSize] {
			return false
		}
	}
	return true
}

// Viewer ID の持ち主(ログイン中の PC のユーザー)。WebSocket をつないだときに記録する。mu で守る
var viewerOwners = make(map[string]string)

func ownerOfViewer(viewerID string) (string, bool) {
	mu.RLock()
	defer mu.RUnlock()
	owner, ok := viewerOwners[viewerID]
	return owner, ok && viewerID != ""
}

// GET /remote-layout?id=<Viewer ID>: 保存してある配置を返す。なければ layout が null
func getRemoteLayoutHandler(c echo.Context) error {
	owner, ok := ownerOfViewer(c.QueryParam("id"))
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "接続先が見つかりません。QRコードを読み取り直してください。"})
	}
	data, found, err := repositories.GetRemoteLayout(owner)
	if err != nil {
		c.Logger().Error("GetRemoteLayout failed: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "配置を読み込めませんでした。"})
	}
	if !found {
		return c.JSON(http.StatusOK, map[string]any{"layout": nil})
	}
	return c.JSON(http.StatusOK, map[string]json.RawMessage{"layout": json.RawMessage(data)})
}

// PUT /remote-layout?id=<Viewer ID>: 配置を保存する。DELETE なら初期状態に戻す
func saveRemoteLayoutHandler(c echo.Context) error {
	owner, ok := ownerOfViewer(c.QueryParam("id"))
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "接続先が見つかりません。QRコードを読み取り直してください。"})
	}
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, maxLayoutBytes)
	layout := new(remoteLayout)
	if err := json.NewDecoder(c.Request().Body).Decode(layout); err != nil || !validateLayout(layout) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "無効な配置です。"})
	}
	data, err := json.Marshal(layout)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "配置を保存できませんでした。"})
	}
	if err := repositories.SaveRemoteLayout(owner, string(data)); err != nil {
		c.Logger().Error("SaveRemoteLayout failed: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "配置を保存できませんでした。"})
	}
	return c.JSON(http.StatusOK, map[string]json.RawMessage{"layout": json.RawMessage(data)})
}

func resetRemoteLayoutHandler(c echo.Context) error {
	owner, ok := ownerOfViewer(c.QueryParam("id"))
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "接続先が見つかりません。QRコードを読み取り直してください。"})
	}
	if err := repositories.DeleteRemoteLayout(owner); err != nil {
		c.Logger().Error("DeleteRemoteLayout failed: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "配置を戻せませんでした。"})
	}
	return c.NoContent(http.StatusNoContent)
}

// WebSocket をつないだ PC がログイン中なら、その Viewer ID の持ち主として記録する
func recordViewerOwner(c echo.Context, viewerID string) {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return
	}
	mu.Lock()
	viewerOwners[viewerID] = user.UserID
	mu.Unlock()
}
