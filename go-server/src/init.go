package main

import (
	"rimodeck/repositories"
)

// // .envを呼び出します。
// func loadEnv() {
// 	// .envファイル全体を読み込み
// 	err := godotenv.Load(".env")

// 	// エラーの場合
// 	if err != nil {
// 		log.Fatalf("読み込み出来ませんでした: %v", err)
// 	}
// }

func Init() {

	//データベース接続、マイグレーション
	repositories.Init()
	
}

