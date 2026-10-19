package repositories

import (
	"log"
	"os"
	"rimodeck/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	db *gorm.DB = nil
)

func Init() {
	// 接続先は環境変数 DB_URL で指定する(config/app.env、README参照)
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		log.Fatal("DB_URL が設定されていません。config/app.env を作成し、docker compose で go-server を作り直してください(README参照)")
	}

	// データベースを開く
	dbconn, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	// グローバル変数に格納
	db = dbconn

	// db.Migrator().DropTable(&models.Note{})
	db.AutoMigrate(&models.Note{})

	// データベースの中身をリセット
	// db.Migrator().DropTable(&models.Users{})
	
	// マイグレーションを実行
	db.AutoMigrate(&models.Users{})

}
