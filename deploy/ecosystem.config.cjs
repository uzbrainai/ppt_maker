// PM2 process config for the slidewind generation service.
//   cd /var/www/slidewind
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup        # survive reboots
//
// Runs the compiled service (run `npm run build` first). It reads ../.env via
// the app's own loader, and binds to 127.0.0.1:8081 (nginx proxies /api → here).
module.exports = {
  apps: [
    {
      name: 'slidewind-api',
      cwd: '/var/www/slidewind',
      script: 'dist/services/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      env: { NODE_ENV: 'production' },
      out_file: '/var/log/slidewind/out.log',
      error_file: '/var/log/slidewind/err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
