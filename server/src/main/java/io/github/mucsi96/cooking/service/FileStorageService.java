package io.github.mucsi96.cooking.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

@Service
public class FileStorageService {

  @Value("${storage.directory}")
  private String storageDirectory;

  private Path storagePath;

  @PostConstruct
  public void init() throws IOException {
    storagePath = Paths.get(storageDirectory).toAbsolutePath().normalize();
    Files.createDirectories(storagePath);
  }

  public Path resolveFilePath(String fileName) throws IOException {
    final Path filePath = storagePath.resolve(fileName).normalize();

    // Security check: ensure the resolved path is within the storage directory
    if (!filePath.startsWith(storagePath)) {
      throw new IOException("Invalid file path: " + fileName);
    }

    return filePath;
  }

  public byte[] fetchFile(String filePath) {
    try {
      final Path resolvedPath = resolveFilePath(filePath);

      if (!Files.exists(resolvedPath)) {
        throw new RuntimeException("File not found: " + filePath);
      }

      return Files.readAllBytes(resolvedPath);
    } catch (IOException e) {
      throw new RuntimeException("Failed to fetch file: " + filePath, e);
    }
  }
}
