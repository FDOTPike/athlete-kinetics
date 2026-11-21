package com.athletekinetics;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;

final class BoundedBackupCopy {
  static final int MAX_BYTES = 16 * 1024 * 1024;

  static void copy(InputStream source, File destination) throws IOException {
    boolean complete = false;
    try {
      try (InputStream input = source; FileOutputStream output = new FileOutputStream(destination)) {
        if (input == null) throw new IOException("The selected backup could not be opened.");
        byte[] buffer = new byte[8192];
        int total = 0;
        while (true) {
          if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Backup copy cancelled.");
          int count = input.read(buffer, 0, Math.min(buffer.length, MAX_BYTES + 1 - total));
          if (count == -1) break;
          if (count <= 0) throw new IOException("The selected backup stream could not be read.");
          total += count;
          if (total > MAX_BYTES) throw new IOException("Backup is too large for this version.");
          output.write(buffer, 0, count);
        }
        if (total == 0) throw new IOException("The selected backup is empty.");
      }
      complete = true;
    } finally {
      if (!complete && destination.exists() && !destination.delete()) {
        throw new IOException("Temporary backup removal could not be confirmed.");
      }
    }
  }
}
