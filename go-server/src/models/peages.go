package models

type Peages struct {
	PeageID  uint `gorm:"primaryKey"` // peageid
	PeageNum int  // ページ番号
	SlideID  uint // 外部キー
	Memo     string

	// Peageは1つのSlideに属する
	Slide Slides `gorm:"foreignKey:SlideID"`

	// Peageは複数のQuestionを持つ
	Questions []Questions `gorm:"foreignKey:PageID"` // pageidがPeageIDに対応すると想定
}
