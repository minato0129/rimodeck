package models


type Users struct {
	UserID int `gorm:"primaryKey"` // userid
	Name   string
	Pass   string // パスワードは適切にハッシュ化して保存する必要があります
	// Userは複数のSlideを持つ
	Slides []Slides `gorm:"foreignKey:UserID"`
}

