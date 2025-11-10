package repositories

import (
	"rimodeck/models"
	"rimodeck/utils"
)


func  CreateUser(username, password string) error {
	//uidを生成
	uid,err := utils.Genid()
	if err != nil {
		return err	
	}

	Create := models.Users{
		UserID: uid,
		Name:   username,
		Pass:   password,
		Slides: []models.Slides{},
	}

	if err := db.Create(&Create).Error; err != nil {
        return err // エラー処理を追加
    }

	return nil
}

var users_filter models.Users

func UserExists(username string,password string) (int64, error) {
	count := db.Where(models.Users{Name:username,Pass:password}).First(&users_filter).RowsAffected

	return count, nil
}
