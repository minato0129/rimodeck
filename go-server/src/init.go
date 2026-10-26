package main

import (
	"rimodeck/repositories"
	"rimodeck/services"
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

	// アクセストークンの署名に使う SECRET_KEY が設定されているか確認(なければ止める)
	services.RequireSecretKey()

	//データベース接続、マイグレーション
	repositories.Init()

}

