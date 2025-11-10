package main

import (
	"net/http"
	"os"
	"rimodeck/controllers"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func InitServer() {
	// サーバー作成
	server := echo.New()

	// ミドルウェア
	server.Use(middleware.Logger())
	server.Use(middleware.Recover())

	server.POST("/", func(ctx echo.Context) error {
		return ctx.String(http.StatusOK, "Hello, World!")
	})

	server.POST("/sinup",controllers.SignUp)

	// サーバー起動
	server.Logger.Fatal(server.Start(os.Getenv("GO_URL")))

}
