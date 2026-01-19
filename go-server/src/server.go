package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	// NOTE: utils.Genid() は、一意のIDを生成する関数として仮定します。
	"rimodeck/utils"
	"rimodeck/controllers"
	"rimodeck/repositories"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	db *gorm.DB
)

// アクティブなWebSocket接続をViewer ID (文字列) にマップします
var wsMap = make(map[string]*websocket.Conn)

// クライアント(Remote)から受信するJSONメッセージの構造
type Message struct {
	Type string `json:"type"` // "user_message"
	Id   string `json:"id"`   // ターゲットのViewer ID
	Data string `json:"data"` // "next", "prev", "fullscreen"
}

// クライアント(Viewer/Remote)へ送信するJSONメッセージの構造
type ReturnMessage struct {
	Type   string `json:"type"`   // "remote_control" または "error"
	Status int    `json:"status"` // HTTPステータスコードを模倣 (200, 404など)
	Data   string `json:"data"`   // コマンド ('next', 'prev', 'fullscreen') またはエラー詳細
}

// WebSocketハンドラ
func hello(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}

	// utils.Genid()を使用して一意のIDを生成 (Viewer ID)
	uid, err := utils.Genid()
	if err != nil {
		c.Logger().Error("Failed to generate ID: ", err)
		ws.Close()
		return err
	}
	
	// マップに接続を格納 (Viewer IDがキー)
	wsMap[uid] = ws
	log.Printf("New connection established. UID: %s. Total connections: %d\n", uid, len(wsMap))


	// 接続時に一意のID (Viewer ID) をクライアントに送信 (Viewer側がRemote URLを生成するために使用)
	err = ws.WriteMessage(websocket.TextMessage, []byte(uid))
	if err != nil {
		c.Logger().Error("Failed to send UID: ", err)
	}

	defer func() {
		// defer関数で接続が終了したらマップから削除し、WebSocketを閉じる
		delete(wsMap, uid)
		ws.Close()
		log.Printf("UID %s disconnected. Active connections: %d\n", uid, len(wsMap))
	}()

	for {
		// Read
		_, msg, err := ws.ReadMessage()
		if err != nil {
			// 接続切断などのエラーは無視してループを抜ける
			break 
		}

		var receivedMsg Message

		// JSON形式のメッセージをパース
		if err := json.Unmarshal(msg, &receivedMsg); err != nil {
			// JSONパースエラーの場合、メッセージをスキップしループを続行
			c.Logger().Warn("JSON Unmarshal failed, ignoring non-JSON or malformed message: ", string(msg))
			continue 
		}

		log.Println("Received Message -> Type:", receivedMsg.Type, "Id:", receivedMsg.Id, "Data:", receivedMsg.Data)

		// Remoteからの操作メッセージ ("user_message") を処理
		if receivedMsg.Type == "user_message" && receivedMsg.Id != "" {
			if sendWs, ok := wsMap[receivedMsg.Id]; ok {
				// ターゲットのViewerにメッセージを転送 (Remote Control Commandとして)
				responseMessage := ReturnMessage{
					Type:   "remote_control", // Viewer側のJSで処理しやすいTypeに変更
					Status: 200,
					// Dataは'next', 'prev', または 'fullscreen'
					Data: receivedMsg.Data, 
				}

				responseJSON, err := json.Marshal(responseMessage)
				if err != nil {
					c.Logger().Error("JSON Marshal failed for response: ", err)
					continue
				} 
				
				// Viewerにコマンドを送信
				err = sendWs.WriteMessage(websocket.TextMessage, []byte(responseJSON))
				if err != nil {
					c.Logger().Error("Write to Viewer failed: ", err)
					// Viewerへの書き込み失敗は接続切れの可能性が高いため、以降のメッセージを処理しない
					// ただし、このエラーは次回のws.ReadMessage()で検出されるため、ここでは何もしない
				}
			} else {
				// ターゲットのViewerが見つからない場合、Remoteへエラーを返す
				responseMessage := ReturnMessage{
					Type:   "error",
					Status: 404,
					Data: "接続先が見つかりません。\n QRコードを生成し読み取ってください。",
				}
				responseJSON, err := json.Marshal(responseMessage)
				if err != nil {
					c.Logger().Error("JSON Marshal failed for error response: ", err)
					continue
				}
				// Remoteにエラーを送信
				if err := ws.WriteMessage(websocket.TextMessage, []byte(responseJSON)); err != nil {
					c.Logger().Error("Write error response to Remote failed: ", err)
				}
			}
		} 
	}
	return nil
}

// ユーザーのSlidepass（UUIDフォルダ名）を取得するヘルパー
func getUserSlidepass(c echo.Context) (string, error) {
	// 本来はセッションやJWTから取得すべきですが、
	// 現状の構成に合わせてヘッダーの X-Username から取得するようにします
	username := c.Request().Header.Get("X-Username")
	if username == "" {
		return "", fmt.Errorf("user not identified")
	}

	user, err := repositories.GetUserByName(username)
	if err != nil {
		return "", err
	}
	if user.Slidepass == "" {
		return "", fmt.Errorf("slidepass not set for user")
	}
	return user.Slidepass, nil
}

// アップロード処理を行うハンドラ
func handleUpload(c echo.Context) error {
	slideFolder, err := getUserSlidepass(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}

    // 1. ファイルを受け取る
    file, err := c.FormFile("pdf_file") // start.htmlで定義するフィールド名
    if err != nil {
        return c.String(http.StatusBadRequest, fmt.Sprintf("ファイル取得エラー: %v", err))
    }

    // 2. 拡張子のチェック (簡易的なセキュリティ)
    if filepath.Ext(file.Filename) != ".pdf" && filepath.Ext(file.Filename) != ".PDF" {
        return c.String(http.StatusBadRequest, "PDFファイルのみアップロード可能です。")
    }
    
    // 3. ファイルサイズの制限 (例: 50MB)
    // Echoのデフォルトは32MBですが、ここで明示的に制限することも可能です
    const maxFileSize = 50 * 1024 * 1024 // 50MB
    if file.Size > maxFileSize {
        return c.String(http.StatusRequestEntityTooLarge, "ファイルサイズが50MBを超えています。")
    }

    // 4. ファイルを開く
    src, err := file.Open()
    if err != nil {
        return c.String(http.StatusInternalServerError, fmt.Sprintf("ファイルオープンエラー: %v", err))
    }
    defer src.Close()

    // 5. 保存先のパスを決定し、ファイルを保存する
    // 保存先のフォルダがassets/Slidepass/{UUID}であることを確認
    dstPath := filepath.Join("assets", "Slidepass", slideFolder, file.Filename)
    
    // 同名ファイルが存在する場合の上書き防止やリネーム処理は省略します
    
    dst, err := os.Create(dstPath)
    if err != nil {
        return c.String(http.StatusInternalServerError, fmt.Sprintf("ファイル作成エラー: %v", err))
    }
    defer dst.Close()

    // 6. データをコピー
    if _, err = io.Copy(dst, src); err != nil {
        return c.String(http.StatusInternalServerError, fmt.Sprintf("データコピーエラー: %v", err))
    }

    // 成功レスポンス
    log.Printf("Successfully uploaded file: %s to %s", file.Filename, slideFolder)
    return c.String(http.StatusOK, "アップロードが完了しました。")
}


// PDFファイルをスキャンしてリストを返す関数
func getPdfList(c echo.Context) error {
	slideFolder, err := getUserSlidepass(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}

	dir := filepath.Join("assets", "Slidepass", slideFolder)
	files, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("Error reading Slidepass directory: %v", err)
		return c.String(http.StatusInternalServerError, "Failed to read PDF directory")
	}

	var pdfFiles []string
	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".pdf" {
			// パスをクライアント向けに /assets/filename.pdf の形式で返す
			// フロントエンド側で /assets/ 以下のルーティングが動くように調整
			pdfFiles = append(pdfFiles, "/assets/" + file.Name())
		}
	}

	// JSON形式でクライアントに返す
	return c.JSON(http.StatusOK, pdfFiles)
}

// PDFファイルを削除するハンドラ
func deletePdfHandler(c echo.Context) error {
	slideFolder, err := getUserSlidepass(c)
	if err != nil {
		return c.String(http.StatusUnauthorized, "Unauthorized")
	}

    // クライアントから送信されるJSONの構造
    type DeleteRequest struct {
        PdfPath string `json:"pdf_path"` // 例: /assets/my_presentation.pdf
    }

    reqData := new(DeleteRequest)
    // 1. JSONボディをパース
    if err := c.Bind(reqData); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "無効なリクエストフォーマットです。"})
    }

    pdfPath := reqData.PdfPath

    if pdfPath == "" {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "PDFパスが指定されていません。"})
    }

    // 2. セキュリティ対策: パスからファイル名のみを抽出し、ユーザー専用フォルダ内のパスを構築する
    fileName := filepath.Base(pdfPath)
    fullPath := filepath.Join("assets", "Slidepass", slideFolder, fileName)
    
    // 3. ファイルの存在確認
    if _, err := os.Stat(fullPath); os.IsNotExist(err) {
        log.Printf("Deletion attempt failed: File not found at %s", fullPath)
        return c.JSON(http.StatusNotFound, map[string]string{"error": "削除対象のファイルが見つかりません。"})
    }

    // 4. ファイルを削除
    if err := os.Remove(fullPath); err != nil {
        log.Printf("Failed to delete file %s: %v", fullPath, err)
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("ファイルの削除に失敗しました: %v", err)})
    }

    log.Printf("Successfully deleted file: %s", fullPath)
    return c.JSON(http.StatusOK, map[string]string{"message": "ファイルは正常に削除されました。"})
}

func Dbconn() {
	// データベースを開く
	dbconn, err := gorm.Open(postgres.Open(os.Getenv("DB_URL")), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database")
	}

	// グローバル変数に格納
	db = dbconn
}

// メインウェブサーバー設定
func web_main() {
	// assets/Slidepassディレクトリを作成
	if err := os.MkdirAll(filepath.Join("assets", "Slidepass"), 0755); err != nil {
		log.Fatalf("Failed to create Slidepass directory: %v", err)
	}

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// Init()

    // 1. 個別のファイルルートを先に定義 (優先順位を上げる)
	
	// Viewer (index.html) をトップページとして提供	
	e.File("/", "index.html")

    // 2. 従来のプレゼン画面 (index.html) を "/viewer" パスに移動する
    e.File("/viewer", "slide.html")

	// ログイン画面
	e.File("/login", "login.html")

	// 新規登録画面
	e.File("/signup", "signup.html")
	
	// Remote (phone.html) を /remote パスで提供
	e.File("/remote", "phone.html")

	// 2. 静的ファイルを提供 (上記のパスにマッチしなかった場合)
	// 実際には、このディレクトリパスは実行環境に合わせて調整してください
	e.Static("/", "../public") 
	
	// PDFファイルを /assets パスで提供 (PDFのみに制限)
	
	// PDFファイルを /assets パスで提供 (PDFのみに制限、ユーザー専用フォルダから提供)
	e.GET("/assets/*", func(c echo.Context) error {
		slideFolder, err := getUserSlidepass(c)
		if err != nil {
			return c.String(http.StatusUnauthorized, "Unauthorized")
		}

		path := c.Param("*")
		if !strings.HasSuffix(strings.ToLower(path), ".pdf") {
			return c.String(http.StatusForbidden, "Only PDF files are accessible")
		}
		// ユーザー専用フォルダ内のファイルを取得
		return c.File(filepath.Join("assets", "Slidepass", slideFolder, path))
	})
	
	//PDF一覧を取得するための新しいエンドポイント
    e.GET("/pdfs", getPdfList)

	//PDFアップロードのエンドポイント
    e.POST("/upload", handleUpload)

	//PDF削除のエンドポイントを追加
    e.POST("/delete-pdf", deletePdfHandler)

	// 認証エンドポイント
	e.POST("/signup", controllers.SignUp)
	e.POST("/login", controllers.Login)

	// ノート管理のエンドポイントを登録
    e.Match([]string{http.MethodGet, http.MethodPost}, "/note", controllers.HandleNote)

	e.GET("/ws", hello)
	e.Logger.Fatal(e.Start("0.0.0.0:1323"))
}
