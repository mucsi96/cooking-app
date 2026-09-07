package io.github.mucsi96.cooking.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class FfmpegServiceTest {

  @Test
  void normalizesARecipePhotoToJpeg() throws Exception {
    final byte[] photo = createBmp();

    final byte[] jpeg = new FfmpegService().normalizeRecipePhoto(photo);

    assertTrue(jpeg.length > 4);
    assertEquals(0xff, Byte.toUnsignedInt(jpeg[0]));
    assertEquals(0xd8, Byte.toUnsignedInt(jpeg[1]));
  }

  @Test
  void rejectsContentThatIsNotAnImage() {
    assertThrows(IOException.class, () -> new FfmpegService().normalizeRecipePhoto(
        "https://example.com/recipe.jpg".getBytes(StandardCharsets.UTF_8)));
  }

  private byte[] createBmp() {
    final byte[] header = {
        0x42, 0x4d, 70, 0, 0, 0, 0, 0, 0, 0, 54, 0, 0, 0,
        40, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 0, 24, 0,
        0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0
    };
    final byte[] pixels = {
        0, 0, 0, (byte) 255, (byte) 255, (byte) 255, 0, 0,
        (byte) 255, (byte) 255, (byte) 255, 0, 0, 0, 0, 0
    };
    return ByteBuffer.allocate(header.length + pixels.length)
        .put(header)
        .put(pixels)
        .array();
  }
}
