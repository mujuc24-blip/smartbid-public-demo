(function(){
'use strict';
const C=globalThis.SmartBid,D=globalThis.SMARTBID_PUBLIC,$=id=>document.getElementById(id);
let storage;try{storage=globalThis.localStorage;}catch(error){storage={getItem(){throw error},setItem(){throw error},removeItem(){throw error}};}
const store=C.createStore(storage),drafts=new Map();let selected=null,current=[];
const money=value=>typeof value==='number'?value.toLocaleString('ko-KR')+' 원':'미확인';
const compact=value=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value/100000000)+' 억원';
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;}
function chip(text,warn=false){return node('span',text,'chip'+(warn?' warning':''));}
function report(result){$('notice').textContent=result.message;$('notice').className=result.ok?'':'error';}
function option(select,value,label=value){const el=node('option',label);el.value=value;select.append(el);}
function readFilters(){return {month:$('month').value,product:$('product').value,region:$('region').value,query:$('search').value};}
function table(headers,rows,caption){const table=node('table');if(caption)table.append(node('caption',caption));const thead=node('thead'),tr=node('tr');headers.forEach(h=>{const th=node('th',h);th.scope='col';tr.append(th)});thead.append(tr);table.append(thead);const body=node('tbody');for(const row of rows){const tr=node('tr');for(const [i,value] of row.entries())tr.append(node('td',value,i>0?'number':''));body.append(tr);}table.append(body);return table;}
function bars(target,groups,mode='amount'){
 target.replaceChildren();const max=Math.max(0,...groups.map(g=>g[mode]));
 if(!groups.length){target.append(node('p','선택한 조건의 표본이 없습니다.','empty'));return;}
 for(const g of groups){const row=node('div',undefined,'bar-row'),track=node('div',undefined,'track'),fill=node('div',undefined,'fill');fill.style.width=(max?g[mode]/max*100:0)+'%';track.append(fill);track.setAttribute('role','img');track.setAttribute('aria-label',`${g.name}: ${g.count}건, 낙찰금액 ${money(g.amount)}. 선택 표본 내 비교`);row.append(node('span',g.name),track,node('span',`${g.count}건 · ${compact(g.amount)}`,'bar-value'));target.append(row);}
}
function renderDeadlines(){
 const today=C.kstDate();$('today').textContent='납기 계산 기준 '+today+' · KST';const target=$('deadlines');target.replaceChildren();
 for(const bucket of C.candidateBuckets(current,today)){const item=node('div',undefined,'deadline-item');item.append(node('span',bucket.name),node('strong',bucket.count+'건'));target.append(item);}
 document.querySelectorAll('[data-deadline]').forEach(el=>{el.textContent=C.deadline(el.dataset.deadline||null,today).label;});
}
function renderAnalytics(){
 const s=C.summarize(current);$('result-summary').textContent=`선택된 표본 ${s.count} / 전체 ${D.records.length}건 · 모든 지표·차트·목록에 동일 조건 적용`;
 $('coverage').textContent=`선택 표본 계약조회 ${s.attempts}/${s.count}건 · 후보 있음 ${s.candidateAwards}건 · 정상 빈 결과 ${s.empty}건 · 낙찰 귀속 확정 ${s.confirmed}건.`;
 const kpis=[['표본 낙찰건수',s.count+'건','전국 전체 건수가 아닙니다'],['낙찰금액 · 표본합계',compact(s.amount),money(s.amount)],['업체 후보수',s.companies.length+'개','수집회차 임시그룹 기준'],['계약조회 시도율',(s.count?s.attempts/s.count*100:0).toFixed(1)+'%',`${s.attempts} / ${s.count} 낙찰행 · 미조회 ${s.count-s.attempts}건`],['후보납기 확보',s.explicitDetailRows+'행',`상세 명시일 원행 · 확정 낙찰납기 ${s.confirmed}건`]];
 $('kpis').replaceChildren();for(const [label,value,sub] of kpis){const el=node('div',undefined,'kpi');el.append(node('div',label,'label'),node('div',value,'value'),node('div',sub,'sub'));$('kpis').append(el);}
 bars($('monthly'),s.months);bars($('products'),s.products);bars($('regions'),s.regions,'count');renderDeadlines();
 $('deadline-evidence').textContent=`선택 표본: 통합계약번호 ${s.contracts}개 / 명시 납기 상세 원행 ${s.explicitDetailRows}행. 위 구간은 계약번호별 상호배타 집계(원행합계 아님). 확정 낙찰납기 ${s.confirmed}건. 계약금액은 후보·행 이력끼리 합산하지 않습니다.`;
 $('demands').replaceChildren(table(['수요처','표본 낙찰건수','표본 낙찰금액'],s.demands.map(g=>[g.name,g.count+'건',money(g.amount)]),'선택 조건 전체 수요처 · 기관명 기반 / 소재지역 추정 없음'));
}
function form(kind,id){
 const key=kind+'|'+id,saved=drafts.get(key)||store.read(kind,id),wrapper=node('div',undefined,'internal-form');wrapper.append(node('h3',kind==='company'?'업체 내부 관리':'계약후보 내부 구매 관리'));
 const grid=node('div',undefined,'form-grid'),choice=node('select'),memo=node('textarea');
 for(const value of kind==='company'?C.affinities:C.statuses)option(choice,value);choice.value=kind==='company'?saved.affinity:saved.status;choice.setAttribute('aria-label',kind==='company'?'업체 우호도':'계약 구매상태');memo.value=saved.memo;memo.maxLength=2000;memo.setAttribute('aria-label',kind==='company'?'업체 메모':'계약 메모');memo.placeholder='민감정보 제외 · 최대 2,000자';
 const entry=()=>kind==='company'?{affinity:choice.value,memo:memo.value}:{status:choice.value,memo:memo.value};
 choice.addEventListener('change',()=>drafts.set(key,entry()));memo.addEventListener('input',()=>drafts.set(key,entry()));
 const a=node('label',kind==='company'?'우호도 · 수주확률 아님':'구매상태 · 사용자 기록'),b=node('label','메모 · 이 브라우저만');a.append(choice);b.append(memo);grid.append(a,b);wrapper.append(grid);
 const save=node('button',kind==='company'?'업체 저장':'구매상태 저장');save.type='button';save.addEventListener('click',()=>{const result=store.save(kind,id,entry());report(result);if(result.ok){drafts.delete(key);renderCompanies();}});wrapper.append(save);return wrapper;
}
function renderCompanies(){
 const groups=C.summarize(current).companies;const target=$('companies');target.replaceChildren();if(!groups.length)target.append(node('p','조건에 맞는 업체가 없습니다.','empty'));
 groups.forEach((g,i)=>{const r=g.rows[0],button=node('button',undefined,'company-button'+(selected===g.name?' active':''));button.type='button';button.setAttribute('aria-pressed',String(selected===g.name));button.dataset.companyId=g.name;const name=node('span',undefined,'company-name');name.append(node('span',String(i+1).padStart(2,'0'),'rank'),node('span',r.company_name+' · 업체 열기'));button.append(name,node('span',`${g.count}건 · ${compact(g.amount)} · ${r.company_region||'지역 미확인'}`,'company-meta'),node('span',`우호도 ${store.read('company',g.name).affinity} · ${g.name}`,'company-meta'));button.addEventListener('click',()=>{selected=g.name;renderCompanies();renderDetail();});target.append(button);});
}
function facts(target,pairs){const grid=node('div',undefined,'facts');for(const [label,value] of pairs)grid.append(node('p',label+'  '+value));target.append(grid);}
function deadlineNode(date){const el=node('div',C.deadline(date).label,'detail-date');el.dataset.deadline=date||'';return el;}
function contractGroup(group,record){
 const container=node('details',undefined,'contract'),r=group.representative;container.append(node('summary',(r.dcsnCntrctNo?'같은 확정계약번호 그룹 · '+r.dcsnCntrctNo:'확정번호 미반환 · '+r.untyCntrctNo)+` / ${group.rows.length}개 원행`));
 const body=node('div',undefined,'contract-body');body.append(chip('낙찰 귀속 미확정',true),chip('공고차수·분류·재입찰 미확정',true));
 body.append(node('p',(r.cntrctCnclsDate?'대표행: 계약일 최신 참고 '+r.cntrctCnclsDate:'대표행: 계약일 미반환 · 최신 미확인')+(group.tied?' · 동률 미확정':'')+' / 변경일·변경차수 근거 없음. 최신 변경 확정이 아닙니다.','footnote'));
 facts(body,[['참고 계약총액',money(r.totCntrctAmt)],['참고 금차계약금액',money(r.thtmCntrctAmt)]]);
 body.append(node('p','계약총액·금차금액·낙찰금액은 별도 필드입니다. 0원은 응답값이며, 이력 금액을 합산하지 않습니다.','footnote'));
 const history=node('details',undefined,'history');history.append(node('summary',`원행 이력 · ${group.rows.length}행 펼치기`));const scroll=node('div',undefined,'table-scroll');
 scroll.append(table(['통합계약번호','계약일','계약총액','금차계약금액'],group.rows.map(c=>[c.untyCntrctNo,c.cntrctCnclsDate||'미반환',money(c.totCntrctAmt),money(c.thtmCntrctAmt)]),'수집 원행 · 같은 확정계약번호만 그룹 / 변경순서 미확정'));history.append(scroll);body.append(history);
 for(const c of group.rows){const detail=node('details');detail.append(node('summary','계약후보 상세 · '+c.untyCntrctNo));detail.append(node('p',`공개 법인명 ${c.company_name_match?'일치':'미확인/익명'} · 공고차수 ${c.notice_order_match?'일치':'미반환'} · 상세 통합계약번호 일치는 아래 행별 확인`,'footnote'));
 for(const d of c.details){const block=node('div');block.append(node('p',`${d.product_name||'품목 미확인'} · 계약후보 명시납기 ${d.delivery_deadline||'미확인'}`),deadlineNode(d.delivery_deadline),node('p',`상세 계약번호 ${d.untyCntrctNo} · 동일번호 ${d.same_contract?'확인':'미확인'} / 납품일수 ${d.delivery_days??'미반환'}일 (기준일 불명, 날짜 환산 안 함)`,'footnote'));detail.append(block);}
 body.append(detail);}
 body.append(node('p','실제 구매업체 · 실제 제작업체 · API 납품완료 상태: 모두 미확인','footnote'),form('contract',record.company_id+'|'+record.id+'|'+group.id));container.append(body);return container;
}
function renderDetail(){
 const rows=current.filter(r=>r.company_id===selected),target=$('detail');target.replaceChildren();
 if(!rows.length){target.append(node('h2','업체를 선택하세요'),node('p','금액순 업체 목록에서 공고 · 계약후보 · 원행 이력을 확인하세요.','empty'));return;}
 const r=rows[0];target.append(node('h2',r.company_name),chip(r.company_id),chip('수집회차 임시그룹',true));if(r.company_name==='이름 비공개')target.append(node('p','익명 업체 · 공개 법인표시 미확보. 다른 익명 업체와 로컬ID로 구분합니다.','footnote'));
 target.append(node('p','공적 법인 식별자 미확보 · 기존 표본과 자동 병합 없음. 실제 구매업체로 추정하지 않습니다.','footnote'),form('company',r.company_id));
 for(const record of rows){const section=node('section',undefined,'notice-section');section.append(chip(record.product),node('h3',record.title));facts(section,[['공고번호 / 차수',record.notice_no+' / '+record.notice_order],['낙찰 분류 / 재입찰',record.classification+' / '+record.rebid_no],['실개찰일시',record.opened_at+' KST'],['최종낙찰일',record.award_date],['낙찰금액',money(record.award_amount)],['수요처',record.demand_name],['업체 소재지역',record.company_region||'미확인'],['낙찰 귀속 확정 납기','미확인 · 확정 0건']]);
 if(record.contract_search_status==='not_attempted')section.append(node('p','계약 미조회 · 계약 없음/미체결을 의미하지 않습니다.','footnote'));
 else if(record.contract_search_status==='normal_empty')section.append(node('p','계약조회 정상 빈 결과 · 미체결 확정이 아닙니다.','footnote'));
 else section.append(node('p','공고번호 수준 계약후보입니다. 상세 납기를 공고 납기로 자동 전용하지 않습니다.','footnote'));
 for(const group of C.groupContracts(record.contracts))section.append(contractGroup(group,record));target.append(section);}
}
function refresh(){current=C.filter(D.records,readFilters());if(!current.some(r=>r.company_id===selected))selected=null;renderAnalytics();renderCompanies();renderDetail();}
for(const month of C.months)option($('month'),month);for(const product of C.products)option($('product'),product);for(const region of [...new Set(D.records.map(r=>r.company_region||'미확인'))].sort())option($('region'),region);
$('period').textContent=`실개찰일 기준 ${D.metadata.start_date} ~ ${D.metadata.end_date} · KST / 계약일 기준 아님`;
$('snapshot').textContent='수집 완료 '+D.metadata.collected_at.replace('T',' ')+' · 고정 스냅샷 (수집시각 ≠ 계약변경시각)';$('bias').textContent=D.metadata.sampling;
$('filters').addEventListener('submit',e=>e.preventDefault());for(const id of ['month','product','region'])$(id).addEventListener('change',refresh);$('search').addEventListener('input',refresh);
$('clear').addEventListener('click',()=>{$('filters').reset();refresh();});
$('reset-records').addEventListener('click',()=>$('reset-dialog').showModal());$('cancel-reset').addEventListener('click',()=>{$('reset-dialog').close();report(store.reset(false));});$('confirm-reset').addEventListener('click',()=>{const result=store.reset(true);$('reset-dialog').close();report(result);if(result.ok){drafts.clear();renderCompanies();renderDetail();}});
refresh();if(store.warning)report({ok:false,message:store.warning});let basis=C.kstDate();setInterval(()=>{const next=C.kstDate();if(next!==basis){basis=next;renderDeadlines();}},30000);
})();
