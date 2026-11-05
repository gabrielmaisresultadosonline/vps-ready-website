module.exports = {
  apps: [{
    name: 'nosilva-drinks',
    script: 'src/server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '250M',
    node_args: '--max-old-space-size=200',
    out_file: '/var/www/nosilva-drinks/logs/app-out.log',
    error_file: '/var/www/nosilva-drinks/logs/app-error.log',
    env: { NODE_ENV: 'production' },
  }],
};
