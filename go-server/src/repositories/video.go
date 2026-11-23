package repositories

import (
	"rimodeck/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ページに動画を紐付ける。そのページにすでに動画があれば差し替えて、前の保存ファイル名を返す(なければ空文字)。
func SavePageVideo(v *models.PageVideo) (previousStoredName string, err error) {
	err = db.Transaction(func(tx *gorm.DB) error {
		var old models.PageVideo
		found := tx.Where("user_id = ? AND pdf_name = ? AND page_index = ?", v.UserID, v.PdfName, v.PageIndex).
			Limit(1).Find(&old).RowsAffected > 0
		if found {
			previousStoredName = old.StoredName
		}
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "pdf_name"}, {Name: "page_index"}},
			DoUpdates: clause.AssignmentColumns([]string{"stored_name", "original_name", "created_at"}),
		}).Create(v).Error
	})
	return previousStoredName, err
}

// ユーザーの、ある PDF に紐付いた動画をページ順に返す
func ListPageVideos(userID, pdfName string) ([]models.PageVideo, error) {
	videos := []models.PageVideo{}
	err := db.Where("user_id = ? AND pdf_name = ?", userID, pdfName).
		Order("page_index ASC").
		Find(&videos).Error
	return videos, err
}

// 動画を1本取り出す(持ち主の PDF のものだけ)
func GetPageVideo(userID, pdfName string, id uint) (*models.PageVideo, error) {
	var v models.PageVideo
	err := db.Where("id = ? AND user_id = ? AND pdf_name = ?", id, userID, pdfName).First(&v).Error
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// ページの動画の紐付けを外す。外した動画の保存ファイル名を返す。
func DeletePageVideo(userID, pdfName string, page int) (storedName string, err error) {
	var v models.PageVideo
	if err := db.Where("user_id = ? AND pdf_name = ? AND page_index = ?", userID, pdfName, page).First(&v).Error; err != nil {
		return "", err
	}
	if err := db.Delete(&v).Error; err != nil {
		return "", err
	}
	return v.StoredName, nil
}

// PDF を削除したとき、その PDF の動画の紐付けも外す。外した動画の保存ファイル名を返す。
func DeletePageVideosByPdf(userID, pdfName string) ([]string, error) {
	videos, err := ListPageVideos(userID, pdfName)
	if err != nil {
		return nil, err
	}
	if err := db.Where("user_id = ? AND pdf_name = ?", userID, pdfName).Delete(&models.PageVideo{}).Error; err != nil {
		return nil, err
	}
	names := make([]string, 0, len(videos))
	for _, v := range videos {
		names = append(names, v.StoredName)
	}
	return names, nil
}
