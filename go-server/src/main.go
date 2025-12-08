package main

import "rimodeck/repositories"

func main() {
	// 初期化
	// Init()

	// // サーバー起動
	// mainServer()

	//デバッグのみ
	Debug()

}

func mainServer(){
	// サーバー初期化
	InitServer()

}

func Debug() {
	repositories.Init()
	web_main()
	// tests.Test()
}

