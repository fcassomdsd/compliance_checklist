export const createElectronService = () => {

  const defaultPathExists = async () => {
    return await window.electronAPI.checkDefaultPath();
  }

  const createDefaultPath = async () => {
    try {
      await window.electronAPI.createDefaultPath();  
    } catch(error) {
      throw error;
    }
  }

  return {
      defaultPathExists,
      createDefaultPath
  }

}