package repositories

import (
	"rimodeck/models"
)

// トークン登録
func RegisterToken(tokenString string, userID string, exp int64) error {
	token := models.Tokens{
		Token:  tokenString,
		UserID: userID,
		Exp:    exp,
	}

	result := db.Create(&token)

	return result.Error
}

// 発行済み(登録済み)のトークンか
func TokenExists(tokenString string) (bool, error) {
	var count int64
	result := db.Model(&models.Tokens{}).Where("token = ?", tokenString).Count(&count)
	return count > 0, result.Error
}

// トークンを削除する(ログアウトで失効させる)。登録されていなくてもエラーにしない。
func DeleteToken(tokenString string) error {
	return db.Where("token = ?", tokenString).Delete(&models.Tokens{}).Error
}

// 有効期限(Unix 時間)を過ぎたトークンを削除する
func DeleteExpiredTokens(now int64) error {
	return db.Where("exp < ?", now).Delete(&models.Tokens{}).Error
}
