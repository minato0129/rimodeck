package controllers

import (
	"net/http"
	"rimodeck/services"
	"github.com/labstack/echo/v4"
)

func UploadFile(ctx echo.Context) error {
	// ファイルを取得
	file, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(http.StatusBadRequest, "File not found")
	}
	// サービス層のアップロード関数を呼び出し
	err = services.UploadFileService(file)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, err.Error())
	}
	return ctx.JSON(http.StatusOK, "File uploaded successfully")
}
