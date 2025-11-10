package repositories

import (
	"rimodeck/models"
	"rimodeck/utils"
)


func  CreateUser(username, password string) error {
	uid,err := utils.Genid()
	if err != nil {
		return err	
	}

	//パスワードをハッシュ化
	passwordHash, err := utils.EncryptPassword(password)
	if err != nil {
		return err
	}

	Create := models.Users{
		UserID: uid,
		Name:   username,
		Pass:   passwordHash,
		Slides: []models.Slides{},
	}

	if err := db.Create(&Create).Error; err != nil {
        return err // エラー処理を追加
    }

	return nil
}
