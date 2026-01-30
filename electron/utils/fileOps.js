import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { logger } from './logger.js'
import { safePath } from './fileSec.js'

export const fileExists = async (filePath) => {
  try {
    const newPath = safePath(filePath)
    await fs.access(safePath(newPath))
    return true
  } catch (error) {
    if (error.code == 'ENOENT') {
      // it doesn't exist
      return false
    } else {
      logger.error('fileExists: could not get access to file ' + filePath)
      throw error
    }
  }
}

export async function ensureDir(dirPath) {
  try {
    const found = await fileExists(dirPath)
    if (!found) {
      await fs.mkdir(safePath(dirPath), { recursive: true })
    }
    return dirPath
  } catch (e) {
    logger.error(`ensurePath: Could not create directory ${dirPath}`, e)
    throw e
  }
}

export async function listDir(dirPath) {
  try {
    const toDirPath = safePath(dirPath)
    const found = await fileExists(toDirPath)
    if (found) {
      const dirContents = await fs.readdir(toDirPath)
      return dirContents.map((x) => ({ name: x, URL: path.join(toDirPath, x), count: 0 }))
    } else {
      throw new Error(`readDir: Directory does not exist: ${dirPath}`)
    }
  } catch (error) {
    logger.error(`Could not read contents of directory ${dirPath} `, error)
    throw error
  }
}

export async function readFile(filePath) {
  try {
    const toFilePath = safePath(filePath)
    const found = await fileExists(toFilePath)
    if (found) {
      const fileContents = await fs.readFile(toFilePath, 'utf-8')
      return fileContents
    } else {
      throw new Error(`readFile: File does not exist: ${filePath}`)
    }
  } catch (error) {
    logger.error(`Could not read contents of file ${filePath} `, error)
    throw error
  }
}

export async function saveFile(filePath, buffer) {
  try {
    const toFilePath = safePath(filePath)
    const dirPath = path.dirname(toFilePath)
    await fs.mkdir(dirPath, { recursive: true })

    if (buffer.length == 0) {
      throw new Error('saveFile: Buffer is empty')
    }
    logger.info(`fileOps.saveFile: ${filePath} ${buffer.length}`)

    await fs.writeFile(toFilePath, buffer, 'utf-8')
    logger.info('saveFile : returning ' + filePath)
    return filePath
  } catch (error) {
    logger.error('saveFile: Could not save file: ' + filePath + ' :', error)
    throw error
  }
}

export async function deleteFile(filePath) {
  try {
    await fs.unlink(safePath(filePath))
    return true
  } catch (error) {
    logger.error(`Could not delete file ${filePath}`, error)
    throw error
  }
}

export async function getFileStats(filePath) {
  try {
    const fileStats = await fs.stat(filePath)
    return fileStats
  } catch (error) {
    if (error.code == 'ENOENT') {
      // it doesn't exist, so valid for writing.
      logger.info('getFileStats: file does not exist, returning null: ' + filePath)
      return null
    } else {
      throw error
    }
  }
}
