package services

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt"
)

const testSecret = "0123456789abcdef0123456789abcdef"

func sign(t *testing.T, method jwt.SigningMethod, key interface{}, claims jwt.MapClaims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatalf("署名に失敗: %v", err)
	}
	return s
}

func TestParseToken(t *testing.T) {
	t.Setenv("SECRET_KEY", testSecret)
	future := time.Now().Add(time.Hour).Unix()
	past := time.Now().Add(-time.Hour).Unix()

	cases := []struct {
		name    string
		token   string
		wantID  string
		wantErr bool
	}{
		{"正しいトークン", sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"user_id": "u1", "exp": future}), "u1", false},
		{"別の鍵で署名", sign(t, jwt.SigningMethodHS256, []byte("another-secret-another-secret-0000"), jwt.MapClaims{"user_id": "u1", "exp": future}), "", true},
		{"期限切れ", sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"user_id": "u1", "exp": past}), "", true},
		{"exp がない", sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"user_id": "u1"}), "", true},
		{"user_id がない", sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"exp": future}), "", true},
		{"署名方式が HS512", sign(t, jwt.SigningMethodHS512, []byte(testSecret), jwt.MapClaims{"user_id": "u1", "exp": future}), "", true},
		{"署名なし(alg=none)", sign(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, jwt.MapClaims{"user_id": "u1", "exp": future}), "", true},
		{"空文字", "", "", true},
		{"でたらめな文字列", "not-a-token", "", true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			id, err := parseToken(c.token)
			if (err != nil) != c.wantErr {
				t.Fatalf("err = %v, wantErr = %v", err, c.wantErr)
			}
			if id != c.wantID {
				t.Fatalf("id = %q, want %q", id, c.wantID)
			}
		})
	}
}

func TestParseTokenTampered(t *testing.T) {
	t.Setenv("SECRET_KEY", testSecret)
	valid := sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"user_id": "u1", "exp": time.Now().Add(time.Hour).Unix()})
	// 署名の途中の1文字を変える(末尾の文字は余りのビットなので、変えても署名が変わらないことがある)
	i := len(valid) - 10
	replacement := byte('A')
	if valid[i] == 'A' {
		replacement = 'B'
	}
	tampered := valid[:i] + string(replacement) + valid[i+1:]
	if _, err := parseToken(tampered); err == nil {
		t.Fatal("署名を書き換えたトークンが通ってしまった")
	}
}
