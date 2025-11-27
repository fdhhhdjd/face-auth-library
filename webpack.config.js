const path = require('path');

module.exports = {
  entry: './face-auth.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'face-auth.min.js',
    library: 'FaceAuth',
    libraryTarget: 'umd',
    globalObject: 'this',
    clean: true
  },
  mode: 'production',
  externals: {
    '@tensorflow/tfjs': 'tf',
    '@tensorflow-models/face-landmarks-detection': 'faceLandmarksDetection'
  }
};