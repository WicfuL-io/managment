/**
 * APK MANAGEMENT - GOOGLE APPS SCRIPT BACKEND
 * Multi-user: data keuangan, stok operasional, POS, dan utang/piutang
 * dipisahkan berdasarkan userId. Daftar semua stok hanya untuk dibaca.
 */

// ======================================================
// KONFIGURASI
// ======================================================
const SPREADSHEET_ID = '127iYthDvHpufZo02bKnqZxXivlAoEHLgdmXI-lOX0X8';
const SESSION_TTL_SECONDS = 21600;
const ONESIGNAL_APP_ID = '091fcbaa-85b0-4a7a-945e-6af276a7fc89';
const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

const SHEETS = {
  Users: ['id','name','email','passwordHash','salt','role','status','permissions','createdAt','updatedAt'],
  LoginLogs: ['id','userId','email','event','timestamp','ipAddress','deviceType','browser','platform','userAgent','language','screen','timezone','detail'],
  ActivityLogs: ['id','userId','email','action','module','description','timestamp','ipAddress'],
  Items: ['id','name','category','unit','minStock','createdAt','updatedAt','userId'],
  StockBatches: ['id','itemId','itemName','qty','buyPrice','buyDate','expiryDate','supplier','createdAt','userId'],
  StockMovements: ['id','itemId','batchId','itemName','type','qty','date','note','userId','createdAt'],
  IncomeCategories: ['id','name','createdAt','userId'],
  ExpenseCategories: ['id','name','createdAt','userId'],
  Transactions: ['id','type','date','description','categoryId','categoryName','amount','method','userId','createdAt'],
  Settings: ['key','value','updatedAt'],
  Debts: ['id','direction','kind','partyName','partyContact','description','itemName','unit','qty','settledQty','totalAmount','paidAmount','date','dueDate','status','note','isArchived','userId','createdAt','updatedAt'],
  DebtPayments: ['id','debtId','date','paymentType','amount','qty','note','userId','createdAt'],
  Notifications: ['id','userId','actorId','actorName','action','module','title','message','createdAt','isRead','readAt','referenceId']
};

// ======================================================
// API / ROUTER
// ======================================================
function doGet() {
  return json_({success:true,message:'APK Management API aktif',version:'1.3.0'});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_({success:true,data:route_(String(body.action || ''),body)});
  } catch (err) {
    return json_({success:false,message:err && err.message ? err.message : 'Terjadi kesalahan server.'});
  }
}

function route_(action,b) {
  switch(action) {
    case 'setup': return setupSheets();
    case 'register': return register_(b);
    case 'login': return login_(b);
    case 'logout': return logout_(b);
    case 'me': return publicUser_(requireSession_(b.token));

    case 'admin.listUsers':
      requireAdmin_(b.token); return rows_('Users').map(publicUser_);
    case 'admin.approveUser': return approveUser_(b);
    case 'admin.setUserStatus': return setUserStatus_(b);
    case 'admin.setPermissions': return setPermissions_(b);
    case 'admin.loginLogs':
      requireAdmin_(b.token); return rows_('LoginLogs').slice(-500).reverse();
    case 'admin.activityLogs':
      requireAdmin_(b.token); return rows_('ActivityLogs').slice(-500).reverse();

    case 'dashboard.summary': {
      const user = requirePermission_(b.token,'Dashboard');
      return dashboard_(user);
    }

    case 'stock.list': {
      const user = requirePermission_(b.token,'Stock Barang');
      const items = rows_('Items');
      const batches = rows_('StockBatches');
      const movements = rows_('StockMovements');
      const users = rows_('Users');
      const ownerNames = {};
      users.forEach(u => ownerNames[String(u.id)] = u.name || u.email || 'Pengguna');
      const ownItems = items.filter(x => sameUser_(x.userId,user.id));
      const ownBatches = batches.filter(x => sameUser_(x.userId,user.id));
      const allItems = items.map(x => Object.assign({},x,{ownerName:ownerNames[String(x.userId)] || 'Data lama'}));
      const allBatches = batches.map(x => Object.assign({},x,{ownerName:ownerNames[String(x.userId)] || 'Data lama'}));
      return {
        items: ownItems,
        batches: ownBatches,
        movements: movements.filter(x => sameUser_(x.userId,user.id)),
        allItems: allItems,
        allBatches: allBatches
      };
    }
    case 'stock.add': return addStock_(b);
    case 'stock.remove': return removeStock_(b);

    case 'finance.list': {
      const user = requirePermission_(b.token,'Keuangan');
      return {
        transactions: rows_('Transactions').filter(x => sameUser_(x.userId,user.id)),
        incomeCategories: rows_('IncomeCategories').filter(x => sameUser_(x.userId,user.id)),
        expenseCategories: rows_('ExpenseCategories').filter(x => sameUser_(x.userId,user.id))
      };
    }
    case 'finance.add': return addTransaction_(b);
    case 'finance.addCategory': return addCategory_(b);
    case 'pos.checkout': return checkoutPOS_(b);

    case 'debt.list': {
      const u = requirePermission_(b.token,'Utang & Piutang'); return debtList_(u.id);
    }
    case 'debt.summary': {
      const u = requirePermission_(b.token,'Utang & Piutang'); return debtSummary_(u.id);
    }
    case 'debt.detail':
      requirePermission_(b.token,'Utang & Piutang'); return debtDetail_(b);
    case 'debt.add': return addDebt_(b);
    case 'debt.payment': return addDebtPayment_(b);
    case 'debt.update': return updateDebt_(b);
    case 'debt.archive': return archiveDebt_(b);
    case 'debt.archived.list': {
      const u = requirePermission_(b.token,'Utang & Piutang'); return debtArchivedList_(u.id);
    }
    case 'debt.restore': return restoreDebt_(b);

    case 'notifications.list': return notificationList_(b);
    case 'notifications.unreadCount': return notificationUnreadCount_(b);
    case 'notifications.markRead': return notificationMarkRead_(b);
    case 'notifications.markAllRead': return notificationMarkAllRead_(b);
    default: throw new Error('Action tidak dikenal: ' + action);
  }
}

// ======================================================
// SETUP & MIGRASI DATA LAMA
// ======================================================
function setupSheets() {
  const ss = ss_();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const required = SHEETS[name];
    if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
      sh.getRange(1,1,1,required.length).setValues([required]);
      return;
    }
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(v => String(v).trim());
    const missing = required.filter(h => headers.indexOf(h) < 0);
    if (missing.length) sh.getRange(1,sh.getLastColumn()+1,1,missing.length).setValues([missing]);
  });
  return 'Sheet diperiksa. Kolom yang belum ada telah ditambahkan tanpa menghapus data.';
}

/**
 * Jalankan MANUAL setelah memastikan email admin pemilik data lama.
 * Contoh: migrateLegacyDataOwner('admin@email.com')
 * Hanya mengisi userId yang masih kosong; tidak menimpa kepemilikan yang sudah ada.
 */
function migrateLegacyDataOwner(adminEmail) {
  const email = normalizeEmail_(adminEmail);
  if (!email) throw new Error('Masukkan email admin pemilik data lama.');
  setupSheets();
  const admin = rows_('Users').find(u => normalizeEmail_(u.email) === email && u.role === 'admin' && u.status === 'active');
  if (!admin) throw new Error('Akun admin aktif dengan email tersebut tidak ditemukan.');
  const targets = ['Items','StockBatches','IncomeCategories','ExpenseCategories','StockMovements'];
  const result = {};
  targets.forEach(name => {
    const sh = sheet_(name);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) { result[name] = 0; return; }
    const headers = values[0].map(String);
    const col = headers.indexOf('userId');
    if (col < 0) throw new Error('Kolom userId belum ada pada sheet ' + name);
    let count = 0;
    for (let r=1;r<values.length;r++) {
      if (values[r].some(v => v !== '') && !String(values[r][col] || '').trim()) {
        sh.getRange(r+1,col+1).setValue(admin.id);
        count++;
      }
    }
    result[name] = count;
  });
  return {success:true,owner:admin.email,updated:result};
}

// ======================================================
// AUTHENTICATION
// ======================================================
function register_(b) {
  const name = String(b.name || '').trim();
  const email = normalizeEmail_(b.email);
  const password = String(b.password || '');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Nama atau email tidak valid.');
  if (password.length < 8) throw new Error('Password minimal 8 karakter.');
  if (rows_('Users').some(u => normalizeEmail_(u.email) === email)) throw new Error('Email sudah terdaftar.');
  const salt = Utilities.getUuid();
  append_('Users',[id_(),name,email,hash_(password,salt),salt,'staff','pending',JSON.stringify(['Dashboard']),new Date(),new Date()]);
  appendLoginLog_('',email,'REGISTER_PENDING',b.client || {},'Menunggu persetujuan admin');
  notifyAdmins_('REGISTER_PENDING','Pendaftaran pengguna baru',name+' ('+email+') mendaftar dan menunggu persetujuan admin.');
  return {status:'pending',message:'Pendaftaran menunggu persetujuan admin.'};
}

function login_(b) {
  const email = normalizeEmail_(b.email);
  const password = String(b.password || '');
  const user = rows_('Users').find(u => normalizeEmail_(u.email) === email);
  const client = b.client || {};
  if (!user || hash_(password,user.salt) !== user.passwordHash) {
    appendLoginLog_(user ? user.id : '',email,'LOGIN_FAILED',client,'Email atau password salah');
    throw new Error('Email atau password salah.');
  }
  if (user.status !== 'active') {
    appendLoginLog_(user.id,email,'LOGIN_BLOCKED',client,'Status akun: '+user.status);
    throw new Error(user.status === 'pending' ? 'Akun Anda masih menunggu persetujuan admin.' : 'Akun Anda dinonaktifkan.');
  }
  const token = Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('session_'+token,JSON.stringify({id:user.id}),SESSION_TTL_SECONDS);
  appendLoginLog_(user.id,email,'LOGIN_SUCCESS',client,'Login berhasil');
  activity_(user,'LOGIN','Auth','Pengguna login');
  return {token:token,user:publicUser_(user)};
}

function logout_(b) {
  if (b.token) CacheService.getScriptCache().remove('session_'+b.token);
  return {loggedOut:true};
}

// ======================================================
// ADMIN
// ======================================================
function approveUser_(b) {
  const admin = requireAdmin_(b.token);
  const target = rows_('Users').find(u => String(u.id) === String(b.userId));
  if (!target) throw new Error('User tidak ditemukan.');
  updateById_('Users',target.id,{status:'active',role:b.role === 'admin' ? 'admin' : 'staff',updatedAt:new Date()});
  activity_(admin,'USER_APPROVED','Pengguna','Menyetujui akun pengguna '+target.name);
  return {approved:true};
}
function setUserStatus_(b) {
  const admin = requireAdmin_(b.token);
  if (!['active','blocked'].includes(b.status)) throw new Error('Status tidak valid.');
  const target = rows_('Users').find(u => String(u.id) === String(b.userId));
  if (!target) throw new Error('User tidak ditemukan.');
  if (String(target.id) === String(admin.id) && b.status === 'blocked') throw new Error('Anda tidak dapat memblokir akun sendiri.');
  updateById_('Users',b.userId,{status:b.status,updatedAt:new Date()});
  activity_(admin,'USER_STATUS','Pengguna','Mengubah status '+target.name+' menjadi '+b.status);
  return {updated:true};
}
function setPermissions_(b) {
  const admin = requireAdmin_(b.token);
  if (!Array.isArray(b.permissions)) throw new Error('Permissions harus berupa array.');
  const target = rows_('Users').find(u => String(u.id) === String(b.userId));
  if (!target) throw new Error('User tidak ditemukan.');
  updateById_('Users',b.userId,{permissions:JSON.stringify(b.permissions),updatedAt:new Date()});
  activity_(admin,'USER_PERMISSION','Pengguna','Memperbarui hak akses '+target.name);
  return {updated:true};
}

// ======================================================
// STOCK
// ======================================================
function addStock_(b) {
  const user = requirePermission_(b.token,'Tambah barang');
  const name = String(b.name || '').trim();
  const qty = Number(b.qty), buyPrice = Number(b.buyPrice || 0);
  const buyDate = String(b.buyDate || ''), expiry = String(b.expiryDate || '');
  if (!name || !Number.isFinite(qty) || qty<=0 || !Number.isFinite(buyPrice) || buyPrice<0 || !buyDate || !expiry || expiry<buyDate) throw new Error('Data barang tidak valid.');
  const batches = rows_('StockBatches').filter(x => sameUser_(x.userId,user.id));
  if (batches.some(x => String(x.itemName).toLowerCase()===name.toLowerCase() && String(x.buyDate).slice(0,10)===buyDate && String(x.expiryDate).slice(0,10)===expiry)) throw new Error('Batch dengan nama, tanggal beli, dan expired yang sama sudah ada.');
  let item = rows_('Items').find(x => sameUser_(x.userId,user.id) && String(x.name).toLowerCase()===name.toLowerCase());
  if (!item) {
    item = {id:id_(),name:name,category:String(b.category || 'Umum'),unit:String(b.unit || 'pcs'),minStock:Number(b.minStock || 0)};
    append_('Items',[item.id,item.name,item.category,item.unit,item.minStock,new Date(),new Date(),user.id]);
  }
  const batchId = id_();
  append_('StockBatches',[batchId,item.id,name,qty,buyPrice,buyDate,expiry,String(b.supplier || ''),new Date(),user.id]);
  append_('StockMovements',[id_(),item.id,batchId,name,'IN',qty,buyDate,'Barang masuk',user.id,new Date()]);
  activity_(user,'STOCK_IN','Stock Barang','Barang masuk '+name+' ('+qty+')');
  return {batchId:batchId};
}

function removeStock_(b) {
  const user = requirePermission_(b.token,'Stock Barang');
  const qty = Number(b.qty);
  const batch = rows_('StockBatches').find(x => String(x.id)===String(b.batchId) && sameUser_(x.userId,user.id));
  if (!batch || !Number.isFinite(qty) || qty<=0 || Number(batch.qty)<qty) throw new Error('Batch tidak ditemukan, bukan milik Anda, atau stok tidak mencukupi.');
  const remaining = Number(batch.qty)-qty;
  updateOwnedById_('StockBatches',batch.id,user.id,{qty:remaining});
  append_('StockMovements',[id_(),batch.itemId,batch.id,batch.itemName,'OUT',qty,String(b.date || date_()),String(b.note || ''),user.id,new Date()]);
  activity_(user,'STOCK_OUT','Stock Barang','Barang keluar '+batch.itemName+' ('+qty+')');
  return {remaining:remaining};
}

// ======================================================
// POS
// ======================================================
function checkoutPOS_(b) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Server sedang memproses transaksi lain. Silakan coba kembali.');
  try {
    const user = requirePermission_(b.token,'Stock Barang');
    requirePermission_(b.token,'Tambah transaksi');
    if (!Array.isArray(b.items) || !b.items.length) throw new Error('Keranjang belanja masih kosong.');
    const pickup = String(b.pickupMethod || '').trim();
    const isSelfPickup = pickup.toLowerCase()==='ambil sendiri' || String(b.method || '').toLowerCase()==='ambil sendiri' || b.selfPickup===true;
    const method = isSelfPickup ? 'Ambil Sendiri' : String(b.method || 'Tunai');
    if (!['Tunai','Transfer','QRIS','Debit','Ambil Sendiri'].includes(method)) throw new Error('Metode checkout tidak valid.');
    const note = String(b.note || '').trim();
    const batches = rows_('StockBatches');
    const prepared = [];
    let total = 0;
    b.items.forEach(it => {
      const batchId = String(it.batchId || '');
      const qty = Number(it.qty), price = Number(it.price || 0);
      if (!batchId || !Number.isFinite(qty) || qty<=0) throw new Error('Data jumlah barang tidak valid.');
      if (!isSelfPickup && (!Number.isFinite(price) || price<=0)) throw new Error('Harga jual harus lebih dari nol.');
      const batch = batches.find(x => String(x.id)===batchId && sameUser_(x.userId,user.id));
      if (!batch) throw new Error('Batch barang tidak ditemukan atau bukan milik akun Anda.');
      if (!Number.isFinite(Number(batch.qty)) || Number(batch.qty)<qty) throw new Error('Stok '+batch.itemName+' tidak mencukupi. Stok tersedia: '+batch.qty);
      const subtotal = isSelfPickup ? 0 : qty*price;
      prepared.push({batch:batch,qty:qty,price:isSelfPickup?0:price,subtotal:subtotal});
      total += subtotal;
    });
    const byBatch = {};
    prepared.forEach(x => byBatch[x.batch.id]=(byBatch[x.batch.id] || 0)+x.qty);
    Object.keys(byBatch).forEach(id => {
      const batch = batches.find(x => String(x.id)===id);
      if (!batch || byBatch[id]>Number(batch.qty)) throw new Error('Total jumlah barang melebihi stok tersedia: '+(batch ? batch.itemName : id));
    });
    total = isSelfPickup ? 0 : total;
    let paidAmount=0, changeAmount=0;
    if (!isSelfPickup && (!Number.isFinite(total) || total<=0)) throw new Error('Total transaksi tidak valid.');
    if (!isSelfPickup && method==='Tunai' && b.paidAmount!==undefined && b.paidAmount!==null && b.paidAmount!=='') {
      paidAmount=Number(b.paidAmount);
      if (!Number.isFinite(paidAmount) || paidAmount<total) throw new Error('Uang pembayaran kurang dari total transaksi.');
      changeAmount=paidAmount-total;
    }
    const date=date_(), transactionId=id_();
    const movementNote=(isSelfPickup?'Pengambilan sendiri - Gratis - ':'Penjualan POS - ')+transactionId;
    prepared.forEach(x => {
      const remaining=Number(x.batch.qty)-x.qty;
      updateOwnedById_('StockBatches',x.batch.id,user.id,{qty:remaining});
      append_('StockMovements',[id_(),x.batch.itemId,x.batch.id,x.batch.itemName,'OUT',x.qty,date,movementNote,user.id,new Date()]);
    });
    let description=(isSelfPickup?'Pengambilan Gratis / Ambil Sendiri':'Penjualan POS')+' ('+prepared.length+' jenis barang)'+(note?' - '+note:'');
    if (!isSelfPickup && method==='Tunai' && paidAmount>0) description+=' - Uang diterima: '+paidAmount+' - Kembalian: '+changeAmount;
    append_('Transactions',[transactionId,'income',date,description,'',isSelfPickup?'Pengambilan Gratis':'Penjualan',total,method,user.id,new Date()]);
    activity_(user,isSelfPickup?'POS_SELF_PICKUP':'POS_CHECKOUT','Point of Sale',isSelfPickup?'Pengambilan barang gratis berhasil.':'Transaksi penjualan berhasil. Total: '+total);
    return {success:true,transactionId:transactionId,total:total,itemValueTotal:total,itemsCount:prepared.length,totalQty:prepared.reduce((s,x)=>s+x.qty,0),method:method,isSelfPickup:isSelfPickup,paidAmount:paidAmount,changeAmount:changeAmount,date:date};
  } finally { lock.releaseLock(); }
}

// ======================================================
// FINANCE
// ======================================================
function addCategory_(b) {
  const user=requirePermission_(b.token,'Keuangan');
  const type=b.type==='expense'?'expense':'income';
  const name=String(b.name || '').trim();
  if (!name) throw new Error('Nama kategori wajib diisi.');
  const tab=type==='income'?'IncomeCategories':'ExpenseCategories';
  if (rows_(tab).some(x => sameUser_(x.userId,user.id) && String(x.name).toLowerCase()===name.toLowerCase())) throw new Error('Kategori sudah ada.');
  const id=id_();
  append_(tab,[id,name,new Date(),user.id]);
  activity_(user,'CATEGORY_ADD','Keuangan','Kategori '+type+' ditambahkan: '+name);
  return {id:id};
}
function addTransaction_(b) {
  const user=requirePermission_(b.token,'Tambah transaksi');
  const type=b.type==='expense'?'expense':'income';
  const amount=Number(b.amount), date=String(b.date || date_()), description=String(b.description || '').trim();
  const categoryId=String(b.categoryId || ''), categoryName=String(b.categoryName || '').trim();
  if (!description || !Number.isFinite(amount) || amount<=0 || !categoryName) throw new Error('Data transaksi tidak valid.');
  const id=id_();
  append_('Transactions',[id,type,date,description,categoryId,categoryName,amount,String(b.method || 'Tunai'),user.id,new Date()]);
  activity_(user,'TRANSACTION_ADD','Keuangan',type+': '+description);
  return {id:id};
}

// ======================================================
// DEBT & RECEIVABLE
// ======================================================
function debtList_(userId) {
  const payments=rows_('DebtPayments').filter(p => sameUser_(p.userId,userId));
  return rows_('Debts').filter(d => sameUser_(d.userId,userId) && !isArchived_(d.isArchived))
    .map(d => enrichDebt_(d,payments)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
function debtSummary_(userId) {
  const debts=debtList_(userId);
  const out={payableMoney:0,receivableMoney:0,payableGoods:0,receivableGoods:0,activeCount:debts.length,overdueCount:0,settledCount:0};
  debts.forEach(d=>{
    if(d.status==='lunas'){out.settledCount++;return;}
    if(d.status==='jatuh_tempo')out.overdueCount++;
    if(d.kind==='money'){if(d.direction==='payable')out.payableMoney+=Number(d.remainingAmount||0);else out.receivableMoney+=Number(d.remainingAmount||0);}
    else {if(d.direction==='payable')out.payableGoods+=Number(d.remainingQty||0);else out.receivableGoods+=Number(d.remainingQty||0);}
  });
  return out;
}
function debtDetail_(b) {
  const user=requirePermission_(b.token,'Utang & Piutang'), id=String(b.id || '');
  if(!id)throw new Error('ID utang/piutang wajib diisi.');
  const debt=rows_('Debts').find(d=>String(d.id)===id && sameUser_(d.userId,user.id) && !isArchived_(d.isArchived));
  if(!debt)throw new Error('Data utang/piutang tidak ditemukan.');
  const payments=rows_('DebtPayments').filter(p=>String(p.debtId)===id && sameUser_(p.userId,user.id)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return {debt:enrichDebt_(debt,payments),payments:payments};
}
function syncDebtInitialTransaction_(debt,userId) {
  if(!debt || debt.kind!=='money')return {skipped:true};
  const transactionId='DEBT-'+String(debt.id), payable=debt.direction==='payable';
  const transaction={id:transactionId,type:payable?'income':'expense',date:String(debt.date || date_()).slice(0,10),description:(payable?'Utang diterima':'Piutang diberikan')+' - '+String(debt.partyName||'')+(debt.description?' - '+debt.description:''),categoryId:'',categoryName:payable?'Pencatatan Utang':'Pemberian Piutang',amount:Number(debt.totalAmount||0),method:'Pencatatan',userId:userId||debt.userId||'',createdAt:new Date()};
  if(!Number.isFinite(transaction.amount)||transaction.amount<=0)throw new Error('Nominal transaksi awal utang/piutang tidak valid.');
  const existing=rows_('Transactions').find(x=>String(x.id)===transactionId && sameUser_(x.userId,transaction.userId));
  if(existing)updateOwnedById_('Transactions',transactionId,transaction.userId,{type:transaction.type,date:transaction.date,description:transaction.description,categoryId:'',categoryName:transaction.categoryName,amount:transaction.amount,method:transaction.method});
  else append_('Transactions',[transaction.id,transaction.type,transaction.date,transaction.description,'',transaction.categoryName,transaction.amount,transaction.method,transaction.userId,transaction.createdAt]);
  return {transactionId:transactionId};
}
function addDebt_(b) {
  const lock=LockService.getScriptLock(); if(!lock.tryLock(10000))throw new Error('Server sedang memproses transaksi lain.');
  try {
    const user=requirePermission_(b.token,'Utang & Piutang');
    const direction=String(b.direction||''),kind=String(b.kind||''),partyName=String(b.partyName||'').trim(),description=String(b.description||'').trim();
    const date=String(b.date||date_()).slice(0,10),dueDate=String(b.dueDate||'').slice(0,10),note=String(b.note||'').trim();
    if(!['payable','receivable'].includes(direction))throw new Error('Jenis utang/piutang tidak valid.');
    if(!['money','goods'].includes(kind))throw new Error('Jenis pencatatan tidak valid.');
    if(!partyName||!description)throw new Error('Nama pihak dan keterangan wajib diisi.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal pencatatan tidak valid.');
    if(dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||dueDate<date))throw new Error('Tanggal jatuh tempo tidak valid.');
    let itemName='',unit='',qty=0,totalAmount=0;
    if(kind==='money'){totalAmount=Number(b.totalAmount);if(!Number.isFinite(totalAmount)||totalAmount<=0)throw new Error('Nominal uang harus lebih dari nol.');}
    else {itemName=String(b.itemName||'').trim();unit=String(b.unit||'').trim();qty=Number(b.qty);if(!itemName||!unit||!Number.isFinite(qty)||qty<=0)throw new Error('Nama barang, satuan, dan jumlah wajib valid.');}
    const id=id_(), now=new Date();
    const debt={id,direction,kind,partyName,partyContact:String(b.partyContact||'').trim(),description,itemName,unit,qty,settledQty:0,totalAmount,paidAmount:0,date,dueDate,status:'belum_lunas',note,isArchived:false,userId:user.id,createdAt:now,updatedAt:now};
    append_('Debts',[debt.id,debt.direction,debt.kind,debt.partyName,debt.partyContact,debt.description,debt.itemName,debt.unit,debt.qty,debt.settledQty,debt.totalAmount,debt.paidAmount,debt.date,debt.dueDate,debt.status,debt.note,debt.isArchived,debt.userId,debt.createdAt,debt.updatedAt]);
    if(kind==='money')syncDebtInitialTransaction_(debt,user.id);
    activity_(user,'DEBT_ADD','Utang & Piutang',(direction==='payable'?'Utang':'Piutang')+' baru: '+partyName+' - '+description);
    return {id:id,transactionCreated:kind==='money'};
  } finally {lock.releaseLock();}
}
function addDebtPayment_(b) {
  const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw new Error('Server sedang memproses transaksi lain.');
  try {
    const user=requirePermission_(b.token,'Utang & Piutang'),debtId=String(b.debtId||'');
    const debt=rows_('Debts').find(d=>String(d.id)===debtId && sameUser_(d.userId,user.id) && !isArchived_(d.isArchived));
    if(!debt)throw new Error('Data utang/piutang tidak ditemukan.');
    const paymentType=String(b.paymentType||''),date=String(b.date||date_()),note=String(b.note||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal pembayaran tidak valid.');
    if(paymentType!==debt.kind)throw new Error('Jenis pembayaran harus sama dengan jenis utang/piutang.');
    const payments=rows_('DebtPayments').filter(p=>String(p.debtId)===debtId && sameUser_(p.userId,user.id));
    const current=enrichDebt_(debt,payments);if(current.status==='lunas')throw new Error('Utang/piutang ini sudah lunas.');
    let amount=0,qty=0;
    if(debt.kind==='money'){amount=Number(b.amount);if(!Number.isFinite(amount)||amount<=0||amount>Number(current.remainingAmount))throw new Error('Nominal pembayaran tidak valid atau melebihi sisa.');}
    else {qty=Number(b.qty);if(!Number.isFinite(qty)||qty<=0||qty>Number(current.remainingQty))throw new Error('Jumlah barang tidak valid atau melebihi sisa.');}
    const paymentId=id_();
    append_('DebtPayments',[paymentId,debtId,date,paymentType,amount,qty,note,user.id,new Date()]);
    const newPaid=Number(current.paidAmount||0)+amount,newQty=Number(current.settledQty||0)+qty;
    const settled=debt.kind==='money'?newPaid>=Number(debt.totalAmount):newQty>=Number(debt.qty);
    updateOwnedById_('Debts',debtId,user.id,{paidAmount:newPaid,settledQty:newQty,status:settled?'lunas':'sebagian',updatedAt:new Date()});
    if(debt.kind==='money'){
      const payable=debt.direction==='payable';
      append_('Transactions',[id_(),payable?'expense':'income',date,(payable?'Pembayaran utang':'Penerimaan piutang')+' - '+debt.partyName+' - '+debt.description,'',payable?'Pembayaran Utang':'Penerimaan Piutang',amount,String(b.method||'Tunai'),user.id,new Date()]);
    }
    activity_(user,'DEBT_PAYMENT','Utang & Piutang','Pembayaran/pengembalian berhasil untuk '+debt.partyName);
    return {paymentId:paymentId,paidAmount:newPaid,settledQty:newQty,status:settled?'lunas':'sebagian'};
  } finally {lock.releaseLock();}
}
function updateDebt_(b) {
  const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw new Error('Server sedang memproses transaksi lain.');
  try {
    const user=requirePermission_(b.token,'Utang & Piutang'),id=String(b.id||'');
    const debt=rows_('Debts').find(d=>String(d.id)===id && sameUser_(d.userId,user.id) && !isArchived_(d.isArchived));
    if(!debt)throw new Error('Data tidak ditemukan.');
    const payments=rows_('DebtPayments').filter(p=>String(p.debtId)===id && sameUser_(p.userId,user.id));
    const current=enrichDebt_(debt,payments);
    if(current.paymentCount>0||current.status!=='belum_lunas')throw new Error('Data yang sudah memiliki pembayaran tidak dapat diubah.');
    const partyName=String(b.partyName!==undefined?b.partyName:debt.partyName).trim();
    const description=String(b.description!==undefined?b.description:debt.description).trim();
    const date=String(b.date!==undefined?b.date:debt.date).slice(0,10);
    const dueDate=String(b.dueDate!==undefined?b.dueDate:debt.dueDate).slice(0,10);
    if(!partyName||!description)throw new Error('Nama pihak dan keterangan wajib diisi.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal pencatatan tidak valid.');
    if(dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||dueDate<date))throw new Error('Tanggal jatuh tempo tidak valid.');
    const changes={partyName,partyContact:String(b.partyContact!==undefined?b.partyContact:debt.partyContact).trim(),description,date,dueDate,note:String(b.note!==undefined?b.note:debt.note).trim(),updatedAt:new Date()};
    if(debt.kind==='money'){const total=Number(b.totalAmount!==undefined?b.totalAmount:debt.totalAmount);if(!Number.isFinite(total)||total<=0)throw new Error('Nominal tidak valid.');changes.totalAmount=total;}
    else {const q=Number(b.qty!==undefined?b.qty:debt.qty);changes.itemName=String(b.itemName!==undefined?b.itemName:debt.itemName).trim();changes.unit=String(b.unit!==undefined?b.unit:debt.unit).trim();changes.qty=q;if(!Number.isFinite(q)||q<=0||!changes.itemName||!changes.unit)throw new Error('Data barang tidak valid.');}
    updateOwnedById_('Debts',id,user.id,changes);
    if(debt.kind==='money')syncDebtInitialTransaction_(Object.assign({},debt,changes),user.id);
    activity_(user,'DEBT_UPDATE','Utang & Piutang','Memperbarui pencatatan '+partyName);
    return {updated:true};
  } finally {lock.releaseLock();}
}
function archiveDebt_(b) {
  const user=requirePermission_(b.token,'Utang & Piutang'),id=String(b.id||'');
  const debt=rows_('Debts').find(d=>String(d.id)===id && sameUser_(d.userId,user.id) && !isArchived_(d.isArchived));
  if(!debt)throw new Error('Data tidak ditemukan.');
  updateOwnedById_('Debts',id,user.id,{isArchived:true,updatedAt:new Date()});
  activity_(user,'DEBT_ARCHIVE','Utang & Piutang','Mengarsipkan data '+debt.partyName);
  return {archived:true};
}
function debtArchivedList_(userId) {
  const payments=rows_('DebtPayments').filter(p=>sameUser_(p.userId,userId));
  return rows_('Debts').filter(d=>sameUser_(d.userId,userId)&&isArchived_(d.isArchived)).map(d=>enrichDebt_(d,payments))
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
}
function restoreDebt_(b) {
  const user=requirePermission_(b.token,'Utang & Piutang'),id=String(b.id||'').trim();
  if(!id)throw new Error('ID pencatatan tidak ditemukan.');
  const debt=rows_('Debts').find(d=>String(d.id)===id && sameUser_(d.userId,user.id));
  if(!debt)throw new Error('Data utang/piutang tidak ditemukan.');
  if(!isArchived_(debt.isArchived))throw new Error('Data ini tidak berada di dalam arsip.');
  updateOwnedById_('Debts',id,user.id,{isArchived:false,updatedAt:new Date()});
  activity_(user,'DEBT_RESTORE','Utang & Piutang','Memulihkan data '+debt.partyName+' dari arsip');
  return {id:id,restored:true,message:'Data berhasil dipulihkan.'};
}
function enrichDebt_(debt,payments) {
  const related=payments.filter(p=>String(p.debtId)===String(debt.id));
  const paid=related.reduce((s,p)=>s+Number(p.amount||0),0),settled=related.reduce((s,p)=>s+Number(p.qty||0),0);
  const remainingAmount=Math.max(0,Number(debt.totalAmount||0)-paid),remainingQty=Math.max(0,Number(debt.qty||0)-settled);
  const isSettled=debt.kind==='money'?remainingAmount<=0.000001:remainingQty<=0.000001;
  let status=isSettled?'lunas':(paid>0||settled>0?'sebagian':'belum_lunas');
  const due=String(debt.dueDate||'').slice(0,10);
  if(!isSettled&&due&&due<date_())status='jatuh_tempo';
  return Object.assign({},debt,{paidAmount:paid,settledQty:settled,remainingAmount,remainingQty,status,paymentCount:related.length});
}
function isArchived_(v){return v===true||String(v).toLowerCase()==='true';}

// ======================================================
// NOTIFICATION CENTER
// ======================================================
function notificationList_(b) {
  const user=requireSession_(b.token),limit=Math.min(Math.max(Number(b.limit)||50,1),100);
  return rows_('Notifications').filter(n=>sameUser_(n.userId,user.id)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,limit);
}
function notificationUnreadCount_(b) {
  const user=requireSession_(b.token);
  return {count:rows_('Notifications').filter(n=>sameUser_(n.userId,user.id)&&!isNotificationRead_(n.isRead)).length};
}
function notificationMarkRead_(b) {
  const user=requireSession_(b.token),id=String(b.id||'');
  if(!id)throw new Error('ID notifikasi wajib diisi.');
  const sh=sheet_('Notifications'),v=sh.getDataRange().getValues(),h=v[0]||[];
  const idCol=h.indexOf('id'),uCol=h.indexOf('userId'),rCol=h.indexOf('isRead'),tCol=h.indexOf('readAt');
  if([idCol,uCol,rCol,tCol].some(x=>x<0))throw new Error('Struktur sheet Notifications tidak valid.');
  for(let r=1;r<v.length;r++)if(String(v[r][idCol])===id&&sameUser_(v[r][uCol],user.id)){sh.getRange(r+1,rCol+1).setValue(true);sh.getRange(r+1,tCol+1).setValue(new Date());return {updated:true};}
  throw new Error('Notifikasi tidak ditemukan.');
}
function notificationMarkAllRead_(b) {
  const user=requireSession_(b.token),sh=sheet_('Notifications'),v=sh.getDataRange().getValues();
  if(v.length<2)return {updated:0};
  const h=v[0],uCol=h.indexOf('userId'),rCol=h.indexOf('isRead'),tCol=h.indexOf('readAt');
  if([uCol,rCol,tCol].some(x=>x<0))throw new Error('Struktur sheet Notifications tidak valid.');
  let count=0;const now=new Date();
  for(let r=1;r<v.length;r++)if(sameUser_(v[r][uCol],user.id)&&!isNotificationRead_(v[r][rCol])){sh.getRange(r+1,rCol+1).setValue(true);sh.getRange(r+1,tCol+1).setValue(now);count++;}
  return {updated:count};
}
function isNotificationRead_(v){return v===true||String(v).toLowerCase()==='true';}

/**
 * Notifikasi aktivitas operasional umum boleh dikirim kepada pengguna terkait.
 * Detail/nilai transaksi keuangan dan utang/piutang TIDAK dibagikan lintas akun.
 */
function createActivityNotification_(user,action,module,description) {
  if(['Keuangan','Utang & Piutang'].includes(module))return;
  const users=rows_('Users');
  const permissionMap={
    'Stock Barang':['Stock Barang','Tambah barang'],
    'Point of Sale':['Point of Sale','POS','Stock Barang','Tambah transaksi']
  };
  const required=permissionMap[module]||[module];
  const recipients=users.filter(target=>{
    if(target.status!=='active'||sameUser_(target.id,user.id))return false;
    if(target.role==='admin')return true;
    let p=parseJson_(target.permissions,[]);
    return Array.isArray(p)&&required.some(x=>p.includes(x));
  });
  if(!recipients.length)return;
  const title=notificationTitle_(action,module),actor=String(user.name||user.email||'Pengguna'),now=new Date();
  // Pesan stok/POS dibuat generik; tidak membagikan detail privat.
  const safeMessage=module==='Stock Barang'?'Ada aktivitas stok baru.':'Ada aktivitas POS baru.';
  recipients.forEach(t=>append_('Notifications',[id_(),t.id,user.id,actor,action,module,title,safeMessage,now,false,'','']));
  sendOneSignalPush_(recipients.map(x=>x.id),title,actor+': '+safeMessage,{type:'ACTIVITY',action,module,actorId:String(user.id),actorName:actor});
}
function notifyAdmins_(action,title,message) {
  const admins=rows_('Users').filter(u=>u.role==='admin'&&u.status==='active');
  if(!admins.length)return;
  const now=new Date();
  admins.forEach(a=>append_('Notifications',[id_(),a.id,'','Sistem',action,'Auth',title,message,now,false,'','']));
  sendOneSignalPush_(admins.map(a=>a.id),title,message,{type:'SYSTEM',action,module:'Auth'});
}
function notificationTitle_(action,module) {
  const map={LOGIN:'Pengguna masuk',USER_APPROVED:'Pengguna disetujui',USER_STATUS:'Status pengguna diperbarui',USER_PERMISSION:'Hak akses diperbarui',STOCK_IN:'Barang masuk',STOCK_OUT:'Barang keluar',POS_CHECKOUT:'Transaksi penjualan baru',POS_SELF_PICKUP:'Pengambilan barang',TRANSACTION_ADD:'Transaksi keuangan baru',CATEGORY_ADD:'Kategori keuangan baru',DEBT_ADD:'Pencatatan utang/piutang baru',DEBT_PAYMENT:'Pembayaran utang/piutang',DEBT_UPDATE:'Data utang/piutang diperbarui',DEBT_ARCHIVE:'Data utang/piutang diarsipkan',DEBT_RESTORE:'Data utang/piutang dipulihkan',REGISTER_PENDING:'Pendaftaran pengguna baru'};
  return map[action]||('Aktivitas baru - '+module);
}

// ======================================================
// ONESIGNAL
// ======================================================
function sendOneSignalPush_(externalIds,title,message,data) {
  try {
    const key=PropertiesService.getScriptProperties().getProperty('ONESIGNAL_REST_API_KEY');
    if(!key){Logger.log('[OneSignal] API key belum diatur.');return {success:false,reason:'API key belum diatur.'};}
    const ids=[...new Set((Array.isArray(externalIds)?externalIds:[externalIds]).map(x=>String(x||'').trim()).filter(Boolean))];
    if(!ids.length)return {success:false,reason:'Tidak ada External ID penerima.'};
    const results=[];
    for(let i=0;i<ids.length;i+=2000){
      const payload={app_id:ONESIGNAL_APP_ID,include_aliases:{external_id:ids.slice(i,i+2000)},target_channel:'push',headings:{en:String(title||'APK Management'),id:String(title||'APK Management')},contents:{en:String(message||'Ada aktivitas baru.'),id:String(message||'Ada aktivitas baru.')},data:data||{}};
      const res=UrlFetchApp.fetch(ONESIGNAL_API_URL,{method:'post',contentType:'application/json',headers:{Authorization:'Key '+key},payload:JSON.stringify(payload),muteHttpExceptions:true});
      const status=res.getResponseCode(),raw=res.getContentText();let parsed;try{parsed=JSON.parse(raw);}catch(e){parsed={raw};}
      results.push({success:status>=200&&status<300,status,response:parsed});
      Logger.log('[OneSignal] HTTP '+status+' | '+raw);
    }
    return {success:results.every(x=>x.success),results};
  } catch(e){Logger.log('[OneSignal] '+e);return {success:false,reason:String(e)};}
}
function sendPushToAdmins_(title,message,data) {
  const admins=rows_('Users').filter(u=>u.role==='admin'&&u.status==='active');
  return sendOneSignalPush_(admins.map(u=>u.id),title,message,data||{});
}
function testOneSignalPush() {
  return sendPushToAdmins_('Tes APK Management','Pengiriman notifikasi otomatis berhasil diuji.',{type:'TEST',module:'System'});
}
function authorizeOneSignalPermissions() {
  const r=UrlFetchApp.fetch('https://api.onesignal.com',{method:'get',muteHttpExceptions:true});
  Logger.log('[OneSignal] Otorisasi berhasil. HTTP: '+r.getResponseCode());return true;
}

// ======================================================
// DASHBOARD - HANYA DATA PEMILIK LOGIN
// ======================================================
function dashboard_(user) {
  const uid=user.id;
  const batches=rows_('StockBatches').filter(x=>sameUser_(x.userId,uid));
  const items=rows_('Items').filter(x=>sameUser_(x.userId,uid));
  const movements=rows_('StockMovements').filter(x=>sameUser_(x.userId,uid));
  const transactions=rows_('Transactions').filter(x=>sameUser_(x.userId,uid));
  const activities=rows_('ActivityLogs').filter(x=>sameUser_(x.userId,uid));
  const timezone=Session.getScriptTimeZone()||'Asia/Makassar',today=date_(),month=today.slice(0,7);
  const num=v=>{
    if(typeof v==='number')return Number.isFinite(v)?v:0;
    if(v===null||v===undefined||v==='')return 0;
    let s=String(v).trim().replace(/rp/gi,'').replace(/\s/g,'').replace(/[^\d,.-]/g,'');
    if(!s||s==='-'||s==='.')return 0;
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    else if(/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
    const n=Number(s);return Number.isFinite(n)?n:0;
  };
  const dateKey=v=>{
    if(!v)return '';
    if(v instanceof Date&&!isNaN(v.getTime()))return Utilities.formatDate(v,timezone,'yyyy-MM-dd');
    const s=String(v).trim(),m=s.match(/^(\d{4}-\d{2}-\d{2})/);if(m)return m[1];
    const d=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return d?[d[3],String(d[2]).padStart(2,'0'),String(d[1]).padStart(2,'0')].join('-'):'';
  };
  const typeOf=v=>{const s=String(v||'').trim().toLowerCase();if(['income','pemasukan','masuk','pendapatan'].includes(s))return 'income';if(['expense','pengeluaran','keluar','beban'].includes(s))return 'expense';return '';};
  const methodOf=v=>{
    const s=String(v||'').trim().toLowerCase();if(!s||s.includes('ambil sendiri')||s.includes('pencatatan'))return '';
    if(s==='tunai'||s==='cash'||s.includes('uang tunai'))return 'cash';
    if(s.includes('debit')||s.includes('transfer')||s.includes('qris')||s==='tf'||s.includes('bank'))return 'debit';
    return '';
  };
  const totalQty=batches.reduce((s,x)=>s+num(x.qty),0);
  const stockValue=batches.reduce((s,x)=>s+num(x.qty)*num(x.buyPrice),0);
  const byItem={};batches.forEach(x=>{const id=String(x.itemId||'');if(id)byItem[id]=(byItem[id]||0)+num(x.qty);});
  const lowStock=items.filter(x=>(byItem[String(x.id)]||0)<=num(x.minStock)).length;
  const todayDate=new Date(today+'T00:00:00'),limit=new Date(todayDate);limit.setDate(limit.getDate()+30);
  const nearExpiry=batches.filter(x=>{const k=dateKey(x.expiryDate);if(!k||num(x.qty)<=0)return false;const p=k.split('-').map(Number),d=new Date(p[0],p[1]-1,p[2]);return d>=todayDate&&d<=limit;}).length;
  const valid=transactions.map(x=>Object.assign({},x,{normalizedType:typeOf(x.type),normalizedDate:dateKey(x.date),normalizedAmount:num(x.amount),normalizedMethod:methodOf(x.method)}));
  const sumType=t=>valid.filter(x=>x.normalizedType===t).reduce((s,x)=>s+x.normalizedAmount,0);
  const monthRows=valid.filter(x=>x.normalizedDate.slice(0,7)===month);
  const incomeMonth=monthRows.filter(x=>x.normalizedType==='income').reduce((s,x)=>s+x.normalizedAmount,0);
  const expenseMonth=monthRows.filter(x=>x.normalizedType==='expense').reduce((s,x)=>s+x.normalizedAmount,0);
  const transactionsToday=valid.filter(x=>x.normalizedDate===today).length;
  const paymentBuckets={cash:{income:0,expense:0,balance:0,monthIncome:0,monthExpense:0},debit:{income:0,expense:0,balance:0,monthIncome:0,monthExpense:0}};
  valid.forEach(x=>{
    const bucket=x.normalizedMethod,type=x.normalizedType;if(!bucket||!type)return;
    if(type==='income')paymentBuckets[bucket].income+=x.normalizedAmount;
    if(type==='expense')paymentBuckets[bucket].expense+=x.normalizedAmount;
    if(x.normalizedDate.slice(0,7)===month){if(type==='income')paymentBuckets[bucket].monthIncome+=x.normalizedAmount;if(type==='expense')paymentBuckets[bucket].monthExpense+=x.normalizedAmount;}
  });
  ['cash','debit'].forEach(k=>paymentBuckets[k].balance=paymentBuckets[k].income-paymentBuckets[k].expense);
  const debts=debtList_(uid).filter(d=>d.status!=='lunas'&&dateKey(d.dueDate));
  const overdue=debts.filter(d=>dateKey(d.dueDate)<today).sort((a,b)=>dateKey(a.dueDate).localeCompare(dateKey(b.dueDate)));
  const next7=new Date(todayDate);next7.setDate(next7.getDate()+7);
  const next7Key=Utilities.formatDate(next7,timezone,'yyyy-MM-dd');
  const dueSoon=debts.filter(d=>dateKey(d.dueDate)>=today&&dateKey(d.dueDate)<=next7Key).sort((a,b)=>dateKey(a.dueDate).localeCompare(dateKey(b.dueDate)));
  const debtAlerts=overdue.concat(dueSoon).slice(0,8).map(d=>({id:d.id,direction:d.direction,kind:d.kind,partyName:d.partyName||'Tanpa nama',description:d.description||'',itemName:d.itemName||'',unit:d.unit||'',dueDate:dateKey(d.dueDate),status:d.status,remainingAmount:num(d.remainingAmount),remainingQty:num(d.remainingQty),overdue:dateKey(d.dueDate)<today}));
  const monthlyMap={},now=new Date();
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=Utilities.formatDate(d,timezone,'yyyy-MM');monthlyMap[key]={month:Utilities.formatDate(d,timezone,'MMM yyyy'),stockIn:0,stockOut:0,income:0,expense:0};}
  movements.forEach(x=>{const k=dateKey(x.date).slice(0,7);if(!monthlyMap[k])return;const t=String(x.type||'').toUpperCase(),q=num(x.qty);if(t==='IN'||t==='MASUK')monthlyMap[k].stockIn+=q;if(t==='OUT'||t==='KELUAR')monthlyMap[k].stockOut+=q;});
  valid.forEach(x=>{const k=x.normalizedDate.slice(0,7);if(!monthlyMap[k])return;if(x.normalizedType==='income')monthlyMap[k].income+=x.normalizedAmount;if(x.normalizedType==='expense')monthlyMap[k].expense+=x.normalizedAmount;});
  const recent=activities.slice(-10).reverse().map(x=>({action:x.action||'',module:x.module||'',description:x.description||'',timestamp:x.timestamp||'',email:x.email||''}));
  return {totalQty,itemCount:items.length,batchCount:batches.length,stockValue,incomeMonth,expenseMonth,incomeAll:sumType('income'),expenseAll:sumType('expense'),transactionsToday,lowStock,nearExpiry,monthly:Object.values(monthlyMap),recent,paymentBuckets,debtAlerts,debtOverdueCount:overdue.length,debtDueSoonCount:dueSoon.length};
}

// ======================================================
// SESSION & PERMISSION
// ======================================================
function requireSession_(token) {
  if(!token)throw new Error('Sesi tidak ditemukan.');
  const raw=CacheService.getScriptCache().get('session_'+token);
  if(!raw)throw new Error('Sesi kedaluwarsa. Silakan login kembali.');
  const session=JSON.parse(raw),user=rows_('Users').find(u=>String(u.id)===String(session.id));
  if(!user||user.status!=='active')throw new Error('Akun tidak aktif.');
  return user;
}
function requireAdmin_(token) {
  const u=requireSession_(token);if(u.role!=='admin')throw new Error('Akses khusus admin.');return u;
}
function requirePermission_(token,permission) {
  const u=requireSession_(token);if(u.role==='admin')return u;
  const list=parseJson_(u.permissions,[]);
  if(!Array.isArray(list)||!list.includes(permission))throw new Error('Anda tidak memiliki izin: '+permission);
  return u;
}

// ======================================================
// LOGS & ACTIVITY
// ======================================================
function appendLoginLog_(userId,email,event,client,detail) {
  client=client||{};
  append_('LoginLogs',[id_(),userId,email,event,new Date(),client.ipAddress||'Tidak tersedia',client.deviceType||'',client.browser||'',client.platform||'',client.userAgent||'',client.language||'',client.screen||'',client.timezone||'',detail||'']);
}
function activity_(user,action,module,description) {
  append_('ActivityLogs',[id_(),user.id,user.email,action,module,description,new Date(),'']);
  createActivityNotification_(user,action,module,description);
}

// ======================================================
// HELPERS
// ======================================================
function publicUser_(u) {
  return {id:u.id,name:u.name,email:u.email,role:u.role,status:u.status,permissions:parseJson_(u.permissions,[])};
}
function parseJson_(v,fallback){try{return JSON.parse(v||'');}catch(e){return fallback;}}
function normalizeEmail_(v){return String(v||'').trim().toLowerCase();}
function sameUser_(a,b){return String(a||'').trim()!==''&&String(a)===String(b);}
function hash_(password,salt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+password,Utilities.Charset.UTF_8)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function id_(){return Utilities.getUuid();}
function date_(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Makassar','yyyy-MM-dd');}
function ss_(){if(!SPREADSHEET_ID)throw new Error('Atur SPREADSHEET_ID pada Code.gs.');return SpreadsheetApp.openById(SPREADSHEET_ID);}
function sheet_(name){const sh=ss_().getSheetByName(name);if(!sh)throw new Error('Sheet '+name+' belum ada. Jalankan setupSheets().');return sh;}
function rows_(name) {
  const values=sheet_(name).getDataRange().getValues();if(values.length<2)return [];
  const headers=values[0];
  return values.slice(1).filter(row=>row.some(v=>v!=='')).map(row=>{
    const obj={};
    headers.forEach((key,i)=>{obj[key]=row[i] instanceof Date?Utilities.formatDate(row[i],Session.getScriptTimeZone()||'Asia/Makassar',"yyyy-MM-dd'T'HH:mm:ss"):row[i];});
    return obj;
  });
}
function append_(name,row){sheet_(name).appendRow(row);}
function updateById_(name,id,changes) {
  const sh=sheet_(name),values=sh.getDataRange().getValues();if(!values.length)throw new Error('Sheet belum memiliki header.');
  const headers=values[0],idCol=headers.indexOf('id');if(idCol<0)throw new Error('Kolom id tidak ditemukan pada '+name);
  for(let r=1;r<values.length;r++)if(String(values[r][idCol])===String(id)){Object.keys(changes).forEach(k=>{const c=headers.indexOf(k);if(c>=0)sh.getRange(r+1,c+1).setValue(changes[k]);});return;}
  throw new Error('Data tidak ditemukan.');
}
function updateOwnedById_(name,id,userId,changes) {
  const sh=sheet_(name),values=sh.getDataRange().getValues();if(!values.length)throw new Error('Sheet belum memiliki header.');
  const headers=values[0],idCol=headers.indexOf('id'),ownerCol=headers.indexOf('userId');
  if(idCol<0||ownerCol<0)throw new Error('Kolom id/userId tidak ditemukan pada '+name);
  for(let r=1;r<values.length;r++)if(String(values[r][idCol])===String(id)){
    if(!sameUser_(values[r][ownerCol],userId))throw new Error('Akses ditolak: data bukan milik akun Anda.');
    Object.keys(changes).forEach(k=>{const c=headers.indexOf(k);if(c>=0)sh.getRange(r+1,c+1).setValue(changes[k]);});
    return;
  }
  throw new Error('Data tidak ditemukan.');
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
