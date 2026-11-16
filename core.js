(function(root){
  'use strict';
  function groupContracts(rows) {
    const groups=new Map();
    for(const row of rows) {
      const key=row.confirmed ? 'contract:'+row.confirmed : 'unconfirmed:'+row.id;
      if(!groups.has(key)) groups.set(key,{id:key,unconfirmed:!row.confirmed,rows:[]});
      groups.get(key).rows.push(row);
    }
    return Array.from(groups.values(),group=>{
      const ordered=[...group.rows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      const latest=ordered[0];
      return {...group,representative:latest,tied:ordered.filter(r=>r.date===latest.date).length>1};
    });
  }
  function kstDate(now=new Date()) {
    return new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
  }
  function parseDate(value) {
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const stamp=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10)===value ? stamp : null;
  }
  function deadline(value,now=new Date()) {
    const stamp=parseDate(value);
    if(stamp===null) return {days:null,label:'미확인'};
    const days=Math.round((stamp-parseDate(kstDate(now)))/86400000);
    return {days,label:days===0?'오늘 · 0일':days<0?`${-days}일 경과 · 완료 미확인`:`${days}일 남음`};
  }
  function filterCompanies(companies,query='',product='') {
    const keyword=String(query??'').trim().toLocaleLowerCase('ko');
    return companies.map(company=>({...company,notices:company.notices.filter(n=>(!product || n.product===product) && (!keyword || company.name.toLocaleLowerCase('ko').includes(keyword) || n.title.toLocaleLowerCase('ko').includes(keyword)))})).filter(c=>c.notices.length);
  }
  const affinities=['미평가','나쁨','조금 나쁨','보통','조금 좋음','좋음'];
  const statuses=['미확인','구매전','견적진행','공급업체선정완료','납품완료'];
  function createStore(storage) {
    const key='smartbid-local-v1'; let state={company:{},contract:{}}; let warning='';
    const validEntry=(kind,entry)=>entry && typeof entry==='object' && typeof (entry.memo??'')==='string' && (entry.memo??'').length<=2000 && (kind==='company'?affinities.includes(entry.affinity):statuses.includes(entry.status));
    try {
      const raw=storage.getItem(key);
      if(raw!==null) {
        const saved=JSON.parse(raw);
        if(!saved || typeof saved.company!=='object' || !saved.company || typeof saved.contract!=='object' || !saved.contract || Array.isArray(saved.company) || Array.isArray(saved.contract)) throw Error('invalid schema');
        for(const kind of ['company','contract']) for(const entry of Object.values(saved[kind])) if(!validEntry(kind,entry)) throw Error('invalid entry');
        state=saved;
      }
    } catch(error) {warning='저장된 내부입력을 읽지 못했습니다. 브라우저 저장 권한 또는 데이터 형식을 확인하세요.';}
    const read=(kind,id)=>Object.hasOwn(state[kind],id)?state[kind][id]:kind==='company'?{affinity:'미평가',memo:''}:{status:'미확인',memo:''};
    return {
      warning,company:id=>read('company',id),contract:id=>read('contract',id),
      save(kind,id,entry) {
        if(!['company','contract'].includes(kind) || typeof id!=='string' || !id || !validEntry(kind,entry)) return {ok:false,message:'입력값을 확인하세요. 메모는 2,000자 이내입니다.'};
        const clean=kind==='company'?{affinity:entry.affinity,memo:entry.memo??''}:{status:entry.status,memo:entry.memo??''};
        const next={...state,[kind]:{...state[kind],[id]:clean}};
        try {storage.setItem(key,JSON.stringify(next));state=next;return {ok:true,message:'이 브라우저에 저장했습니다.'};}
        catch(error) {return {ok:false,message:'저장 실패: 브라우저 저장 권한·용량을 확인하세요. 변경은 보존되지 않았습니다.'};}
      },
      reset(confirmed) {
        if(!confirmed) return {ok:false,message:'초기화를 취소했습니다.'};
        try {storage.removeItem(key);state={company:{},contract:{}};return {ok:true,message:'내부입력만 초기화했습니다. 실제 표본은 보존됩니다.'};}
        catch(error) {return {ok:false,message:'초기화 실패: 브라우저 저장 권한을 확인하세요.'};}
      }
    };
  }
  const api={groupContracts,kstDate,deadline,filterCompanies,createStore,affinities,statuses};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.SmartBidCore=api;
})(globalThis);
