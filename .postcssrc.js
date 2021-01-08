module.exports = {
  parser: require('postcss-scss'),
  plugins: [
    require('precss'),
    require('autoprefixer'),
  ],
};
