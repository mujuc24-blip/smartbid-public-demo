(function(){
  'use strict';
  const C=globalThis.SmartBidCore;
  const data=globalThis.SMARTBID_DATA;
  const $=id=>document.getElementById(id);
  let storage;
  try {storage=globalThis.localStorage;} catch(error) {storage={getItem(){throw error;},setItem(){throw error;},removeItem(){throw error;}};}
  const store=C.createStore(storage);
  let selected=null;
  const money=value=>typeof value==='number'?value.toLocaleString('ko-KR')+' 원':'미확인';
  function node(tag,text,className){
    const element=document.createElement(tag);
    if(text!==undefined) element.textContent=String(text);
    if(className) element.className=className;
    return element;
  }
  function chip(text,warning=false){return node('span',text,'chip'+(warning?' warning':''));}
  function report(result){$('notice').textContent=result.message;$('notice').className=result.ok?'':'error';}
  function field(labelText,control){const label=node('label',labelText);label.append(control);return label;}
  function select(options,value,label){
    const control=node('select'); control.setAttribute('aria-label',label);
    for(const option of options){const item=node('option',option);item.value=option;control.append(item);}
    control.value=value;return control;
  }
  function memo(value,label){const input=node('textarea');input.value=value;input.maxLength=2000;input.setAttribute('aria-label',label);input.placeholder='민감정보를 제외한 내부 참고사항 · 최대 2,000자';return input;}
  function fact(container,label,value){container.append(node('p',label+'  '+value));}
  function internalForm(kind,id){
    const saved=kind==='company'?store.company(id):store.contract(id);
    const options=kind==='company'?C.affinities:C.statuses;
    const choice=select(options,kind==='company'?saved.affinity:saved.status,kind==='company'?'업체 우호도':'계약 구매상태');
    const note=memo(saved.memo,kind==='company'?'업체 내부메모':'계약 내부메모');
    const wrapper=node('div',undefined,kind==='company'?'company-form':'purchase');
    wrapper.append(node('h3',kind==='company'?'내부 업체 관리':'내부 구매 관리'));
    const grid=node('div',undefined,'form-grid');
    grid.append(field(kind==='company'?'우호도 · 수주확률 아님':'구매상태 · 사용자 기록',choice),field('메모 · 로컬 저장',note));
    wrapper.append(grid);
    const save=node('button',kind==='company'?'업체 저장':'구매상태 저장'); save.type='button';
    save.addEventListener('click',()=>{
      const entry=kind==='company'?{affinity:choice.value,memo:note.value}:{status:choice.value,memo:note.value};
      report(store.save(kind,id,entry));renderList();
    });
    wrapper.append(save);
    return wrapper;
  }
  function renderHistory(group){
    const history=node('details',undefined,'history');history.append(node('summary',`행 이력 펼치기 · ${group.rows.length}행 (통합계약번호별 원행 보존)`));
    const scroll=node('div',undefined,'table-scroll');const table=node('table');
    const caption=node('caption','API 계약 행 · 중복 합산 없음');table.append(caption);
    const head=node('thead');const header=node('tr');
    for(const label of ['통합계약번호 / 확정번호','계약일','총계약금액','금차계약금액','계약 자체 명시납기 / 잔여일']){const th=node('th',label);th.setAttribute('scope','col');header.append(th);}
    head.append(header);table.append(head);const body=node('tbody');
    for(const row of group.rows){
      const tr=node('tr');const id=node('td');id.append(node('strong',row.id),node('div',row.confirmed||'확정번호 미반환','muted small'));tr.append(id);
      tr.append(node('td',row.date||'미반환'),node('td',money(row.total),'number'),node('td',money(row.current),'number'));
      const delivery=node('td');delivery.append(node('strong',row.deadline||'미확인'),node('div',C.deadline(row.deadline).label),node('div',row.deadline?'상세 통합번호 일치 · 낙찰 전체연결 미확정':'상세 미조회 · 납기 추정 없음','muted small'));
      tr.append(delivery);body.append(tr);
    }
    table.append(body);scroll.append(table);history.append(scroll);return history;
  }
  function renderGroup(group,notice){
    const representative=group.representative;
    const container=node('details',undefined,'contract');
    const summary=node('summary');
    summary.append(node('span',group.unconfirmed?'확인필요 · '+representative.id:representative.confirmed),chip(group.unconfirmed?'체결 확정 주장 불가':`${group.rows.length}개 원행`,group.unconfirmed));
    container.append(summary);const body=node('div',undefined,'contract-body');
    body.append(chip('공고번호+업체명 연결 후보',true),chip('차수·분류·재입찰 미확정',true));
    body.append(node('p','대표행: '+(representative.date?'계약일 기준 최신 참고':'계약일 미반환 · 최신 여부 미확인')+(group.tied?' · 동률 구분불가':'')+' / API 변경일·변경차수 미제공. 행 순서는 변경 순서를 뜻하지 않습니다.','muted small'));
    const facts=node('div',undefined,'facts');
    fact(facts,'참고 총계약금액',money(representative.total));fact(facts,'참고 금차계약금액',money(representative.current));
    fact(facts,'계약일',representative.date||'미반환');fact(facts,'계약기관',representative.institution||'미확인');
    fact(facts,'계약 자체 명시납기',representative.deadline||'미확인');fact(facts,'잔여일',C.deadline(representative.deadline).label);
    body.append(facts,node('p','총액·금차는 서로 다른 필드입니다. 같은 확정번호 행의 금액을 중복 합산하지 않습니다. 0원은 실제 응답값입니다.','muted small'));
    body.append(renderHistory(group));
    body.append(node('p','실제 구매업체: 미확인 / 실제 제작업체: 미확인 / API 납품완료 상태: 미확인','muted small'));
    body.append(internalForm('contract',selected+'|'+group.id));
    body.append(node('p','내부상태는 이 그룹에만 저장됩니다. 확인필요 행은 다른 계약과 자동 통합하지 않습니다.','muted small'));
    container.append(body);return container;
  }
  function renderDetail(company){
    const target=$('detail'); target.replaceChildren();
    if(!company){target.append(node('h2','업체를 선택하세요'),node('p','왼쪽 업체 열기로 계약 후보와 납기·내부 영업상태를 확인합니다.','empty'));return;}
    target.append(node('h2',company.name,'section-title'),chip('업체명 기반 임시그룹',true),chip(company.id));
    target.append(node('p','사업자번호 등 공적 식별번호 미확보 · 동일 이름 통합확정 아님','muted small'));
    if(company.isAssociation) target.append(node('p','조합/협회는 계약상 낙찰자입니다. 실제 제작·구매업체는 미확인입니다.','muted'));
    target.append(internalForm('company',company.id));
    for(const notice of company.notices){
      const section=node('section',undefined,'notice-section');section.append(chip(notice.product),node('h3',notice.title));
      const facts=node('div',undefined,'facts');
      fact(facts,'공고번호 / 원 차수',notice.id+' / '+notice.order);fact(facts,'원 낙찰 분류 / 재입찰',notice.classification+' / '+notice.rebid);
      fact(facts,'수요기관',notice.demand);fact(facts,'최종낙찰일',notice.awardDate);fact(facts,'낙찰금액 (계약금액 아님)',money(notice.awardAmount));
      section.append(facts,node('p','계약 응답에는 공고번호만 반환되어 원 차수·낙찰 분류·재입찰 대응을 확정할 수 없습니다. 계약 자체 명시납기 확인과 낙찰→계약→납기 전체 확정연결은 별개입니다.','muted small'));
      if(!notice.rows.length) section.append(node('p','계약 미조회 · 확보 한도 내 상세 미실시. 계약 없음 또는 미체결을 의미하지 않습니다.','empty'));
      for(const group of C.groupContracts(notice.rows)) section.append(renderGroup(group,notice));
      target.append(section);
    }
  }
  function filtered(){return C.filterCompanies(data.companies,$('search').value,$('product').value);}
  function renderList(){
    const companies=filtered();$('count').textContent=companies.length+'개 후보';const list=$('company-list');list.replaceChildren();
    if(!companies.length) list.append(node('p','검색 결과가 없습니다. 검색어나 품목을 변경하세요.','empty'));
    for(const company of companies){
      const button=node('button',undefined,'company-button'+(selected===company.id?' active':''));button.type='button';button.setAttribute('aria-pressed',String(selected===company.id));
      button.append(node('span',company.name+' · 업체 열기','company-name'),node('span',company.notices.map(n=>n.product).join(' · ')+' / 우호도 '+store.company(company.id).affinity,'company-meta'));
      button.addEventListener('click',()=>{selected=company.id;renderList();renderDetail(company);});list.append(button);
    }
  }
  function refresh(){
    renderList(); const company=filtered().find(c=>c.id===selected);
    if(!company) selected=null;renderDetail(company);
  }
  function updateBasis(){ $('today').textContent='납기 기준일 '+C.kstDate()+' · KST'; }
  $('snapshot').textContent='계약 API 수집: '+data.snapshot+' / 낙찰 표본 수집: '+data.awardSnapshot+' (수집시각은 계약변경일이 아닙니다.)';
  $('search').addEventListener('input',refresh);$('product').addEventListener('change',refresh);
  $('reset').addEventListener('click',()=>{
    const confirmed=globalThis.confirm('내부 우호도·구매상태·메모만 초기화할까요? 실제 API 표본은 삭제하지 않습니다.');
    const result=store.reset(confirmed);report(result);if(result.ok) refresh();
  });
  updateBasis();refresh();
  if(store.warning) report({ok:false,message:store.warning});
  let basis=C.kstDate();
  setInterval(()=>{const next=C.kstDate();if(next!==basis){basis=next;updateBasis();refresh();}},30000);
})();
