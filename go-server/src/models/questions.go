package models

import "time"

type Questions struct {
	QuestionID uint `gorm:"primaryKey"` // questionid
	Txt        string // 質問テキスト
	PageID     uint // peageのIDを参照すると想定 (ご提示の構成より)
	CreatedAt  time.Time

	// Questionは1つのPeageに属する
	Peage Peages `gorm:"foreignKey:PageID"`
}
