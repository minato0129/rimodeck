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
	// ログイン中のユーザーを確かめる(Cookie の token を検証)
	user, err := Authenticate(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, "Unauthorized")
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
