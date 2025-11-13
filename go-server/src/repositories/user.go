package repositories

import (
	"rimodeck/models"
	"rimodeck/utils"
)

// ユーザー作成
func CreateUser(username, password string) error {
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

// ユーザー存在確認
func UserExists(username string) (int64, error) {
	count := db.Where(models.Users{Name:username}).First(&users_filter).RowsAffected

	return count, nil
}

// ユーザー名を元にユーザー取得
func GetUserByName(username string) (models.Users, error) {
	var user models.Users
	result := db.Where("name = ?", username).First(&user)
	if result.Error != nil {
		return models.Users{}, result.Error
	}
	return user, nil
}
