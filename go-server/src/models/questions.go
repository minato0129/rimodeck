package models

import "time"

// 傾聴者から発表者への質問。発表者が削除するまで残る(PDF ごとに保存)。
type Question struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"type:varchar(255);not null;index:idx_question_user_pdf" json:"-"` // 発表者のユーザーID
	PdfName   string    `gorm:"type:varchar(255);not null;index:idx_question_user_pdf" json:"-"` // PDF のファイル名(フォルダは含まない)
	PageIndex int       `gorm:"not null" json:"page"`                                            // どのスライドへの質問か
	Content   string    `gorm:"type:text;not null" json:"content"`
	Answered  bool      `gorm:"not null;default:false" json:"answered"`
	CreatedAt time.Time `json:"created_at"`
}
