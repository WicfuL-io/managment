/**
 * APK MANAGEMENT - GOOGLE APPS SCRIPT BACKEND
 *
 * POS:
 * - Tunai, Transfer, QRIS = transaksi berbayar.
 * - Ambil Sendiri = gratis, tanpa pemasukan.
 * - Stok tetap berkurang untuk semua checkout.
 *
 * NOTIFICATIONS:
 * - Notifikasi internal tersimpan di Google Sheets.
 * - Setiap pengguna hanya dapat melihat notifikasinya sendiri.
 * - Aktivitas pengguna dikirim kepada pengguna aktif lain
 *   yang memiliki akses ke modul terkait.
 */

// ======================================================
// KONFIGURASI
// ======================================================

const SPREADSHEET_ID = '127iYthDvHpufZo02bKnqZxXivlAoEHLgdmXI-lOX0X8';
const SESSION_TTL_SECONDS = 21600;

const SHEETS = {
  Users: [
    'id', 'name', 'email', 'passwordHash', 'salt',
    'role', 'status', 'permissions', 'createdAt', 'updatedAt'
  ],

  LoginLogs: [
    'id', 'userId', 'email', 'event', 'timestamp',
    'ipAddress', 'deviceType', 'browser', 'platform',
    'userAgent', 'language', 'screen', 'timezone', 'detail'
  ],

  ActivityLogs: [
    'id', 'userId', 'email', 'action', 'module',
    'description', 'timestamp', 'ipAddress'
  ],

  Items: [
    'id', 'name', 'category', 'unit', 'minStock',
    'createdAt', 'updatedAt'
  ],

  StockBatches: [
    'id', 'itemId', 'itemName', 'qty', 'buyPrice',
    'buyDate', 'expiryDate', 'supplier', 'createdAt'
  ],

  StockMovements: [
    'id', 'itemId', 'batchId', 'itemName', 'type',
    'qty', 'date', 'note', 'userId', 'createdAt'
  ],

  IncomeCategories: [
    'id', 'name', 'createdAt'
  ],

  ExpenseCategories: [
    'id', 'name', 'createdAt'
  ],

  Transactions: [
    'id', 'type', 'date', 'description', 'categoryId',
    'categoryName', 'amount', 'method', 'userId', 'createdAt'
  ],

  Settings: [
    'key', 'value', 'updatedAt'
  ],

  Debts: [
    'id',
    'direction',
    'kind',
    'partyName',
    'partyContact',
    'description',
    'itemName',
    'unit',
    'qty',
    'settledQty',
    'totalAmount',
    'paidAmount',
    'date',
    'dueDate',
    'status',
    'note',
    'isArchived',
    'userId',
    'createdAt',
    'updatedAt'
  ],

  DebtPayments: [
    'id',
    'debtId',
    'date',
    'paymentType',
    'amount',
    'qty',
    'note',
    'userId',
    'createdAt'
  ],

  // SHEET BARU UNTUK PUSAT NOTIFIKASI
  Notifications: [
    'id',
    'userId',
    'actorId',
    'actorName',
    'action',
    'module',
    'title',
    'message',
    'createdAt',
    'isRead',
    'readAt',
    'referenceId'
  ]
};


// ======================================================
// API
// ======================================================

function doGet() {
  return json_({
    success: true,
    message: 'APK Management API aktif',
    version: '1.2.0'
  });
}


function doPost(e) {
  try {
    const body = JSON.parse(
      (e && e.postData && e.postData.contents) || '{}'
    );

    const action = String(body.action || '');
    const result = route_(action, body);

    return json_({
      success: true,
      data: result
    });

  } catch (err) {
    return json_({
      success: false,
      message: err && err.message
        ? err.message
        : 'Terjadi kesalahan server.'
    });
  }
}


// ======================================================
// ROUTER
// ======================================================

function route_(action, body) {
  switch (action) {

    // SYSTEM
    case 'setup':
      return setupSheets();

    // AUTH
    case 'register':
      return register_(body);

    case 'login':
      return login_(body);

    case 'logout':
      return logout_(body);

    case 'me':
      return publicUser_(requireSession_(body.token));

    // ADMIN
    case 'admin.listUsers':
      requireAdmin_(body.token);
      return rows_('Users').map(publicUser_);

    case 'admin.approveUser':
      return approveUser_(body);

    case 'admin.setUserStatus':
      return setUserStatus_(body);

    case 'admin.setPermissions':
      return setPermissions_(body);

    case 'admin.loginLogs':
      requireAdmin_(body.token);
      return rows_('LoginLogs').slice(-500).reverse();

    case 'admin.activityLogs':
      requireAdmin_(body.token);
      return rows_('ActivityLogs').slice(-500).reverse();

    // DASHBOARD
    case 'dashboard.summary':
      requirePermission_(body.token, 'Dashboard');
      return dashboard_();

    // STOCK
    case 'stock.list':
      requirePermission_(body.token, 'Stock Barang');

      return {
        items: rows_('Items'),
        batches: rows_('StockBatches'),
        movements: rows_('StockMovements')
      };

    case 'stock.add':
      return addStock_(body);

    case 'stock.remove':
      return removeStock_(body);

    // FINANCE
    case 'finance.list':
      requirePermission_(body.token, 'Keuangan');

      return {
        transactions: rows_('Transactions'),
        incomeCategories: rows_('IncomeCategories'),
        expenseCategories: rows_('ExpenseCategories')
      };

    case 'finance.add':
      return addTransaction_(body);

    case 'finance.addCategory':
      return addCategory_(body);

    // POS
    case 'pos.checkout':
      return checkoutPOS_(body);

    // DEBT & RECEIVABLE
    case 'debt.list':
      requirePermission_(body.token, 'Utang & Piutang');
      return debtList_();

    case 'debt.summary':
      requirePermission_(body.token, 'Utang & Piutang');
      return debtSummary_();

    case 'debt.detail':
      requirePermission_(body.token, 'Utang & Piutang');
      return debtDetail_(body);

    case 'debt.add':
      return addDebt_(body);

    case 'debt.payment':
      return addDebtPayment_(body);

    case 'debt.update':
      return updateDebt_(body);

    case 'debt.archive':
      return archiveDebt_(body);

    case 'debt.archived.list':
      requirePermission_(body.token, 'Utang & Piutang');
      return debtArchivedList_();

    case 'debt.restore':
      return restoreDebt_(body);

    // NOTIFICATIONS
    case 'notifications.list':
      return notificationList_(body);

    case 'notifications.unreadCount':
      return notificationUnreadCount_(body);

    case 'notifications.markRead':
      return notificationMarkRead_(body);

    case 'notifications.markAllRead':
      return notificationMarkAllRead_(body);

    default:
      throw new Error('Action tidak dikenal: ' + action);
  }
}


// ======================================================
// SETUP SHEETS
// ======================================================

function setupSheets() {
  const ss = ss_();

  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
    }

    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
    }
  });

  return 'Semua sheet berhasil disiapkan.';
}


// ======================================================
// AUTHENTICATION
// ======================================================

function register_(b) {
  const name = String(b.name || '').trim();
  const email = normalizeEmail_(b.email);
  const password = String(b.password || '');

  if (
    name.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('Nama atau email tidak valid.');
  }

  if (password.length < 8) {
    throw new Error('Password minimal 8 karakter.');
  }

  if (
    rows_('Users').some(
      u => normalizeEmail_(u.email) === email
    )
  ) {
    throw new Error('Email sudah terdaftar.');
  }

  const salt = Utilities.getUuid();

  append_('Users', [
    id_(),
    name,
    email,
    hash_(password, salt),
    salt,
    'staff',
    'pending',
    JSON.stringify(['Dashboard']),
    new Date(),
    new Date()
  ]);

  appendLoginLog_(
    '',
    email,
    'REGISTER_PENDING',
    b.client || {},
    'Menunggu persetujuan admin'
  );

  // Beri tahu semua admin aktif bahwa ada pendaftaran baru.
  notifyAdmins_(
    'REGISTER_PENDING',
    'Pendaftaran pengguna baru',
    name + ' (' + email + ') mendaftar dan menunggu persetujuan admin.'
  );

  return {
    status: 'pending',
    message: 'Pendaftaran menunggu persetujuan admin.'
  };
}


function login_(b) {
  const email = normalizeEmail_(b.email);
  const password = String(b.password || '');

  const user = rows_('Users').find(
    u => normalizeEmail_(u.email) === email
  );

  const client = b.client || {};

  if (!user || hash_(password, user.salt) !== user.passwordHash) {
    appendLoginLog_(
      user ? user.id : '',
      email,
      'LOGIN_FAILED',
      client,
      'Email atau password salah'
    );

    throw new Error('Email atau password salah.');
  }

  if (user.status !== 'active') {
    appendLoginLog_(
      user.id,
      email,
      'LOGIN_BLOCKED',
      client,
      'Status akun: ' + user.status
    );

    throw new Error(
      user.status === 'pending'
        ? 'Akun Anda masih menunggu persetujuan admin.'
        : 'Akun Anda dinonaktifkan.'
    );
  }

  const token = Utilities.getUuid() + Utilities.getUuid();

  CacheService.getScriptCache().put(
    'session_' + token,
    JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role
    }),
    SESSION_TTL_SECONDS
  );

  appendLoginLog_(
    user.id,
    email,
    'LOGIN_SUCCESS',
    client,
    'Login berhasil'
  );

  activity_(
    user,
    'LOGIN',
    'Auth',
    'Pengguna login'
  );

  return {
    token: token,
    user: publicUser_(user)
  };
}


function logout_(b) {
  if (b.token) {
    CacheService.getScriptCache().remove(
      'session_' + b.token
    );
  }

  return {
    loggedOut: true
  };
}


// ======================================================
// ADMIN
// ======================================================

function approveUser_(b) {
  const admin = requireAdmin_(b.token);

  const target = rows_('Users').find(
    u => u.id === b.userId
  );

  if (!target) {
    throw new Error('User tidak ditemukan.');
  }

  updateById_('Users', target.id, {
    status: 'active',
    role: b.role === 'admin' ? 'admin' : 'staff',
    updatedAt: new Date()
  });

  activity_(
    admin,
    'USER_APPROVED',
    'Pengguna',
    'Menyetujui akun pengguna ' + target.name
  );

  return { approved: true };
}


function setUserStatus_(b) {
  const admin = requireAdmin_(b.token);

  if (!['active', 'blocked'].includes(b.status)) {
    throw new Error('Status tidak valid.');
  }

  const target = rows_('Users').find(
    u => String(u.id) === String(b.userId)
  );

  if (!target) {
    throw new Error('User tidak ditemukan.');
  }

  updateById_('Users', b.userId, {
    status: b.status,
    updatedAt: new Date()
  });

  activity_(
    admin,
    'USER_STATUS',
    'Pengguna',
    'Mengubah status ' + target.name + ' menjadi ' + b.status
  );

  return { updated: true };
}


function setPermissions_(b) {
  const admin = requireAdmin_(b.token);

  if (!Array.isArray(b.permissions)) {
    throw new Error('Permissions harus berupa array.');
  }

  const target = rows_('Users').find(
    u => String(u.id) === String(b.userId)
  );

  if (!target) {
    throw new Error('User tidak ditemukan.');
  }

  updateById_('Users', b.userId, {
    permissions: JSON.stringify(b.permissions),
    updatedAt: new Date()
  });

  activity_(
    admin,
    'USER_PERMISSION',
    'Pengguna',
    'Memperbarui hak akses ' + target.name
  );

  return { updated: true };
}


// ======================================================
// STOCK
// ======================================================

function addStock_(b) {
  const user = requirePermission_(b.token, 'Tambah barang');

  const name = String(b.name || '').trim();
  const qty = Number(b.qty);
  const buyDate = String(b.buyDate || '');
  const expiry = String(b.expiryDate || '');
  const buyPrice = Number(b.buyPrice || 0);

  if (
    !name ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(buyPrice) ||
    buyPrice < 0 ||
    !buyDate ||
    !expiry ||
    expiry < buyDate
  ) {
    throw new Error('Data barang tidak valid.');
  }

  const batches = rows_('StockBatches');

  if (
    batches.some(x =>
      String(x.itemName).toLowerCase() === name.toLowerCase() &&
      String(x.buyDate).slice(0, 10) === buyDate &&
      String(x.expiryDate).slice(0, 10) === expiry
    )
  ) {
    throw new Error(
      'Batch dengan nama, tanggal beli, dan expired yang sama sudah ada.'
    );
  }

  let item = rows_('Items').find(
    x => String(x.name).toLowerCase() === name.toLowerCase()
  );

  if (!item) {
    item = {
      id: id_(),
      name: name,
      category: String(b.category || 'Umum'),
      unit: String(b.unit || 'pcs'),
      minStock: Number(b.minStock || 0)
    };

    append_('Items', [
      item.id,
      item.name,
      item.category,
      item.unit,
      item.minStock,
      new Date(),
      new Date()
    ]);
  }

  const batchId = id_();

  append_('StockBatches', [
    batchId,
    item.id,
    name,
    qty,
    buyPrice,
    buyDate,
    expiry,
    String(b.supplier || ''),
    new Date()
  ]);

  append_('StockMovements', [
    id_(),
    item.id,
    batchId,
    name,
    'IN',
    qty,
    buyDate,
    'Barang masuk',
    user.id,
    new Date()
  ]);

  activity_(
    user,
    'STOCK_IN',
    'Stock Barang',
    'Barang masuk ' + name + ' (' + qty + ')'
  );

  return { batchId: batchId };
}


function removeStock_(b) {
  const user = requirePermission_(b.token, 'Stock Barang');
  const qty = Number(b.qty);

  const batch = rows_('StockBatches').find(
    x => String(x.id) === String(b.batchId)
  );

  if (
    !batch ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    Number(batch.qty) < qty
  ) {
    throw new Error(
      'Batch tidak ditemukan atau stok tidak mencukupi.'
    );
  }

  const remaining = Number(batch.qty) - qty;

  updateById_('StockBatches', batch.id, {
    qty: remaining
  });

  append_('StockMovements', [
    id_(),
    batch.itemId,
    batch.id,
    batch.itemName,
    'OUT',
    qty,
    String(b.date || date_()),
    String(b.note || ''),
    user.id,
    new Date()
  ]);

  activity_(
    user,
    'STOCK_OUT',
    'Stock Barang',
    'Barang keluar ' + batch.itemName + ' (' + qty + ')'
  );

  return { remaining: remaining };
}


// ======================================================
// POINT OF SALE - CHECKOUT
// ======================================================

function checkoutPOS_(b) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error(
      'Server sedang memproses transaksi lain. Silakan coba kembali.'
    );
  }

  try {
    const user = requirePermission_(
      b.token,
      'Stock Barang'
    );

    requirePermission_(
      b.token,
      'Tambah transaksi'
    );

    if (!Array.isArray(b.items) || b.items.length === 0) {
      throw new Error('Keranjang belanja masih kosong.');
    }

    const pickupMethod = String(
      b.pickupMethod || ''
    ).trim();

    const isSelfPickup =
      pickupMethod.toLowerCase() === 'ambil sendiri' ||
      String(b.method || '').toLowerCase() === 'ambil sendiri' ||
      b.selfPickup === true;

    const method = isSelfPickup
      ? 'Ambil Sendiri'
      : String(b.method || 'Tunai');

    const note = String(b.note || '').trim();

    const allowedMethods = [
      'Tunai',
      'Transfer',
      'QRIS',
      'Ambil Sendiri'
    ];

    if (!allowedMethods.includes(method)) {
      throw new Error('Metode checkout tidak valid.');
    }

    const batches = rows_('StockBatches');
    const preparedItems = [];

    let itemValueTotal = 0;

    b.items.forEach(item => {
      const batchId = String(item.batchId || '');
      const qty = Number(item.qty);
      const price = Number(item.price || 0);

      if (
        !batchId ||
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        throw new Error('Data jumlah barang tidak valid.');
      }

      if (
        !isSelfPickup &&
        (!Number.isFinite(price) || price <= 0)
      ) {
        throw new Error('Harga jual harus lebih dari nol.');
      }

      const batch = batches.find(
        x => String(x.id) === batchId
      );

      if (!batch) {
        throw new Error(
          'Batch barang tidak ditemukan: ' + batchId
        );
      }

      const available = Number(batch.qty);

      if (
        !Number.isFinite(available) ||
        available < qty
      ) {
        throw new Error(
          'Stok ' + batch.itemName +
          ' tidak mencukupi. Stok tersedia: ' + available
        );
      }

      const subtotal = isSelfPickup
        ? 0
        : qty * price;

      preparedItems.push({
        batch: batch,
        qty: qty,
        price: isSelfPickup ? 0 : price,
        subtotal: subtotal
      });

      itemValueTotal += subtotal;
    });

    const qtyByBatch = {};

    preparedItems.forEach(item => {
      const batchId = String(item.batch.id);

      qtyByBatch[batchId] =
        (qtyByBatch[batchId] || 0) + item.qty;
    });

    Object.keys(qtyByBatch).forEach(batchId => {
      const batch = batches.find(
        x => String(x.id) === batchId
      );

      if (
        !batch ||
        qtyByBatch[batchId] > Number(batch.qty)
      ) {
        throw new Error(
          'Total jumlah barang pada batch ' +
          (batch ? batch.itemName : batchId) +
          ' melebihi stok tersedia.'
        );
      }
    });

    let total = isSelfPickup ? 0 : itemValueTotal;
    let paidAmount = 0;
    let changeAmount = 0;

    if (!isSelfPickup) {
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error('Total transaksi tidak valid.');
      }

      if (method === 'Tunai') {
        if (
          b.paidAmount !== undefined &&
          b.paidAmount !== null &&
          b.paidAmount !== ''
        ) {
          paidAmount = Number(b.paidAmount);

          if (
            !Number.isFinite(paidAmount) ||
            paidAmount < total
          ) {
            throw new Error(
              'Uang pembayaran kurang dari total transaksi.'
            );
          }

          changeAmount = paidAmount - total;
        }
      }
    }

    const date = date_();
    const transactionId = id_();

    const movementNote = isSelfPickup
      ? 'Pengambilan sendiri - Gratis - ' + transactionId
      : 'Penjualan POS - ' + transactionId;

    preparedItems.forEach(item => {
      const batch = item.batch;
      const remaining = Number(batch.qty) - item.qty;

      updateById_(
        'StockBatches',
        batch.id,
        { qty: remaining }
      );

      append_('StockMovements', [
        id_(),
        batch.itemId,
        batch.id,
        batch.itemName,
        'OUT',
        item.qty,
        date,
        movementNote,
        user.id,
        new Date()
      ]);
    });

    let description;

    if (isSelfPickup) {
      description =
        'Pengambilan Gratis / Ambil Sendiri (' +
        preparedItems.length +
        ' jenis barang)' +
        (note ? ' - ' + note : '');

    } else {
      description =
        'Penjualan POS (' +
        preparedItems.length +
        ' jenis barang)' +
        (note ? ' - ' + note : '');

      if (method === 'Tunai' && paidAmount > 0) {
        description +=
          ' - Uang diterima: ' + paidAmount +
          ' - Kembalian: ' + changeAmount;
      }
    }

    append_('Transactions', [
      transactionId,
      'income',
      date,
      description,
      '',
      isSelfPickup ? 'Pengambilan Gratis' : 'Penjualan',
      total,
      method,
      user.id,
      new Date()
    ]);

    activity_(
      user,
      isSelfPickup ? 'POS_SELF_PICKUP' : 'POS_CHECKOUT',
      'Point of Sale',
      isSelfPickup
        ? 'Pengambilan barang gratis berhasil. Total pemasukan: 0.'
        : 'Transaksi penjualan berhasil. Total: ' + total
    );

    return {
      success: true,
      transactionId: transactionId,
      total: total,
      itemValueTotal: itemValueTotal,
      itemsCount: preparedItems.length,
      totalQty: preparedItems.reduce(
        (sum, item) => sum + item.qty,
        0
      ),
      method: method,
      isSelfPickup: isSelfPickup,
      paidAmount: paidAmount,
      changeAmount: changeAmount,
      date: date
    };

  } finally {
    lock.releaseLock();
  }
}


// ======================================================
// FINANCE
// ======================================================

function addCategory_(b) {
  const user = requirePermission_(b.token, 'Keuangan');

  const type = b.type === 'expense'
    ? 'expense'
    : 'income';

  const name = String(b.name || '').trim();

  if (!name) {
    throw new Error('Nama kategori wajib diisi.');
  }

  const tab = type === 'income'
    ? 'IncomeCategories'
    : 'ExpenseCategories';

  if (
    rows_(tab).some(
      x => String(x.name).toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error('Kategori sudah ada.');
  }

  const id = id_();

  append_(tab, [
    id,
    name,
    new Date()
  ]);

  activity_(
    user,
    'CATEGORY_ADD',
    'Keuangan',
    'Kategori ' + type + ' ditambahkan: ' + name
  );

  return { id: id };
}


function addTransaction_(b) {
  const user = requirePermission_(
    b.token,
    'Tambah transaksi'
  );

  const type = b.type === 'expense'
    ? 'expense'
    : 'income';

  const amount = Number(b.amount);
  const date = String(b.date || date_());
  const description = String(b.description || '').trim();

  const categoryId = String(b.categoryId || '');
  const categoryName = String(b.categoryName || '').trim();

  if (
    !description ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !categoryName
  ) {
    throw new Error('Data transaksi tidak valid.');
  }

  const id = id_();

  append_('Transactions', [
    id,
    type,
    date,
    description,
    categoryId,
    categoryName,
    amount,
    String(b.method || 'Tunai'),
    user.id,
    new Date()
  ]);

  activity_(
    user,
    'TRANSACTION_ADD',
    'Keuangan',
    type + ': ' + description + ' (' + amount + ')'
  );

  return { id: id };
}


// ======================================================
// DEBT & RECEIVABLE - UTANG PIUTANG
// ======================================================

function debtList_() {
  const debts = rows_('Debts');
  const payments = rows_('DebtPayments');

  return debts
    .filter(d => !isArchived_(d.isArchived))
    .map(d => enrichDebt_(d, payments))
    .sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
}


function debtSummary_() {
  const debts = debtList_();

  const result = {
    payableMoney: 0,
    receivableMoney: 0,
    payableGoods: 0,
    receivableGoods: 0,
    activeCount: debts.length,
    overdueCount: 0,
    settledCount: 0
  };

  debts.forEach(d => {
    if (d.status === 'lunas') {
      result.settledCount++;
      return;
    }

    if (d.status === 'jatuh_tempo') {
      result.overdueCount++;
    }

    if (d.kind === 'money') {
      if (d.direction === 'payable') {
        result.payableMoney += Number(d.remainingAmount || 0);
      } else {
        result.receivableMoney += Number(d.remainingAmount || 0);
      }
    } else {
      if (d.direction === 'payable') {
        result.payableGoods += Number(d.remainingQty || 0);
      } else {
        result.receivableGoods += Number(d.remainingQty || 0);
      }
    }
  });

  return result;
}


function debtDetail_(b) {
  const id = String(b.id || '');

  if (!id) {
    throw new Error('ID utang/piutang wajib diisi.');
  }

  const debt = rows_('Debts').find(
    d => String(d.id) === id &&
         !isArchived_(d.isArchived)
  );

  if (!debt) {
    throw new Error('Data utang/piutang tidak ditemukan.');
  }

  const payments = rows_('DebtPayments')
    .filter(p => String(p.debtId) === id)
    .sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

  return {
    debt: enrichDebt_(debt, payments),
    payments: payments
  };
}


// ======================================================
// SINKRONISASI TRANSAKSI AWAL UTANG & PIUTANG UANG
// ======================================================

function syncDebtInitialTransaction_(debt, userId) {
  if (!debt || debt.kind !== 'money') {
    return { skipped: true };
  }

  const transactionId = 'DEBT-' + String(debt.id);
  const isPayable = debt.direction === 'payable';
  const partyName = String(debt.partyName || '').trim();
  const description = String(debt.description || '').trim();

  const transaction = {
    id: transactionId,
    type: isPayable ? 'income' : 'expense',
    date: String(debt.date || date_()).slice(0, 10),
    description: (isPayable
      ? 'Utang diterima'
      : 'Piutang diberikan') +
      ' - ' + partyName +
      (description ? ' - ' + description : ''),
    categoryId: '',
    categoryName: isPayable
      ? 'Pencatatan Utang'
      : 'Pemberian Piutang',
    amount: Number(debt.totalAmount || 0),
    method: 'Pencatatan',
    userId: userId || debt.userId || '',
    createdAt: new Date()
  };

  if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
    throw new Error('Nominal transaksi awal utang/piutang tidak valid.');
  }

  const existing = rows_('Transactions').find(
    item => String(item.id) === transactionId
  );

  if (existing) {
    updateById_('Transactions', transactionId, {
      type: transaction.type,
      date: transaction.date,
      description: transaction.description,
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryName,
      amount: transaction.amount,
      method: transaction.method
    });
  } else {
    append_('Transactions', [
      transaction.id,
      transaction.type,
      transaction.date,
      transaction.description,
      transaction.categoryId,
      transaction.categoryName,
      transaction.amount,
      transaction.method,
      transaction.userId,
      transaction.createdAt
    ]);
  }

  return { transactionId: transactionId };
}


function addDebt_(b) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error('Server sedang memproses transaksi lain.');
  }

  try {
    const user = requirePermission_(
      b.token,
      'Utang & Piutang'
    );

    const direction = String(b.direction || '');
    const kind = String(b.kind || '');
    const partyName = String(b.partyName || '').trim();
    const description = String(b.description || '').trim();
    const date = String(b.date || date_()).slice(0, 10);
    const dueDate = String(b.dueDate || '').slice(0, 10);
    const note = String(b.note || '').trim();

    if (!['payable', 'receivable'].includes(direction)) {
      throw new Error('Jenis utang/piutang tidak valid.');
    }

    if (!['money', 'goods'].includes(kind)) {
      throw new Error('Jenis pencatatan tidak valid.');
    }

    if (!partyName || !description) {
      throw new Error('Nama pihak dan keterangan wajib diisi.');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Tanggal pencatatan tidak valid.');
    }

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new Error('Tanggal jatuh tempo tidak valid.');
    }

    if (dueDate && dueDate < date) {
      throw new Error('Jatuh tempo tidak boleh sebelum tanggal pencatatan.');
    }

    let itemName = '';
    let unit = '';
    let qty = 0;
    let totalAmount = 0;

    if (kind === 'money') {
      totalAmount = Number(b.totalAmount);

      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw new Error('Nominal uang harus lebih dari nol.');
      }
    }

    if (kind === 'goods') {
      itemName = String(b.itemName || '').trim();
      unit = String(b.unit || '').trim();
      qty = Number(b.qty);

      if (
        !itemName ||
        !unit ||
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        throw new Error('Nama barang, satuan, dan jumlah wajib valid.');
      }
    }

    const id = id_();

    const debt = {
      id: id,
      direction: direction,
      kind: kind,
      partyName: partyName,
      partyContact: String(b.partyContact || '').trim(),
      description: description,
      itemName: itemName,
      unit: unit,
      qty: qty,
      settledQty: 0,
      totalAmount: totalAmount,
      paidAmount: 0,
      date: date,
      dueDate: dueDate,
      status: 'belum_lunas',
      note: note,
      isArchived: false,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    append_('Debts', [
      debt.id,
      debt.direction,
      debt.kind,
      debt.partyName,
      debt.partyContact,
      debt.description,
      debt.itemName,
      debt.unit,
      debt.qty,
      debt.settledQty,
      debt.totalAmount,
      debt.paidAmount,
      debt.date,
      debt.dueDate,
      debt.status,
      debt.note,
      debt.isArchived,
      debt.userId,
      debt.createdAt,
      debt.updatedAt
    ]);

    if (kind === 'money') {
      syncDebtInitialTransaction_(debt, user.id);
    }

    activity_(
      user,
      'DEBT_ADD',
      'Utang & Piutang',
      (direction === 'payable' ? 'Utang' : 'Piutang') +
      ' baru: ' + partyName + ' - ' + description
    );

    return {
      id: id,
      transactionCreated: kind === 'money'
    };

  } finally {
    lock.releaseLock();
  }
}


function addDebtPayment_(b) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error('Server sedang memproses transaksi lain.');
  }

  try {
    const user = requirePermission_(
      b.token,
      'Utang & Piutang'
    );

    const debtId = String(b.debtId || '');
    const debt = rows_('Debts').find(
      d => String(d.id) === debtId &&
           !isArchived_(d.isArchived)
    );

    if (!debt) {
      throw new Error('Data utang/piutang tidak ditemukan.');
    }

    const paymentType = String(b.paymentType || '');
    const date = String(b.date || date_());
    const note = String(b.note || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Tanggal pembayaran tidak valid.');
    }

    if (paymentType !== debt.kind) {
      throw new Error(
        'Jenis pembayaran harus sama dengan jenis utang/piutang.'
      );
    }

    const payments = rows_('DebtPayments').filter(
      p => String(p.debtId) === debtId
    );

    const current = enrichDebt_(debt, payments);

    if (current.status === 'lunas') {
      throw new Error('Utang/piutang ini sudah lunas.');
    }

    let amount = 0;
    let qty = 0;

    if (debt.kind === 'money') {
      amount = Number(b.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > Number(current.remainingAmount)
      ) {
        throw new Error('Nominal pembayaran tidak valid atau melebihi sisa.');
      }
    } else {
      qty = Number(b.qty);

      if (
        !Number.isFinite(qty) ||
        qty <= 0 ||
        qty > Number(current.remainingQty)
      ) {
        throw new Error('Jumlah barang tidak valid atau melebihi sisa.');
      }
    }

    const paymentId = id_();

    append_('DebtPayments', [
      paymentId,
      debtId,
      date,
      paymentType,
      amount,
      qty,
      note,
      user.id,
      new Date()
    ]);

    const newPaidAmount =
      Number(debt.paidAmount || 0) + amount;

    const newSettledQty =
      Number(debt.settledQty || 0) + qty;

    const fullySettled = debt.kind === 'money'
      ? newPaidAmount >= Number(debt.totalAmount)
      : newSettledQty >= Number(debt.qty);

    updateById_('Debts', debtId, {
      paidAmount: newPaidAmount,
      settledQty: newSettledQty,
      status: fullySettled ? 'lunas' : 'sebagian',
      updatedAt: new Date()
    });

    if (debt.kind === 'money') {
      const transactionType =
        debt.direction === 'payable' ? 'expense' : 'income';

      const transactionDescription =
        (debt.direction === 'payable'
          ? 'Pembayaran utang'
          : 'Penerimaan piutang') +
        ' - ' + debt.partyName +
        ' - ' + debt.description;

      append_('Transactions', [
        id_(),
        transactionType,
        date,
        transactionDescription,
        '',
        debt.direction === 'payable'
          ? 'Pembayaran Utang'
          : 'Penerimaan Piutang',
        amount,
        String(b.method || 'Tunai'),
        user.id,
        new Date()
      ]);
    }

    activity_(
      user,
      'DEBT_PAYMENT',
      'Utang & Piutang',
      'Pembayaran/pengembalian ' + debt.partyName +
      ' - ' + (amount > 0 ? amount : qty + ' ' + debt.unit)
    );

    return {
      paymentId: paymentId,
      paidAmount: newPaidAmount,
      settledQty: newSettledQty,
      status: fullySettled ? 'lunas' : 'sebagian'
    };

  } finally {
    lock.releaseLock();
  }
}


function updateDebt_(b) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error('Server sedang memproses transaksi lain.');
  }

  try {
    const user = requirePermission_(
      b.token,
      'Utang & Piutang'
    );

    const id = String(b.id || '');

    const debt = rows_('Debts').find(
      d => String(d.id) === id &&
           !isArchived_(d.isArchived)
    );

    if (!debt) {
      throw new Error('Data tidak ditemukan.');
    }

    const payments = rows_('DebtPayments').filter(
      p => String(p.debtId) === id
    );

    const current = enrichDebt_(debt, payments);

    if (current.paymentCount > 0 || current.status !== 'belum_lunas') {
      throw new Error(
        'Data yang sudah memiliki pembayaran tidak dapat diubah.'
      );
    }

    const partyName = String(
      b.partyName !== undefined ? b.partyName : debt.partyName
    ).trim();

    const description = String(
      b.description !== undefined ? b.description : debt.description
    ).trim();

    const date = String(
      b.date !== undefined ? b.date : debt.date
    ).slice(0, 10);

    const dueDate = String(
      b.dueDate !== undefined ? b.dueDate : debt.dueDate
    ).slice(0, 10);

    if (!partyName || !description) {
      throw new Error('Nama pihak dan keterangan wajib diisi.');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Tanggal pencatatan tidak valid.');
    }

    if (
      dueDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < date)
    ) {
      throw new Error('Tanggal jatuh tempo tidak valid.');
    }

    const changes = {
      partyName: partyName,
      partyContact: String(
        b.partyContact !== undefined
          ? b.partyContact
          : debt.partyContact
      ).trim(),
      description: description,
      date: date,
      dueDate: dueDate,
      note: String(
        b.note !== undefined ? b.note : debt.note
      ).trim(),
      updatedAt: new Date()
    };

    if (debt.kind === 'money') {
      const total = Number(
        b.totalAmount !== undefined
          ? b.totalAmount
          : debt.totalAmount
      );

      if (!Number.isFinite(total) || total <= 0) {
        throw new Error('Nominal tidak valid.');
      }

      changes.totalAmount = total;
    } else {
      const qty = Number(
        b.qty !== undefined ? b.qty : debt.qty
      );

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Jumlah barang tidak valid.');
      }

      changes.itemName = String(
        b.itemName !== undefined ? b.itemName : debt.itemName
      ).trim();

      changes.unit = String(
        b.unit !== undefined ? b.unit : debt.unit
      ).trim();

      changes.qty = qty;

      if (!changes.itemName || !changes.unit) {
        throw new Error('Nama barang dan satuan wajib diisi.');
      }
    }

    updateById_('Debts', id, changes);

    if (debt.kind === 'money') {
      syncDebtInitialTransaction_(
        Object.assign({}, debt, changes),
        user.id
      );
    }

    activity_(
      user,
      'DEBT_UPDATE',
      'Utang & Piutang',
      'Memperbarui pencatatan ' + partyName
    );

    return { updated: true };

  } finally {
    lock.releaseLock();
  }
}


function archiveDebt_(b) {
  const user = requirePermission_(
    b.token,
    'Utang & Piutang'
  );

  const id = String(b.id || '');

  const debt = rows_('Debts').find(
    d => String(d.id) === id &&
         !isArchived_(d.isArchived)
  );

  if (!debt) {
    throw new Error('Data tidak ditemukan.');
  }

  updateById_('Debts', id, {
    isArchived: true,
    updatedAt: new Date()
  });

  activity_(
    user,
    'DEBT_ARCHIVE',
    'Utang & Piutang',
    'Mengarsipkan data ' + debt.partyName
  );

  return { archived: true };
}


function enrichDebt_(debt, payments) {
  const related = payments.filter(
    p => String(p.debtId) === String(debt.id)
  );

  const paidAmount = related.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const settledQty = related.reduce(
    (sum, p) => sum + Number(p.qty || 0),
    0
  );

  const remainingAmount = Math.max(
    0,
    Number(debt.totalAmount || 0) - paidAmount
  );

  const remainingQty = Math.max(
    0,
    Number(debt.qty || 0) - settledQty
  );

  const isSettled = debt.kind === 'money'
    ? remainingAmount <= 0.000001
    : remainingQty <= 0.000001;

  let status = isSettled
    ? 'lunas'
    : (paidAmount > 0 || settledQty > 0
        ? 'sebagian'
        : 'belum_lunas');

  const dueDate = String(debt.dueDate || '').slice(0, 10);

  if (
    !isSettled &&
    dueDate &&
    dueDate < date_()
  ) {
    status = 'jatuh_tempo';
  }

  return {
    ...debt,
    paidAmount: paidAmount,
    settledQty: settledQty,
    remainingAmount: remainingAmount,
    remainingQty: remainingQty,
    status: status,
    paymentCount: related.length
  };
}


function isArchived_(value) {
  return value === true ||
    String(value).toLowerCase() === 'true';
}


// ======================================================
// DAFTAR UTANG & PIUTANG YANG DIARSIPKAN
// ======================================================

function debtArchivedList_() {
  const debts = rows_('Debts');
  const payments = rows_('DebtPayments');

  return debts
    .filter(d => isArchived_(d.isArchived))
    .map(d => enrichDebt_(d, payments))
    .sort((a, b) => {
      return String(b.updatedAt || b.createdAt || '')
        .localeCompare(String(a.updatedAt || a.createdAt || ''));
    });
}


// ======================================================
// PULIHKAN DATA DARI ARSIP
// ======================================================

function restoreDebt_(body) {
  const user = requirePermission_(
    body.token,
    'Utang & Piutang'
  );

  const id = String(body.id || '').trim();

  if (!id) {
    throw new Error('ID pencatatan tidak ditemukan.');
  }

  const debts = rows_('Debts');
  const debt = debts.find(d => String(d.id) === id);

  if (!debt) {
    throw new Error('Data utang/piutang tidak ditemukan.');
  }

  if (!isArchived_(debt.isArchived)) {
    throw new Error('Data ini tidak berada di dalam arsip.');
  }

  updateById_('Debts', id, {
    isArchived: false,
    updatedAt: new Date()
  });

  activity_(
    user,
    'DEBT_RESTORE',
    'Utang & Piutang',
    'Memulihkan data ' + debt.partyName + ' dari arsip'
  );

  return {
    id: id,
    restored: true,
    message: 'Data berhasil dipulihkan.'
  };
}


// ======================================================
// NOTIFICATION CENTER
// ======================================================

// Mengambil daftar notifikasi milik akun yang sedang login.
function notificationList_(b) {
  const user = requireSession_(b.token);

  const requestedLimit = Number(b.limit) || 50;
  const limit = Math.min(Math.max(requestedLimit, 1), 100);

  const notifications = rows_('Notifications')
    .filter(n => String(n.userId) === String(user.id))
    .sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

  return notifications.slice(0, limit);
}


// Menghitung jumlah notifikasi yang belum dibaca.
function notificationUnreadCount_(b) {
  const user = requireSession_(b.token);

  const count = rows_('Notifications').filter(n =>
    String(n.userId) === String(user.id) &&
    !isNotificationRead_(n.isRead)
  ).length;

  return { count: count };
}


// Menandai satu notifikasi sebagai sudah dibaca.
function notificationMarkRead_(b) {
  const user = requireSession_(b.token);
  const notificationId = String(b.id || '');

  if (!notificationId) {
    throw new Error('ID notifikasi wajib diisi.');
  }

  const sh = sheet_('Notifications');
  const values = sh.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Notifikasi tidak ditemukan.');
  }

  const headers = values[0];
  const idCol = headers.indexOf('id');
  const userCol = headers.indexOf('userId');
  const readCol = headers.indexOf('isRead');
  const readAtCol = headers.indexOf('readAt');

  if (
    idCol < 0 ||
    userCol < 0 ||
    readCol < 0 ||
    readAtCol < 0
  ) {
    throw new Error('Struktur sheet Notifications tidak valid.');
  }

  for (let r = 1; r < values.length; r++) {
    if (
      String(values[r][idCol]) === notificationId &&
      String(values[r][userCol]) === String(user.id)
    ) {
      sh.getRange(r + 1, readCol + 1).setValue(true);
      sh.getRange(r + 1, readAtCol + 1).setValue(new Date());

      return { updated: true };
    }
  }

  throw new Error('Notifikasi tidak ditemukan.');
}


// Menandai seluruh notifikasi milik pengguna sebagai sudah dibaca.
function notificationMarkAllRead_(b) {
  const user = requireSession_(b.token);

  const sh = sheet_('Notifications');
  const values = sh.getDataRange().getValues();

  if (values.length < 2) {
    return { updated: 0 };
  }

  const headers = values[0];
  const userCol = headers.indexOf('userId');
  const readCol = headers.indexOf('isRead');
  const readAtCol = headers.indexOf('readAt');

  if (userCol < 0 || readCol < 0 || readAtCol < 0) {
    throw new Error('Struktur sheet Notifications tidak valid.');
  }

  let updated = 0;
  const now = new Date();

  for (let r = 1; r < values.length; r++) {
    if (
      String(values[r][userCol]) === String(user.id) &&
      !isNotificationRead_(values[r][readCol])
    ) {
      sh.getRange(r + 1, readCol + 1).setValue(true);
      sh.getRange(r + 1, readAtCol + 1).setValue(now);
      updated++;
    }
  }

  return { updated: updated };
}


// Normalisasi nilai status baca dari Google Sheets.
function isNotificationRead_(value) {
  return value === true ||
    String(value).toLowerCase() === 'true';
}


// Membuat notifikasi untuk pengguna aktif lain yang relevan.
function createActivityNotification_(user, action, module, description) {
  const users = rows_('Users');

  const recipients = users.filter(target => {
    if (target.status !== 'active') return false;

    // Jangan kirim notifikasi aktivitas kepada pelakunya sendiri.
    if (String(target.id) === String(user.id)) return false;

    // Semua admin aktif menerima aktivitas dari pengguna lain.
    if (target.role === 'admin') return true;

    // Aktivitas autentikasi hanya dikirim kepada admin.
    if (module === 'Auth' || module === 'Pengguna') return false;

    let permissions = [];

    try {
      permissions = JSON.parse(target.permissions || '[]');
    } catch (e) {
      permissions = [];
    }

    if (!Array.isArray(permissions)) {
      permissions = [];
    }

    // Alias disesuaikan dengan nama izin yang mungkin dipakai frontend.
    const permissionMap = {
      'Stock Barang': [
        'Stock Barang',
        'Tambah barang'
      ],
      'Point of Sale': [
        'Point of Sale',
        'POS',
        'Stock Barang',
        'Tambah transaksi'
      ],
      'Keuangan': [
        'Keuangan',
        'Tambah transaksi'
      ],
      'Utang & Piutang': [
        'Utang & Piutang'
      ]
    };

    const required = permissionMap[module] || [module];

    return required.some(permission =>
      permissions.includes(permission)
    );
  });

  if (recipients.length === 0) return;

  const title = notificationTitle_(action, module);
  const message = String(
    description || 'Aktivitas baru dilakukan.'
  );

  const actorName = String(
    user.name || user.email || 'Pengguna'
  );

  const now = new Date();

  recipients.forEach(target => {
    append_('Notifications', [
      id_(),
      target.id,
      user.id,
      actorName,
      action,
      module,
      title,
      message,
      now,
      false,
      '',
      ''
    ]);
  });
}


// Notifikasi sistem untuk seluruh admin aktif.
function notifyAdmins_(action, title, message) {
  const admins = rows_('Users').filter(u =>
    u.role === 'admin' &&
    u.status === 'active'
  );

  const now = new Date();

  admins.forEach(admin => {
    append_('Notifications', [
      id_(),
      admin.id,
      '',
      'Sistem',
      action,
      'Auth',
      title,
      message,
      now,
      false,
      '',
      ''
    ]);
  });
}


// Judul notifikasi berdasarkan jenis aktivitas.
function notificationTitle_(action, module) {
  const titles = {
    LOGIN: 'Pengguna masuk',
    USER_APPROVED: 'Pengguna disetujui',
    USER_STATUS: 'Status pengguna diperbarui',
    USER_PERMISSION: 'Hak akses pengguna diperbarui',
    STOCK_IN: 'Barang masuk',
    STOCK_OUT: 'Barang keluar',
    POS_CHECKOUT: 'Transaksi penjualan baru',
    POS_SELF_PICKUP: 'Pengambilan barang',
    TRANSACTION_ADD: 'Transaksi keuangan baru',
    CATEGORY_ADD: 'Kategori keuangan baru',
    DEBT_ADD: 'Pencatatan utang/piutang baru',
    DEBT_PAYMENT: 'Pembayaran utang/piutang',
    DEBT_UPDATE: 'Data utang/piutang diperbarui',
    DEBT_ARCHIVE: 'Data utang/piutang diarsipkan',
    DEBT_RESTORE: 'Data utang/piutang dipulihkan',
    REGISTER_PENDING: 'Pendaftaran pengguna baru'
  };

  return titles[action] || ('Aktivitas baru - ' + module);
}


// ======================================================
// DASHBOARD
// ======================================================

function dashboard_() {
  const batches = rows_('StockBatches');
  const items = rows_('Items');
  const movements = rows_('StockMovements');
  const tx = rows_('Transactions');
  const activities = rows_('ActivityLogs');

  const timezone =
    Session.getScriptTimeZone() || 'Asia/Makassar';

  const today = date_();
  const currentMonth = today.slice(0, 7);

  const number = value => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  };

  const totalQty = batches.reduce(
    (total, batch) => total + number(batch.qty),
    0
  );

  const stockValue = batches.reduce(
    (total, batch) =>
      total +
      number(batch.qty) * number(batch.buyPrice),
    0
  );

  const stockByItem = {};

  batches.forEach(batch => {
    const itemId = String(batch.itemId || '');

    stockByItem[itemId] =
      (stockByItem[itemId] || 0) +
      number(batch.qty);
  });

  const lowStock = items.filter(item => {
    const available =
      stockByItem[String(item.id)] || 0;

    return available <= number(item.minStock);
  }).length;

  const todayDate = new Date(today + 'T00:00:00');
  const thirtyDaysLater = new Date(todayDate);

  thirtyDaysLater.setDate(
    thirtyDaysLater.getDate() + 30
  );

  const nearExpiry = batches.filter(batch => {
    const expiry = String(
      batch.expiryDate || ''
    ).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      return false;
    }

    const expiryDate = new Date(
      expiry + 'T00:00:00'
    );

    return (
      expiryDate >= todayDate &&
      expiryDate <= thirtyDaysLater &&
      number(batch.qty) > 0
    );
  }).length;

  const sumTransaction = type => {
    return tx
      .filter(t => t.type === type)
      .reduce(
        (total, t) => total + number(t.amount),
        0
      );
  };

  const incomeMonth = tx
    .filter(t =>
      t.type === 'income' &&
      String(t.date).slice(0, 7) === currentMonth
    )
    .reduce(
      (total, t) => total + number(t.amount),
      0
    );

  const expenseMonth = tx
    .filter(t =>
      t.type === 'expense' &&
      String(t.date).slice(0, 7) === currentMonth
    )
    .reduce(
      (total, t) => total + number(t.amount),
      0
    );

  const transactionsToday = tx.filter(t =>
    String(t.date).slice(0, 10) === today
  ).length;

  const monthlyMap = {};
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    const monthKey = Utilities.formatDate(
      monthDate,
      timezone,
      'yyyy-MM'
    );

    monthlyMap[monthKey] = {
      month: Utilities.formatDate(
        monthDate,
        timezone,
        'MMM yyyy'
      ),
      stockIn: 0,
      stockOut: 0,
      income: 0,
      expense: 0
    };
  }

  movements.forEach(movement => {
    const date = String(
      movement.date || ''
    ).slice(0, 10);

    const monthKey = date.slice(0, 7);

    if (!monthlyMap[monthKey]) return;

    const type = String(
      movement.type || ''
    ).toUpperCase();

    const qty = number(movement.qty);

    if (type === 'IN') {
      monthlyMap[monthKey].stockIn += qty;
    }

    if (type === 'OUT') {
      monthlyMap[monthKey].stockOut += qty;
    }
  });

  tx.forEach(transaction => {
    const date = String(
      transaction.date || ''
    ).slice(0, 10);

    const monthKey = date.slice(0, 7);

    if (!monthlyMap[monthKey]) return;

    const amount = number(transaction.amount);

    if (transaction.type === 'income') {
      monthlyMap[monthKey].income += amount;
    }

    if (transaction.type === 'expense') {
      monthlyMap[monthKey].expense += amount;
    }
  });

  const monthly = Object.values(monthlyMap);

  const recent = activities
    .slice(-10)
    .reverse()
    .map(activity => ({
      action: activity.action || '',
      module: activity.module || '',
      description: activity.description || '',
      timestamp: activity.timestamp || '',
      email: activity.email || ''
    }));

  return {
    totalQty,
    itemCount: items.length,
    batchCount: batches.length,
    stockValue,
    incomeMonth,
    expenseMonth,
    incomeAll: sumTransaction('income'),
    expenseAll: sumTransaction('expense'),
    transactionsToday,
    lowStock,
    nearExpiry,
    monthly,
    recent
  };
}


// ======================================================
// SESSION & PERMISSION
// ======================================================

function requireSession_(token) {
  if (!token) {
    throw new Error('Sesi tidak ditemukan.');
  }

  const raw = CacheService
    .getScriptCache()
    .get('session_' + token);

  if (!raw) {
    throw new Error(
      'Sesi kedaluwarsa. Silakan login kembali.'
    );
  }

  const session = JSON.parse(raw);

  const user = rows_('Users').find(
    u => String(u.id) === String(session.id)
  );

  if (!user || user.status !== 'active') {
    throw new Error('Akun tidak aktif.');
  }

  return user;
}


function requireAdmin_(token) {
  const user = requireSession_(token);

  if (user.role !== 'admin') {
    throw new Error('Akses khusus admin.');
  }

  return user;
}


function requirePermission_(token, permission) {
  const user = requireSession_(token);

  if (user.role === 'admin') {
    return user;
  }

  let list = [];

  try {
    list = JSON.parse(user.permissions || '[]');
  } catch (e) {
    list = [];
  }

  if (!list.includes(permission)) {
    throw new Error(
      'Anda tidak memiliki izin: ' + permission
    );
  }

  return user;
}


// ======================================================
// LOGS
// ======================================================

function appendLoginLog_(
  userId,
  email,
  event,
  client,
  detail
) {
  client = client || {};

  append_('LoginLogs', [
    id_(),
    userId,
    email,
    event,
    new Date(),
    client.ipAddress || 'Tidak tersedia',
    client.deviceType || '',
    client.browser || '',
    client.platform || '',
    client.userAgent || '',
    client.language || '',
    client.screen || '',
    client.timezone || '',
    detail || ''
  ]);
}


function activity_(
  user,
  action,
  module,
  description
) {
  // Tetap simpan log aktivitas seperti sebelumnya.
  append_('ActivityLogs', [
    id_(),
    user.id,
    user.email,
    action,
    module,
    description,
    new Date(),
    ''
  ]);

  // Setelah log tersimpan, buat notifikasi untuk penerima terkait.
  createActivityNotification_(
    user,
    action,
    module,
    description
  );
}


// ======================================================
// HELPERS
// ======================================================

function publicUser_(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    permissions: parseJson_(u.permissions, [])
  };
}


function parseJson_(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch (e) {
    return fallback;
  }
}


function normalizeEmail_(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}


function hash_(password, salt) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password,
    Utilities.Charset.UTF_8
  )
    .map(b =>
      ('0' + ((b + 256) % 256).toString(16)).slice(-2)
    )
    .join('');
}


function id_() {
  return Utilities.getUuid();
}


function date_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'Asia/Makassar',
    'yyyy-MM-dd'
  );
}


function ss_() {
  if (!SPREADSHEET_ID) {
    throw new Error(
      'Atur SPREADSHEET_ID pada Code.gs.'
    );
  }

  return SpreadsheetApp.openById(
    SPREADSHEET_ID
  );
}


function sheet_(name) {
  const sh = ss_().getSheetByName(name);

  if (!sh) {
    throw new Error(
      'Sheet ' + name +
      ' belum ada. Jalankan setupSheets().'
    );
  }

  return sh;
}


function rows_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];

  return values
    .slice(1)
    .filter(row => row.some(value => value !== ''))
    .map(row => {
      const obj = {};

      headers.forEach((key, index) => {
        obj[key] = row[index] instanceof Date
          ? Utilities.formatDate(
            row[index],
            Session.getScriptTimeZone() || 'Asia/Makassar',
            "yyyy-MM-dd'T'HH:mm:ss"
          )
          : row[index];
      });

      return obj;
    });
}


function append_(name, row) {
  sheet_(name).appendRow(row);
}


function updateById_(name, id, changes) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();

  if (!values.length) {
    throw new Error('Sheet belum memiliki header.');
  }

  const headers = values[0];
  const idCol = headers.indexOf('id');

  if (idCol < 0) {
    throw new Error('Kolom id tidak ditemukan.');
  }

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      Object.keys(changes).forEach(key => {
        const col = headers.indexOf(key);

        if (col >= 0) {
          sh.getRange(r + 1, col + 1)
            .setValue(changes[key]);
        }
      });

      return;
    }
  }

  throw new Error('Data tidak ditemukan.');
}


function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
