export const createElectronService = () => {

  const defaultPathExists = async () => {
    return await window.electronAPI.checkDefaultPath();
  }

  const createPath = async (filePath) => {
    try {
      await window.electronAPI.createPath(filePath);  
    } catch(error) {
      throw error;
    }
  }

  return {
      defaultPathExists,
      createPath
  }

}