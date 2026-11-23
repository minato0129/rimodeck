package models

import "time"

// スライドのあるページに紐付けた動画。1ページにつき1本(上書きすると差し替わる)。
// 動画ファイルは assets/Slidepass/<フォルダ>/videos/ に、サーバーが付けた名前で保存する。
type PageVideo struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       string    `gorm:"type:varchar(255);not null;uniqueIndex:idx_video_user_pdf_page" json:"-"` // 発表者のユーザーID
	PdfName      string    `gorm:"type:varchar(255);not null;uniqueIndex:idx_video_user_pdf_page" json:"-"` // PDF のファイル名(フォルダは含まない)
	PageIndex    int       `gorm:"not null;uniqueIndex:idx_video_user_pdf_page" json:"page"`                // 動画を流すスライドのページ番号
	StoredName   string    `gorm:"type:varchar(255);not null" json:"-"`                                     // 保存したファイル名(ランダム + 拡張子)
	OriginalName string    `gorm:"type:varchar(255);not null" json:"name"`                                  // アップロード時のファイル名(画面に表示する)
	CreatedAt    time.Time `json:"created_at"`
}
