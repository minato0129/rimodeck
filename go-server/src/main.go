package main

import "rimodeck/tests"

func main() {
	// 初期化
	Init()

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
	upload() 
	tests.Test()
}

