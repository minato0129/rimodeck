package models

import "gorm.io/gorm"

type Note struct {
    gorm.Model // ID, CreatedAt, UpdatedAt, DeletedAt (論理削除用) が自動で追加されます
    UserID     string `gorm:"type:varchar(255);not null"` // ユーザーID
    PdfPath    string `gorm:"type:varchar(255);not null"` // PDFファイルのパス
    PageIndex  int    `gorm:"not null"`                   // スライドのページ番号
    Content    string `gorm:"type:text"`                  // ノートの内容
}
