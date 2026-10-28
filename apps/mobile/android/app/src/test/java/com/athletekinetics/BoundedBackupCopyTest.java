package com.athletekinetics;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.Arrays;

/** Host check: compile alongside BoundedBackupCopy.java, then run with java -ea. */
public final class BoundedBackupCopyTest {
  private static class Source extends InputStream {
    long remaining;
    int bytesRead;
    boolean closed;
    Source(long size) { remaining = size; }
    @Override public int read() { throw new AssertionError("Use bounded block reads"); }
    @Override public int read(byte[] bytes, int offset, int length) throws IOException {
      assert length > 0;
      if (remaining == 0) return -1;
      int count = (int) Math.min(length, remaining);
      Arrays.fill(bytes, offset, offset + count, (byte) 7);
      remaining -= count;
      bytesRead += count;
      return count;
    }
    @Override public void close() throws IOException { closed = true; }
  }

  private static void rejects(Source source, File target) throws IOException {
    try {
      BoundedBackupCopy.copy(source, target);
      throw new AssertionError("Expected copy rejection");
    } catch (IOException expected) {
      assert !target.exists() : "Partial output survived";
      assert source == null || source.closed : "Source was not closed";
    }
  }

  public static void main(String[] args) throws IOException {
    File directory = Files.createTempDirectory("ak-bounded-copy-").toFile();
    File target = new File(directory, "backup.pmbak");
    try {
      Source small = new Source(64);
      BoundedBackupCopy.copy(small, target);
      assert small.closed && target.length() == 64;
      for (byte value : Files.readAllBytes(target.toPath())) assert value == 7;
      Files.delete(target.toPath());

      Source exact = new Source(BoundedBackupCopy.MAX_BYTES);
      BoundedBackupCopy.copy(exact, target);
      assert exact.closed && exact.bytesRead == BoundedBackupCopy.MAX_BYTES;
      assert target.length() == BoundedBackupCopy.MAX_BYTES;
      Files.delete(target.toPath());

      Source endless = new Source(Long.MAX_VALUE);
      rejects(endless, target);
      assert endless.bytesRead == BoundedBackupCopy.MAX_BYTES + 1 : "Read exceeded the byte budget";

      Source broken = new Source(100_000) {
        @Override public int read(byte[] bytes, int offset, int length) throws IOException {
          if (bytesRead > 0) throw new IOException("Provider failed after partial output");
          return super.read(bytes, offset, length);
        }
      };
      rejects(broken, target);
      assert broken.bytesRead > 0;
      rejects(new Source(0), target);
      rejects(null, target);

      Thread.currentThread().interrupt();
      try { rejects(new Source(64), target); }
      finally { Thread.interrupted(); }

      rejects(new Source(64) {
        @Override public void close() throws IOException {
          super.close();
          throw new IOException("Provider close failed");
        }
      }, target);
      System.out.println("BoundedBackupCopy: 8 checks passed");
    } finally {
      Files.deleteIfExists(target.toPath());
      Files.delete(directory.toPath());
    }
  }
}
