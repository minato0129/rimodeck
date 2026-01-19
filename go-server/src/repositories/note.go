package repositories

import (
	"rimodeck/models"
)

// ノートの保存または更新
func SaveNote(userID, pdfPath string, pageIndex int, content string) error {
	var note models.Note
	// 既存のノートがあるか確認
	result := db.Where("user_id = ? AND pdf_path = ? AND page_index = ?", userID, pdfPath, pageIndex).First(&note)

	if result.Error == nil {
		// 更新
		note.Content = content
		return db.Save(&note).Error
	} else {
		// 新規作成
		newNote := models.Note{
			UserID:    userID,
			PdfPath:   pdfPath,
			PageIndex: pageIndex,
			Content:   content,
		}
		return db.Create(&newNote).Error
	}
}

// ノートの取得
func GetNote(userID, pdfPath string, pageIndex int) (models.Note, error) {
	var note models.Note
	err := db.Where("user_id = ? AND pdf_path = ? AND page_index = ?", userID, pdfPath, pageIndex).First(&note).Error
	return note, err
}
