package models


type Users struct {
	UserID string `gorm:"primaryKey"` // userid
	Name   string
	Pass   string // パスワードはハッシュ化
	Slidepass string
}

