(function(root){
'use strict';
const months=['2026-08','2026-09','2026-10','2026-11'];
const products=['배전반','분전반','전동기제어반'];
function filter(rows,{month='',product='',region='',query=''}={}){
 const term=String(query).trim().toLocaleLowerCase('ko');
 return rows.filter(r=>(!month||r.month===month)&&(!product||r.product===product)&&(!region||(r.company_region||'미확인')===region)&&(!term||[r.company_name,r.company_id,r.notice_no,r.title,r.demand_name,...r.contracts.flatMap(c=>[c.untyCntrctNo,c.dcsnCntrctNo||''])].join(' ').toLocaleLowerCase('ko').includes(term)));
}
function aggregate(rows,key,seeds=[]){
 const groups=new Map(seeds.map(name=>[name,{name,count:0,amount:0,rows:[]}]));
 for(const r of rows){const name=key(r);if(!groups.has(name))groups.set(name,{name,count:0,amount:0,rows:[]});const g=groups.get(name);g.count++;g.amount+=r.award_amount;g.rows.push(r);}
 return [...groups.values()];
}
function candidateContracts(rows){
 const unique=new Map();
 for(const r of rows)for(const c of r.contracts){if(!unique.has(c.untyCntrctNo))unique.set(c.untyCntrctNo,c);}
 return [...unique.values()];
}
function summarize(rows){
 const contracts=candidateContracts(rows);
 return {count:rows.length,amount:rows.reduce((a,r)=>a+r.award_amount,0),companies:aggregate(rows,r=>r.company_id).sort((a,b)=>b.amount-a.amount),attempts:rows.filter(r=>r.contract_search_status!=='not_attempted').length,candidateAwards:rows.filter(r=>r.contracts.length).length,empty:rows.filter(r=>r.contract_search_status==='normal_empty').length,contracts:contracts.length,explicitDetailRows:contracts.reduce((n,c)=>n+c.details.filter(d=>d.same_contract&&d.delivery_deadline).length,0),confirmed:rows.filter(r=>r.delivery_deadline).length,months:aggregate(rows,r=>r.month,months),products:aggregate(rows,r=>r.product,products),regions:aggregate(rows,r=>r.company_region||'미확인').sort((a,b)=>b.count-a.count),demands:aggregate(rows,r=>r.demand_name).sort((a,b)=>b.amount-a.amount)};
}
function kstDate(now=new Date()){return new Date(now.getTime()+9*3600000).toISOString().slice(0,10);}
function parseDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const stamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:null;}
function deadline(value,today=kstDate()){
 const stamp=parseDate(value),basis=parseDate(today);if(stamp===null||basis===null)return {days:null,bucket:'미확인',label:'미확인'};
 const days=Math.round((stamp-basis)/86400000);return {days,bucket:days<0?'경과':days<=30?'30일 이내':days<=90?'31~90일':'90일 초과',label:days<0?`${-days}일 경과 · 완료 미확인`:days===0?'오늘 · 0일':`${days}일 남음`};
}
function candidateBuckets(rows,today=kstDate()){
 const buckets=['경과','30일 이내','31~90일','90일 초과','미확인'].map(name=>({name,count:0}));
 for(const c of candidateContracts(rows)){
  const dates=[...new Set(c.details.filter(d=>d.same_contract&&parseDate(d.delivery_deadline)!==null).map(d=>d.delivery_deadline))];
  // Multiple explicit dates do not establish a single contract deadline.
  const bucket=deadline(dates.length===1?dates[0]:null,today).bucket;buckets.find(b=>b.name===bucket).count++;
 }
 return buckets;
}
function groupContracts(rows){
 const groups=new Map();for(const row of rows){const key=row.dcsnCntrctNo?'confirmed:'+row.dcsnCntrctNo:'unconfirmed:'+row.untyCntrctNo;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 return [...groups].map(([id,items])=>{const sorted=[...items].sort((a,b)=>(b.cntrctCnclsDate||'').localeCompare(a.cntrctCnclsDate||''));const representative=sorted[0];return {id,rows:items,representative,tied:sorted.filter(r=>r.cntrctCnclsDate===representative.cntrctCnclsDate).length>1,latestConfirmed:false};});
}
// 구매자(낙찰업체)가 받은 완제품은 products, 우리가 그 완제품에 납품할 부품은 supplyParts.
const supplyParts=['차단기','개폐기','보호기기','디지털보호계전기'];
const partQuestions={
 '차단기':'이번 낙찰 완제품에 들어갈 차단기의 종류·정격·수량과 제조사 지정 여부를 알려주실 수 있을까요?',
 '개폐기':'개폐기가 사양에 포함되는지, 포함된다면 규격·수량과 자재 확정 시점을 알려주실 수 있을까요?',
 '보호기기':'보호기기가 사양에 포함되는지, 포함된다면 품목·규격·수량을 알려주실 수 있을까요?',
 '디지털보호계전기':'디지털보호계전기가 적용되는지, 시방서에 지정된 사양이나 모델이 있는지 알려주실 수 있을까요?'
};
const compactText=value=>String(value||'').replace(/\s+/g,'');
// 원문(공고명, 동일 통합계약번호 상세 품명)에 부품명이 있을 때만 '원문 명시'. 그 외는 추정하지 않고 '상담 시 확인'.
function partEvidence(rows){
 return supplyParts.map(part=>{
  const sources=[];
  for(const r of rows){
   if(compactText(r.title).includes(part))sources.push({field:'공고명',notice_no:r.notice_no,text:r.title});
   for(const c of r.contracts)for(const d of c.details||[])if(d.same_contract===true&&compactText(d.product_name).includes(part))sources.push({field:'계약후보 상세 품명',notice_no:r.notice_no,contract_no:d.untyCntrctNo,text:d.product_name});
  }
  return {part,status:sources.length?'원문 명시':'상담 시 확인',sources,question:partQuestions[part]};
 });
}
// 오늘 연락할 업체: 낙찰금액 순위(summarize().companies와 동일)를 그대로 쓰고 근거만 덧붙인다. 계약후보는 낙찰로 세지 않는다.
function contactLeads(rows,{product='',region=''}={}){
 const groups=aggregate(filter(rows,{product,region}),r=>r.company_id).sort((a,b)=>b.amount-a.amount);
 return groups.map(g=>{
  const first=g.rows[0],evidence=[...g.rows].sort((a,b)=>b.award_date.localeCompare(a.award_date)).map(r=>({awardId:r.id,notice_no:r.notice_no,notice_order:r.notice_order,title:r.title,product:r.product,opened_at:r.opened_at,award_date:r.award_date,award_amount:r.award_amount,demand_name:r.demand_name}));
  return {companyId:g.name,companyName:first.company_name,region:first.company_region||null,regionLabel:first.company_region||'소재지역 미확인',awardCount:g.count,awardAmount:g.amount,products:products.filter(p=>g.rows.some(r=>r.product===p)),latestAwardDate:evidence[0].award_date,candidateContractCount:candidateContracts(g.rows).length,evidence,parts:partEvidence(g.rows)};
 });
}
const STORAGE_KEY='smartbid-dashboard-v2-20261117';
const affinities=['미확인','나쁨','조금 나쁨','보통','조금 좋음','좋음'];const statuses=['미확인','구매전','견적진행','공급업체선정완료','납품완료'];
function createStore(storage){
 let state={company:{},contract:{}},warning='';
 const valid=(kind,e)=>e&&typeof e==='object'&&!Array.isArray(e)&&typeof e.memo==='string'&&e.memo.length<=2000&&(kind==='company'?affinities.includes(e.affinity):statuses.includes(e.status));
 try{const raw=storage.getItem(STORAGE_KEY);if(raw!==null){const parsed=JSON.parse(raw);for(const kind of ['company','contract']){if(!parsed[kind]||typeof parsed[kind]!=='object'||Array.isArray(parsed[kind]))throw Error('invalid schema');for(const entry of Object.values(parsed[kind]))if(!valid(kind,entry))throw Error('invalid entry');}state=parsed;}}catch(error){warning='로컬 기록 읽기 실패: 저장 권한 또는 데이터 형식을 확인하세요. 원래 저장값은 삭제하지 않았습니다.';}
 return {warning,read(kind,id){return Object.hasOwn(state[kind],id)?state[kind][id]:kind==='company'?{affinity:'미확인',memo:''}:{status:'미확인',memo:''};},save(kind,id,entry){if(!['company','contract'].includes(kind)||typeof id!=='string'||!id||!valid(kind,entry))return {ok:false,message:'입력값 오류: 메모 2,000자 이내, 유효한 상태를 선택하세요.'};const clean=kind==='company'?{affinity:entry.affinity,memo:entry.memo}:{status:entry.status,memo:entry.memo};const next={...state,[kind]:{...state[kind],[id]:clean}};try{storage.setItem(STORAGE_KEY,JSON.stringify(next));state=next;return {ok:true,message:'이 브라우저에 저장했습니다. 외부 전송 없음.'};}catch(error){return {ok:false,message:'저장 실패: 브라우저 저장 권한·용량을 확인하세요. 입력은 화면에 남아 있습니다.'};}},reset(confirmed){if(!confirmed)return {ok:false,message:'초기화를 취소했습니다.'};try{storage.removeItem(STORAGE_KEY);state={company:{},contract:{}};return {ok:true,message:'v2 내부 기록만 초기화했습니다. 기존 표본 기록은 보존했습니다.'};}catch(error){return {ok:false,message:'초기화 실패: 저장 권한을 확인하세요.'};}}};
}
const api={contactLeads,supplyParts,filter,aggregate,candidateContracts,summarize,months,products,kstDate,deadline,candidateBuckets,groupContracts,createStore,STORAGE_KEY,affinities,statuses};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SmartBid=api;
})(globalThis);
