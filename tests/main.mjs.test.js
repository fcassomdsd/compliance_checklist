import { describe, it, expect } from 'vitest'
import os from 'node:os'

describe('main.mjs logic', () => {
  it('should detect platform correctly', () => {
    const isMac = os.platform() === 'darwin'
    const isWindows = os.platform() === 'win32'
    const isLinux = os.platform() === 'linux'
    expect([isMac, isWindows, isLinux].some(Boolean)).toBe(true)
  })
})
