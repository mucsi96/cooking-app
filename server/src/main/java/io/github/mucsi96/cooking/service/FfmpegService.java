package io.github.mucsi96.cooking.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class FfmpegService {

  private static final int TIMEOUT_SECONDS = 30;
  private static final String INPUT = "__INPUT__";
  private static final Set<String> ISO_IMAGE_BRANDS = Set.of(
      "avif", "avis", "heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1");

  public void resizeImage(byte[] imageData, int width, int height, Path outputFile) throws IOException {
    Files.createDirectories(outputFile.getParent());
    run(imageData,
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", INPUT,
        "-filter:v", "scale=%d:%d:force_original_aspect_ratio=decrease".formatted(width, height),
        "-codec:v", "libwebp", "-quality", "75",
        "-frames:v", "1",
        "-f", "webp",
        outputFile.toString());
  }

  public byte[] normalizeRecipePhoto(byte[] imageData) throws IOException {
    if (!isSupportedImage(imageData)) {
      throw new IOException("Unsupported recipe photo format");
    }
    final Path outputFile = Files.createTempFile("recipe-photo-", ".jpg");
    try {
      run(imageData,
          "ffmpeg", "-nostdin", "-y", "-loglevel", "error",
          "-protocol_whitelist", "file", "-max_pixels", "25000000",
          "-i", INPUT,
          "-filter:v", "scale=w='min(1568,iw)':h='min(1568,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
          "-codec:v", "mjpeg", "-q:v", "3", "-pix_fmt", "yuvj420p",
          "-frames:v", "1",
          outputFile.toString());
      return Files.readAllBytes(outputFile);
    } finally {
      Files.deleteIfExists(outputFile);
    }
  }

  private boolean isSupportedImage(byte[] data) {
    final boolean jpeg = startsWith(data, 0xff, 0xd8, 0xff);
    final boolean png = startsWith(data, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    final boolean gif = startsWith(data, 0x47, 0x49, 0x46, 0x38)
        && data.length >= 6 && (data[4] == '7' || data[4] == '9') && data[5] == 'a';
    final boolean bmp = startsWith(data, 0x42, 0x4d);
    final boolean webp = startsWith(data, 0x52, 0x49, 0x46, 0x46)
        && hasSignatureAt(data, 8, 0x57, 0x45, 0x42, 0x50);
    final boolean isoImage = hasSignatureAt(data, 4, 0x66, 0x74, 0x79, 0x70)
        && data.length >= 12
        && ISO_IMAGE_BRANDS.contains(new String(data, 8, 4, StandardCharsets.US_ASCII));
    return jpeg || png || gif || bmp || webp || isoImage;
  }

  private boolean startsWith(byte[] data, int... signature) {
    return hasSignatureAt(data, 0, signature);
  }

  private boolean hasSignatureAt(byte[] data, int offset, int... signature) {
    return data.length >= offset + signature.length
        && IntStream.range(0, signature.length)
            .allMatch(i -> Byte.toUnsignedInt(data[offset + i]) == signature[i]);
  }

  private void run(byte[] input, String... args) throws IOException {
    final Path inputFile = Files.createTempFile("ffmpeg-in-", ".tmp");
    try {
      Files.write(inputFile, input);
      final ProcessBuilder pb = new ProcessBuilder(
          Arrays.stream(args)
              .map(a -> a.equals(INPUT) ? inputFile.toString() : a)
              .toList());
      pb.redirectErrorStream(true);
      log.debug("Running ffmpeg: {}", String.join(" ", pb.command()));
      final Process process = pb.start();

      try {
        final boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        if (!finished) {
          process.destroyForcibly();
          throw new IOException("ffmpeg timed out after %d seconds".formatted(TIMEOUT_SECONDS));
        }

        final byte[] output = process.getInputStream().readAllBytes();

        if (process.exitValue() != 0) {
          throw new IOException("ffmpeg exited with code %d: %s".formatted(
              process.exitValue(), new String(output, StandardCharsets.UTF_8)));
        }
      } catch (InterruptedException e) {
        process.destroyForcibly();
        Thread.currentThread().interrupt();
        throw new IOException("ffmpeg process interrupted", e);
      }
    } finally {
      Files.deleteIfExists(inputFile);
    }
  }
}
