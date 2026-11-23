package repositories

import (
	"rimodeck/models"

	"gorm.io/gorm/clause"
)

// ユーザーのリモート画面の配置(JSON)を返す。まだ保存していなければ found=false
func GetRemoteLayout(userID string) (data string, found bool, err error) {
	var layout models.RemoteLayout
	result := db.Where("user_id = ?", userID).Limit(1).Find(&layout)
	if result.Error != nil {
		return "", false, result.Error
	}
	return layout.Data, result.RowsAffected > 0, nil
}

// 配置を保存する(あれば上書き)
func SaveRemoteLayout(userID, data string) error {
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"data", "updated_at"}),
	}).Create(&models.RemoteLayout{UserID: userID, Data: data}).Error
}

// 配置を消して、初期状態に戻す
func DeleteRemoteLayout(userID string) error {
	return db.Where("user_id = ?", userID).Delete(&models.RemoteLayout{}).Error
}
