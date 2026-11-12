import type { ApiResult } from '../types'

const API_URL = "https://script.google.com/macros/s/AKfycbw02vO_Z3XehG2qpQPdpnyMuDdLJ663HnfmURNvT6-aHJKGbuiRKrLozfQng8nWYv9X/exec"
// const API_URL = (import.meta as ImportMeta & {
//   env?: {
//     VITE_API_URL?: string
//   }
// }).env?.VITE_API_URL as string | undefined

export async function api<T=unknown>(action:string,payload:Record<string,unknown>={}):Promise<ApiResult<T>>{
 if(!API_URL||API_URL.includes('PASTE_DEPLOYMENT_ID'))throw new Error('URL Google Apps Script belum diatur pada VITE_API_URL.');
 const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});
 let result:ApiResult<T>;try{result=await response.json() as ApiResult<T>}catch{throw new Error('Respons Apps Script tidak valid. Periksa URL deployment dan izin Web App.')}if(!response.ok||!result.success)throw new Error(result.message||`Permintaan gagal (${response.status}).`);return result;
}
export async function getClientInfo(){const ua=navigator.userAgent;let ipAddress='Tidak tersedia';try{const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),4000);const r=await fetch('https://api.ipify.org?format=json',{signal:c.signal});if(r.ok)ipAddress=(await r.json()).ip||ipAddress;window.clearTimeout(timer)}catch{}const mobile=/Android|iPhone|iPad|iPod/i.test(ua);return {ipAddress,userAgent:ua,deviceType:mobile?'Mobile':'Desktop',browser:/Edg/i.test(ua)?'Edge':/Chrome/i.test(ua)?'Chrome':/Firefox/i.test(ua)?'Firefox':/Safari/i.test(ua)?'Safari':'Browser lain',platform:navigator.platform||'Tidak diketahui',language:navigator.language,screen:`${screen.width}x${screen.height}`,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}}
