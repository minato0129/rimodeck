package models

import "time"

type Questions struct {
	QuestionID string `gorm:"primaryKey"` // questionid
	Txt        string // 質問テキスト
	PageID     string // peageのIDを参照すると想定
	CreatedAt  time.Time
	Peage Peages `gorm:"foreignKey:PageID"`
}
