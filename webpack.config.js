const path = require('path');

module.exports = {
  entry: './face-auth.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'face-auth.min.js',
    library: 'FaceAuth',
    libraryTarget: 'umd',
    libraryExport: 'default',
    globalObject: 'this'
  },
  externals: {
    '@tensorflow/tfjs': {
      commonjs: '@tensorflow/tfjs',
      commonjs2: '@tensorflow/tfjs',
      amd: '@tensorflow/tfjs',
      root: 'tf'
    },
    '@tensorflow-models/face-landmarks-detection': {
      commonjs: '@tensorflow-models/face-landmarks-detection',
      commonjs2: '@tensorflow-models/face-landmarks-detection',
      amd: '@tensorflow-models/face-landmarks-detection',
      root: 'faceLandmarksDetection'
    }
  },
  mode: 'production'
};