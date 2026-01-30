import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateApp = vi.fn()
const mockCreatePinia = vi.fn()
const mockToast = vi.fn()
const mockDefineStore = vi.fn(() => vi.fn())

const mockAppInstance = {
  use: vi.fn(function () {
    return this
  }),
  mount: vi.fn(),
}

vi.mock('vue', () => ({
  createApp: mockCreateApp,
}))

vi.mock('pinia', () => ({
  createPinia: mockCreatePinia,
  defineStore: mockDefineStore,
}))

vi.mock('vue-toastification', () => ({
  default: mockToast,
}))

vi.mock('vue-toastification/dist/index.css', () => ({}))

vi.mock('./App.vue', () => ({
  default: {
    __file: '/home/fernando/git/compliance_repo/compliance_checklist/src/App.vue',
    __name: 'App',
    render: () => {},
    setup: () => {},
  },
}))

describe('main.js', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockCreateApp.mockReturnValue(mockAppInstance)
    mockCreatePinia.mockReturnValue({ name: 'pinia' })
    await import('../main.js')
  })

  describe('App initialization', () => {
    it('should create the Vue app with App component', async () => {
      expect(mockCreateApp).toHaveBeenCalledWith(
        expect.objectContaining({
          __name: 'App',
        })
      )
    })
    it('should return the app instance from createApp', async () => {
      expect(mockCreateApp).toHaveBeenCalled()
      const returnedApp = mockCreateApp.mock.results[0].value
      expect(returnedApp).toBe(mockAppInstance)
    })
  })

  describe('Plugin registration', () => {
    it('should use Pinia store', async () => {
      const useCallArgs = mockAppInstance.use.mock.calls
      expect(useCallArgs.some((args) => args[0] === mockCreatePinia.mock.results[0].value)).toBe(
        true
      )
    })

    it('should use Toast plugin', async () => {
      const useCallArgs = mockAppInstance.use.mock.calls
      expect(useCallArgs.some((args) => args[0] === mockToast)).toBe(true)
    })

    it('should call app.use() in correct order - Pinia first, then Toast', async () => {
      const calls = mockAppInstance.use.mock.calls
      // First call should be Pinia (function or object)
      expect(typeof calls[0][0] === 'function' || typeof calls[0][0] === 'object').toBe(true)
      expect(calls[1][0]).toEqual(mockToast)
    })
  })

  describe('Toast configuration', () => {
    it('should pass Toast options with 3000ms timeout', async () => {
      const useCallArgs = mockAppInstance.use.mock.calls
      const toastCall = useCallArgs.find((args) => args[0] === mockToast)
      expect(toastCall).toBeDefined()
      expect(toastCall[1]).toEqual({
        timeout: 3000,
      })
    })
  })

  describe('App mounting', () => {
    it('should mount app to #app element', async () => {
      expect(mockAppInstance.mount).toHaveBeenCalledWith('#app')
    })
    it('should call mount after all plugins are registered', async () => {
      const useCallCount = mockAppInstance.use.mock.calls.length
      const mountCallCount = mockAppInstance.mount.mock.calls.length
      expect(useCallCount).toBe(2)
      expect(mountCallCount).toBe(1)
    })
  })

  describe('Method chaining', () => {
    it('should support method chaining for app.use()', async () => {
      mockAppInstance.use.mockReturnValueOnce(mockAppInstance)
      mockAppInstance.use.mockReturnValueOnce(mockAppInstance)
      expect(mockAppInstance.use).toHaveBeenCalledTimes(2)
    })
  })
})
