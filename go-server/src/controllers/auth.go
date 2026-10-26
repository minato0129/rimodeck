package controllers

import (
	"net/http"
	"rimodeck/services"
	"time"

	"github.com/labstack/echo/v4"
)

// アクセストークン(JWT)を入れる Cookie の名前
const TokenCookieName = "token"

type UserData struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	Slidepass string `json:"slidepass"`
}

// アカウント作成
func SignUp(ctx echo.Context) error {
	CreateData := UserData{}

	if err := ctx.Bind(&CreateData); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid input")
	}

	err := services.CreateUser(CreateData.Username, CreateData.Password, CreateData.Slidepass)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, err.Error())
	}

	return ctx.JSON(http.StatusOK, "SignUp successful")
}

// ログイン
func Login(ctx echo.Context) error {
	LoginData := UserData{}

	if err := ctx.Bind(&LoginData); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid input")
	}

	user, err := services.LoginUser(LoginData.Username, LoginData.Password)
	if err != nil {
		return ctx.JSON(http.StatusUnauthorized, "Invalid username or password")
	}

	// アクセストークン(JWT)を発行して Cookie に入れる
	token, expires, err := services.IssueToken(user)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, "Failed to issue token")
	}
	ctx.SetCookie(&http.Cookie{
		Name:     TokenCookieName,
		Value:    token,
		Expires:  expires,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		// 本番環境がHTTPSの場合は Secure: true にするのが望ましい
	})

	// クッキーを設定(従来のユーザー名。次のブランチで JWT の検証に切り替えたあと廃止する)
	cookie := new(http.Cookie)
	cookie.Name = "username"
	cookie.Value = user.Name
	cookie.Expires = time.Now().Add(24 * time.Hour)
	cookie.Path = "/"
	cookie.HttpOnly = true
	cookie.SameSite = http.SameSiteLaxMode // 同一ドメイン内での遷移で確実に送信
	// 本番環境がHTTPSの場合は以下を有効にするのが望ましい
	// cookie.Secure = true 
	ctx.SetCookie(cookie)

	return ctx.JSON(http.StatusOK, map[string]string{
		"message":  "Login successful",
		"username": user.Name,
	})
}

// ログアウト
func Logout(ctx echo.Context) error {
	cookie := new(http.Cookie)
	cookie.Name = "username"
	cookie.Value = ""
	cookie.Expires = time.Now().Add(-1 * time.Hour) // 過去の時間を設定して削除
	cookie.Path = "/"
	ctx.SetCookie(cookie)

	// アクセストークンの Cookie も消す
	ctx.SetCookie(&http.Cookie{
		Name:     TokenCookieName,
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	return ctx.JSON(http.StatusOK, "Logout successful")
}
