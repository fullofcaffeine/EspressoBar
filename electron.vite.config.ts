import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.ELECTRON_TEST_MODE': JSON.stringify(process.env.ELECTRON_TEST_MODE)
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {}
})
