package models

import "gorm.io/gorm"

type Note struct {
    gorm.Model // ID, CreatedAt, UpdatedAt, DeletedAt (論理削除用) が自動で追加されます
    PdfPath    string `gorm:"type:varchar(255);not null"` // PDFファイルのパス
    PageIndex  int    `gorm:"not null"`                   // スライドのページ番号
    Content    string `gorm:"type:text"`                  // ノートの内容
    // 複合ユニークキーを設定して、特定のPDFの特定ページにノートが1つだけ存在するようにする
    // Gormではタグで直接指定できないため、DBへの移行時に手動で設定するか、InitDB内で実行します。
}
