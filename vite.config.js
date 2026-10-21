import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: 'src/main.js',
      output: { entryFileNames: 'main.js', chunkFileNames: '[name].js' },
    },
  },
  // En dev, la page publiée sur webflow.io charge http://localhost:5173/src/main.js
  server: { cors: { origin: ['https://kapam.webflow.io'] } },
  test: { include: ['test/**/*.test.js'] },
})
