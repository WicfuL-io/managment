
type OneSignalInstance = {
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  Notifications: {
    requestPermission: () => Promise<boolean>
    permission: boolean
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<
      (OneSignal: OneSignalInstance) => void | Promise<void>
    >
    OneSignalReady?: Promise<OneSignalInstance>
  }
}

const TIMEOUT = 15000

async function getOneSignal(): Promise<OneSignalInstance> {
  if (!window.OneSignalReady) {
    throw new Error('OneSignal belum diinisialisasi.')
  }

  let timeoutId: number | undefined

  try {
    return await Promise.race([
      window.OneSignalReady,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error('OneSignal tidak merespons dalam 15 detik.'))
        }, TIMEOUT)
      })
    ])
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
    }
  }
}

// Hubungkan perangkat dengan akun pengguna.
export async function oneSignalLogin(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('User ID tidak ditemukan.')
  }

  const OneSignal = await getOneSignal()

  console.log('[OneSignal] Login External ID:', userId)

  await OneSignal.login(userId)

  console.log('[OneSignal] Akun berhasil dihubungkan')
}

// Lepaskan identitas pengguna.
export async function oneSignalLogout(): Promise<void> {
  const OneSignal = await getOneSignal()

  await OneSignal.logout()

  console.log('[OneSignal] Logout berhasil')
}

// Meminta izin notifikasi.
export async function oneSignalRequestPermission(): Promise<{
  granted: boolean
  browserPermission: NotificationPermission
  oneSignalPermission: boolean
}> {
  if (!('Notification' in window)) {
    throw new Error('Browser tidak mendukung Notification API.')
  }

  const OneSignal = await getOneSignal()

  console.log('[OneSignal] Meminta izin notifikasi...')

  await OneSignal.Notifications.requestPermission()

  const browserPermission = Notification.permission
  const oneSignalPermission = OneSignal.Notifications.permission

  const result = {
    granted:
      browserPermission === 'granted' &&
      oneSignalPermission === true,
    browserPermission,
    oneSignalPermission
  }

  console.log('[OneSignal] Hasil pemeriksaan:', result)

  return result
}
