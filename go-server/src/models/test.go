package models

// type Peages struct {
// 	PeageID  uint `gorm:"primaryKey"` // peageid
// 	PeageNum int  // ページ番号
// 	SlideID  uint // 外部キー
// 	Memo     string

// 	// Peageは1つのSlideに属する
// 	Slide Slides `gorm:"foreignKey:SlideID"`

// 	// Peageは複数のQuestionを持つ
// 	Questions []Questions `gorm:"foreignKey:PageID"` // pageidがPeageIDに対応すると想定
// }

// type Questions struct {
// 	QuestionID uint `gorm:"primaryKey"` // questionid
// 	Txt        string // 質問テキスト
// 	PageID     uint // peageのIDを参照すると想定 (ご提示の構成より)
// 	CreatedAt  time.Time

// 	// Questionは1つのPeageに属する
// 	Peage Peages `gorm:"foreignKey:PageID"`
// }



// type Slides struct {
// 	SlideID   string `gorm:"primaryKey"` // slideid
// 	UserID    string // 外部キー
// 	CreatedAt time.Time
// 	UpdatedAt time.Time
// 	User Users `gorm:"foreignKey:UserID"`
// 	Peages []Peages `gorm:"foreignKey:SlideID"`
// }

// type Users struct {
// 	UserID string `gorm:"primaryKey"` // userid
// 	Name   string
// 	Pass   string // パスワードは適切にハッシュ化して保存する必要があります
// 	// Userは複数のSlideを持つ
// 	Slides []Slides `gorm:"foreignKey:UserID"`
// }

