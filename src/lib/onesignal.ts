
type OneSignalInstance = {
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  Notifications: {
    requestPermission: () => Promise<void>
    permission: boolean
    permissionNative: NotificationPermission
    isPushSupported: () => boolean
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<
      (OneSignal: OneSignalInstance) => void | Promise<void>
    >
  }
}

function runOneSignal<T>(
  callback: (OneSignal: OneSignalInstance) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []

    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        const result = await callback(OneSignal)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    })
  })
}

// Hubungkan perangkat dengan akun yang sedang login.
export function oneSignalLogin(userId: string): Promise<void> {
  return runOneSignal(async (OneSignal) => {
    if (!userId) {
      throw new Error('User ID tidak ditemukan.')
    }

    await OneSignal.login(userId)
  })
}

// Lepaskan identitas akun dari perangkat.
export function oneSignalLogout(): Promise<void> {
  return runOneSignal(async (OneSignal) => {
    await OneSignal.logout()
  })
}

// Meminta izin dan memeriksa status notifikasi.
export function oneSignalRequestPermission(): Promise<{
  granted: boolean
  browserPermission: NotificationPermission
  oneSignalPermission: boolean
  supported: boolean
}> {
  return runOneSignal(async (OneSignal) => {
    // Periksa dukungan browser.
    const supported = OneSignal.Notifications.isPushSupported()

    if (!supported) {
      return {
        granted: false,
        browserPermission:
          typeof Notification !== 'undefined'
            ? Notification.permission
            : 'denied',
        oneSignalPermission: false,
        supported: false
      }
    }

    // Minta izin notifikasi.
    await OneSignal.Notifications.requestPermission()

    // Periksa izin asli dari browser.
    const browserPermission =
      typeof Notification !== 'undefined'
        ? Notification.permission
        : 'denied'

    // Periksa izin dari OneSignal.
    const oneSignalPermission =
      OneSignal.Notifications.permission

    return {
      granted:
        browserPermission === 'granted' &&
        oneSignalPermission === true,
      browserPermission,
      oneSignalPermission,
      supported: true
    }
  })
}
