// apps\mobile\webpack.config.js
const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Ensure entry point is properly set
  if (!config.entry || config.entry.length === 0) {
    config.entry = [path.resolve(__dirname, 'index.js')];
  }

  // Add module resolution for React Native Web
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native': 'react-native-web',
    // Add these new aliases to fix the errors
    'react-native-vector-icons': '@expo/vector-icons',
    '@react-native-vector-icons/get-image': '@expo/vector-icons',
    '@react-native-vector-icons/material-design-icons': '@expo/vector-icons/MaterialIcons',
    '@react-native-vector-icons/common': '@expo/vector-icons',
    'react-native/Libraries/Image/AssetRegistry': '@react-native/assets-registry/registry',
  };

  // Add babel loader configuration
  config.module.rules.push({
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: /node_modules\/(?!(react-native|@react-native|react-native-.*|@react-navigation|react-navigation|@expo|expo|native-base|react-native-paper|react-native-vector-icons)\/).*/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['babel-preset-expo'],
        plugins: [
          'react-native-reanimated/plugin',
        ],
      },
    },
  });

  // Add CSS support for better web styling
  config.module.rules.push({
    test: /\.css$/,
    use: ['style-loader', 'css-loader'],
  });

  // Optimize for web performance
  if (env.mode === 'production') {
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };
  }

  return config;
};