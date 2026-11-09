package media

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"time"
)

const MaxPhotoBytes = 15 * 1024 * 1024

func supported(data []byte) bool {
	if bytes.HasPrefix(data, []byte{0xff, 0xd8, 0xff}) || bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")) || bytes.HasPrefix(data, []byte("GIF87a")) || bytes.HasPrefix(data, []byte("GIF89a")) || bytes.HasPrefix(data, []byte("BM")) {
		return true
	}
	if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return true
	}
	return len(data) >= 12 && string(data[4:8]) == "ftyp" && slices.Contains([]string{"avif", "avis", "heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"}, string(data[8:12]))
}

func convert(ctx context.Context, data []byte, format string) ([]byte, error) {
	if !supported(data) {
		return nil, errors.New("unsupported photo format")
	}
	dir, err := os.MkdirTemp("", "cooking-image-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	input, output := filepath.Join(dir, "input"), filepath.Join(dir, "output."+format)
	if err := os.WriteFile(input, data, 0600); err != nil {
		return nil, err
	}
	args := []string{"-nostdin", "-y", "-loglevel", "error", "-protocol_whitelist", "file", "-max_pixels", "25000000", "-i", input, "-frames:v", "1", "-threads", "1"}
	if format == "jpg" {
		args = append(args, "-vf", "scale=w='min(1568,iw)':h='min(1568,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2", "-c:v", "mjpeg", "-q:v", "3", "-pix_fmt", "yuvj420p")
	} else {
		args = append(args, "-vf", "scale=1200:1200:force_original_aspect_ratio=decrease", "-c:v", "libwebp", "-quality", "75")
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", append(args, output)...)
	if log, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("convert image: %w: %s", err, log)
	}
	return os.ReadFile(output)
}

func NormalizePhoto(ctx context.Context, data []byte) ([]byte, error) {
	return convert(ctx, data, "jpg")
}

type Storage struct{ Directory string }

func (s Storage) ImagePath(id string) string { return filepath.Join(s.Directory, "images", id+".webp") }

func (s Storage) SaveImage(ctx context.Context, id string, data []byte) error {
	image, err := convert(ctx, data, "webp")
	if err != nil {
		return err
	}
	dir := filepath.Join(s.Directory, "images")
	file, err := os.CreateTemp(dir, ".image-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err := file.Write(image); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), s.ImagePath(id))
}
