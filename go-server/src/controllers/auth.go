package controllers

import (
	"log"
	"net/http"
	"rimodeck/models"
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

	return ctx.JSON(http.StatusOK, map[string]string{
		"message":  "Login successful",
		"username": user.Name,
	})
}

// ログアウト
func Logout(ctx echo.Context) error {
	// サーバー側でもトークンを失効させる(Cookie を消すだけだと、控えておいたトークンが期限まで使える)
	var revokeErr error
	if tokenCookie, err := ctx.Cookie(TokenCookieName); err == nil && tokenCookie.Value != "" {
		revokeErr = services.RevokeToken(tokenCookie.Value)
		if revokeErr != nil {
			log.Printf("failed to revoke token: %v", revokeErr)
		}
	}

	// 以前のログインで残っているかもしれない username の Cookie も消す
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

	if revokeErr != nil {
		return ctx.JSON(http.StatusInternalServerError, "Failed to revoke token")
	}
	return ctx.JSON(http.StatusOK, "Logout successful")
}

// リクエストの Cookie(token)を検証して、ログイン中のユーザーを返す。
// 失敗したら (空のユーザー, エラー)。呼び出し側は 401 を返す。
func Authenticate(ctx echo.Context) (models.Users, error) {
	cookie, err := ctx.Cookie(TokenCookieName)
	if err != nil {
		return models.Users{}, services.ErrInvalidToken
	}
	return services.AuthenticateToken(cookie.Value)
}
