module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/services': './src/services',
            '@/types': './src/types',
            '@/hooks': './src/hooks',
            '@/utils': './src/utils',
            // Add aliases to fix the module resolution errors
            'react-native-vector-icons': '@expo/vector-icons',
            '@react-native-vector-icons/get-image': '@expo/vector-icons',
            '@react-native-vector-icons/material-design-icons': '@expo/vector-icons/MaterialIcons',
            'react-native/Libraries/Image/AssetRegistry': '@react-native/assets-registry/registry',
          },
        },
      ],
    ],
  };
};