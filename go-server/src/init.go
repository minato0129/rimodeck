package main

import (
	"rimodeck/repositories"
)


func Init() {
	//データベース接続、マイグレーション
	repositories.Init()
}

