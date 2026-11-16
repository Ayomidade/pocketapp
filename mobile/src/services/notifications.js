import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiRequest } from './apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function configureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('incidents', {
    name: 'Critical Incidents',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#A52F2A',
  });

  await Notifications.setNotificationChannelAsync('deployments', {
    name: 'Deployments & Builds',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#236C7B',
  });

  await Notifications.setNotificationChannelAsync('health', {
    name: 'Service Health & Recovery',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#246C4B',
  });

  await Notifications.setNotificationChannelAsync('git', {
    name: 'Pull Request & CI Checks',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#315F91',
  });
}

export async function registerPushNotificationsAsync() {
  await configureAndroidNotificationChannels();

  if (!Device.isDevice) {
    return { status: 'simulator_unsupported', token: null };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return { status: 'denied', token: null };
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const expoPushToken = tokenResponse.data;

  await apiRequest('/ops/notifications/devices', {
    method: 'POST',
    body: {
      expoPushToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceName: Device.modelName || 'Android Device',
    },
  });

  return { status: 'granted', token: expoPushToken };
}
