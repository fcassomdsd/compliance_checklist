import parseChecklist from '../utils/checklist.js';
import parseSession from '../utils/session.js';

export const createFileService = () => {

  // Default maximum file upload size
  //const MAX_FILE_SIZE = getSizeAndSuffix("10MB");
  const EVIDENCE_MAX_SIZE = getSizeAndSuffix("10MB");
  const DEFAULT_ROOT = null;

  function getSizeAndSuffix(sizeString) {
    
    const suffix = [
      { "finder" : "B", "power" : 0, "base" : 1 },    
      { "finder" : "KB", "power" : 1, "base" : 1000, "label" : "kB" },    
      { "finder" : "MB", "power" : 2, "base" : 1000 },    
      { "finder" : "GB", "power" : 3, "base" : 1000 },    
      { "finder" : "KIB", "power" : 1, "base" : 1024, "label" : "KiB" },    
      { "finder" : "MIB", "power" : 2, "base" : 1024, "label" : "MiB" },    
      { "finder" : "GIB", "power" : 3, "base" : 1024, "label" : "GiB" }
    ]
    
    // separate the size and the suffix
    const ss = sizeString.match(/^([0-9]+([.][0-9]+){0,1})|([kmg]i{0,1}){0,1}b$/gi);
    if (!ss) {
      throw new Error("Invalid file size format: " + sizeString);
    }

    // get information about the suffix
    const suffixInfo = suffix.find((x) => x.finder == ss[1].toUpperCase());
      
    const totalSize = Number.parseFloat(ss[0]) * Math.pow(suffixInfo.base, suffixInfo.power);
    const sizeLabel = ( "label" in suffixInfo ? suffixInfo.label : suffixInfo.finder );

    return { "size" : totalSize, "label" : ss[0] + sizeLabel };
  }

  const defaultPathExists = async () => {
    try {
      return await window.electronAPI.checkPath(DEFAULT_ROOT);
    } catch (error) {
      throw new Error("defaultPathExists: could not check default path: " + error.message);
    }
  }

  const setSavePath = async (specialty) => {
  try {
      const filePath = window.electronAPI.getPath(DEFAULT_ROOT, specialty);
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, specialty)) {
        return filePath;
      }
      else {
        return null;
      }
    } catch (error) {
      throw new Error(`setSavePath: could not save path ${specialty} : ` + error.message);
    }
  }

  const createDefaultPath = async (filePath) => {
    try {
      await window.electronAPI.createDir(DEFAULT_ROOT, filePath, "Evidence");  
    } catch (error) {
      throw new Error(`createDefaultPath: could not create path ${filePath} : ` + error.message);
    }
  }

  const saveEvidence = async (specialty, fileName, buffer) => {
    try {
      const fileSize = buffer.bytelength;
      if (fileSize > EVIDENCE_MAX_SIZE.size) {
        throw new Error(`File size exceeds ${EVIDENCE_MAX_SIZE.label} limit`);
      }
       // save if file doesn't exist or the size is different
      const stats = await window.electronAPI.getStats(DEFAULT_ROOT, specialty, "Evidence", fileName); 
      if (!stats || (fileSize != stats.size)) {
        const savedPath = await window.electronAPI.saveFile(Array.from(buffer), DEFAULT_ROOT, specialty, "Evidence", fileName);
        return savedPath;
      }
      else {
        return null;
      }
    } catch (error) {
      throw new Error(`saveEvidence: could not save evidence for ${specialty}/${fileName} : ` + error.message);
    }
  }

  const deleteEvidence = async (specialty, fileName) => {
    try {
      const deleted = await window.electronAPI.deleteFile(DEFAULT_ROOT, specialty, "Evidence", fileName);
      return deleted;
    } catch (error) {
      throw new Error(`deleteEvidence: could not delete evidence ${specialty}/${fileName} : ` + error.message);
    }
  }
  
  const loadChecklist = async (specialty) => {
    try {
      const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, specialty, "checklist.json")
      return parseChecklist(fileContents);
    } catch (error) {
      throw new Error(`loadChecklist: could not load checklist for ${specialty} : ` + error.message);
    }
  }
  
  const loadSession = async (specialty) => {
    try {
      const toFilePath = window.electronAPI.getPath(DEFAULT_ROOT, specialty, "session.json");
      const found = await window.electronAPI.checkPath(DEFAULT_ROOT, specialty, "session.json");
      if (found) {
        const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, specialty, "session.json")
        return parseSession(fileContents);
      }
      else {
        return null;
      }
    } catch (error) {
      throw new Error(`loadSession: could not load session for ${specialty} : ` + error.message);
    }
  }
  
  const readEvidence = async (specialty) => {
    try {
      const dirList = await window.electronAPI.listPath(DEFAULT_ROOT, specialty, "Evidence");
      return dirList;
    } catch (error) {
      throw new Error(`readEvidence: could not read evidence for ${specialty} : ` + error.message);
    }
  }
  
  const saveSession = async (specialty, jsonObj) => {
    try {
      const sessionString = (typeof jsonObj === 'object' ? JSON.stringify(jsonObj, null, 2) : jsonObj);
      await window.electronAPI.saveFile(sessionString, DEFAULT_ROOT, specialty, "session.json");
      return true;
    } catch (error) {
      throw new Error(`saveSession: could not save session for ${specialty} : ` + error.message);
    }
  }
  
  return {
    defaultPathExists,
    setSavePath,
    createDefaultPath,
    saveEvidence,
    deleteEvidence,
    loadChecklist,
    loadSession,
    readEvidence,
    saveSession
  }
}
