package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func okButton(id string) layoutButton {
	return layoutButton{ID: id, Width: "half", Height: "l", Color: "white", TextSize: "m"}
}

func TestValidateLayout(t *testing.T) {
	bad := okButton("prev")
	bad.Color = "pink"
	tooMany := &remoteLayout{}
	for i := 0; i < maxLayoutButtons+1; i++ {
		tooMany.Buttons = append(tooMany.Buttons, okButton("prev"))
	}

	cases := []struct {
		name   string
		layout *remoteLayout
		want   bool
	}{
		{"空(ボタンを全部消した)", &remoteLayout{}, true},
		{"前と次", &remoteLayout{Buttons: []layoutButton{okButton("prev"), okButton("next")}}, true},
		{"知らないボタン", &remoteLayout{Buttons: []layoutButton{okButton("fullscreen")}}, false},
		{"同じボタンが 2 つ", &remoteLayout{Buttons: []layoutButton{okButton("prev"), okButton("prev")}}, false},
		{"色がパレットに無い", &remoteLayout{Buttons: []layoutButton{bad}}, false},
		{"ボタンが多すぎる", tooMany, false},
	}
	for _, c := range cases {
		if got := validateLayout(c.layout); got != c.want {
			t.Errorf("%s: validateLayout = %v, want %v", c.name, got, c.want)
		}
	}
}

// 持ち主の分からない(PC がつながっていない) ID では、DB に触らず 404 になる
func TestRemoteLayoutUnknownViewer(t *testing.T) {
	e := echo.New()
	e.GET("/remote-layout", getRemoteLayoutHandler)
	e.PUT("/remote-layout", saveRemoteLayoutHandler)
	e.DELETE("/remote-layout", resetRemoteLayoutHandler)

	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		req := httptest.NewRequest(method, "/remote-layout?id=nope", strings.NewReader(`{"buttons":[]}`))
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want %d", method, rec.Code, http.StatusNotFound)
		}
	}
}
