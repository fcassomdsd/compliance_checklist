import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from '../utils/logger.js';
import * as fileSec from '../utils/fileSec.js';
import { fileExists, ensureDir, listDir, readFile, saveFile, deleteFile, getFileStats } from '../utils/fileOps.js';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('node:path');
vi.mock('../utils/logger.js');
vi.mock('../utils/fileSec.js', { spy : true} );

describe('fileOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'access').mockReset();
    vi.spyOn(fs, 'mkdir').mockReset();
    vi.spyOn(fs, 'readdir').mockReset();
    vi.spyOn(fs, 'readFile').mockReset();
    vi.spyOn(fs, 'writeFile').mockReset();
    vi.spyOn(fs, 'unlink').mockReset();
    vi.spyOn(fs, 'stat').mockReset();
    vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/'));
    vi.spyOn(path, 'dirname').mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
  });

  describe('fileExists', () => {
    it('returns true if file exists', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      const result = await fileExists('/path/file.txt');
      expect(fileSec.safePath).toHaveBeenCalledWith('/path/file.txt');
      expect(fs.access).toHaveBeenCalledWith('/path/file.txt');
      expect(result).toBe(true);
    });

    it('returns false for ENOENT', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(fs, 'access').mockRejectedValue({ code: 'ENOENT' });
      const result = await fileExists('/path/file.txt');
      expect(result).toBe(false);
    });

    it('throws and logs for other errors', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(logger, 'error');
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      vi.spyOn(fs, 'access').mockRejectedValue(error);
      await expect(fileExists('/path/file.txt')).rejects.toThrow('Permission denied');
      expect(logger.error).toHaveBeenCalledWith('fileExists: could not get access to file /path/file.txt');
    });
  });

  describe('ensureDir', () => {
    it('creates directory if it does not exist', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/sub');
      vi.spyOn(fs, 'access').mockRejectedValue({ code: 'ENOENT' });
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      const result = await ensureDir('/path/sub');
      expect(fs.mkdir).toHaveBeenCalledWith('/path/sub', { recursive: true });
      expect(result).toBe('/path/sub');
    });

    it('returns path if directory exists', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/sub');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      const result = await ensureDir('/path/sub');
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(result).toBe('/path/sub');
    });

    it('throws and logs on error', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/sub');
      vi.spyOn(fs, 'access').mockRejectedValue({ code: 'ENOENT' });
      const error = new Error('Permission denied');
      vi.spyOn(fs, 'mkdir').mockRejectedValue(error);
      await expect(ensureDir('/path/sub')).rejects.toThrow('Permission denied');
      expect(logger.error).toHaveBeenCalledWith('ensurePath: Could not create directory /path/sub', error);
    });
  });

  describe('listDir', () => {
    it('lists directory contents', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/sub');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      vi.spyOn(fs, 'readdir').mockResolvedValue(['file1.txt', 'file2.txt']);
      const result = await listDir('/path/sub');
      expect(fs.readdir).toHaveBeenCalledWith('/path/sub');
      expect(result).toEqual([
        { name: 'file1.txt', URL: '/path/sub/file1.txt', count: 0 },
        { name: 'file2.txt', URL: '/path/sub/file2.txt', count: 0 },
      ]);
    });

    it('throws if directory does not exist', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/sub');
      vi.spyOn(fs, 'access').mockRejectedValue({ code: 'ENOENT' });
      const error = new Error('readDir: Directory does not exist: /path/sub');
      await expect(listDir('/path/sub')).rejects.toThrow('readDir: Directory does not exist: /path/sub');
    });

    it('throws and logs on other errors', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/sub');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      const error = new Error('Permission denied');
      vi.spyOn(fs, 'readdir').mockRejectedValue(error);
      await expect(listDir('/path/sub')).rejects.toThrow('Permission denied');
    });
  });

  describe('readFile', () => {
    it('reads file content with utf-8', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.json');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      vi.spyOn(fs, 'readFile').mockResolvedValue('{"key": "value"}');
      const result = await readFile('/path/file.json');
      expect(fs.readFile).toHaveBeenCalledWith('/path/file.json', 'utf-8');
      expect(result).toBe('{"key": "value"}');
    });

    it('throws if file does not exist', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.json');
      vi.spyOn(fs, 'access').mockRejectedValue({ code: 'ENOENT' });
      await expect(readFile('/path/file.json')).rejects.toThrow('readFile: File does not exist: /path/file.json');
//      expect(logger.error).toHaveBeenCalledWith('Could not read contents of file /path/file.json');
    });

    it('throws and logs on other errors', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.json');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      const error = new Error('Permission denied');
      vi.spyOn(fs, 'readFile').mockRejectedValue(error);
      await expect(readFile('/path/file.json')).rejects.toThrow('Permission denied');
//      expect(logger.error).toHaveBeenCalledWith('Could not read contents of file /path/file.json', error);
    });
  });

  describe('saveFile', () => {
    it('saves string data', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(path, 'dirname').mockReturnValue('/path');
      const result = await saveFile('/path/file.txt', 'test data');
      expect(fs.writeFile).toHaveBeenCalledWith('/path/file.txt', 'test data', 'utf-8');
      expect(logger.info).toHaveBeenCalledWith('saveFile : returning /path/file.txt');
      expect(result).toBe('/path/file.txt');
    });

    it('saves Buffer data', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(path, 'dirname').mockReturnValue('/path');
      const buffer = Buffer.from('test');
      const result = await saveFile('/path/file.txt', buffer);
      expect(fs.writeFile).toHaveBeenCalledWith('/path/file.txt', buffer, 'utf-8');
      expect(result).toBe('/path/file.txt');
    });

    it('creates parent directory', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(fs, 'access').mockRejectedValue({ code: 'ENOENT' });
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(path, 'dirname').mockReturnValue('/path');
      await saveFile('/path/file.txt', 'test data');
      expect(fs.mkdir).toHaveBeenCalledWith('/path', { recursive: true });
    });

    it('throws and logs on error', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(fs, 'access').mockResolvedValue(undefined);
      const error = new Error('Write failed');
      vi.spyOn(fs, 'writeFile').mockRejectedValue(error);
      vi.spyOn(path, 'dirname').mockReturnValue('/path');
      await expect(saveFile('/path/file.txt', 'test data')).rejects.toThrow('Write failed');
      expect(logger.error).toHaveBeenCalledWith('saveFile: Could not save file: /path/file.txt :', error);
    });
  });

  describe('deleteFile', () => {
    it('deletes existing file', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);
      const result = await deleteFile('/path/file.txt');
      expect(fs.unlink).toHaveBeenCalledWith('/path/file.txt');
      expect(result).toBe(true);
    });

    it('throws and logs on error', async () => {
      vi.spyOn(fileSec, 'safePath').mockReturnValue('/path/file.txt');
      const error = new Error('Delete failed');
      vi.spyOn(fs, 'unlink').mockRejectedValue(error);
      await expect(deleteFile('/path/file.txt')).rejects.toThrow('Delete failed');
      expect(logger.error).toHaveBeenCalledWith('Could not delete file /path/file.txt', error);
    });
  });

  describe('getFileStats', () => {
    it('returns file stats', async () => {
      const stats = { size: 1024, mtime: new Date() };
      vi.spyOn(fs, 'stat').mockResolvedValue(stats);
      const result = await getFileStats('/path/file.txt');
      expect(fs.stat).toHaveBeenCalledWith('/path/file.txt');
      expect(result).toBe(stats);
    });

    it('returns null for ENOENT', async () => {
      vi.spyOn(fs, 'stat').mockRejectedValue({ code: 'ENOENT' });
      const result = await getFileStats('/path/file.txt');
      expect(logger.info).toHaveBeenCalledWith('getFileStats: file does not exist, returning null: /path/file.txt');
      expect(result).toBe(null);
    });

    it('throws on other errors', async () => {
      const error = new Error('Permission denied');
      vi.spyOn(fs, 'stat').mockRejectedValue(error);
      await expect(getFileStats('/path/file.txt')).rejects.toThrow('Permission denied');
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
