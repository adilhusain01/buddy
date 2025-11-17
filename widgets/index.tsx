import { registerWidget } from '@bittingz/expo-widgets';
import BuddyTaskWidget from '../components/BuddyTaskWidget';

// Register the widget with the system
registerWidget({
  name: 'BuddyTaskWidget',
  component: BuddyTaskWidget,
});

export { BuddyTaskWidget };