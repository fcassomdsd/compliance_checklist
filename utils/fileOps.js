const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');

const safeJoin = (base, input) => {
  const resolved = path.resolve(base, input);
  if (!resolved.startsWith(base)) {
    throw new Error('Invalid path: Path traversal detected');
  }
  return resolved;
};

const safePath = (filePath) => {

  if (typeof filePath !== "string" || filePath.includes("..") ) {
    throw new Error("Illegal path name");    
  }
  else {
    return filePath;  
  }
}

async function ensureDir(dirPath) {
  try {
    fs.mkdir(safePath(dirPath), { recursive: true });
    return dirPath;
  }
  catch(e) {
    logger.error(`Could not create directory ${dirPath}`, e);
    throw e;
  }
}

async function readDir(ruta) {

  try {
    
    await ensureDir(ruta);
    const dirContents = await fs.readdir(ruta); 
    return dirContents.map( (x) => ( { "name": x, "URL" : path.join(ruta, x), "count" : 0 } ) );
  } catch (error) {
    logger.error(`Could not read contents of directory ${ruta} `, error);
    throw error;
  }

}

async function saveEvidenceFile(fileDir, fileObj) {
 
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const MAX_SIZE_LABEL = '100' + 'MB';
 
  try {
    const filePath = safeJoin(fileDir, fileObj.name);
    await ensureDir(path.dirname(filePath));
  
    if (fileObj.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${MAX_SIZE_LABEL} limit`);
    }
 
    if (await validForWrite(filePath, fileObj.size)) {
      fs.writeFile(filePath, fileObj.buffer);
      logger.info("saveEvidenceFile : returning " + filePath);
      return filePath;
    }
    else {
      logger.info("saveEvidenceFile : returning null");
      return null;    
    }
    return filePath;
  } catch (error) {
    logger.error("Could not save evidence file: ", error);
    throw error;
  }

}

async function deleteFile(filePath) {

  try {
    fs.unlink(safePath(filePath)); 
    return true;
  } catch (error) {
    logger.error(`Could not delete file ${filePath}`, error);
    throw error;  
  }
  
}

async function validForWrite(filePath, fileSize) {

  try {
    const fileStats = await fs.stat(filePath);
    logger.info(fileStats);

    // if size is different, file is different.  valid for writing
    logger.info("validForWrite: returning " + (fileStats.size != fileSize));
    return (fileStats.size != fileSize);
    } catch (error) {
      if (error.code == "ENOENT") {
        // it doesn't exist, so valid for writing.
        logger.info("validForWrite: returning true");
        return true; 
      }       
      else {
        throw error;     
     }
    }
}

module.exports = { saveEvidenceFile, deleteFile, readDir, safeJoin, safePath };