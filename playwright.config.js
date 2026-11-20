const { defineConfig, devices } = require('@playwright/test');
const chrome = process.env.PW_CHROME ? { launchOptions: { executablePath: process.env.PW_CHROME } } : {};
module.exports = defineConfig({
  testDir: 'tests', testMatch: /.*\.spec\.js/, timeout: 60000, workers: 2,
  webServer: { command: 'node tests/serve.js 31080', url: 'http://127.0.0.1:31080/', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:31080/', ...chrome },
  projects: [
    { name: 'pc', use: { viewport: { width: 1440, height: 900 }, ...chrome } },
    { name: 'ipad', use: { viewport: { width: 1024, height: 1366 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, ...chrome } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, ...chrome } }
  ]
});
