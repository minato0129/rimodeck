package controllers

import (
	"net/http"
	"rimodeck/services"

	"github.com/labstack/echo/v4"
)

type UserData struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// アカウント作成
func SignUp(ctx echo.Context) error {
	CreateData := UserData{}

	if err := ctx.Bind(&CreateData); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid input")
	}

	err := services.CreateUser(CreateData.Username, CreateData.Password)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, err.Error())
	}

	return ctx.JSON(http.StatusOK, "SignUp endpoint")
}

// ログイン
func Login(ctx echo.Context) error {
	LoginData := UserData{}

	if err := ctx.Bind(&LoginData); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid input")
	}

	err := services.LoginUser(LoginData.Username, LoginData.Password)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, err.Error())
	}

	return ctx.JSON(http.StatusOK, "Login endpoint")
}
