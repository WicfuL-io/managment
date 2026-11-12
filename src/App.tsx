import {useEffect,useState} from 'react'
import {Boxes,LoaderCircle} from 'lucide-react'
import Auth from './components/Auth';import Shell from './components/Shell';import Dashboard from './pages/Dashboard';import Stock from './pages/Stock';import Finance from './pages/Finance';import Admin from './pages/Admin';import POS from './pages/POS';import {api,getClientInfo} from './lib/api';import type {Page,User} from './types'
const STORAGE_KEY='apk_management_session';type StoredSession={user:User;token:string}
export default function App(){const [session,setSession]=useState<StoredSession|null>(null);const [page,setPage]=useState<Page>('dashboard');const [boot,setBoot]=useState(true)
 useEffect(()=>{let alive=true;(async()=>{const raw=sessionStorage.getItem(STORAGE_KEY);if(raw){try{const saved=JSON.parse(raw) as StoredSession;const res=await api<User>('me',{token:saved.token});if(alive){const next={...saved,user:res.data!};setSession(next);sessionStorage.setItem(STORAGE_KEY,JSON.stringify(next))}}catch{sessionStorage.removeItem(STORAGE_KEY)}}if(alive)setBoot(false)})();return()=>{alive=false}},[])
 async function login(_unused:User,email:string,password:string){const client=await getClientInfo();const r=await api<StoredSession>('login',{email,password,client});const next=r.data!;setSession(next);sessionStorage.setItem(STORAGE_KEY,JSON.stringify(next));setPage('dashboard');return next.user}
 async function register(name:string,email:string,password:string){await api('register',{name,email,password,client:await getClientInfo()})}
 async function logout(){try{await api('logout',{token:session?.token})}catch{}sessionStorage.removeItem(STORAGE_KEY);setSession(null)}
 if(boot)return <div className="splash"><div className="splash-logo"><Boxes size={38}/></div><h2>APK<span>Management</span></h2><p>Manage smarter. Grow faster.</p><LoaderCircle className="loader" size={20}/></div>
 if(!session)return <Auth onLogin={login} onRegister={register}/>
 const token=session.token;const pages:Record<Page,React.ReactNode>={dashboard:<Dashboard token={token}/>,stock:<Stock token={token}/>,pos:<POS token={token}/>,finance:<Finance token={token}/>,users:<Admin token={token} page="users"/>,logs:<Admin token={token} page="logs"/>,settings:<Admin token={token} page="settings"/>}
 return <Shell user={session.user} page={page} setPage={setPage} onLogout={logout}>{pages[page]}</Shell>
}
