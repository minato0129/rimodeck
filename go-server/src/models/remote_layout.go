package models

import "time"

// スマホのリモート画面の配置(ユーザーごとに 1 件)。中身は JSON の文字列。
type RemoteLayout struct {
	ID        uint      `gorm:"primaryKey"`
	UserID    string    `gorm:"type:varchar(255);not null;uniqueIndex"`
	Data      string    `gorm:"type:text;not null"`
	UpdatedAt time.Time
}
