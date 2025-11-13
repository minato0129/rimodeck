package services

import (
	"rimodeck/models"
	"rimodeck/repositories"
)

func GetuserByName(username string) (models.Users, error) {
	// ユーザー名でユーザーを取得
	user, err := repositories.GetUserByName(username)
	if err != nil {
		return models.Users{}, err
	}
	return user, nil
}
