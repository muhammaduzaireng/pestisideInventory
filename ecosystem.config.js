module.exports = {
  apps: [
    {
      name: 'sales-app-backend',
      script: './sales-app-backend/server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5002,
        SERVE_FRONTEND: 'false' // Set to 'true' if you want backend to serve frontend
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      merge_logs: true
    },
    {
      name: 'sales-app-frontend',
      script: 'npx',
      args: 'serve -s build -l 3000',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      merge_logs: true
    }
  ]
};
