package controllers

import (
	"net/http"
	"rimodeck/services"
	"time"

	"github.com/labstack/echo/v4"
)

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

	// クッキーを設定
	cookie := new(http.Cookie)
	cookie.Name = "username"
	cookie.Value = user.Name
	cookie.Expires = time.Now().Add(24 * time.Hour) // 24時間有効
	cookie.Path = "/"
	cookie.HttpOnly = true // JavaScriptからアクセス不可にする（推奨）
	// cookie.Secure = true // HTTPS環境なら有効にする
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

	return ctx.JSON(http.StatusOK, "Logout successful")
}
