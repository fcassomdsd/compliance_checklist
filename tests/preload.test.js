import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIpcRenderer = {
  invoke: vi.fn(),
}
const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
}

vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
}))

let api

describe('preload.js', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    await import('../preload.cjs')
    const call = mockContextBridge.exposeInMainWorld.mock.calls[0]
    api = call ? call[1] : undefined
  })

  describe('contextBridge.exposeInMainWorld', () => {
    it('should expose electronAPI to the renderer process', () => {
      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object)
      )
    })
    it('should expose all required methods', () => {
      expect(api).toBeDefined()
      expect(api).toHaveProperty('checkPath')
      expect(api).toHaveProperty('createDir')
      expect(api).toHaveProperty('deleteFile')
      expect(api).toHaveProperty('getPath')
      expect(api).toHaveProperty('getStats')
      expect(api).toHaveProperty('listPath')
      expect(api).toHaveProperty('readFile')
      expect(api).toHaveProperty('saveFile')
    })
  })

  describe('File operation methods', () => {
    it('checkPath should invoke check-path with filePath and pathLegs', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(true)
      await api.checkPath('/home/user', 'documents', 'file.txt')
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'check-path', '/home/user', ['documents', 'file.txt']
      )
    })

    it('createDir should invoke create-dir with correct arguments', async () => {
      mockIpcRenderer.invoke.mockResolvedValue('/home/user/documents')

      await api.createDir('/home/user', 'documents', 'subfolder')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'create-dir',
        '/home/user',
        ['documents', 'subfolder']
      )
    })

    it('deleteFile should invoke delete-file with correct arguments', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(true)

      await api.deleteFile('/home/user', 'file.txt')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'delete-file',
        '/home/user',
        ['file.txt']
      )
    })

    it('getPath should invoke get-path with correct arguments', async () => {
      mockIpcRenderer.invoke.mockResolvedValue('/home/user/documents/file.txt')

      await api.getPath('/home/user', 'documents', 'file.txt')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'get-path',
        '/home/user',
        ['documents', 'file.txt']
      )
    })

    it('getStats should invoke get-stats with correct arguments', async () => {
      const mockStats = { size: 1024, isFile: true }
      mockIpcRenderer.invoke.mockResolvedValue(mockStats)

      await api.getStats('/home/user', 'file.txt')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'get-stats',
        '/home/user',
        ['file.txt']
      )
    })

    it('listPath should invoke list-path with correct arguments', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(['file1.txt', 'file2.txt'])

      await api.listPath('/home/user', 'documents')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'list-path',
        '/home/user',
        ['documents']
      )
    })

    it('readFile should invoke read-file with correct arguments', async () => {
      const fileContent = 'Hello, World!'
      mockIpcRenderer.invoke.mockResolvedValue(fileContent)

      await api.readFile('/home/user', 'file.txt')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'read-file',
        '/home/user',
        ['file.txt']
      )
    })

    it('saveFile should invoke save-file with fileData, filePath, and pathLegs', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(true)
      const fileData = 'New content'

      await api.saveFile(fileData, '/home/user', 'file.txt')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'save-file',
        fileData,
        '/home/user',
        ['file.txt']
      )
    })
  })

  describe('Promise handling', () => {
    it('should return resolved promise on success', async () => {
      const expectedResult = { success: true }
      mockIpcRenderer.invoke.mockResolvedValue(expectedResult)

      const result = await api.readFile('/path', 'file.txt')

      expect(result).toEqual(expectedResult)
    })

    it('should return rejected promise on error', async () => {
      const error = new Error('File not found')
      mockIpcRenderer.invoke.mockRejectedValue(error)

      await expect(api.readFile('/path', 'nonexistent.txt')).rejects.toThrow('File not found')
    })
  })

  describe('Edge cases', () => {
    it('should handle methods with no pathLegs', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(true)

      await api.checkPath('/home/user')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'check-path',
        '/home/user',
        []
      )
    })

    it('should handle multiple pathLegs', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(true)

      await api.getPath('/home', 'user', 'documents', 'projects', 'file.txt')

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'get-path',
        '/home',
        ['user', 'documents', 'projects', 'file.txt']
      )
    })
  })
})