import { ref } from 'vue'
import { defineStore } from 'pinia'
import { createFileService } from '../utils/fileServices.js'
import { getEvidenceLinks } from '../utils/session.js'

export const useAudioStore = defineStore('audio', () => {
  const fs = createFileService()

  // State
  const files = ref({})

  // Actions
  const reset = () => {
    for (const key of Object.keys(files.value)) {
      delete files.value[key]
    }
  }

  const load = async (specialty) => {
    try {
      const afiles = await fs.readAudio(specialty)
      afiles.forEach((x) => {
        files.value[x.name] = {}
        files.value[x.name]['URL'] = x.URL
        files.value[x.name]['count'] = 0
      })
    } catch (error) {
      // Audio directory might not exist yet, which is ok
      console.log('audioStore.load: ' + error.message)
    }
  }

  const updateCount = (obj) => {
    const audioLinks = getEvidenceLinks(JSON.stringify(obj))

    for (const [linkName, linkObj] of Object.entries(audioLinks)) {
      // Only track files that look like audio files
      if (linkName.includes('.webm')) {
        if (!files.value[linkName]) {
          files.value[linkName] = { URL: '', count: linkObj.count }
        } else {
          files.value[linkName].count = linkObj.count
        }
      }
    }
  }

  const add = async (specialty, fileName, buffer) => {
    try {
      const savedPath = await fs.saveAudio(specialty, fileName, buffer)

      // if file created or updated, update the URL
      if (savedPath !== null) {
        // if not tracking file, create record
        if (!files.value[fileName]) {
          files.value[fileName] = {}
          files.value[fileName]['count'] = 0
        }
        files.value[fileName]['URL'] = savedPath
      } else {
        if (!files.value[fileName]) {
          // file exists but was not being tracked. error
          throw new Error('audio.add: detected untracked file: ' + fileName)
        }
      }
    } catch (error) {
      throw new Error('audioStore.add: could not add audio: ' + error.message)
    }
  }

  const addCount = (fileName) => {
    if (!files.value[fileName]) {
      files.value[fileName] = { URL: '', count: 0 }
    }
    files.value[fileName].count++
  }

  const subtract = async (specialty, fileName) => {
    if (files.value[fileName].count == 1) {
      await fs.deleteAudio(specialty, fileName)
      delete files.value[fileName]
    } else {
      files.value[fileName].count--
    }
  }

  return {
    files,
    load,
    reset,
    add,
    addCount,
    subtract,
    updateCount,
  }
})
