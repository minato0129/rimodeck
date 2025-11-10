package controllers

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type LoginData struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

//アカウント作成
func SignUp(ctx echo.Context) error {	
	data := LoginData{}

	if err := ctx.Bind(&data); err != nil {
		return ctx.String(http.StatusBadRequest, "Invalid input")
	}
	
	return ctx.String(http.StatusOK, "SignUp endpoint")
}
