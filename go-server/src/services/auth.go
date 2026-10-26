package services

import (
	"errors"
	"log"
	"os"
	"rimodeck/repositories"
	"rimodeck/utils"
	"rimodeck/models"
	"time"

	"github.com/golang-jwt/jwt"
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
// 認証に成功したユーザーを返す。ログイン状態は呼び出し側(controllers.Login)が Cookie で保持する。
// アクセストークン(createToken)は dev 側で追加された JWT の仕組みで、まだログイン処理には組み込んでいない。
func LoginUser(username, password string) (models.Users, error) {
	// ユーザー取得
	user, err := repositories.GetUserByName(username)
	if err != nil {
		return models.Users{}, err
	}

	// パスワード検証
	if err := valid_pass([]byte(password), user.Pass); err != nil {
		return models.Users{}, err
	}

	return user, nil
}

// パスワード検証
func valid_pass(password []byte, hashpass string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashpass), password)
}

func createToken(userID string, username string) (string, error) {
	
	// トークンの有効期限を設定（例: 12時間）
	expirationTime := time.Now().Add(12 * time.Hour)

	// JWTのクレームを設定
	claims := jwt.MapClaims{
		"user_id":  userID,
		"username": username,
		"exp":      expirationTime.Unix(),
	}

	// トークンを作成
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	secretKey := []byte(os.Getenv("SECRET_KEY")) // 秘密鍵を設定（環境変数などで管理することを推奨）

	// トークンに署名を付与
	tokenString, err := token.SignedString(secretKey)
	if err != nil {
		return "", err
	}

	// トークンをデータベースに保存
	err = repositories.RegisterToken(tokenString, userID, expirationTime.Unix())
	if err != nil {
		return "", err
	}

	return tokenString, nil
}
