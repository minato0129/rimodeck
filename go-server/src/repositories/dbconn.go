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
	// データベースを開く
	dbconn, err := gorm.Open(postgres.Open(os.Getenv("DB_URL")), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database")
	}

	// グローバル変数に格納
	db = dbconn

	db.Migrator().DropTable(&models.Note{})
	db.AutoMigrate(&models.Note{})

	// データベースの中身をリセット
	db.Migrator().DropTable(&models.Users{})
	db.Migrator().DropTable(&models.Slides{})
	db.Migrator().DropTable(&models.Peages{})
	db.Migrator().DropTable(&models.Questions{})
	
	// マイグレーションを実行
	db.AutoMigrate(&models.Users{})
	db.AutoMigrate(&models.Slides{})
	db.AutoMigrate(&models.Peages{})
	db.AutoMigrate(&models.Questions{})
}
