package main

import (
	"encoding/json"
	"log"
	"net/http"
	"rimodeck/utils"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

var wsMap = make(map[string]*websocket.Conn)

type Message struct {
	Type string `json:"type"`
	Id   string `json:"id"`
	Data string `json:"data"`
}

type ReturnMessage struct {
	Type string `json:"type"`
	Status int `json:"status"`
	Data string `json:"data"`
}

func hello(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	uid, err := utils.Genid()
	wsMap[uid] = ws

	if err != nil {
		c.Logger().Error("JSON Marshal failed: ", err)
		return err
	}

	//接続時
	err = ws.WriteMessage(websocket.TextMessage, []byte(uid))
	if err != nil {
		c.Logger().Error(err)
	}

	defer func() {
		ws.Close()
		log.Printf("UID",uid, len(wsMap))
	}()

	for {

		// Read
		_, msg, err := ws.ReadMessage()
		if err != nil {
			// c.Logger().Error(err)
		}

		var receivedMsg Message

		json.Unmarshal(msg, &receivedMsg)

		// log.Println("Type", receivedMsg.Type)
		// log.Println("Id", receivedMsg.Id)
		// log.Println("data", receivedMsg.Data)

		if string(msg) != "" {
			if sendWs, ok := wsMap[receivedMsg.Id]; ok {
				responseMessage := ReturnMessage{
					Type:    "found",
					Status:  200,
					Data: receivedMsg.Data,
				}

				responseJSON, err := json.Marshal(responseMessage)
				if err != nil {
					c.Logger().Error("JSON Marshal failed for response: ", err)
					continue
				}	
			err = sendWs.WriteMessage(websocket.TextMessage, []byte(responseJSON))
			
			}else {
			
				responseMessage := ReturnMessage{
					Type:    "error",
					Status:  404,
					Data: "ユーザーが見つかりません",
				}
				responseJSON, err := json.Marshal(responseMessage)
				if err != nil {
					c.Logger().Error("JSON Marshal failed for response: ", err)
					continue
				}
				err = ws.WriteMessage(websocket.TextMessage, []byte(responseJSON))
			}
		}
	}
}

func web_main() {
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Static("/", "../public")
	e.GET("/ws", hello)
	e.Logger.Fatal(e.Start("127.0.0.1:1323"))
}
