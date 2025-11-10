package services
import (
	"errors"
)

func CreateUser(username, password string) error {
	// ユーザー作成のロジックをここに実装
	if username == "" || password == "" {	
		return errors.New("username and password cannot be empty")
	}	
		
	return nil
}
