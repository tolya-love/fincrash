/* Local school competition. No remote accounts or scores are implied. */
(() => {
  'use strict';
  const PERIODS = 12;
  const finite = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const clamp = (n, max) => Math.max(0, Math.min(max, finite(n)));
  const text = (s, max) => Array.from(String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()).slice(0, max).join('');
  const questions = [
    {id:'risk', title:'Не зависеть от одного товара', question:'Весь доход приносит один товар. Что поможет снизить зависимость от спроса на него?', options:['Повысить его цену в десять раз','Развивать несколько направлений и учитывать их расходы','Вложить все деньги в то же производство'], correct:1, explanation:'Несколько направлений снижают зависимость от одного рынка. Но каждое нужно проверять на прибыльность: число товаров само по себе не гарантирует успех.'},
    {id:'profit', title:'Выручка и прибыль', question:'Компания продала товаров на 12 000 ₽, а все расходы периода составили 9 000 ₽. Какова прибыль?', options:['12 000 ₽','21 000 ₽','3 000 ₽'], correct:2, explanation:'Прибыль = выручка − все расходы. В этом периоде: 12 000 − 9 000 = 3 000 ₽.'},
    {id:'reserve', title:'Резерв на следующий период', question:'Почему опасно потратить все деньги на улучшение фабрики?', options:['Может не хватить денег на сырьё, зарплаты и обслуживание','Потому что улучшения всегда убыточны','Потому что запасы заменяют любые денежные расходы'], correct:0, explanation:'Даже после улучшения компании нужны оборотные средства. Денежный резерв помогает пережить снижение спроса и оплатить обязательные расходы.'},
    {id:'price', title:'Цена и спрос', question:'Цена товара выросла, но покупателей стало меньше. Что стоит сравнить перед следующим решением?', options:['Только цену конкурента','Только число произведённых товаров','Выручку, себестоимость, объём продаж и прибыль'], correct:2, explanation:'Высокая цена не всегда даёт большую прибыль. Оценивайте одновременно объём продаж и все расходы, затем проверяйте новую стратегию.'}
  ];
  const view = {source:'local', search:'', grade:'', school:'', sort:'score', stage:null};
  function capital(s, products) {
    return finite(s.cash) + Object.entries(products).reduce((sum, [id, p]) => sum + Math.max(0, finite(s.stock?.[id])) * p.base * .35, 0) - finite(s.debt);
  }
  function normalize(s, products) {
    if (!s.schoolRating || s.schoolRating.version !== 1) {
      s.schoolRating = {version:1, periods:0, initialCapital:Math.max(1, capital(s, products)), answers:{}, snapshots:[], diversitySum:0, solventPeriods:0};
    }
    const r = s.schoolRating;
    r.periods = Math.floor(clamp(r.periods, PERIODS));
    r.initialCapital = Math.max(1, finite(r.initialCapital));
    r.answers = r.answers && typeof r.answers === 'object' && !Array.isArray(r.answers) ? r.answers : {};
    r.snapshots = Array.isArray(r.snapshots) ? r.snapshots.filter(x => x && Number.isInteger(x.period) && x.period >= 0 && x.period <= PERIODS) : [];
    r.diversitySum = clamp(r.diversitySum, PERIODS);
    r.solventPeriods = Math.floor(clamp(r.solventPeriods, r.periods));
    capture(s, products);
    return r;
  }
  function score(s, products) {
    const r = s.schoolRating;
    const value = capital(s, products);
    const finance = Math.round(clamp((value / r.initialCapital - .5) * 400, 400));
    const completed = questions.filter(q => r.answers[q.id] === true).length;
    const learning = completed * 75;
    const diversity = r.periods ? Math.round(clamp(r.diversitySum / r.periods, 1) * 200) : 0;
    const stability = r.periods ? Math.round(r.solventPeriods / r.periods * 100) : 0;
    return {period:r.periods, capital:Math.round(value), growth:(value / r.initialCapital - 1) * 100, finance, learning, diversity, stability, total:finance + learning + diversity + stability, completed};
  }
  function capture(s, products) {
    const r = s.schoolRating;
    if (r.periods >= PERIODS && r.snapshots.some(x => x.period === PERIODS)) return;
    const snapshot = score(s, products);
    r.snapshots = r.snapshots.filter(x => x.period !== r.periods).concat(snapshot).sort((a,b) => a.period-b.period);
  }
  function recordPeriod(s, products, sales) {
    const r = s.schoolRating;
    if (r.periods >= PERIODS) return;
    const categories = {};
    for (const sale of sales) {
      const category = products[sale.id]?.category;
      if (category) categories[category] = (categories[category] || 0) + Math.max(0, finite(sale.revenue));
    }
    const total = Object.values(categories).reduce((a,b) => a+b, 0);
    // 1 - HHI, normalized by the number of categories in the product catalog.
    const count = new Set(Object.values(products).map(p=>p.category)).size;
    const diversity = total > 0 && count > 1 ? (1 - Object.values(categories).reduce((sum,n) => sum + (n/total) ** 2, 0)) / (1 - 1/count) : 0;
    r.periods++;
    r.diversitySum += clamp(diversity, 1);
    if (finite(s.cash) >= 0) r.solventPeriods++;
    capture(s, products);
  }
  function student(acc, key) {
    const p = acc.student || {};
    return {name:text(p.name, 32) || acc.login || key, school:text(p.school, 60), grade:/^(5|6|7|8|9|10|11)$/.test(String(p.grade)) ? String(p.grade) : ''};
  }
  function rows(ctx, stage) {
    return Object.entries(ctx.accounts).flatMap(([key, acc]) => {
      const s = key === ctx.user ? ctx.state : ctx.readSave(key);
      const snapshot = s?.schoolRating?.snapshots?.find(x => x.period === stage);
      if (!snapshot) return [];
      return [{key, ...student(acc,key), company:s.company, ...snapshot, total:finite(snapshot.total), capital:finite(snapshot.capital)}];
    }).sort((a,b) => b.total-a.total || b.capital-a.capital || a.key.localeCompare(b.key, 'ru')).map((row,i) => ({...row, rank:i+1}));
  }
  function demoRows(stage) {
    return [
      ['Александра К.', 'Лицей «Горизонт»', '10', 1.32, 4, 174, 100],
      ['Михаил С.', 'Школа «Вектор»', '9', 1.24, 4, 160, 92],
      ['Дарья М.', 'Лицей «Горизонт»', '10', 1.21, 3, 182, 100],
      ['Артём В.', 'Школа «Вектор»', '11', 1.18, 3, 144, 83],
      ['Софья Н.', 'Школа «Старт»', '8', 1.12, 2, 128, 100],
      ['Илья Р.', 'Школа «Старт»', '9', 1.06, 2, 110, 75]
    ].map(([name,school,grade,ratio,completed,diversity,stability],i) => {
      const fraction=stage/PERIODS, growth=(ratio-1)*fraction;
      const learning = Math.min(completed, Math.floor(stage/2)) * 75;
      const finance = Math.round((.5+growth)*400);
      return {key:`demo-${i}`,name,school,grade,company:'Учебный пример',period:stage,capital:Math.round(103000*(1+growth)),growth:growth*100,finance,learning,diversity:stage?diversity:0,stability:stage?stability:0,completed:learning/75,total:finance+learning+(stage?diversity+stability:0)};
    }).sort((a,b) => b.total-a.total || b.capital-a.capital).map((row,i) => ({...row,rank:i+1}));
  }
  function breakdown(x, ctx) {
    return [['Капитал',x.finance,400],['Учебные задания',x.learning,300],['Разнообразие продаж',x.diversity,200],['Устойчивость',x.stability,100]].map(([name,value,max]) => `<div class="score-part"><div><span>${name}</span><b>${ctx.num(value)} <small>/ ${max}</small></b></div><div class="bar"><span style="width:${clamp(value/max*100,100)}%"></span></div></div>`).join('');
  }
  function profileForm(ctx) {
    const p=student(ctx.accounts[ctx.user] || {},ctx.user), e=ctx.esc;
    return `<div class="panel">${ctx.panelHead('Профиль школьника','В рейтинге можно использовать псевдоним. Школа и класс — по желанию.')}<form id="studentForm"><div class="form-row"><div class="field"><label for="studentName">ИМЯ ИЛИ ПСЕВДОНИМ</label><input id="studentName" maxlength="32" required value="${e(p.name)}"></div><div class="field"><label for="studentSchool">ШКОЛА</label><input id="studentSchool" maxlength="60" value="${e(p.school)}" placeholder="Например, лицей № 12"></div><div class="field"><label for="studentGrade">КЛАСС</label><select id="studentGrade"><option value="">Не указан</option>${[5,6,7,8,9,10,11].map(n=>`<option value="${n}" ${p.grade===String(n)?'selected':''}>${n} класс</option>`).join('')}</select></div><button class="primary-btn" type="submit">Сохранить профиль школьника</button></div><p class="hint">Эти данные сохраняются только в вашем браузере.</p></form></div>`;
  }
  function render(ctx) {
    const r=ctx.state.schoolRating, e=ctx.esc;
    const stage=view.stage===null ? r.periods : view.stage;
    const all=view.source==='demo' ? demoRows(stage) : rows(ctx,stage);
    const mine=all.find(x=>x.key===ctx.user);
    const latest=r.snapshots.find(x=>x.period===r.periods);
    const schools=[...new Set(all.map(x=>x.school).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    if (view.school && !schools.includes(view.school)) view.school='';
    const filtered=all.filter(x=>(!view.grade||x.grade===view.grade)&&(!view.school||x.school===view.school)&&(!view.search||`${x.name} ${x.school} ${x.company}`.toLocaleLowerCase('ru').includes(view.search.toLocaleLowerCase('ru'))));
    if(view.sort==='capital') filtered.sort((a,b)=>b.capital-a.capital||a.rank-b.rank);
    const podium=all.slice(0,3);
    return `<div class="welcome ranking-hero"><div><div class="eyebrow">FINCRASH / ШКОЛЬНАЯ ЛИГА</div><h2>Учись. Управляй. Поднимайся в рейтинге.</h2><p>Здесь важны не только деньги: учись считать прибыль, распределять риски и сохранять устойчивость компании.</p><div class="season-chip">Учебный сезон · ${PERIODS} игровых периодов · виртуальный капитал</div></div><div class="league-emblem" aria-hidden="true">★</div></div>
      <div class="ranking-local-note"><span class="live-dot"></span><div><b>${view.source==='demo'?'Демо-пример для презентации':'Локальная школьная лига'}</b><span>${view.source==='demo'?'Все имена и результаты вымышлены. Ваши баллы в этот список не входят.':'В таблице — аккаунты только этого браузера. Для общего рейтинга разных устройств нужен сервер.'}</span></div></div>
      <div class="grid metrics">${ctx.metric('Моё место',view.source==='demo'?'—':mine?`#${mine.rank}`:'—','★',mine?`Среди ${all.length} участников на этапе ${stage}`:'Нет результата на выбранном этапе')}${ctx.metric('Мои баллы',ctx.num(latest.total),'✦','Из 1 000 · текущий результат')}${ctx.metric('Мой прогресс',`${r.periods} / ${PERIODS}`,'◷',r.periods===PERIODS?'Сезон завершён · результат зафиксирован':'Завершайте игровые периоды')}${ctx.metric('Задания',`${latest.completed} / ${questions.length}`,'✓','Каждое верное решение: +75 баллов')}</div>
      <div class="section-head"><div><h2>Лидеры этапа ${stage}</h2><p>${stage===0?'Старт сезона: сравнение до первого периода.':`Результаты после ${stage} завершённых периодов.`} При равных баллах выше участник с большим капиталом.</p></div><div class="source-tabs" role="group" aria-label="Источник рейтинга"><button data-rating-source="local" class="${view.source==='local'?'active':''}">Игроки этого браузера</button><button data-rating-source="demo" class="${view.source==='demo'?'active':''}">Демо-пример</button></div></div>
      ${podium.length?`<div class="grid podium">${podium.map(x=>`<div class="podium-card podium-${x.rank}"><div class="podium-top"><span class="rank-medal">${x.rank===1?'★':x.rank===2?'◇':'○'}</span><span>${x.rank} место</span>${x.key===ctx.user?'<span class="you-label">Вы</span>':''}</div><h3>${e(x.name)}</h3><p>${e(x.school||'Школа не указана')} · ${x.grade?`${x.grade} класс`:'Класс не указан'}</p><div class="podium-score">${ctx.num(x.total)} <small>баллов</small></div><div class="podium-capital">Капитал ${ctx.money(x.capital)}</div></div>`).join('')}</div>`:''}
      <div class="panel">${ctx.panelHead('Таблица участников','Место определяется общим рейтингом этапа; фильтры не меняют место.')}<div class="rating-filters"><div class="field"><label for="ratingSearch">ПОИСК</label><input id="ratingSearch" value="${e(view.search)}" placeholder="Имя, школа или компания" type="search" maxlength="80"></div><div class="field"><label for="ratingStage">ЭТАП СЕЗОНА</label><select id="ratingStage">${Array.from({length:PERIODS+1},(_,n)=>`<option value="${n}" ${stage===n?'selected':''}>${n===0?'Старт':n===PERIODS?'Финал · 12 периодов':`${n} периодов`}</option>`).join('')}</select></div><div class="field"><label for="ratingGrade">КЛАСС</label><select id="ratingGrade"><option value="">Все классы</option>${[5,6,7,8,9,10,11].map(n=>`<option value="${n}" ${view.grade===String(n)?'selected':''}>${n} класс</option>`).join('')}</select></div><div class="field"><label for="ratingSchool">ШКОЛА</label><select id="ratingSchool"><option value="">Все школы</option>${schools.map(s=>`<option ${s===view.school?'selected':''} value="${e(s)}">${e(s)}</option>`).join('')}</select></div><div class="field"><label for="ratingSort">ПОРЯДОК СТРОК</label><select id="ratingSort"><option value="score" ${view.sort==='score'?'selected':''}>По баллам</option><option value="capital" ${view.sort==='capital'?'selected':''}>По капиталу</option></select></div><button class="secondary-btn" id="clearRatingFilters">Сбросить фильтры</button></div>
      <p class="hint" role="status">Найдено: ${filtered.length} из ${all.length} участников ${view.source==='demo'?'демо-примера':'на этапе'}.</p><div class="table-wrap"><table class="ranking-table"><thead><tr><th>МЕСТО</th><th>УЧАСТНИК</th><th>ШКОЛА / КЛАСС</th><th>КАПИТАЛ</th><th>ЗАДАНИЯ</th><th>БАЛЛЫ</th></tr></thead><tbody>${filtered.map(x=>`<tr class="${x.key===ctx.user?'my-ranking-row':''}"><td><span class="table-rank">${x.rank}</span></td><td><div class="rank-player"><div class="rank-avatar">${e(ctx.initials(x.name))}</div><div><b>${e(x.name)} ${x.key===ctx.user?'<span class="you-label">Вы</span>':''}</b><small>${e(x.company)}</small></div></div></td><td>${e(x.school||'Не указана')}<small class="cell-sub">${x.grade?`${x.grade} класс`:'Класс не указан'}</small></td><td><b>${ctx.money(x.capital)}</b><small class="cell-sub ${x.growth>=0?'positive':'negative'}">${x.growth>=0?'+':''}${finite(x.growth).toFixed(1)}% к старту</small></td><td>${x.completed} / ${questions.length}</td><td><strong class="rank-total">${ctx.num(x.total)}</strong> / 1 000</td></tr>`).join('')}</tbody></table></div>${!filtered.length?`<div class="empty"><strong>Пока пусто</strong>${all.length?'Нет участников с такими параметрами. Измените или сбросьте фильтры.':'Участники ещё не достигли этого этапа. Завершите нужное число периодов или выберите более ранний этап.'}</div>`:''}
      ${all.length===1&&view.source==='local'?'<p class="hint">Вы первый участник. Создайте другой локальный аккаунт для сравнения или откройте демо-пример.</p>':''}</div>
      <div class="grid two-col"><div class="panel">${ctx.panelHead('Из чего складываются мои баллы','Текущий этап вашего сезона')}${breakdown(latest,ctx)}<button class="text-btn" data-go="profile">Указать имя, школу и класс →</button></div><div class="panel">${ctx.panelHead('Прозрачные правила','Максимум 1 000 баллов')}<div class="rating-rules"><p><b>400 · Капитал.</b> Деньги + запасы по балансовой цене − долг. На старте 200 баллов; 50% стартового капитала дают 0, 150% — 400. Между ними — линейный расчёт.</p><p><b>300 · Обучение.</b> Четыре задания по 75 баллов. Повторная попытка доступна; одно задание учитывается один раз.</p><p><b>200 · Разнообразие.</b> Средняя сбалансированность выручки по пяти категориям товаров за все периоды. Нет продаж — 0 за период; одна категория — 0; равные доли пяти — максимум.</p><p><b>100 · Устойчивость.</b> Доля завершённых периодов с неотрицательным денежным балансом.</p><p>Сравниваются снимки одного этапа. После 12 периодов результат фиксируется; компанию можно развивать дальше. Сброс игры начинает сезон заново. В старых сохранениях сезон начинается с первого входа в обновлённую версию.</p></div></div></div>
      <div class="section-head" id="learningSection"><div><h2>Учебные задания</h2><p>${r.periods===PERIODS?'Сезон завершён. Можно повторять материал; итоговые баллы уже зафиксированы.':'Понимайте решения, а не только гонитесь за балансом.'}</p></div><span class="status">${latest.completed} из ${questions.length} в рейтинге</span></div><div class="grid learning-grid">${questions.map((q,i)=>`<div class="panel lesson-card"><div class="lesson-heading"><span class="lesson-number">0${i+1}</span><span class="status ${r.answers[q.id]?'':'off'}">${r.answers[q.id]?'Выполнено · 75 баллов':r.periods===PERIODS?'Для повторения':'+75 баллов'}</span></div><h3>${q.title}</h3><p>${q.question}</p>${r.answers[q.id]?`<div class="lesson-feedback success">${q.explanation}</div>`:`<form data-lesson="${q.id}"><fieldset><legend class="sr-only">${q.question}</legend>${q.options.map((option,j)=>`<label class="lesson-option"><input type="radio" name="answer-${q.id}" value="${j}" required><span>${option}</span></label>`).join('')}</fieldset><button class="secondary-btn" type="submit">Проверить ответ</button><div class="lesson-feedback" role="status" hidden></div></form>`}</div>`).join('')}</div>
      <div class="notice">Достижения сезона: 300 баллов — «Первый шаг», 600 — «Осознанная стратегия», 850 — «Финансовый навигатор». ${latest.total>=850?'Ваше достижение: «Финансовый навигатор».':latest.total>=600?'Ваше достижение: «Осознанная стратегия».':latest.total>=300?'Ваше достижение: «Первый шаг».':'Выполняйте задания и проверяйте стратегию, чтобы получить первое достижение.'} Приглашения на мероприятия — идея будущего развития, а не обещанный приз.</div>`;
  }
  function bind(ctx) {
    const root=document.querySelector('#pageContent');
    const profile=root.querySelector('#studentForm');
    if(profile) profile.addEventListener('submit', event=>{
      event.preventDefault();
      const name=text(root.querySelector('#studentName').value,32);
      if(!name) return ctx.toast('Введите имя или псевдоним');
      const accounts=ctx.getAccounts();
      accounts[ctx.user].student={name,school:text(root.querySelector('#studentSchool').value,60),grade:root.querySelector('#studentGrade').value};
      ctx.setAccounts(accounts);ctx.rerender();ctx.toast('Профиль школьника сохранён');
    });
    root.querySelectorAll('[data-rating-source]').forEach(button=>button.addEventListener('click',()=>{
      view.source=button.dataset.ratingSource;view.school='';view.grade='';view.search='';ctx.rerender();
    }));
    for(const [id,key] of [['ratingStage','stage'],['ratingGrade','grade'],['ratingSchool','school'],['ratingSort','sort']]) {
      root.querySelector(`#${id}`)?.addEventListener('change',event=>{view[key]=key==='stage'?Number(event.target.value):event.target.value;ctx.rerender();});
    }
    root.querySelector('#ratingSearch')?.addEventListener('input',event=>{
      const position=event.target.selectionStart;
      view.search=event.target.value;ctx.rerender();
      const input=root.querySelector('#ratingSearch');input.focus();input.setSelectionRange(position,position);
    });
    root.querySelector('#clearRatingFilters')?.addEventListener('click',()=>{view.search='';view.grade='';view.school='';view.sort='score';ctx.rerender();});
    root.querySelectorAll('[data-lesson]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const q=questions.find(x=>x.id===form.dataset.lesson), answer=form.querySelector('input:checked');
      if(!answer) return;
      const feedback=form.querySelector('.lesson-feedback');feedback.hidden=false;
      if(Number(answer.value)!==q.correct){feedback.textContent='Попробуйте ещё раз. Подсказка: '+q.explanation;return;}
      if(ctx.state.schoolRating.periods>=PERIODS){feedback.textContent='Верно! '+q.explanation+' Итог сезона остаётся прежним.';feedback.classList.add('success');return;}
      ctx.state.schoolRating.answers[q.id]=true;
      capture(ctx.state,ctx.products);ctx.save();ctx.rerender();ctx.toast('Верно! +75 баллов за учебное задание');
      document.querySelector('#learningSection')?.scrollIntoView({block:'start'});
    }));
  }
  function resetView(){Object.assign(view,{source:'local',search:'',grade:'',school:'',sort:'score',stage:null});}
  window.FinCrashSchool={normalize,recordPeriod,capture,render,bind,profileForm,resetView};
})();
