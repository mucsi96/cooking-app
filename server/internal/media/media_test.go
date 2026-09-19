package media

import (
	"bytes"
	"context"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestRecipePhotoAndThumbnail(t *testing.T) {
	var input bytes.Buffer
	if err := png.Encode(&input, image.NewRGBA(image.Rect(0, 0, 2000, 1000))); err != nil {
		t.Fatal(err)
	}
	photo, err := NormalizePhoto(context.Background(), input.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(photo))
	if err != nil || config.Width > 1568 || config.Height > 1568 {
		t.Fatalf("invalid normalized image: %+v %v", config, err)
	}
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "images"), 0700); err != nil {
		t.Fatal(err)
	}
	storage := Storage{Directory: dir}
	if err := storage.SaveImage(context.Background(), "candidate", input.Bytes()); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(storage.ImagePath("candidate"))
	if err != nil || len(data) < 12 || string(data[8:12]) != "WEBP" {
		t.Fatalf("invalid thumbnail: %v", err)
	}
}

func TestRejectsNonImages(t *testing.T) {
	for _, data := range [][]byte{nil, []byte("file '/etc/passwd'"), []byte("<svg></svg>"), []byte("GIF89acorrupt")} {
		if _, err := NormalizePhoto(context.Background(), data); err == nil {
			t.Fatal("accepted invalid photo")
		}
	}
}
