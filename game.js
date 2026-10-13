(() => {
  const ACCOUNTS_KEY = "finCrashAccounts_v1", SESSION_KEY = "finCrashSession_v1", SAVE_PREFIX = "finCrashSave_v1:", LEGACY_KEY = "marketEmpireSave_v2", LEGACY_CLAIMED_KEY = "finCrashLegacyClaimed_v1";
  const DEFAULT_COMPANY = "Моя компания";
  const PRODUCTS = {
    grain:{name:"Зерно",icon:"🌾",category:"Сырьё",base:28,cost:15,demand:90,recipe:null,desc:"Сельскохозяйственная культура"},
    flour:{name:"Мука",icon:"🥣",category:"Материалы",base:48,cost:27,demand:78,recipe:{grain:2},desc:"Переработанное зерно"},
    fabric:{name:"Ткань",icon:"🧵",category:"Материалы",base:118,cost:68,demand:55,recipe:null,desc:"Материал для одежды"},
    timber:{name:"Древесина",icon:"🪵",category:"Сырьё",base:72,cost:40,demand:50,recipe:null,desc:"Ресурс для производства"},
    bread:{name:"Хлеб",icon:"🥖",category:"Продукты",base:118,cost:0,demand:88,recipe:{flour:2},desc:"Массовый продукт питания"},
    shirts:{name:"Футболки",icon:"👕",category:"Одежда",base:345,cost:0,demand:46,recipe:{fabric:2},desc:"Базовая одежда"},
    furniture:{name:"Мебель",icon:"🪑",category:"Товары",base:580,cost:0,demand:26,recipe:{timber:3,fabric:1},desc:"Товар с высокой добавленной стоимостью"}
  };
  const defaultState = (company=DEFAULT_COMPANY) => ({
    company, day:1, cash:100000, debt:0, reputation:50, employees:6,
    divisions:[
      {id:1,name:"Пекарня №1",type:"factory",level:1,product:"bread",active:true},
      {id:2,name:"Текстильная мастерская",type:"factory",level:1,product:"shirts",active:true},
      {id:3,name:"Лесопилка",type:"factory",level:1,product:"timber",active:false},
      {id:4,name:"Мебельный цех",type:"factory",level:1,product:"furniture",active:true}
    ],
    stock:{grain:80,flour:24,fabric:24,timber:20,bread:10,shirts:3,furniture:0},
    prices:Object.fromEntries(Object.entries(PRODUCTS).map(([id,p])=>[id,p.base])),
    saleTargets:{grain:70,flour:0,fabric:0,timber:0,bread:20,shirts:10,furniture:5},
    production:{flour:12,bread:10,shirts:4,timber:8,furniture:3},
    suppliers:[
      {id:"north",name:"Северный агрохолдинг",focus:["grain"],reliability:92,discount:0.04,lead:0},
      {id:"textile",name:"Текстильный опт",focus:["fabric"],reliability:88,discount:0.02,lead:0},
      {id:"forest",name:"Лесресурс",focus:["timber"],reliability:84,discount:0.03,lead:1},
      {id:"general",name:"Универсальный поставщик",focus:["grain","fabric","timber","flour"],reliability:76,discount:0,lead:0}
    ],
    purchaseOrders:[], shipments:[], contracts:[], contractOffers:[], pendingCosts:{purchases:0,logistics:0}, research:{efficiency:0,marketing:0,logistics:0,quality:0},
    researchProgress:{efficiency:0,marketing:0,logistics:0,quality:0},
    history:[{day:1,revenue:0,costs:0,profit:0,cash:100000,events:["Компания начала работу."]}],
    events:[{day:1,icon:"✦",title:"Компания создана",desc:"Изучите рынок и настройте первые производственные линии.",time:"Сегодня"}],
    salesLog:[], lastPeriod:{revenue:0,costs:0,profit:0,sold:0,productionCosts:0,wages:0,maintenance:0,purchases:0,logistics:0},
    market:{trend:1,news:"Рынок стабилен",competition:1}
  });
  const BASE_DEMAND = Object.fromEntries(Object.entries(PRODUCTS).map(([id,p])=>[id,p.demand]));
  let state = null, currentUser = null;
  const saveKey = () => SAVE_PREFIX + currentUser;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const readJSON = (k,fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
  const sanitizeCompany = s => Array.from(String(s ?? "").replace(/[\u0000-\u001f\u007f]/g,"").replace(/\s+/g," ").trim()).slice(0,32).join("");
  const initials = (name,fallback="?") => { const w = String(name||"").trim().split(/\s+/).filter(Boolean).map(x=>Array.from(x)); if(!w.length) return fallback; return (w.length>1 ? w[0][0]+w[1][0] : w[0].slice(0,2).join("")).toUpperCase(); };
  function normalizeState(){
    state.company = sanitizeCompany(state.company) || DEFAULT_COMPANY;
    state.stock ||= {}; state.prices ||= {}; state.saleTargets ||= {}; state.production ||= defaultState().production;
    state.events ||= []; state.history ||= defaultState().history; state.salesLog ||= [];
    for (const [id,p] of Object.entries(PRODUCTS)) {
      if (state.stock[id] == null) state.stock[id]=0;
      if (state.prices[id] == null) state.prices[id]=p.base;
      if (state.saleTargets[id] == null) state.saleTargets[id]=0;
    }
    state.research ||= {efficiency:0,marketing:0,logistics:0,quality:0};
    state.researchProgress ||= {efficiency:0,marketing:0,logistics:0,quality:0};
    state.suppliers ||= defaultState().suppliers;
    state.purchaseOrders ||= []; state.shipments ||= []; state.contracts ||= []; state.contractOffers ||= []; state.pendingCosts ||= {purchases:0,logistics:0};
    state.market ||= {trend:1,news:"Рынок стабилен",competition:1};
    state.marketDemand ||= {...BASE_DEMAND};
    for(const id of Object.keys(PRODUCTS)){if(state.marketDemand[id]==null)state.marketDemand[id]=BASE_DEMAND[id];PRODUCTS[id].demand=state.marketDemand[id];}
    state.lastPeriod ||= {revenue:0,costs:0,profit:0,sold:0};
    FinCrashSchool.normalize(state, PRODUCTS);
  }
  const $ = s => document.querySelector(s);
  const money = n => new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(Number(n)||0);
  const num = n => new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(Number(n)||0);
  const product = id => PRODUCTS[id];
  const save = () => { if(!currentUser||!state) return; FinCrashSchool.capture(state, PRODUCTS); try { localStorage.setItem(saveKey(),JSON.stringify(state)); } catch { toast("Не удалось сохранить: хранилище браузера переполнено"); } };
  const toast = msg => { const el=$("#toast"); el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2600); };
  const dayName = n => ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"][(n-1)%7];
  const netWorth = () => state.cash + Object.entries(state.stock).reduce((s,[id,q])=>s+q*product(id).base*.35,0)-state.debt;
  const pageNames = {overview:"Обзор компании",divisions:"Подразделения",production:"Производство",warehouse:"Склад",market:"Рынок",staff:"Персонал",suppliers:"Снабжение",logistics:"Логистика",research:"Развитие",competitors:"Конкуренты",contracts:"Контракты",finance:"Финансы",profile:"Профиль"};
  pageNames.rating = "Рейтинг школьников";
  let currentPage="overview";
  function schoolContext(){return {state, user:currentUser, products:PRODUCTS, accounts:getAccounts(), getAccounts, setAccounts, readSave:key=>readJSON(SAVE_PREFIX+key,null), esc, money, num, initials, metric, panelHead, save, rerender:render, toast};}
  function rating(){return FinCrashSchool.render(schoolContext());}
  function header(){
    $("#sideCompany").textContent=state.company; $("#sideAvatar").textContent=initials(state.company); const acc=getAccounts()[currentUser]||{}; $("#sideUser").textContent=`@${acc.login||currentUser}`; $("#userName").textContent=acc.login||currentUser; $("#userAvatar").textContent=initials(acc.login||currentUser); document.title=`${state.company} · ФинCrash`; $("#sideTurn").textContent=`День ${state.day}`; $("#sideDate").textContent=dayName(state.day);
    $("#topTurn").textContent=`День ${state.day}`; $("#breadcrumb").textContent=`КОМПАНИЯ / ${pageNames[currentPage].toUpperCase()}`;$("#pageTitle").textContent=pageNames[currentPage];
  }
  const metric = (label,value,icon,foot,klass="") => `<div class="metric"><div class="metric-head"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value ${klass}">${value}</div><div class="metric-foot">${foot}</div></div>`;
  const panelHead = (title,sub="",action="") => `<div class="panel-head"><div><h3>${title}</h3>${sub?`<p>${sub}</p>`:""}</div>${action}</div>`;
  function productRow(id){
    const p=product(id), stock=state.stock[id]||0;
    return `<tr><td><div class="product-cell"><div class="product-icon">${p.icon}</div><div class="product-name"><b>${p.name}</b><small>${p.category}</small></div></div></td><td>${num(stock)} ед.</td><td>${money(state.prices[id])}</td><td>${num(p.demand)} ед.</td><td><span class="status ${stock<5?"warn":""}">${stock<5?"Мало запасов":"Доступен"}</span></td></tr>`;
  }
  function overview(){
    const last=state.lastPeriod;
    return `<div class="welcome"><div><div class="eyebrow">ВАШ БИЗНЕС. ВАШИ ПРАВИЛА.</div><h2>${esc(state.company)}: добро пожаловать, руководитель.</h2><p>Производство, снабжение, торговля и развитие — управляйте компанией и наблюдайте за реакцией рынка.</p></div><div class="welcome-stat"><small>Капитал компании</small><strong>${money(netWorth())}</strong><span>● Компания работает</span></div></div>
    <div class="notice league-shortcut"><div><b>Школьная лига FINCRASH</b><br>12 периодов, учебные задания и рейтинг осознанных решений.</div><button class="primary-btn" data-go="rating">Мой рейтинг →</button></div>
    <div class="grid metrics">
      ${metric("Денежные средства",money(state.cash),"₽",`Долг: ${money(state.debt)}`)}
      ${metric("Выручка за период",money(last.revenue),"↗",last.revenue?`${num(last.sold)} единиц продано`:"Пока нет продаж",last.revenue?"positive":"")}
      ${metric("Прибыль за период",money(last.profit),"⌁",last.costs?`Расходы: ${money(last.costs)}`:"Ожидает первого расчёта",last.profit>0?"positive":last.profit<0?"negative":"")}
      ${metric("Сотрудники",num(state.employees),"♙",`Репутация: ${state.reputation}/100`)}
    </div>
    <div class="grid two-col">
      <div class="panel">${panelHead("Товары компании","Текущие остатки и рыночные цены",`<button class="text-btn" data-go="warehouse">Весь склад →</button>`)}<div class="table-wrap"><table><thead><tr><th>ТОВАР</th><th>ОСТАТОК</th><th>ЦЕНА</th><th>СПРОС</th><th>СТАТУС</th></tr></thead><tbody>${Object.keys(PRODUCTS).map(productRow).join("")}</tbody></table></div></div>
      <div class="panel">${panelHead("Последние события","Что происходит в компании")}<div class="activity-list">${state.events.slice(0,5).map(e=>`<div class="activity"><div class="activity-icon">${esc(e.icon)}</div><div><b>${esc(e.title)}</b><p>${esc(e.desc)}</p><time>${esc(e.time||`День ${e.day}`)}</time></div></div>`).join("")}</div></div>
    </div>
    <div class="grid two-col"><div class="panel">${panelHead("Рыночная ситуация","Обновляется каждый игровой период")}<div class="division-card"><div class="division-visual">📊</div><div class="division-main"><h3>${state.market.news}</h3><p>Индекс спроса ${Math.round(state.market.trend*100)}% · конкуренция ${Math.round(state.market.competition*100)}%</p></div></div><div class="bar"><span style="width:${Math.min(100,state.market.trend*65)}%"></span></div></div>
    <div class="panel">${panelHead("Быстрые действия","Управляйте бизнесом в несколько кликов")}<div class="form-row"><button class="primary-btn" data-go="production">⚙ Производство</button><button class="secondary-btn" data-go="suppliers">⇄ Закупить сырьё</button><button class="secondary-btn" data-go="market">↗ Продажи</button></div></div></div>`;
  }
  function divisions(){
    return `<div class="section-head"><div><h2>Структура компании</h2><p>Развивайте производство и запускайте новые площадки.</p></div><button class="primary-btn" id="addDivision">＋ Открыть подразделение · ${money(25000)}</button></div>
    <div class="notice">Активные подразделения выпускают продукцию каждый период. Уровень увеличивает объём производства и расходы на обслуживание.</div>
    <div class="grid two-col">${state.divisions.map(d=>`<div class="panel"><div class="division-card"><div class="division-visual">${product(d.product).icon}</div><div class="division-main"><h3>${d.name}</h3><p>${product(d.product).category} · Уровень ${d.level}</p></div><span class="status ${d.active?"":"off"}">${d.active?"Работает":"Остановлено"}</span></div><div class="division-meta"><div>ПРОДУКТ<b>${product(d.product).name}</b></div><div>ВЫПУСК/ПЕРИОД<b>${(state.production[d.product]||0)*d.level} ед.</b></div><div>УЛУЧШЕНИЕ<b>${money(12000*d.level)}</b></div></div><div class="form-row" style="margin-top:17px"><button class="secondary-btn" data-toggle="${d.id}">${d.active?"Приостановить":"Запустить"}</button><button class="primary-btn" data-upgrade="${d.id}">Улучшить</button></div></div>`).join("")}</div>`;
  }
  function production(){
    const recipes=Object.keys(PRODUCTS).filter(id=>PRODUCTS[id].recipe);
    return `<div class="section-head"><div><h2>Производственные линии</h2><p>Сырьё автоматически расходуется при завершении периода.</p></div></div><div class="notice">Производство выполняется только при наличии активного подразделения для соответствующего товара. Технологии повышают эффективность и снижают себестоимость.</div><div class="grid product-grid">${recipes.map(id=>{let p=product(id),d=state.divisions.find(x=>x.product===id),raw=Object.entries(p.recipe).map(([k,n])=>`${product(k).icon} ${product(k).name}: ${state.stock[k]} (нужно ${n} на ед.)`).join(" · ");return `<div class="product-card"><div class="product-icon">${p.icon}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="card-stats"><span>План выпуска</span><b>${state.production[id]||0} ед.</b></div><div class="card-stats"><span>Материалы</span><b>${raw}</b></div><div class="card-stats"><span>Подразделение</span><b>${d&&d.active?"Активно":"Остановлено"}</b></div><div class="form-row" style="margin-top:15px"><div class="field"><label>ПЛАН НА ПЕРИОД</label><input type="number" min="0" max="200" value="${state.production[id]||0}" data-production="${id}"></div><button class="primary-btn" data-save-production="${id}">Сохранить</button></div></div>`}).join("")}</div>
    <div class="panel">${panelHead("Производственные цепочки","Схема движения ресурсов")}<div class="flow-chain"><div class="flow-node">🌾 Зерно</div><span>→</span><div class="flow-node">🥣 Мука</div><span>→</span><div class="flow-node">🥖 Хлеб</div></div><div class="flow-chain"><div class="flow-node">🪵 Древесина</div><span>+</span><div class="flow-node">🧵 Ткань</div><span>→</span><div class="flow-node">🪑 Мебель</div></div></div>`;
  }
  function warehouse(){
    return `<div class="section-head"><div><h2>Складские остатки</h2><p>Все сырьё и готовая продукция компании.</p></div><button class="primary-btn" data-go="suppliers">Пополнить запасы →</button></div><div class="grid metrics">${metric("Всего единиц",num(Object.values(state.stock).reduce((a,b)=>a+b,0)),"▤","Все категории")}${metric("Сырьё",num(state.stock.grain+state.stock.flour+state.stock.fabric+state.stock.timber),"◈","Материалы для производства")}${metric("Готовая продукция",num(state.stock.bread+state.stock.shirts+state.stock.furniture),"▣","Доступно для продажи")}${metric("Оценка запасов",money(Object.entries(state.stock).reduce((s,[id,q])=>s+q*product(id).base*.35,0)),"₽","Условная балансовая цена")}</div><div class="panel">${panelHead("Номенклатура склада","Остатки и ориентировочная стоимость")}<div class="table-wrap"><table><thead><tr><th>ТОВАР</th><th>КАТЕГОРИЯ</th><th>ОСТАТОК</th><th>БАЗОВАЯ ЦЕНА</th><th>СТОИМОСТЬ</th><th>ЗАПАС</th></tr></thead><tbody>${Object.keys(PRODUCTS).map(id=>{let p=product(id),q=state.stock[id];return `<tr><td><div class="product-cell"><div class="product-icon">${p.icon}</div><div class="product-name"><b>${p.name}</b><small>${p.desc}</small></div></div></td><td>${p.category}</td><td><b>${num(q)} ед.</b></td><td>${money(p.base)}</td><td>${money(q*p.base*.35)}</td><td><span class="status ${q<5?"warn":""}">${q<5?"Низкий":"Нормальный"}</span></td></tr>`}).join("")}</tbody></table></div></div>`;
  }
  function market(){
    return `<div class="section-head"><div><h2>Торговая площадка</h2><p>Установите цену и объём предложения. Продажи рассчитываются в конце периода.</p></div></div><div class="notice">Спрос зависит от цены, репутации, рыночного тренда, конкуренции и маркетинговых исследований.</div><div class="panel">${panelHead("Параметры предложения","Товары с нулевым объёмом не выставляются")}<div class="table-wrap"><table><thead><tr><th>ТОВАР</th><th>НА СКЛАДЕ</th><th>ЦЕНА</th><th>ВЫСТАВИТЬ</th><th>ОЦЕНКА ВЫРУЧКИ</th></tr></thead><tbody>${Object.keys(PRODUCTS).map(id=>`<tr><td><div class="product-cell"><div class="product-icon">${product(id).icon}</div><div class="product-name"><b>${product(id).name}</b><small>${product(id).category}</small></div></div></td><td>${state.stock[id]} ед.</td><td><input style="width:110px;padding:8px;border:1px solid #e4e8f0;border-radius:7px" type="number" min="1" value="${state.prices[id]}" data-price="${id}"></td><td><input style="width:90px;padding:8px;border:1px solid #e4e8f0;border-radius:7px" type="number" min="0" max="${state.stock[id]}" value="${state.saleTargets[id]}" data-target="${id}"></td><td><b>${money(state.prices[id]*Math.min(state.saleTargets[id],state.stock[id]))}</b></td></tr>`).join("")}</tbody></table></div><div class="form-row" style="margin-top:18px"><button class="primary-btn" id="saveMarket">Сохранить предложение</button><button class="secondary-btn" id="fillMarket">Выставить всю готовую продукцию</button></div></div>
    <div class="panel">${panelHead("Последние сделки","История продаж")} ${state.salesLog.length?`<div class="table-wrap"><table><thead><tr><th>ДЕНЬ</th><th>ТОВАР</th><th>ПРОДАНО</th><th>ЦЕНА</th><th>ВЫРУЧКА</th></tr></thead><tbody>${state.salesLog.slice(0,15).map(s=>`<tr><td>День ${s.day}</td><td>${product(s.id).icon} ${product(s.id).name}</td><td>${s.qty} ед.</td><td>${money(s.price)}</td><td class="positive"><b>${money(s.revenue)}</b></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><strong>↗</strong>Пока нет сделок. Выставьте товар и завершите период.</div>`}</div>`;
  }
  function staff(){
    const wage=state.employees*480;
    return `<div class="section-head"><div><h2>Команда компании</h2><p>Персонал обеспечивает производство и ежедневную работу.</p></div></div><div class="grid metrics">${metric("Сотрудники",num(state.employees),"♙","Текущий штат")}${metric("Зарплатный фонд",money(wage),"₽","За игровой период")}${metric("Производительность",`${Math.min(100,42+state.employees*2+state.research.efficiency*5)}%`,"⚙","Условный индекс")}${metric("Репутация",`${state.reputation}/100`,"✦","Влияет на спрос")}</div><div class="grid two-col"><div class="panel">${panelHead("Управление штатом","Найм и сокращение")}<div class="division-card"><div class="division-visual">♙</div><div class="division-main"><h3>Производственный персонал</h3><p>Средняя зарплата — ${money(480)} за период</p></div><b>${state.employees} чел.</b></div><div class="form-row" style="margin-top:20px"><button class="primary-btn" id="hire">＋ Нанять · ${money(1500)}</button><button class="secondary-btn" id="fire">Сократить штат</button></div><p class="muted" style="margin-top:15px">Найм стоит разово 1 500 ₽, затем начисляется зарплата за каждый период.</p></div><div class="panel">${panelHead("Репутация","Доверие покупателей")}<div style="font-size:32px;font-weight:850">${state.reputation}<small style="font-size:13px;color:#9aa2b3"> / 100</small></div><div class="bar"><span style="width:${state.reputation}%"></span></div><p class="muted">Прибыльные периоды и исследования маркетинга повышают репутацию и спрос.</p></div></div>`;
  }
  function suppliers(){
    return `<div class="section-head"><div><h2>Снабжение и закупки</h2><p>Заказывайте сырьё у поставщиков для производственных цепочек.</p></div></div><div class="notice">Закупки списывают деньги сразу. Большинство поставок приходит в конце периода; некоторые поставщики доставляют с задержкой в один день.</div><div class="grid product-grid">${state.suppliers.map(s=>`<div class="product-card"><div class="product-icon">🚚</div><h3>${s.name}</h3><p>Надёжность ${s.reliability}% · скидка ${(s.discount*100).toFixed(0)}% · срок ${s.lead?"1 период":"сегодня"}</p><div class="card-stats"><span>Ассортимент</span><b>${s.focus.map(id=>product(id).name).join(", ")}</b></div><div class="field" style="margin-top:12px"><label>ТОВАР</label><select id="supplierProduct-${s.id}">${s.focus.map(id=>`<option value="${id}">${product(id).name} · ${money(Math.round(product(id).cost*(1-s.discount)))}/ед.</option>`).join("")}</select></div><div class="field" style="margin-top:10px"><label>КОЛИЧЕСТВО</label><input id="supplierQty-${s.id}" type="number" min="1" max="500" value="10"></div><button class="primary-btn" style="width:100%;margin-top:13px" data-order="${s.id}">Оформить заказ</button></div>`).join("")}</div><div class="panel">${panelHead("Ожидаемые поставки","Заказы, которые ещё не поступили")}${state.purchaseOrders.length?`<div class="table-wrap"><table><thead><tr><th>ПОСТАВЩИК</th><th>ТОВАР</th><th>КОЛИЧЕСТВО</th><th>СТОИМОСТЬ</th><th>ПОСТУПЛЕНИЕ</th></tr></thead><tbody>${state.purchaseOrders.map(o=>`<tr><td>${o.supplierName}</td><td>${product(o.product).name}</td><td>${o.qty} ед.</td><td>${money(o.cost)}</td><td>День ${o.arriveDay}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><strong>⇄</strong>Нет заказов в пути.</div>`}</div>`;
  }
  function logistics(){
    return `<div class="section-head"><div><h2>Логистика</h2><p>Доставка готовых товаров и управление транспортными расходами.</p></div></div><div class="grid metrics">${metric("Отправок в пути",state.shipments.length,"🚚","Текущие перевозки")}${metric("Логистическая технология",`Уровень ${state.research.logistics}`,"⌁","Снижает расходы доставки")}${metric("Стоимость доставки",money(Math.max(100,800-state.research.logistics*100)),"₽","Базовая ставка за партию")}${metric("Доступность",`${Math.min(95,70+state.research.logistics*5)}%`,"◉","Условный показатель сервиса")}</div><div class="panel">${panelHead("Отправить товар на рынок","Логистика влияет на расходы и доступность продаж")}<div class="form-row"><div class="field"><label>ТОВАР</label><select id="shipProduct">${Object.keys(PRODUCTS).map(id=>`<option value="${id}">${product(id).icon} ${product(id).name}</option>`).join("")}</select></div><div class="field"><label>КОЛИЧЕСТВО</label><input id="shipQty" type="number" min="1" max="500" value="5"></div><div class="field"><label>РЕГИОН</label><select id="shipRegion"><option value="central">Центральный · ×1,0</option><option value="north">Северный · ×1,4</option><option value="south">Южный · ×1,2</option></select></div><button class="primary-btn" id="sendShipment">Создать отправку</button></div><p class="muted" style="margin-top:14px">Отправка резервирует товар на складе, оплачивает перевозку и возвращает товар в общий склад после доставки. Эта механика моделирует внутреннюю логистику, а не подключается к реальным службам доставки.</p></div><div class="panel">${panelHead("История логистики","Созданные и завершённые перевозки")}${state.shipments.length?`<div class="table-wrap"><table><thead><tr><th>ТОВАР</th><th>КОЛИЧЕСТВО</th><th>РЕГИОН</th><th>СТАТУС</th><th>ДЕНЬ</th></tr></thead><tbody>${state.shipments.map(s=>`<tr><td>${product(s.product).name}</td><td>${s.qty} ед.</td><td>${s.region}</td><td><span class="status ${s.status==="В пути"?"warn":""}">${s.status}</span></td><td>${s.day}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><strong>⌁</strong>Пока нет отправок.</div>`}</div>`;
  }
  const researchDefs = {
    efficiency:{name:"Производственная эффективность",icon:"⚙",desc:"Увеличивает выпуск и немного снижает затраты производства.",cost:18000,effect:"Каждый уровень даёт +5% к условной производительности."},
    marketing:{name:"Маркетинговая аналитика",icon:"📣",desc:"Повышает доступный спрос и укрепляет репутацию.",cost:15000,effect:"Каждый уровень повышает привлекательность товаров."},
    logistics:{name:"Управление логистикой",icon:"🚚",desc:"Снижает стоимость доставки и риск задержек.",cost:12000,effect:"Каждый уровень снижает базовые транспортные расходы."},
    quality:{name:"Контроль качества",icon:"✦",desc:"Позволяет продавать чуть дороже без резкого падения спроса.",cost:22000,effect:"Каждый уровень улучшает конкурентоспособность."}
  };
  function research(){
    return `<div class="section-head"><div><h2>Развитие и исследования</h2><p>Инвестируйте в долгосрочные преимущества компании.</p></div></div><div class="notice">Исследования идут несколько игровых периодов. После завершения уровень технологии сохраняется в компании.</div><div class="grid product-grid">${Object.entries(researchDefs).map(([id,r])=>`<div class="product-card"><div class="product-icon">${r.icon}</div><h3>${r.name}</h3><p>${r.desc}</p><div class="card-stats"><span>Уровень</span><b>${state.research[id]}</b></div><div class="card-stats"><span>Стоимость проекта</span><b>${money(r.cost)}</b></div><div class="bar"><span style="width:${state.researchProgress[id]}%"></span></div><div class="card-stats"><span>Прогресс</span><b>${state.researchProgress[id]}%</b></div><p class="muted">${r.effect}</p><button class="primary-btn" style="width:100%;margin-top:10px" data-research="${id}" ${state.researchProgress[id]>0?"disabled":""}>Начать исследование</button></div>`).join("")}</div><div class="panel">${panelHead("Технологический профиль","Текущие постоянные бонусы")}<div class="table-wrap"><table><thead><tr><th>ТЕХНОЛОГИЯ</th><th>УРОВЕНЬ</th><th>ПРОГРЕСС</th><th>СТАТУС</th></tr></thead><tbody>${Object.entries(researchDefs).map(([id,r])=>`<tr><td>${r.icon} ${r.name}</td><td>${state.research[id]}</td><td>${state.researchProgress[id]}%</td><td><span class="status ${state.researchProgress[id]>0?"warn":""}">${state.researchProgress[id]>=100?"Завершено":state.researchProgress[id]>0?"В работе":"Доступно"}</span></td></tr>`).join("")}</tbody></table></div></div>`;
  }
  function competitors(){
    const rivals=[
      {name:"Northstar Group",sector:"Продукты питания",strength:72,price:.96,desc:"Сильная дистрибуция и умеренные цены"},
      {name:"Urban Threads",sector:"Одежда",strength:65,price:1.04,desc:"Фокус на качестве и ассортименте"},
      {name:"Timberline Works",sector:"Древесина и мебель",strength:58,price:.92,desc:"Низкая себестоимость ресурсов"},
      {name:"Market Union",sector:"Универсальная торговля",strength:83,price:1.08,desc:"Крупный игрок с широкой сетью"}
    ];
    return `<div class="section-head"><div><h2>Конкурентная среда</h2><p>Условные компании-конкуренты формируют давление на цены и рыночный спрос.</p></div></div><div class="notice">Конкуренты моделируются локально. Это не реальные игроки Virtonomica и не подключение к чужому серверу.</div><div class="grid product-grid">${rivals.map(r=>`<div class="product-card"><div class="product-icon">🏢</div><h3>${r.name}</h3><p>${r.sector}</p><div class="card-stats"><span>Индекс силы</span><b>${r.strength}/100</b></div><div class="bar"><span style="width:${r.strength}%"></span></div><div class="card-stats"><span>Индекс цены</span><b>${r.price.toFixed(2)}× рынка</b></div><p class="muted">${r.desc}</p></div>`).join("")}</div><div class="panel">${panelHead("Рыночная сводка","Как вести себя среди конкурентов")}<div class="ledger"><div class="ledger-row"><span>Общее конкурентное давление</span><b>${Math.round(state.market.competition*100)}%</b></div><div class="ledger-row"><span>Текущий рыночный тренд</span><b>${Math.round(state.market.trend*100)}%</b></div><div class="ledger-row"><span>Репутация вашей компании</span><b>${state.reputation}/100</b></div><div class="ledger-row"><span>Рекомендация</span><b>${state.reputation<40?"Укрепляйте качество и не завышайте цены":state.market.competition>1.1?"Проверьте цены конкурентов и себестоимость":"Развивайте производство и удерживайте стабильные цены"}</b></div></div></div>`;
  }
  function makeContractOffers(){
    if(state.contractOffers.length) return;
    const ids=Object.keys(PRODUCTS).filter(id=>["bread","shirts","furniture","flour","fabric","timber"].includes(id));
    state.contractOffers=ids.sort((a,b)=>((a.length*7+state.day*3)%13)-((b.length*7+state.day*3)%13)).slice(0,3).map((id,i)=>{
      const qty=8+((state.day*5+i*7)%18), due=state.day+2+(i%2);
      return {id:`offer-${state.day}-${id}`,product:id,qty,reward:Math.round(PRODUCTS[id].base*qty*(1.12+i*.06)),deadline:due,client:["Сеть «Городской маркет»","Розничный холдинг «Север»","Дистрибьютор «Премьер»"][i]};
    });
  }
  function contracts(){
    makeContractOffers();
    return `<div class="section-head"><div><h2>Коммерческие контракты</h2><p>Принимайте заказы клиентов, поставляйте объём вовремя и зарабатывайте больше, чем на обычной продаже.</p></div></div>
    <div class="notice">Принятый контракт проверяется в конце каждого периода. Если на складе хватает товара, поставка выполняется автоматически. Просрочка снижает репутацию.</div>
    <div class="panel">${panelHead("Новые предложения","Выберите контракт, который реально сможете выполнить")}${state.contractOffers.length?`<div class="table-wrap"><table><thead><tr><th>КЛИЕНТ</th><th>ТОВАР</th><th>ОБЪЁМ</th><th>ОПЛАТА</th><th>СРОК</th><th></th></tr></thead><tbody>${state.contractOffers.map(o=>`<tr><td>${o.client}</td><td>${product(o.product).icon} ${product(o.product).name}</td><td>${o.qty} ед. <small>(на складе: ${state.stock[o.product]})</small></td><td><b>${money(o.reward)}</b></td><td>до дня ${o.deadline}</td><td><button class="primary-btn" data-contract-accept="${o.id}">Принять</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><strong>✓</strong>Новые предложения появятся после следующего периода.</div>`}</div>
    <div class="panel">${panelHead("Активные контракты","Контракты требуют наличия товара на складе")}${state.contracts.length?`<div class="table-wrap"><table><thead><tr><th>КЛИЕНТ</th><th>ТОВАР</th><th>ОБЪЁМ</th><th>ОПЛАТА</th><th>ДЕДЛАЙН</th><th>СТАТУС</th></tr></thead><tbody>${state.contracts.map(c=>`<tr><td>${c.client}</td><td>${product(c.product).name}</td><td>${c.qty} ед. <small>(сейчас: ${state.stock[c.product]})</small></td><td>${money(c.reward)}</td><td>День ${c.deadline}</td><td><span class="status ${c.deadline<=state.day?"warn":""}">${c.deadline<=state.day?"Срок сегодня":"В работе"}</span></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><strong>▤</strong>Активных контрактов нет. Примите предложение выше.</div>`}</div>
    <div class="panel">${panelHead("История выполнения","Последние коммерческие события")}${state.events.filter(e=>/контракт|заказ клиента/i.test(e.title+" "+e.desc)).slice(0,6).map(e=>`<div class="activity"><div class="activity-icon">📄</div><div><b>${esc(e.title)}</b><p>${esc(e.desc)}</p><time>${esc(e.time||`День ${e.day}`)}</time></div></div>`).join("")||`<p class="muted">Пока нет завершённых контрактов.</p>`}</div>`;
  }
  function finance(){
    const hist=state.history.slice(-10),max=Math.max(1,...hist.map(h=>Math.max(h.revenue,h.costs)));
    return `<div class="section-head"><div><h2>Финансовый центр</h2><p>Движение средств, расходы и результаты компании.</p></div></div><div class="grid metrics">${metric("Баланс",money(state.cash),"₽","Доступные средства")}${metric("Капитал",money(netWorth()),"◈","С учётом условных запасов")}${metric("Задолженность",money(state.debt),"⌁","Кредитная система пока не включена")}${metric("Последняя прибыль",money(state.lastPeriod.profit),"↗","После расходов",state.lastPeriod.profit>0?"positive":state.lastPeriod.profit<0?"negative":"")}</div><div class="grid two-col"><div class="panel">${panelHead("Выручка и расходы","Последние игровые периоды")}<div class="finance-chart">${hist.map(h=>`<div class="chart-col"><div class="chart-bar" title="Выручка ${money(h.revenue)}" style="height:${Math.max(3,h.revenue/max*100)}%"></div><div class="chart-bar" title="Расходы ${money(h.costs)}" style="height:${Math.max(3,h.costs/max*100)}%;background:linear-gradient(180deg,#3a2f45,#181623)"></div><small>${h.day}</small></div>`).join("")}</div><div class="form-row" style="margin-top:12px"><span class="status" style="background:#f6eaf0;color:#958087">■ Выручка</span><span class="status" style="background:#ece8ee;color:#181623">■ Расходы</span></div></div><div class="panel">${panelHead("Сводка последнего периода","Финансовые операции")}<div class="ledger"><div class="ledger-row"><span>Выручка от продаж</span><b class="positive">+${money(state.lastPeriod.revenue)}</b></div><div class="ledger-row"><span>Производство и сырьё</span><b class="negative">−${money(state.lastPeriod.productionCosts||0)}</b></div><div class="ledger-row"><span>Зарплата</span><b class="negative">−${money(state.lastPeriod.wages||0)}</b></div><div class="ledger-row"><span>Обслуживание</span><b class="negative">−${money(state.lastPeriod.maintenance||0)}</b></div><div class="ledger-row"><span>Закупки</span><b class="negative">−${money(state.lastPeriod.purchases||0)}</b></div><div class="ledger-row"><span>Логистика</span><b class="negative">−${money(state.lastPeriod.logistics||0)}</b></div><div class="ledger-row"><span>Итог периода</span><b class="${state.lastPeriod.profit>=0?"positive":"negative"}">${money(state.lastPeriod.profit)}</b></div></div></div></div><div class="panel">${panelHead("История периодов","Баланс и финансовый результат")}<div class="table-wrap"><table><thead><tr><th>ПЕРИОД</th><th>ВЫРУЧКА</th><th>РАСХОДЫ</th><th>ПРИБЫЛЬ</th><th>БАЛАНС</th></tr></thead><tbody>${state.history.slice().reverse().map(h=>`<tr><td>День ${h.day}</td><td>${money(h.revenue)}</td><td>${money(h.costs)}</td><td class="${h.profit>=0?"positive":"negative"}"><b>${money(h.profit)}</b></td><td>${money(h.cash)}</td></tr>`).join("")}</tbody></table></div></div><div class="panel">${panelHead("Управление сохранением","Резервная копия или перенос игры между браузерами")}<div class="form-row"><button class="primary-btn" id="exportSave">Экспортировать сохранение</button><label class="secondary-btn" for="importSave" style="cursor:pointer">Импортировать сохранение</label><input id="importSave" type="file" accept="application/json,.json" style="display:none"><button class="danger-btn" id="resetSave">Начать заново</button></div><p class="muted" style="margin-top:12px">Экспорт создаёт JSON-файл со всеми игровыми данными. Импорт заменяет текущее сохранение. Сброс необратим.</p></div>`;
  }

  function profile(){
    const acc=getAccounts()[currentUser]||{};
    const created=acc.created?new Date(acc.created).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}):"—";
    return `<div class="profile-hero"><div class="big-avatar">${esc(initials(state.company))}</div><div><h2>${esc(state.company)}</h2><p>Аккаунт @${esc(acc.login||currentUser)} · зарегистрирован ${created}</p></div></div>
    ${FinCrashSchool.profileForm(schoolContext())}
    <div class="grid two-col">
      <div class="panel">${panelHead("Название компании","Отображается в меню, на обзоре и в журнале событий")}
        <div class="form-row"><div class="field"><label>НАЗВАНИЕ КОМПАНИИ</label><input id="companyInput" maxlength="32" value="${esc(state.company)}" placeholder="Название компании" autocomplete="off"></div><button class="primary-btn" id="saveCompany" type="button">Сохранить название</button></div>
        <p class="hint" id="companyHint">От 2 до 32 символов</p></div>
      <div class="panel">${panelHead("Статистика компании","Текущий прогресс")}<div class="ledger">
        <div class="ledger-row"><span>Игровой день</span><b>${state.day}</b></div>
        <div class="ledger-row"><span>Капитал</span><b>${money(netWorth())}</b></div>
        <div class="ledger-row"><span>Подразделения</span><b>${state.divisions.length}</b></div>
        <div class="ledger-row"><span>Сотрудники</span><b>${num(state.employees)}</b></div>
        <div class="ledger-row"><span>Репутация</span><b>${state.reputation}/100</b></div></div></div>
    </div>
    <div class="grid two-col">
      <div class="panel">${panelHead("Смена пароля","Рекомендуем использовать уникальный пароль")}
        <div style="display:grid;gap:12px">
          <div class="field"><label>ТЕКУЩИЙ ПАРОЛЬ</label><input id="pwOld" type="password" autocomplete="current-password"></div>
          <div class="field"><label>НОВЫЙ ПАРОЛЬ</label><input id="pwNew" type="password" autocomplete="new-password" placeholder="Минимум 6 символов"></div>
          <div class="field"><label>ПОВТОРИТЕ НОВЫЙ ПАРОЛЬ</label><input id="pwNew2" type="password" autocomplete="new-password"></div>
          <div><button class="primary-btn" id="changePass" type="button">Сменить пароль</button></div>
        </div><p class="hint bad" id="passHint" hidden></p></div>
      <div class="panel">${panelHead("Аккаунт","Вход и данные")}
        <div class="field"><label>ЛОГИН</label><input value="${esc(acc.login||currentUser)}" readonly></div>
        <div class="form-row" style="margin-top:16px"><button class="secondary-btn" id="logoutBtn2" type="button">Выйти из аккаунта</button><button class="danger-btn" id="deleteAccount" type="button">Удалить аккаунт</button></div>
        <p class="muted" style="margin-top:12px">Удаление аккаунта стирает его сохранение без возможности восстановления. Сделайте экспорт на странице «Финансы», если хотите сохранить копию.</p></div>
    </div>`;
  }
  function render(){
    header();
    const pages={overview,divisions,production,warehouse,market,staff,suppliers,logistics,research,competitors,contracts,finance,profile,rating};
    $("#pageContent").innerHTML=pages[currentPage]();
    $("#navigation").querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===currentPage));
    bindPage();
  }
  function go(page){currentPage=page;render();window.scrollTo({top:0,behavior:"smooth"});}
  function addEvent(icon,title,desc){state.events.unshift({day:state.day,icon,title,desc,time:`День ${state.day}`});state.events=state.events.slice(0,12);}
  function bindPage(){
    FinCrashSchool.bind(schoolContext());
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
    $("#pageContent").querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>{let d=state.divisions.find(x=>x.id===Number(b.dataset.toggle));d.active=!d.active;addEvent("⚙",d.active?"Подразделение запущено":"Подразделение приостановлено",d.name);save();render();toast(d.active?"Подразделение запущено":"Работа подразделения остановлена");}));
    $("#pageContent").querySelectorAll("[data-upgrade]").forEach(b=>b.addEventListener("click",()=>{let d=state.divisions.find(x=>x.id===Number(b.dataset.upgrade)),cost=12000*d.level;if(state.cash<cost)return toast("Недостаточно средств");state.cash-=cost;d.level++;addEvent("⬆","Подразделение улучшено",`${d.name}: уровень ${d.level}`);save();render();toast("Уровень подразделения повышен");}));
    const add=$("#addDivision");if(add)add.addEventListener("click",()=>{if(state.cash<25000)return toast("Недостаточно средств");if(state.divisions.length>=8)return toast("В этой версии доступно до 8 подразделений");state.cash-=25000;const available=["bread","flour","shirts","timber","furniture"],next=available[state.divisions.length%available.length];state.divisions.push({id:Date.now(),name:`${product(next).name}: площадка ${state.divisions.length+1}`,type:"factory",level:1,product:next,active:true});addEvent("＋","Открыто подразделение",`Новая площадка: ${product(next).name}`);save();render();toast("Новое подразделение открыто");});
    $("#pageContent").querySelectorAll("[data-save-production]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.saveProduction,inp=$(`[data-production="${id}"]`),v=Math.max(0,Math.min(200,Math.floor(Number(inp.value)||0)));state.production[id]=v;save();render();toast("План производства сохранён");}));
    const saveMarket=$("#saveMarket");if(saveMarket)saveMarket.addEventListener("click",()=>{Object.keys(PRODUCTS).forEach(id=>{const price=Number($(`[data-price="${id}"]`).value),target=Number($(`[data-target="${id}"]`).value);state.prices[id]=Math.max(1,Math.min(1000000,Math.floor(price||1)));state.saleTargets[id]=Math.max(0,Math.min(state.stock[id],Math.floor(target||0)));});save();render();toast("Торговое предложение сохранено");});
    const fill=$("#fillMarket");if(fill)fill.addEventListener("click",()=>{Object.keys(PRODUCTS).forEach(id=>state.saleTargets[id]=(["bread","shirts","furniture"].includes(id)?state.stock[id]:0));save();render();toast("Готовая продукция выставлена на продажу");});
    const hire=$("#hire");if(hire)hire.addEventListener("click",()=>{if(state.cash<1500)return toast("Недостаточно средств");state.cash-=1500;state.employees++;addEvent("♙","Новый сотрудник",`В компании теперь ${state.employees} сотрудников`);save();render();toast("Сотрудник нанят");});
    const fire=$("#fire");if(fire)fire.addEventListener("click",()=>{if(state.employees<=1)return toast("Нельзя сократить штат ниже одного человека");state.employees--;addEvent("♙","Изменение штата",`В компании ${state.employees} сотрудников`);save();render();toast("Штат сокращён");});
    $("#pageContent").querySelectorAll("[data-order]").forEach(b=>b.addEventListener("click",()=>{const s=state.suppliers.find(x=>x.id===b.dataset.order),pid=$(`#supplierProduct-${s.id}`).value,qty=Math.max(1,Math.min(500,Math.floor(Number($(`#supplierQty-${s.id}`).value)||1))),cost=Math.round(product(pid).cost*(1-s.discount)*qty);if(state.cash<cost)return toast("Недостаточно средств для заказа");state.cash-=cost;state.pendingCosts.purchases=(state.pendingCosts.purchases||0)+cost;state.purchaseOrders.push({supplier:s.id,supplierName:s.name,product:pid,qty,cost,arriveDay:state.day+(s.lead?2:1)});addEvent("⇄","Заказ поставщику оформлен",`${qty} ед. товара «${product(pid).name}»`);save();render();toast("Заказ оформлен");}));
    const send=$("#sendShipment");if(send)send.addEventListener("click",()=>{const pid=$("#shipProduct").value,qty=Math.max(1,Math.floor(Number($("#shipQty").value)||1)),reg=$("#shipRegion").value,regionName={central:"Центральный",north:"Северный",south:"Южный"}[reg],mult={central:1,north:1.4,south:1.2}[reg],cost=Math.round((800-state.research.logistics*100)*mult+qty*8);if(qty>state.stock[pid])return toast("На складе недостаточно товара");if(state.cash<cost)return toast("Недостаточно средств на доставку");state.stock[pid]-=qty;state.cash-=cost;state.pendingCosts.logistics=(state.pendingCosts.logistics||0)+cost;state.shipments.unshift({product:pid,qty,region:regionName,status:"В пути",day:state.day,arriveDay:state.day+1,cost});addEvent("🚚","Создана отправка",`${qty} ед. товара «${product(pid).name}» в регион «${regionName}»`);save();render();toast("Отправка создана");});
    $("#pageContent").querySelectorAll("[data-contract-accept]").forEach(b=>b.addEventListener("click",()=>{const i=state.contractOffers.findIndex(o=>o.id===b.dataset.contractAccept);if(i<0)return;const c=state.contractOffers[i];if(state.contracts.length>=6)return toast("Сначала выполните текущие контракты");state.contracts.push({...c,acceptedDay:state.day});state.contractOffers.splice(i,1);addEvent("📄","Контракт принят",`${c.client}: ${c.qty} ед. товара «${product(c.product).name}» до дня ${c.deadline}`);save();render();toast("Контракт принят");}));
    const saveCompany=$("#saveCompany");if(saveCompany){const inp=$("#companyInput"),hint=$("#companyHint");const doSave=()=>{const name=sanitizeCompany(inp.value);if(Array.from(name).length<2){hint.textContent="Название должно содержать минимум 2 символа";hint.classList.add("bad");return;}if(name===state.company){hint.textContent="Это название уже используется";hint.classList.add("bad");return;}const old=state.company;state.company=name;addEvent("✎","Компания переименована",`${old} → ${name}`);save();render();toast("Название компании обновлено");};saveCompany.addEventListener("click",doSave);inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();doSave();}});inp.addEventListener("input",()=>{hint.classList.remove("bad");hint.textContent=`${Array.from(inp.value.trim()).length}/32 символов`;});}
    const chPass=$("#changePass");if(chPass)chPass.addEventListener("click",async()=>{const hint=$("#passHint"),fail=m=>{hint.textContent=m;hint.hidden=false;};hint.hidden=true;const oldP=$("#pwOld").value,n1=$("#pwNew").value,n2=$("#pwNew2").value;if(n1.length<6)return fail("Новый пароль должен быть не короче 6 символов");if(n1!==n2)return fail("Новые пароли не совпадают");const accounts=getAccounts(),acc=accounts[currentUser];if(!acc)return fail("Аккаунт не найден");try{if(await hashPassword(oldP,acc.salt,acc.algo)!==acc.hash)return fail("Текущий пароль указан неверно");const salt=makeSalt(),algo=pickAlgo();accounts[currentUser]={...acc,salt,algo,hash:await hashPassword(n1,salt,algo)};setAccounts(accounts);["#pwOld","#pwNew","#pwNew2"].forEach(s=>$(s).value="");toast("Пароль изменён");}catch{fail("Не удалось сменить пароль в этом браузере");}});
    const lo2=$("#logoutBtn2");if(lo2)lo2.addEventListener("click",logout);
    const delAcc=$("#deleteAccount");if(delAcc)delAcc.addEventListener("click",()=>{if(!confirm("Удалить аккаунт и всё его сохранение? Это действие необратимо."))return;const accounts=getAccounts();delete accounts[currentUser];setAccounts(accounts);localStorage.removeItem(saveKey());logout();toast("Аккаунт удалён");});
    const exp=$("#exportSave");if(exp)exp.addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`fincrash-save-day-${state.day}.json`;a.click();URL.revokeObjectURL(url);toast("Сохранение экспортировано");});
    const imp=$("#importSave");if(imp)imp.addEventListener("change",async()=>{const file=imp.files&&imp.files[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!imported||!imported.stock||!imported.prices||!Array.isArray(imported.divisions))throw new Error("invalid save");imported.company=sanitizeCompany(imported.company)||state.company;localStorage.setItem(saveKey(),JSON.stringify(imported));location.reload();}catch(e){toast("Не удалось импортировать: неверный файл");}});
    const reset=$("#resetSave");if(reset)reset.addEventListener("click",()=>{if(!confirm("Удалить текущее сохранение и начать заново? Название компании сохранится."))return;localStorage.setItem(saveKey(),JSON.stringify(defaultState(state.company)));location.reload();});
    $("#pageContent").querySelectorAll("[data-research]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.research,r=researchDefs[id];if(state.cash<r.cost)return toast("Недостаточно средств");state.cash-=r.cost;state.researchProgress[id]=1;addEvent("⌘","Исследование начато",r.name);save();render();toast("Исследование начато");}));
  }
  function advance(){
    if(!state||!currentUser)return;
    let revenue=0,productionCosts=0,sold=0,events=[];
    const purchases=state.pendingCosts.purchases||0, logistics=state.pendingCosts.logistics||0;
    state.pendingCosts={purchases:0,logistics:0};
    // Deliver shipments and supplier orders whose arrival date is now.
    state.purchaseOrders=state.purchaseOrders.filter(o=>{if(o.arriveDay<=state.day){state.stock[o.product]+=o.qty;events.push(`Поставка поступила: ${product(o.product).name} — ${o.qty} ед.`);return false;}return true;});
    state.shipments.forEach(s=>{if(s.status==="В пути"&&s.arriveDay<=state.day){s.status="Доставлено";state.stock[s.product]+=s.qty;events.push(`Доставлено в регион: ${product(s.product).name} — ${s.qty} ед.`);}});
    // Research progresses by 35 points each period after the initial investment.
    for(const [id,progress] of Object.entries(state.researchProgress)){if(progress>0&&progress<100){state.researchProgress[id]=Math.min(100,progress+35);if(state.researchProgress[id]===100){state.research[id]++;events.push(`Исследование завершено: ${researchDefs[id].name}.`);}}}
    // Production with recipe inputs.
    for(const d of state.divisions.filter(x=>x.active)){
      const id=d.product,p=product(id),planned=(state.production[id]||0)*d.level;
      if(!p.recipe){ // resource production by forestry/mining/farm-like divisions
        if(["grain","timber"].includes(id)){const made=Math.min(planned,10+d.level*4);state.stock[id]+=made;productionCosts+=made*(id==="grain"?9:24);if(made)events.push(`${p.name}: добыто/выращено ${made} ед.`);}
        continue;
      }
      let possible=planned;
      for(const [raw,perUnit] of Object.entries(p.recipe))possible=Math.min(possible,Math.floor(state.stock[raw]/perUnit));
      possible=Math.max(0,possible);
      for(const [raw,perUnit] of Object.entries(p.recipe)){state.stock[raw]-=possible*perUnit;productionCosts+=possible*perUnit*product(raw).cost;}
      const labour=Math.ceil(possible*7*(1-state.research.efficiency*.035));productionCosts+=labour;
      state.stock[id]+=possible;
      if(possible<planned)events.push(`${p.name}: выпущено ${possible} из ${planned} ед. — ограничение по сырью.`);
      else if(possible>0)events.push(`${p.name}: выпущено ${possible} ед.`);
    }
    // Fulfil active client contracts before ordinary market sales so contract stock is protected.
    state.contracts=state.contracts.filter(c=>{
      if((state.stock[c.product]||0)>=c.qty){state.stock[c.product]-=c.qty;revenue+=c.reward;sold+=c.qty;state.salesLog.unshift({day:state.day,id:c.product,qty:c.qty,price:Math.round(c.reward/c.qty),revenue:c.reward,contract:true});events.push(`Контракт выполнен: ${c.client}, ${c.qty} ед. ${product(c.product).name}; оплата ${money(c.reward)}.`);return false;}
      if(c.deadline<=state.day){state.reputation=Math.max(0,state.reputation-7);events.push(`Контракт просрочен: ${c.client}. Репутация −7.`);return false;}
      return true;
    });
    // Sales, with competition, price elasticity, marketing and quality effects.
    for(const id of Object.keys(PRODUCTS)){
      const p=product(id),qty=Math.min(state.stock[id],state.saleTargets[id]);
      if(qty<=0)continue;
      const ratio=state.prices[id]/p.base;
      const qualityBoost=1+state.research.quality*.035;
      const priceFactor=Math.max(.08,Math.min(1.35,1.05-(ratio/qualityBoost-1)*.82));
      const reputationFactor=.65+state.reputation/220;
      const demand=Math.max(0,Math.floor(p.demand*state.market.trend/state.market.competition*(.88+Math.random()*.24)*priceFactor*reputationFactor*(1+state.research.marketing*.06)));
      const soldQty=Math.min(qty,demand);
      if(soldQty>0){const rev=soldQty*state.prices[id];state.stock[id]-=soldQty;revenue+=rev;sold+=soldQty;state.salesLog.unshift({day:state.day,id,qty:soldQty,price:state.prices[id],revenue:rev});events.push(`Продано: ${p.name} — ${soldQty} ед. по ${money(state.prices[id])}.`);}
    }
    const wages=state.employees*480,maintenance=state.divisions.reduce((s,d)=>s+(d.active?650*d.level:180),0);
    const costs=productionCosts+wages+maintenance+purchases+logistics,profit=revenue-costs;
    state.cash+=revenue-productionCosts-wages-maintenance;
    if(state.cash<0){state.reputation=Math.max(0,state.reputation-4);events.push("Баланс отрицательный: пересмотрите цены и расходы.");}
    else if(profit>0)state.reputation=Math.min(100,state.reputation+1);
    else state.reputation=Math.max(0,state.reputation-1);
    state.lastPeriod={revenue,costs,profit,sold,productionCosts,wages,maintenance,purchases,logistics};
    state.history.push({day:state.day,revenue,costs,profit,cash:state.cash});
    FinCrashSchool.recordPeriod(state, PRODUCTS, state.salesLog.filter(sale=>sale.day===state.day));
    state.history=state.history.slice(-45);state.salesLog=state.salesLog.slice(0,80);
    state.market.trend=Math.max(.72,Math.min(1.28,state.market.trend+(.5-Math.random())*.12));
    state.market.competition=Math.max(.8,Math.min(1.25,state.market.competition+(.5-Math.random())*.06));
    state.market.news=state.market.trend>1.12?"Спрос на рынке растёт":state.market.trend<.9?"Покупатели сокращают расходы":"Рынок стабилен";
    for(const id of Object.keys(PRODUCTS)){PRODUCTS[id].demand=Math.max(10,Math.round(PRODUCTS[id].demand*(.94+Math.random()*.12)));state.marketDemand[id]=PRODUCTS[id].demand;}
    state.day++;
    state.contractOffers=[];
    state.events=events.slice(0,7).map((desc,i)=>({day:state.day-1,icon:["↗","⚙","▤","₽","✦","◈","🚚"][i%7],title:desc.split(":")[0].slice(0,48),desc,time:`День ${state.day-1}`})).concat(state.events).slice(0,12);
    save();render();toast(`Период завершён. Финансовый результат: ${money(profit)}`);
  }
  $("#navigation").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)go(b.dataset.page);});
  $("#advanceBtn").addEventListener("click",advance);
  $("#advanceMobile").addEventListener("click",advance);
  $("#helpBtn").addEventListener("click",()=>$("#helpDialog").showModal());
  $("#closeHelp").addEventListener("click",()=>$("#helpDialog").close());
  $("#helpDialog").addEventListener("click",e=>{if(e.target.id==="helpDialog")$("#helpDialog").close();});
  // ---------- Аккаунты (локально, в браузере) ----------
  const getAccounts = () => readJSON(ACCOUNTS_KEY,{});
  const setAccounts = a => localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a));
  const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  const makeSalt = () => { const b=new Uint8Array(16); if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(b); else for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256); return hex(b); };
  const pickAlgo = () => (window.crypto&&crypto.subtle) ? "pbkdf2" : "fallback";
  function fallbackHash(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let r=0;r<2000;r++){for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);}return (4294967296*(2097151&h2)+(h1>>>0)).toString(16);}
  async function hashPassword(pass,salt,algo){
    if(algo==="pbkdf2"){
      if(!(window.crypto&&crypto.subtle))throw new Error("no-subtle");
      const enc=new TextEncoder(),key=await crypto.subtle.importKey("raw",enc.encode(pass),"PBKDF2",false,["deriveBits"]);
      return hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:100000,hash:"SHA-256"},key,256)));
    }
    return fallbackHash(salt+":"+pass);
  }
  const LOGIN_RE=/^[A-Za-zА-Яа-яЁё0-9_.\-]{3,20}$/;
  function showAuth(tab="login"){
    $("#appShell").hidden=true;$("#authScreen").classList.add("show");switchAuthTab(tab);
    ["#loginError","#registerError"].forEach(s=>$(s).classList.remove("show"));
    setTimeout(()=>$(tab==="login"?"#loginName":"#regName").focus(),30);
  }
  function switchAuthTab(tab){
    document.querySelectorAll("[data-auth-tab]").forEach(b=>b.classList.toggle("active",b.dataset.authTab===tab));
    $("#loginForm").hidden=tab!=="login";$("#registerForm").hidden=tab!=="register";
  }
  const authError=(id,msg)=>{const el=$(id);el.textContent=msg;el.classList.add("show");};
  function startSession(key,{legacy=null,company=null}={}){
    FinCrashSchool.resetView();
    currentUser=key;localStorage.setItem(SESSION_KEY,key);
    const acc=getAccounts()[key]||{};
    let loaded=readJSON(saveKey(),null);
    if(!loaded||!loaded.stock||!Array.isArray(loaded.divisions))loaded=legacy&&legacy.stock&&Array.isArray(legacy.divisions)?legacy:defaultState(company||acc.company||DEFAULT_COMPANY);
    state=loaded;if(company)state.company=company;normalizeState();save();
    currentPage="overview";
    $("#authScreen").classList.remove("show");$("#appShell").hidden=false;
    ["#loginPass","#regPass","#regPass2"].forEach(s=>$(s).value="");
    render();window.scrollTo({top:0});
  }
  function logout(){
    save();currentUser=null;state=null;localStorage.removeItem(SESSION_KEY);document.title="ФинCrash — экономическая стратегия";showAuth("login");
  }
  async function onLogin(e){
    e.preventDefault();
    const login=$("#loginName").value.trim(),pass=$("#loginPass").value,key=login.toLowerCase(),acc=getAccounts()[key];
    if(!login||!pass)return authError("#loginError","Введите логин и пароль");
    if(!acc)return authError("#loginError","Неверный логин или пароль");
    try{
      if(await hashPassword(pass,acc.salt,acc.algo)!==acc.hash)return authError("#loginError","Неверный логин или пароль");
    }catch{return authError("#loginError","Этот браузер не поддерживает проверку пароля. Откройте игру через localhost или https.");}
    $("#loginError").classList.remove("show");startSession(key);
  }
  async function onRegister(e){
    e.preventDefault();
    const login=$("#regName").value.trim(),company=sanitizeCompany($("#regCompany").value),p1=$("#regPass").value,p2=$("#regPass2").value,key=login.toLowerCase(),accounts=getAccounts();
    if(!LOGIN_RE.test(login))return authError("#registerError","Логин: 3–20 символов, только буквы, цифры, _ . -");
    if(accounts[key])return authError("#registerError","Такой логин уже занят");
    if(Array.from(company).length<2)return authError("#registerError","Укажите название компании (минимум 2 символа)");
    if(p1.length<6)return authError("#registerError","Пароль должен быть не короче 6 символов");
    if(p1!==p2)return authError("#registerError","Пароли не совпадают");
    try{
      const salt=makeSalt(),algo=pickAlgo(),hash=await hashPassword(p1,salt,algo);
      const firstAccount=!Object.keys(accounts).length;
      accounts[key]={login,salt,algo,hash,created:Date.now(),company};setAccounts(accounts);
      let legacy=null;
      if(firstAccount&&!localStorage.getItem(LEGACY_CLAIMED_KEY)){legacy=readJSON(LEGACY_KEY,null);if(legacy)localStorage.setItem(LEGACY_CLAIMED_KEY,"1");}
      $("#registerError").classList.remove("show");
      startSession(key,{legacy,company});
      toast(legacy?"Аккаунт создан. Прежнее сохранение Market Empire перенесено":"Аккаунт создан. Добро пожаловать в ФинCrash!");
    }catch{authError("#registerError","Не удалось создать аккаунт в этом браузере. Откройте игру через localhost или https.");}
  }
  document.querySelectorAll("[data-auth-tab]").forEach(b=>b.addEventListener("click",()=>switchAuthTab(b.dataset.authTab)));
  $("#loginForm").addEventListener("submit",onLogin);
  $("#registerForm").addEventListener("submit",onRegister);
  $("#logoutBtn").addEventListener("click",logout);
  $("#userChip").addEventListener("click",()=>go("profile"));
  $("#companyMini").addEventListener("click",()=>go("profile"));
  const savedSession=localStorage.getItem(SESSION_KEY);
  if(savedSession&&getAccounts()[savedSession])startSession(savedSession);
  else showAuth(Object.keys(getAccounts()).length?"login":"register");
})();
