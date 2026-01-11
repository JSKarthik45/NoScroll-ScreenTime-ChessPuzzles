import { registerRootComponent } from 'expo';
import App from './App';
import { registerBackgroundReminder } from './src/services/backgroundReminder';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Register background reminder with minimal setup (runs ~every 15+ minutes)
registerBackgroundReminder(15);
