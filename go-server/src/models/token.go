package models

type Tokens struct {
	Token   string `gorm:"primaryKey"` // トークン文字列
	UserID  string // ユーザーID
	Exp     int64  // 有効期限（Unixタイムスタンプ）
}
