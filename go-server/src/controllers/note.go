package controllers

import (
	"net/http"
	"rimodeck/repositories"
	"strconv"

	"github.com/labstack/echo/v4"
)

type NoteRequest struct {
	PdfPath   string `json:"pdf_path"`
	PageIndex int    `json:"page_index"`
	Content   string `json:"content"`
}

func HandleNote(c echo.Context) error {
	// まずクッキーからユーザー名を取得
	username := ""
	cookie, err := c.Cookie("username")
	if err == nil {
		username = cookie.Value
	}

	// クッキーにない場合はヘッダーから取得
	if username == "" {
		username = c.Request().Header.Get("X-Username")
	}

	if username == "" {
		return c.JSON(http.StatusUnauthorized, "User not identified")
	}

	user, err := repositories.GetUserByName(username)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, "User not found")
	}

	if c.Request().Method == http.MethodPost {
		var req NoteRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, "Invalid request")
		}
		err := repositories.SaveNote(user.UserID, req.PdfPath, req.PageIndex, req.Content)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, "Failed to save note")
		}
		return c.JSON(http.StatusOK, "Note saved")
	} else {
		pdfPath := c.QueryParam("pdf_path")
		pageIndex, _ := strconv.Atoi(c.QueryParam("page_index"))
		
		note, err := repositories.GetNote(user.UserID, pdfPath, pageIndex)
		if err != nil {
			return c.JSON(http.StatusOK, map[string]string{"content": ""})
		}
		return c.JSON(http.StatusOK, map[string]string{"content": note.Content})
	}
}
