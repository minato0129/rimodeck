package controllers

import (
	"net/http"
	"rimodeck/services"

	"github.com/labstack/echo/v4"
)

type LoginData struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

//アカウント作成
func SignUp(ctx echo.Context) error {	
	LoginData := LoginData{}

	if err := ctx.Bind(&LoginData); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid input")
	}

	err := services.CreateUser(LoginData.Username,LoginData.Password)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, err.Error())
	}

	return ctx.JSON(http.StatusOK, "SignUp endpoint")
}

func SignIn(ctx echo.Context) error {

	return ctx.JSON(http.StatusOK, "SignIn endpoint")
}
