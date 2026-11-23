package main

// スライドのページに紐付ける動画。
// - 発表者がアップロードしてページに紐付ける・外す(ログイン必須)
// - 動画は Range リクエストに対応して配信する(シークや、iOS Safari での再生に必要)
// - 聞き手は共有リンクのトークンで、共有中の PDF の動画だけ見られる(ログイン不要)

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"rimodeck/controllers"
	"rimodeck/models"
	"rimodeck/repositories"

	"github.com/labstack/echo/v4"
)

const (
	maxVideoSize    = 500 * 1024 * 1024 // 動画1本の上限(nginx の client_max_body_size とそろえる)
	videoDirName    = "videos"
	maxVideoPageNum = 10000
)

// 受け付ける動画の拡張子(ブラウザの <video> で再生できるもの)
var videoExts = map[string]bool{".mp4": true, ".m4v": true, ".webm": true, ".mov": true}

func videoExt(filename string) (string, bool) {
	ext := strings.ToLower(filepath.Ext(filename))
	return ext, videoExts[ext]
}

// videoFilePath は、保存した動画の実ファイルパス(ファイル名だけを使い、フォルダの外には出さない)
func videoFilePath(folder, storedName string) string {
	return filepath.Join("assets", "Slidepass", folder, videoDirName, filepath.Base(storedName))
}

func newVideoStoredName(ext string) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b) + ext, nil
}

func removeVideoFile(folder, storedName string) {
	if storedName == "" {
		return
	}
	if err := os.Remove(videoFilePath(folder, storedName)); err != nil && !os.IsNotExist(err) {
		log.Printf("Failed to remove video file %s: %v", storedName, err)
	}
}

func jsonError(c echo.Context, status int, msg string) error {
	return c.JSON(status, map[string]string{"error": msg})
}

// POST /video (ログイン必須, multipart): pdf_path, page, video_file。そのページに動画を紐付ける(あれば差し替え)
func uploadVideoHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	pdfName, _, ok := sharePdfFile(user.Slidepass, c.FormValue("pdf_path"))
	if !ok {
		return jsonError(c, http.StatusNotFound, "PDFが見つかりません。")
	}
	page, err := strconv.Atoi(c.FormValue("page"))
	if err != nil || page < 1 || page > maxVideoPageNum {
		return jsonError(c, http.StatusBadRequest, "ページが正しくありません。")
	}

	file, err := c.FormFile("video_file")
	if err != nil {
		return jsonError(c, http.StatusBadRequest, "動画ファイルを選んでください。")
	}
	ext, ok := videoExt(file.Filename)
	if !ok {
		return jsonError(c, http.StatusBadRequest, "動画は mp4 / m4v / webm / mov のみアップロードできます。")
	}
	if file.Size > maxVideoSize {
		return jsonError(c, http.StatusRequestEntityTooLarge, "動画のサイズが500MBを超えています。")
	}

	src, err := file.Open()
	if err != nil {
		return jsonError(c, http.StatusInternalServerError, "ファイルを開けませんでした。")
	}
	defer src.Close()

	dir := filepath.Join("assets", "Slidepass", user.Slidepass, videoDirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return jsonError(c, http.StatusInternalServerError, "保存先を作れませんでした。")
	}
	storedName, err := newVideoStoredName(ext)
	if err != nil {
		return jsonError(c, http.StatusInternalServerError, "保存に失敗しました。")
	}
	dstPath := videoFilePath(user.Slidepass, storedName)
	dst, err := os.Create(dstPath)
	if err != nil {
		return jsonError(c, http.StatusInternalServerError, "保存に失敗しました。")
	}
	_, copyErr := io.Copy(dst, src)
	closeErr := dst.Close()
	if copyErr != nil || closeErr != nil {
		os.Remove(dstPath)
		return jsonError(c, http.StatusInternalServerError, "保存に失敗しました。")
	}

	video := &models.PageVideo{
		UserID:       user.UserID,
		PdfName:      pdfName,
		PageIndex:    page,
		StoredName:   storedName,
		OriginalName: filepath.Base(file.Filename),
	}
	previous, err := repositories.SavePageVideo(video)
	if err != nil {
		os.Remove(dstPath)
		log.Printf("Failed to save page video: %v", err)
		return jsonError(c, http.StatusInternalServerError, "保存に失敗しました。")
	}
	removeVideoFile(user.Slidepass, previous) // 差し替えた前の動画ファイルを消す

	saved, err := repositories.ListPageVideos(user.UserID, pdfName)
	if err != nil {
		return jsonError(c, http.StatusInternalServerError, "動画の一覧を取得できませんでした。")
	}
	return c.JSON(http.StatusOK, saved)
}

// GET /videos?pdf_path=... (ログイン必須): その PDF に紐付いた動画の一覧(ページ順)
func listVideosHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	pdfName := filepath.Base(c.QueryParam("pdf_path"))
	videos, err := repositories.ListPageVideos(user.UserID, pdfName)
	if err != nil {
		return jsonError(c, http.StatusInternalServerError, "動画の一覧を取得できませんでした。")
	}
	return c.JSON(http.StatusOK, videos)
}

type deleteVideoRequest struct {
	PdfPath string `json:"pdf_path"`
	Page    int    `json:"page"`
}

// POST /video/delete (ログイン必須): ページの動画の紐付けを外し、ファイルも消す
func deleteVideoHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	req := new(deleteVideoRequest)
	if err := c.Bind(req); err != nil {
		return jsonError(c, http.StatusBadRequest, "無効なリクエストです。")
	}
	stored, err := repositories.DeletePageVideo(user.UserID, filepath.Base(req.PdfPath), req.Page)
	if err != nil {
		if repositories.IsNotFound(err) {
			return jsonError(c, http.StatusNotFound, "動画が見つかりません。")
		}
		return jsonError(c, http.StatusInternalServerError, "削除に失敗しました。")
	}
	removeVideoFile(user.Slidepass, stored)
	return c.NoContent(http.StatusNoContent)
}

// GET /video/:id?pdf_path=... (ログイン必須): 動画を返す(Range 対応)
func serveVideoHandler(c echo.Context) error {
	user, err := controllers.Authenticate(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return c.String(http.StatusNotFound, "Not Found")
	}
	v, err := repositories.GetPageVideo(user.UserID, filepath.Base(c.QueryParam("pdf_path")), uint(id))
	if err != nil {
		return c.String(http.StatusNotFound, "Not Found")
	}
	return serveVideoFile(c, user.Slidepass, v)
}

// serveVideoFile は動画ファイルを返す。c.File は http.ServeContent を使うので、Range リクエストにも答える。
func serveVideoFile(c echo.Context, folder string, v *models.PageVideo) error {
	full := videoFilePath(folder, v.StoredName)
	if info, err := os.Stat(full); err != nil || info.IsDir() {
		return c.String(http.StatusNotFound, "Not Found")
	}
	c.Response().Header().Set("Cache-Control", "private, max-age=3600")
	return c.File(full)
}

// GET /shared/:token/videos (ログイン不要): 共有中の PDF に紐付いた動画の一覧
func sharedVideosHandler(c echo.Context) error {
	shareMu.Lock()
	s := findShareLocked(c.Param("token"))
	var userID, pdfName string
	if s != nil {
		userID, pdfName = s.UserID, s.PdfName
	}
	shareMu.Unlock()
	if s == nil {
		return c.String(http.StatusNotFound, "Not Found")
	}
	videos, err := repositories.ListPageVideos(userID, pdfName)
	if err != nil {
		return jsonError(c, http.StatusInternalServerError, "動画の一覧を取得できませんでした。")
	}
	return c.JSON(http.StatusOK, videos)
}

// GET /shared/:token/video/:id (ログイン不要): 共有中の PDF の動画を返す(Range 対応)
func sharedVideoHandler(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return c.String(http.StatusNotFound, "Not Found")
	}
	shareMu.Lock()
	s := findShareLocked(c.Param("token"))
	var userID, pdfName, folder string
	if s != nil {
		userID, pdfName, folder = s.UserID, s.PdfName, s.Folder
	}
	shareMu.Unlock()
	if s == nil {
		return c.String(http.StatusNotFound, "Not Found")
	}
	v, err := repositories.GetPageVideo(userID, pdfName, uint(id)) // 共有中の PDF の動画だけ
	if err != nil {
		return c.String(http.StatusNotFound, "Not Found")
	}
	return serveVideoFile(c, folder, v)
}

// PDF を削除したとき、その PDF の動画(紐付けとファイル)も消す。失敗しても PDF の削除は続ける。
func deleteVideosOfPdf(userID, folder, pdfName string) {
	stored, err := repositories.DeletePageVideosByPdf(userID, pdfName)
	if err != nil {
		log.Printf("Failed to delete videos for %s: %v", pdfName, err)
		return
	}
	for _, name := range stored {
		removeVideoFile(folder, name)
	}
}
