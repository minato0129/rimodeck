package main

import (
	"log"
	models "rimodeck/repositories"

	"github.com/joho/godotenv"
)

// .envを呼び出します。
func loadEnv() {
	// .envファイル全体を読み込み
	err := godotenv.Load(".env")

	// エラーの場合
	if err != nil {
		log.Fatalf("読み込み出来ませんでした: %v", err)
	}
}

func Init() {
	//ENV を読み込み
	loadEnv()
	//データベース接続、マイグレーション
	models.Init()
	
}

