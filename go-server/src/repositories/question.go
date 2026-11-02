package repositories

import (
	"errors"
	"rimodeck/models"

	"gorm.io/gorm"
)

// 質問を保存する
func CreateQuestion(q *models.Question) error {
	return db.Create(q).Error
}

// ユーザーの、ある PDF への質問を、ページ順・届いた順に返す
func ListQuestions(userID, pdfName string) ([]models.Question, error) {
	questions := []models.Question{}
	err := db.Where("user_id = ? AND pdf_name = ?", userID, pdfName).
		Order("page_index ASC, id ASC").
		Find(&questions).Error
	return questions, err
}

// 「回答済み」の印を付ける・外す(自分の質問だけ)
func SetQuestionAnswered(userID string, id uint, answered bool) error {
	result := db.Model(&models.Question{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("answered", answered)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// 質問を削除する(自分の質問だけ)
func DeleteQuestion(userID string, id uint) error {
	result := db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Question{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// PDF を削除したとき、その PDF への質問も消す
func DeleteQuestionsByPdf(userID, pdfName string) error {
	return db.Where("user_id = ? AND pdf_name = ?", userID, pdfName).Delete(&models.Question{}).Error
}

// 見つからないエラーかどうか
func IsNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
