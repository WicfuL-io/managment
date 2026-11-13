
type OneSignalInstance = {
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  Notifications: {
    requestPermission: () => Promise<void>
    permission: boolean
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
    console.log('[OneSignal] Menunggu SDK...')

    if (!window.OneSignalDeferred) {
      window.OneSignalDeferred = []
    }

    let completed = false

    const timeout = window.setTimeout(() => {
      if (!completed) {
        completed = true
        reject(
          new Error(
            'OneSignal SDK tidak merespons. Periksa index.html dan koneksi internet.'
          )
        )
      }
    }, 15000)

    window.OneSignalDeferred.push(async (OneSignal) => {
      if (completed) return

      try {
        console.log('[OneSignal] SDK berhasil dimuat')

        const result = await callback(OneSignal)

        completed = true
        window.clearTimeout(timeout)

        resolve(result)
      } catch (error) {
        completed = true
        window.clearTimeout(timeout)

        reject(error)
      }
    })
  })
}

// Hubungkan perangkat dengan akun pengguna.
export function oneSignalLogin(userId: string): Promise<void> {
  return runOneSignal(async (OneSignal) => {
    if (!userId) {
      throw new Error('User ID tidak ditemukan.')
    }

    console.log('[OneSignal] Login External ID:', userId)

    await OneSignal.login(userId)

    console.log('[OneSignal] Akun berhasil dihubungkan')
  })
}

// Lepaskan identitas pengguna.
export function oneSignalLogout(): Promise<void> {
  return runOneSignal(async (OneSignal) => {
    await OneSignal.logout()

    console.log('[OneSignal] Logout berhasil')
  })
}

// Meminta izin notifikasi.
export function oneSignalRequestPermission(): Promise<{
  granted: boolean
  browserPermission: NotificationPermission
  oneSignalPermission: boolean
}> {
  return runOneSignal(async (OneSignal) => {
    console.log('[OneSignal] Meminta izin notifikasi...')

    if (!('Notification' in window)) {
      throw new Error('Browser tidak mendukung Notification API.')
    }

    await OneSignal.Notifications.requestPermission()

    const browserPermission = Notification.permission
    const oneSignalPermission =
      OneSignal.Notifications.permission

    const result = {
      granted:
        browserPermission === 'granted' &&
        oneSignalPermission === true,
      browserPermission,
      oneSignalPermission
    }

    console.log('[OneSignal] Hasil pemeriksaan:', result)

    return result
  })
}
