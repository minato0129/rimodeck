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
// アクセストークンの発行は IssueToken が行う。
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

// アクセストークンの有効期間
const TokenLifetime = 12 * time.Hour

// 署名の鍵(SECRET_KEY)の最低文字数
const minSecretKeyLength = 32

// 起動時に呼び、署名の鍵が設定されていなければ止める。
// 鍵が空のまま署名すると、誰でもトークンを偽造できてしまうため。
func RequireSecretKey() {
	key := os.Getenv("SECRET_KEY")
	if len(key) < minSecretKeyLength {
		log.Fatalf("SECRET_KEY が未設定か短すぎます(%d 文字以上)。`openssl rand -hex 32` などで作った値を go-server/src/config/app.env に書いてください(README参照)", minSecretKeyLength)
	}
}

// ログインしたユーザーのアクセストークン(JWT)を発行する。戻り値は、トークンと有効期限。
func IssueToken(user models.Users) (string, time.Time, error) {
	return createToken(user.UserID, user.Name)
}

func createToken(userID string, username string) (string, time.Time, error) {
	expirationTime := time.Now().Add(TokenLifetime)

	// JWTのクレームを設定
	claims := jwt.MapClaims{
		"user_id":  userID,
		"username": username,
		"exp":      expirationTime.Unix(),
	}

	// トークンを作成して署名する
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(os.Getenv("SECRET_KEY")))
	if err != nil {
		return "", time.Time{}, err
	}

	// トークンをデータベースに保存
	if err := repositories.RegisterToken(tokenString, userID, expirationTime.Unix()); err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expirationTime, nil
}
