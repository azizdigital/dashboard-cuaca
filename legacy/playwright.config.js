// Dashboard Cuaca Aziz - browser tests. First time: npx playwright install chromium
const { defineConfig } = require('@playwright/test');
const os = require('os');
const path = require('path');

const PORT = 42040;
module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:' + PORT + '/',
    launchOptions: process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME, args: ['--no-sandbox'] } : {}
  },
  webServer: {
    command: 'node server-only.js --mock',
    url: 'http://127.0.0.1:' + PORT + '/api/info',
    reuseExistingServer: false,
    env: { MC_APP: String(PORT), MC_SETUP: String(PORT + 1), MC_HTTPS: String(PORT + 2), MC_USERDATA: path.join(os.tmpdir(), 'mc-pw-' + Date.now()) }
  }
});
