package services

import (
	"errors"
	"fmt"
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

// トークンが正しくない(改ざん・期限切れ・未登録など)ときのエラー
var ErrInvalidToken = errors.New("invalid token")

// トークンの署名と有効期限を確かめ、ユーザーID を取り出す(DB は見ない)
func parseToken(tokenString string) (string, error) {
	if tokenString == "" {
		return "", ErrInvalidToken
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		// 署名の方式は HS256 だけを受け付ける(alg を差し替えた偽造を防ぐ)
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(os.Getenv("SECRET_KEY")), nil
	})
	if err != nil || !token.Valid {
		return "", ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", ErrInvalidToken
	}
	// 有効期限(exp)のないトークンは受け付けない
	if !claims.VerifyExpiresAt(time.Now().Unix(), true) {
		return "", ErrInvalidToken
	}
	userID, ok := claims["user_id"].(string)
	if !ok || userID == "" {
		return "", ErrInvalidToken
	}
	return userID, nil
}

// トークンを検証して、ログイン中のユーザーを返す。
// 署名・有効期限が正しく、かつ発行時に DB へ登録されたトークンだけを受け付ける。
func AuthenticateToken(tokenString string) (models.Users, error) {
	userID, err := parseToken(tokenString)
	if err != nil {
		return models.Users{}, err
	}

	registered, err := repositories.TokenExists(tokenString)
	if err != nil {
		return models.Users{}, err
	}
	if !registered {
		return models.Users{}, ErrInvalidToken
	}

	user, err := repositories.GetUserByID(userID)
	if err != nil {
		return models.Users{}, ErrInvalidToken
	}
	return user, nil
}
