package models

import "time"

type Slides struct {
	SlideID   string `gorm:"primaryKey"` // slideid
	UserID    string // 外部キー
	CreatedAt time.Time
	UpdatedAt time.Time
	User Users `gorm:"foreignKey:UserID"`
	Peages []Peages `gorm:"foreignKey:SlideID"`
}
