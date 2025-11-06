package models

type Peages struct {
	PeageID  string `gorm:"primaryKey"` // peageid
	PeageNum int  // ページ番号
	SlideID  string // 外部キー
	Memo     string
	Questions []Questions `gorm:"foreignKey:PageID"` // 
}
