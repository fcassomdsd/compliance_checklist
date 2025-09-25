// tests/ipcHandles.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, app } from 'electron';
import { setupIpcHandles } from '../ipcHandles';
import * as fileOps from '../utils/fileOps';
import * as fs from 'node:fs/promises';
import { safeJoin } from '../utils/fileSec';
import { logger } from '../utils/logger';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mocked/documents') },
  ipcMain: { handle: vi.fn() },
}));
vi.mock('../utils/fileOps', { spy : true });
vi.mock('../utils/logger');
vi.mock('../utils/fileSec', { spy: true });
vi.mock('node:fs/promises');

describe('ipcHandles', () => {
  let handles = {};

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMain.handle.mockImplementation((channel, handler) => {
      handles[channel] = handler;
    });
    setupIpcHandles(ipcMain);
  });

  describe('check-path', () => {
    it('calls fileExists with correct path', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(true);
      const result = await handles['check-path']({}, '/mocked/path', ['sub', 'file.txt']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub', 'file.txt']);
      expect(fileOps.fileExists).toHaveBeenCalledWith('/mocked/path/sub/file.txt');
      expect(result).toBe(true);
    });

    it('uses defaultSavePath when filePath is null', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(true);
      const result = await handles['check-path']({}, null, ['file.txt']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/documents/Current_inspection', ['file.txt']);
      expect(result).toBe(true);
    });

    it('handles ENOENT error', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(false); // ENOENT case
      const result = await handles['check-path']({}, '/mocked/path', ['file.txt']);
      expect(result).toBe(false);
    });

    it('handles invalid path with ..', async () => {
      await expect(handles['check-path']({}, '/mocked/path', ['../file.txt'])).rejects.toThrow('Illegal path name');
      expect(logger.error).toHaveBeenCalledWith('check-path: Could not assess presence of file /mocked/path ../file.txt: safeJoin: Illegal path name: /mocked/path,../file.txt');
    });

    it('handles non-string filePath', async () => {
      await expect(handles['check-path']({}, 123, ['file.txt'])).rejects.toThrow('safeJoin: Illegal path name: 123');
      expect(safeJoin).toHaveBeenCalledWith(123, ['file.txt']);
      expect(safeJoin).toThrow('safeJoin: Illegal path name:');
      //expect(fileOps.fileExists).toHaveBeenCalledWith('/mocked/path/sub/file.txt');
    });
  });

  describe('get-path', () => {
    it('returns constructed path', async () => {
      const result = await handles['get-path']({}, '/mocked/path', ['sub', 'file.txt']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub','file.txt']);
      expect(result).toBe('/mocked/path/sub/file.txt');
    });

    it('handles empty pathLegs', async () => {
      const result = await handles['get-path']({}, '/mocked/path', []);
      expect(result).toBe('/mocked/path');
    });

    it('handles path traversal', async () => {
      await expect(handles['get-path']({}, '/mocked/path', ['../file.txt'])).rejects.toThrow('safeJoin: Illegal path name: /mocked/path,../file.txt');
      expect(logger.error).toHaveBeenCalledWith('create-dir: Could not create directory /mocked/path ../file.txt : safeJoin: Illegal path name: /mocked/path,../file.txt');
    });
  });

  describe('get-stats', () => {
    it('returns file stats', async () => {
      const stats = { size: 1024, mtime: new Date() };
      vi.spyOn(fileOps, 'getFileStats').mockResolvedValue(stats);
      const result = await handles['get-stats']({}, '/mocked/path', ['file.txt']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.txt']);
      expect(fileOps.getFileStats).toHaveBeenCalledWith('/mocked/path/file.txt');
      expect(result).toBe(stats);
    });

    it('handles case of a null directory path', async () => {
      const stats = { size: 1024, mtime: new Date() };
      vi.spyOn(fileOps, 'getFileStats').mockResolvedValue(stats);
      const result = await handles['get-stats']({}, null, ['file.txt']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/documents/Current_inspection', ['file.txt']);
      expect(fileOps.getFileStats).toHaveBeenCalledWith('/mocked/documents/Current_inspection/file.txt');
      expect(result).toBe(stats);
    });

    it('returns null for ENOENT', async () => {
      vi.spyOn(fileOps, 'getFileStats').mockResolvedValue(null);
      const result = await handles['get-stats']({}, '/mocked/path', ['file.txt']);
      expect(result).toBe(null);
    });

    it('handles errors', async () => {
      vi.spyOn(fileOps, 'getFileStats').mockRejectedValue(new Error('Permission denied'));
      await expect(handles['get-stats']({}, '/mocked/path', ['file.txt'])).rejects.toThrow('Permission denied');
      expect(logger.error).toHaveBeenCalledWith('get-stats: Could not stat file /mocked/path file.txt : Permission denied');
    });
  });

  describe('create-dir', () => {
    it('creates directory', async () => {
      vi.spyOn(fileOps, 'ensureDir').mockResolvedValue('/mocked/path/sub');
      await handles['create-dir']({}, '/mocked/path', ['sub']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub']);
      expect(fileOps.ensureDir).toHaveBeenCalledWith('/mocked/path/sub');
    });

    it('handles existing directory', async () => {
      vi.spyOn(fileOps, 'fileExists').mockResolvedValue(true);
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      await handles['create-dir']({}, '/mocked/path', ['sub']);
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('handles errors', async () => {
      vi.spyOn(fileOps, 'ensureDir').mockRejectedValue(new Error('Dir creation failed'));
      await expect(handles['create-dir']({}, '/mocked/path', ['sub'])).rejects.toThrow('Dir creation failed');
      expect(logger.error).toHaveBeenCalledWith('create-dir: Could not create directory /mocked/path sub : Dir creation failed');
    });
  });

  describe('list-path', () => {
    it('lists directory contents', async () => {
      const files = [{ name: 'file.txt', URL: '/mocked/path/sub/file.txt', count: 0 }];
      vi.spyOn(fileOps, 'listDir').mockResolvedValue(files);
      const result = await handles['list-path']({}, '/mocked/path', ['sub']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['sub']);
      expect(fileOps.listDir).toHaveBeenCalledWith('/mocked/path/sub');
      expect(result).toEqual(files);
    });

    it('handles non-existent directory', async () => {
      vi.spyOn(fileOps, 'listDir').mockRejectedValue(new Error('readDir: Directory does not exist: /mocked/path/sub'));
      await expect(handles['list-path']({}, '/mocked/path', ['sub'])).rejects.toThrow('Directory does not exist');
      expect(logger.error).toHaveBeenCalledWith('list-file: Could not read directory /mocked/path sub : readDir: Directory does not exist: /mocked/path/sub');
    });
  });

  describe('read-file', () => {
    it('reads file content', async () => {
      const content = '{"key": "value"}';
      vi.spyOn(fileOps, 'readFile').mockResolvedValue(content);
      const result = await handles['read-file']({}, '/mocked/path', ['file.json']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.json']);
      expect(fileOps.readFile).toHaveBeenCalledWith('/mocked/path/file.json');
      expect(result).toBe(content);
    });

    it('handles non-existent file', async () => {
      vi.spyOn(fileOps, 'readFile').mockRejectedValue(new Error('readFile: File does not exist: /mocked/path/file.json'));
      await expect(handles['read-file']({}, '/mocked/path', ['file.json'])).rejects.toThrow('File does not exist');
      expect(logger.error).toHaveBeenCalledWith('read-file: Could not read file /mocked/path file.json : readFile: File does not exist: /mocked/path/file.json');
    });
  });

  describe('save-file', () => {
    it('throws error on empty file', async () => {
      const errorMessage = 'ipcHandles.save-file: Could not save file /mocked/path file.txt : Buffer is empty'
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt');
      await expect(handles['save-file']({}, '', '/mocked/path', ['file.txt'])).rejects.toThrowError(errorMessage);
    });

    it('throws error on undefined file data', async () => {
      const errorMessage = 'ipcHandles.save-file: Could not save file /mocked/path file.txt : Invalid buffer'
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt');
      await expect(handles['save-file']({}, undefined, '/mocked/path', ['file.txt'])).rejects.toThrowError(errorMessage);
    });

    it('saves string data', async () => {
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt');
      const result = await handles['save-file']({}, 'test data', '/mocked/path', ['file.txt']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.txt']);
      expect(fileOps.saveFile).toHaveBeenCalledWith('/mocked/path/file.txt', 'test data');
      expect(result).toBe('/mocked/path/file.txt');
    });

    it('saves Buffer data', async () => {
      const buffer = Buffer.from([0x74, 0x65, 0x73, 0x74]); // 'test'
      vi.spyOn(fileOps, 'saveFile').mockResolvedValue('/mocked/path/file.txt');
      const result = await handles['save-file']({}, buffer, '/mocked/path', ['file.txt']);
      expect(fileOps.saveFile).toHaveBeenCalledWith('/mocked/path/file.txt', buffer);
      expect(result).toBe('/mocked/path/file.txt');
    });

    it('handles invalid data', async () => {
      vi.spyOn(fileOps, 'saveFile').mockRejectedValue(new Error('Invalid buffer'));
      await expect(handles['save-file']({}, {}, '/mocked/path', ['file.txt'])).rejects.toThrow('Invalid buffer');
      expect(logger.error).toHaveBeenCalledWith('save-file: Could not save file /mocked/path file.txt : Invalid buffer');
    });
  });

  describe('delete-file', () => {
    it('deletes file', async () => {
      vi.spyOn(fileOps, 'deleteFile').mockResolvedValue(true);
      const result = await handles['delete-file']({}, '/mocked/path', ['file.txt']);
      expect(safeJoin).toHaveBeenCalledWith('/mocked/path', ['file.txt']);
      expect(fileOps.deleteFile).toHaveBeenCalledWith('/mocked/path/file.txt');
      expect(result).toBe(true);
    });

    it('handles errors', async () => {
      vi.spyOn(fileOps, 'deleteFile').mockRejectedValue(new Error('Delete failed'));
      await expect(handles['delete-file']({}, '/mocked/path', ['file.txt'])).rejects.toThrow('Delete failed');
      expect(logger.error).toHaveBeenCalledWith('delete-file: Could not delete file /mocked/path file.txt : Delete failed');
    });
  });
});
