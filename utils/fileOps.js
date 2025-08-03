const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
  }
  catch(e) {
    return null;
  }
}

function saveEvidenceFile(buffer, toFilePath) {
 
  if (!ensureDir(path.dirname(toFilePath))) {
    throw new Error("Could not create directory: " + path.dirname(toFilePath));
  }

  fs.writeFileSync(toFilePath, buffer);
  
  return toFilePath;
}

function deleteFile(filePath) {

  return (fs.existsSync(filePath) ? fs.unlinkSync(filePath) === undefined : false);

}

function validateEvidence(dirPath, archivo) {

  const filePath = path.join(dirPath, archivo.name);
  const fileExists = fs.existsSync(filePath);

  // see if it is the same:  has the same name and size.  If it doestn't exist, it's not the same
  const fileIsSame = (fileExists ? fs.statSync(filePath).size == archivo.size : false);

  return { fileExists, fileIsSame };
  
  };

module.exports = { saveEvidenceFile, deleteFile, validateEvidence };