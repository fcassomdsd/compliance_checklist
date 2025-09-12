const fs = require('fs').promises;
const path = require('path');
const logger = require('./wlogger');

const fileExists = async (filePath) => {

  try {
    await fs.access(safePath(filePath));  
    return true;
  } catch (error) {
      if (error.code == "ENOENT") {
        // it doesn't exist
        return false; 
      }       
      else {
        logger.error("fileExists: could not get access to file " + filePath);
        throw error;     
     }
  }
}

const safeJoin = (base, input) => {
  const resolved = path.resolve(base, input);
  if (!resolved.startsWith(base)) {
    throw new Error('safeJoin: Invalid path: Path traversal detected: ' + base + "/" + input);
  }
  return resolved;
};

const safePath = (filePath) => {

  if (typeof filePath !== "string" || filePath.includes("..") ) {
    throw new Error("safePath: Illegal path name: " + filePath);    
  }
  else {
    return filePath;  
  }
}

async function ensureDir(dirPath) {
  try {
    const found = await fileExists(dirPath);
    if (!found) {
      fs.mkdir(safePath(dirPath), { recursive: true });
    }
    return dirPath;
  }
  catch(e) {
    logger.error(`ensurePath: Could not create directory ${dirPath}`, e);
    throw e;
  }
}

async function listDir(dirPath) {

  try {
    const toDirPath = safePath(dirPath);
    const found = await fileExists(toDirPath);
    if (found) {
      const dirContents = await fs.readdir(toDirPath); 
      return dirContents.map( (x) => ( { "name": x, "URL" : path.join(toDirPath, x), "count" : 0 } ) );
    }
    else {
      throw new Error(`readDir: Directory does not exist: ${dirPath}`);
    }
  } catch (error) {
    logger.error(`Could not read contents of directory ${dirPath} `, error);
    throw error;
  }

}

async function readFile(filePath) {

  try {
    const toFilePath = safePath(filePath);
    const found = await fileExists(toFilePath);
    if (found) {
      const fileContents = await fs.readFile(toFilePath, 'utf-8'); 
      return fileContents;
    }
    else {
      throw new Error(`readFile: File does not exist: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Could not read contents of file ${filePath} `, error);
    throw error;
  }

}

async function saveFile(filePath, buffer) {
 
  try {
    const toFilePath = safePath(filePath);
    await ensureDir(path.dirname(filePath));
  
    fs.writeFile(toFilePath, buffer, 'utf-8');
    logger.info("saveEvidenceFile : returning " + filePath);
    return filePath;
  } catch (error) {
    logger.error("Could not save file: " + filePath + " :", error);
    throw error;
  }
}

async function deleteFile(filePath) {

  try {
    await fs.unlink(safePath(filePath)); 
    return true;
  } catch (error) {
    logger.error(`Could not delete file ${filePath}`, error);
    throw error;  
  }
  
}

async function getFileStats(filePath) {

  try {
    const fileStats = await fs.stat(filePath);
    return fileStats;
  } catch (error) {
    if (error.code == "ENOENT") {
      // it doesn't exist, so valid for writing.
      logger.info("getFileStats: file does not exist, returning null: " + filePath);
      return null; 
    }       
    else {
      throw error;     
    }
  }
}

module.exports = { fileExists, safeJoin, safePath, ensureDir, listDir, readFile, saveFile, deleteFile, getFileStats };
