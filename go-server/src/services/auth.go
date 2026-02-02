package services

import (
	"errors"
	"log"
	"rimodeck/repositories"
	"rimodeck/utils"
	"rimodeck/models"
	"golang.org/x/crypto/bcrypt"
)

// ユーザー作成
func CreateUser(username, password, slidepass string) error {
	// ユーザー作成のロジックをここに実装
	if username == "" || password == "" {
		return errors.New("username and password cannot be empty")
	}

	//パスワードをハッシュ化
	passwordHash, err := utils.EncryptPassword(password)
	if err != nil {
		return err
	}
	
	// すでに同じ名前のユーザーが存在するか確認
	count, err := repositories.UserExists(username)
	if err != nil {
		return err
	}

	if count != 0 {
		return errors.New("user already exists")
	}

	// ユーザーを作成
	err = repositories.CreateUser(username, passwordHash, slidepass)
	if err != nil {
		return err
	}
	log.Println("User created:", username)
	log.Println("passwordHash:", passwordHash)

	return nil
}

// ログイン
func LoginUser(username, password string) (models.Users, error) {

	user,err := repositories.GetUserByName(username)
	if err != nil {
		return models.Users{}, err
	}
	// パスワード検証
	err = valid_pass([]byte(password), user.Pass)
	if err != nil {
		return models.Users{}, err
	}

	
	return user, nil
}

// パスワード検証
func valid_pass(password []byte, hashpass string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashpass), password)
}
