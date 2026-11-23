package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestVideoExt(t *testing.T) {
	cases := []struct {
		in  string
		ext string
		ok  bool
	}{
		{"demo.mp4", ".mp4", true},
		{"DEMO.MOV", ".mov", true},
		{"clip.webm", ".webm", true},
		{"clip.m4v", ".m4v", true},
		{"slide.pdf", ".pdf", false},
		{"script.js", ".js", false},
		{"noext", "", false},
	}
	for _, c := range cases {
		ext, ok := videoExt(c.in)
		if ext != c.ext || ok != c.ok {
			t.Errorf("videoExt(%q) = %q, %v; want %q, %v", c.in, ext, ok, c.ext, c.ok)
		}
	}
}

func TestVideoFilePathStaysInFolder(t *testing.T) {
	got := videoFilePath("u", "../../etc/passwd")
	want := filepath.Join("assets", "Slidepass", "u", "videos", "passwd")
	if got != want {
		t.Errorf("videoFilePath = %q; want %q", got, want)
	}
}

func TestNewVideoStoredName(t *testing.T) {
	a, err := newVideoStoredName(".mp4")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := newVideoStoredName(".mp4")
	if a == b || !strings.HasSuffix(a, ".mp4") || len(a) != 32+len(".mp4") {
		t.Errorf("unexpected stored names: %q, %q", a, b)
	}
}
