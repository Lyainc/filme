/* 레퍼런스 근거표. 데이터는 data/refs.js. */
EV({ id: 'refs', page: 'refs', title: '레퍼런스', html: function () {
  var esc = PR.esc, R = window.REFS;
  var V = { yes: '읽음', partial: '일부', no: '미확인' };
  return '<p class="m-lede">패턴마다 공식 출처, 판정(채택 · 불채택 · 참고 · 실측 채택)과 그 이유예요. "실측 채택"은 열 수 있는 공식 문서가 없어 외부 출처는 미확인이지만, 레포의 실측(이슈 번호)을 근거로 채택한 것이에요. "읽음"은 본문을 열어 확인한 것, "일부"는 일부만, "미확인"은 열지 못해 근거로 쓰지 않은 것이에요. 다른 서비스의 화면 배치는 문서가 직접 말한 것만 적었어요.</p>' +
    EV_TBL(['패턴', '쓰인 곳', '출처', '출처가 말하는 것', '판정', '이유', '확인'], R.map(function (r) {
      return ['<b>' + esc(r.pattern) + '</b>', esc(r.where), r.url ? '<a href="' + r.url + '" target="_blank" rel="noopener" style="overflow-wrap:anywhere">' + esc(r.url.replace(/^https:\/\//, '')) + '</a>' : '—', esc(r.says), r.decision ? '<b>' + esc(r.decision) + '</b>' : '—', esc(r.adopt), '<span class="m-pill ' + (r.verified === 'yes' ? 'ok' : 'open') + '">' + V[r.verified] + '</span>'];
    }), [null, 'n']) + (window.REFS_NOTE ? '<p class="m-note">' + esc(window.REFS_NOTE) + '</p>' : '');
} });
