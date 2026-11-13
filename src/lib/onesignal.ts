
type OneSignalInstance = {
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  Notifications: {
    requestPermission: () => Promise<boolean>
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
export function oneSignalLogin(userId: string) {
  return runOneSignal(async (OneSignal) => {
    await OneSignal.login(userId)
  })
}

// Lepaskan identitas akun dari perangkat.
export function oneSignalLogout() {
  return runOneSignal(async (OneSignal) => {
    await OneSignal.logout()
  })
}

// Minta izin notifikasi dari pengguna.
export function oneSignalRequestPermission() {
  return runOneSignal(async (OneSignal) => {
    return await OneSignal.Notifications.requestPermission()
  })
}
