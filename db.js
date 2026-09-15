const fs = require('fs');
const path = require('path');
const DATA_PATH = process.env.DB_PATH || path.join(__dirname,'data','content.json');
const SEED_PATH = path.join(__dirname,'data','seed.json');
let state = null;
const clone = (x)=>JSON.parse(JSON.stringify(x));
function ensure(){
  fs.mkdirSync(path.dirname(DATA_PATH),{recursive:true});
  if(!fs.existsSync(DATA_PATH)) fs.copyFileSync(SEED_PATH,DATA_PATH);
  state = JSON.parse(fs.readFileSync(DATA_PATH,'utf8'));
  for(const t of ['programs','events','news','stories','team']){
    state[t]=state[t]||[]; state[t].forEach((x,i)=>{if(!x.id)x.id=i+1;if(!x.created_at)x.created_at=new Date().toISOString();if(!x.updated_at)x.updated_at=x.created_at;});
  }
  state.settings=state.settings||{}; save();
}
function save(){fs.writeFileSync(DATA_PATH,JSON.stringify(state,null,2));}
async function init(){ensure();}
async function settings(){return clone(state.settings);}
async function list(table,{published=false,limit=null}={}){let rows=clone(state[table]||[]);if(published)rows=rows.filter(x=>Number(x.published)===1);rows.sort((a,b)=>{
 const key=table==='events'?'event_date':table==='news'?'published_at':table==='team'?'sort_order':'id';
 if(table==='team')return (a[key]||0)-(b[key]||0);return String(b[key]||'').localeCompare(String(a[key]||''));
});return limit?rows.slice(0,limit):rows;}
async function find(table,pred){return clone((state[table]||[]).find(pred));}
async function insert(table,data){const rows=state[table];const id=Math.max(0,...rows.map(x=>Number(x.id)||0))+1;const now=new Date().toISOString();const row={id,...data,created_at:now,updated_at:now};rows.push(row);save();return clone(row);}
async function update(table,id,data){const idx=state[table].findIndex(x=>String(x.id)===String(id));if(idx<0)return null;state[table][idx]={...state[table][idx],...data,updated_at:new Date().toISOString()};save();return clone(state[table][idx]);}
async function remove(table,id){state[table]=state[table].filter(x=>String(x.id)!==String(id));save();}
async function updateSettings(data){state.settings={...state.settings,...data};save();}
module.exports={init,settings,list,find,insert,update,remove,updateSettings};
