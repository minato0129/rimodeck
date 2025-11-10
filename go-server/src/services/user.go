package services

import (
	"errors"
	"rimodeck/repositories"
	"rimodeck/utils"
)

func CreateUser(username, password string) error {
	// ユーザー作成のロジックをここに実装
	if username == "" || password == "" {	
		return errors.New("username and password cannot be empty")
	}
	// すでにユーザーが存在するか確認
	count, err := repositories.UserExists(username,password)
	if err != nil {
		return err
	}

	if count != 0 {
		return errors.New("user already exists")
	}

	//パスワードをハッシュ化
	passwordHash, err := utils.EncryptPassword(password)
	if err != nil {
		return err
	}
	
	// ユーザーを作成
	err = repositories.CreateUser(username,passwordHash)
	if err != nil {
		return err
	}

	return nil
}
