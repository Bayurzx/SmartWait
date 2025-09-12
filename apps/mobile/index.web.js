import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Register the app for web
AppRegistry.registerComponent(appName.expo.name || 'SmartWait', () => App);
AppRegistry.runApplication(appName.expo.name || 'SmartWait', {
  initialProps: {},
  rootTag: document.getElementById('root'),
});