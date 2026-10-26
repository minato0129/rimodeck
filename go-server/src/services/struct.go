package services

type LoginResult struct {
	Success bool //成功したか
	Token string //アクセストークン
	Error error //エラー内容
}


