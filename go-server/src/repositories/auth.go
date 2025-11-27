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
