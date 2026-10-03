module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { browsers: ['last 2 Chrome versions'] } }],
    // development: true keeps __source / _debugSource on elements in dev builds
    ['@babel/preset-react', { runtime: 'automatic', development: process.env.NODE_ENV !== 'production' }],
    '@babel/preset-typescript',
  ],
};
