import { app } from 'electron'
import { shell } from 'electron'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import {
  fileExists,
  ensureDir,
  listDir,
  readFile,
  saveFile,
  deleteFile,
  getFileStats,
} from '../utils/fileOps.js'
import { safeJoin } from '../utils/fileSec.js'
import { logger } from '../utils/logger.js'
import { generateFindingsReport } from '../utils/pdfGenerator.js'

// Moved outside the setup function as it's a constant
//const defaultSavePath = '/home/fernando/Documents/Current_inspection'; //path.join(app.getPath('documents'), 'Current_inspection');
const defaultSavePath = path.join(app.getPath('documents'), 'Current_inspection')

// All handler definitions are now inside this function
export function setupIpcHandles(ipcMain) {
  /**
      filePath : the directory or file to check; if null, then fallback to defaultSavePath
      pathLegs : any additional components of the path, existing under the previous filePath
      
    */
  ipcMain.handle('check-path', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath !== null ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      return await fileExists(toFilePath)
    } catch (err) {
      logger.error(
        `check-path: Could not assess presence of file ${filePath} ${pathLegs.toString()}: ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('get-path', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      return safeJoin(dirPath, pathLegs)
    } catch (err) {
      logger.error(
        `create-dir: Could not create directory ${filePath} ${pathLegs.toString()} : ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('get-full-path', async (event, filePath, pathLegs, fileName) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const dirPathWithLegs = safeJoin(dirPath, pathLegs)
      return safeJoin(dirPathWithLegs, fileName)
    } catch (err) {
      logger.error(
        `get-full-path: Could not get full path ${filePath} ${pathLegs} ${fileName}: ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('get-stats', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const fileStats = await getFileStats(toFilePath)
      return fileStats
    } catch (err) {
      logger.error(`get-stats: Could not stat file ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('create-dir', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = pathLegs ? safeJoin(dirPath, pathLegs) : dirPath
      await ensureDir(toFilePath)
    } catch (err) {
      logger.error(
        `create-dir: Could not create directory ${filePath} ${pathLegs} : ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('list-path', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = pathLegs ? safeJoin(dirPath, pathLegs) : dirPath
      const dirList = await listDir(toFilePath)
      return dirList
    } catch (err) {
      logger.error(`list-file: Could not read directory ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('read-file', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const fileContent = await readFile(toFilePath)
      return fileContent
    } catch (err) {
      logger.error(`read-file: Could not read file ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('save-file', async (event, fileData, filePath, pathLegs) => {
    try {
      // data should be a string or an array
      if (typeof fileData != 'string' && fileData?.byteLength === undefined) {
        throw new Error('Invalid buffer')
      }

      if (fileData.length == 0) {
        throw new Error('Buffer is empty')
      }

      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const dataToSave = typeof fileData === 'string' ? fileData : Buffer.from(fileData)
      const saved = await saveFile(toFilePath, dataToSave)
      return saved
    } catch (err) {
      logger.error(`save-file: Could not save file ${filePath} ${pathLegs} : ${err.message}`)
      throw new Error(
        `ipcHandles.save-file: Could not save file ${filePath} ${pathLegs} : ${err.message}`
      )
    }
  })

  ipcMain.handle('delete-file', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const deleted = await deleteFile(toFilePath)
      return deleted
    } catch (err) {
      logger.error(`delete-file: Could not delete file ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('generate-pdf', async (event, { checklistString, sessionString, specialty, outputPath }) => {
    try {
      if (!checklistString || !sessionString || !specialty || !outputPath) {
        throw new Error('Missing required parameters: checklistString, sessionString, specialty, outputPath')
      }
      const result = await generateFindingsReport({ checklistString, sessionString, specialty, outputPath })
      return result
    } catch (err) {
      logger.error(`generate-pdf: Could not generate PDF: ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      if (!filePath) {
        throw new Error('Missing required parameter: filePath')
      }
      await shell.openPath(filePath)
      return { success: true }
    } catch (err) {
      logger.error(`open-file: Could not open file ${filePath}: ${err.message}`)
      throw err
    }
  })
}
