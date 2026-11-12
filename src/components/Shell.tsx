import { useState } from 'react'
import { LayoutDashboard, Boxes, ShoppingCart, Wallet, Users, ClipboardList, Settings, LogOut, Menu, X, ChevronRight, Bell, UserCircle, Package } from 'lucide-react'
import type { Page, User } from '../types'

const nav: {id:Page; label:string; icon: typeof LayoutDashboard; admin?:boolean}[] = [
  {id:'dashboard',label:'Dashboard',icon:LayoutDashboard},
  {id:'stock',label:'Stock Barang',icon:Boxes},
  {id:'pos',label:'Point of Sale',icon:ShoppingCart},
  {id:'finance',label:'Keuangan',icon:Wallet},
  {id:'users',label:'Manajemen User',icon:Users,admin:true},
  {id:'logs',label:'Log Aktivitas',icon:ClipboardList,admin:true},
  {id:'settings',label:'Pengaturan',icon:Settings,admin:true},
]
type Props = { user:User; page:Page; setPage:(p:Page)=>void; onLogout:()=>void; children:React.ReactNode }
export default function Shell({user,page,setPage,onLogout,children}:Props) {
  const [open,setOpen]=useState(false)
  const visible=nav.filter(n=>user.role==='admin'||(!n.admin&&(n.id==='dashboard'||(user.permissions||[]).includes(n.id==='stock'?'Stock Barang':n.id==='pos'?'Point of Sale':n.id==='finance'?'Keuangan':'')) ))
  return <div className="app-shell">
    {open&&<button className="mobile-scrim" onClick={()=>setOpen(false)} aria-label="Tutup menu"/>}
    <aside className={`sidebar ${open?'sidebar-open':''}`}>
      <div className="side-brand"><span className="brand-icon"><Package size={22}/></span><span>APK<span className="brand-accent">Management</span></span><button className="mobile-close" onClick={()=>setOpen(false)}><X/></button></div>
      <div className="side-label">MENU UTAMA</div>
      <nav>{visible.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>{setPage(item.id);setOpen(false)}}><Icon size={18}/><span>{item.label}</span>{page===item.id&&<ChevronRight size={15} className="nav-arrow"/>}</button>})}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon">✦</div><b>Butuh bantuan?</b><p>Hubungi administrator sistem Anda.</p></div><div className="side-version">APK Management <span>v1.0.0</span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="menu-toggle" onClick={()=>setOpen(true)}><Menu/></button>
        <div className="topbar-title"><span className="topbar-kicker">WORKSPACE</span><b>Management Console</b></div>
        <div className="top-actions"><button className="top-icon" title="Notifikasi"><Bell size={18}/></button><div className="top-divider"/><div className="profile"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><b>{user.name}</b><small>{user.role==='admin'?'Administrator':'Staff'}</small></div></div><button className="top-icon logout" onClick={onLogout} title="Logout"><LogOut size={18}/></button></div>
      </header>
      <div className="page-content">{children}</div>
    </main>
  </div>
}
