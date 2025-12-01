package main

import (
	"fmt"
	"log"
	"os"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

func upload() {
	// --------------------------------------------------------------------------
	// ⚠️ 以下のファイルパスを環境に合わせて変更してください
	// --------------------------------------------------------------------------
	const inputPath = "./assets/a.pdf" // 入力PDFファイル名
	const outputPath = "./assets"   // 出力ディレクトリ名 (存在しない場合は作成されます)

	// 1. 出力ディレクトリが存在しない場合は作成
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		err = os.Mkdir(outputPath, 0755)
		if err != nil {
			log.Fatalf("エラー: 出力ディレクトリの作成に失敗しました: %v", err)
		}
	}

	// 2. Split関数を実行
	// nilのコンフィギュレーションを使用します (pdfcpu.DefaultConfiguration())
	err := api.SplitFile(inputPath, outputPath, 1, nil) // 1 はスパン（分割単位）= 1ページごとを意味します

	// 3. 結果の表示
	if err != nil {
		log.Fatalf("エラー: PDFファイルの分割に失敗しました: %v", err)
	}

	fmt.Printf("✅ 成功: \"%s\" を 1ページずつ \"%s\" ディレクトリに分割しました。\n", inputPath, outputPath)
}

// 注意: このコードを実行するには、カレントディレクトリに "input.pdf" が存在する必要があります。
