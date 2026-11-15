/**
 * 참석여부(RSVP) 수신용 Google Apps Script
 *
 * ── 설치 방법 ─────────────────────────────────────────────
 * 1. 구글 드라이브에서 새 스프레드시트를 만듭니다. (이름 예: "결혼식 참석여부")
 * 2. 메뉴 [확장 프로그램] → [Apps Script] 를 엽니다.
 * 3. 기본 Code.gs 내용을 모두 지우고 이 파일 내용을 붙여넣은 뒤 저장합니다.
 * 4. 오른쪽 위 [배포] → [새 배포] → 유형 선택(톱니바퀴) → [웹 앱]
 *      - 다음 사용자 인증 정보로 실행: 나
 *      - 액세스 권한이 있는 사용자: 모든 사용자   ← 꼭 "모든 사용자"여야 합니다
 * 5. [배포] → 권한 승인(“확인되지 않은 앱” 경고가 나오면 [고급] → [이동])
 * 6. 나오는 "웹 앱 URL"(https://script.google.com/macros/s/…/exec)을 복사해
 *    js/main.js 의 RSVP_ENDPOINT 에 넣습니다.
 *
 * ※ 이 스크립트를 수정했다면 [배포] → [배포 관리] → 연필 → 버전 "새 버전" 으로
 *   다시 배포해야 반영됩니다. (URL은 그대로 유지됨)
 * ※ 브라우저에서 웹 앱 URL을 열어 {"ok":true,"ready":true} 가 보이면 정상입니다.
 *
 * ── 시트 구성 ─────────────────────────────────────────────
 * "참석여부" 시트에 [성함 | 구분 | 참석여부 | 처음 보낸 시각 | 마지막 수정 시각]
 * 같은 성함으로 다시 보내면 새 줄을 만들지 않고 기존 줄을 고칩니다.
 */

var SHEET_NAME = '참석여부';
var HEADERS = ['성함', '구분', '참석여부', '처음 보낸 시각', '마지막 수정 시각'];
var SIDES = ['신랑측', '신부측'];
var ATTENDS = ['참석', '미참석'];

function doGet() {
  return json_({ ok: true, ready: true });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    var side = String(body.side || '');
    var attend = String(body.attend || '');

    if (!name) return json_({ ok: false, error: 'name' });
    if (SIDES.indexOf(side) < 0) return json_({ ok: false, error: 'side' });
    if (ATTENDS.indexOf(attend) < 0) return json_({ ok: false, error: 'attend' });

    lock.waitLock(10000);
    var sheet = getSheet_();
    var now = new Date();
    var safeName = /^[=+\-@]/.test(name) ? "'" + name : name; // 수식으로 해석되지 않게

    var last = sheet.getLastRow();
    var row = -1;
    if (last > 1) {
      var names = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
      for (var i = names.length - 1; i >= 0; i--) {
        if (names[i][0].replace(/\s+/g, ' ').trim() === name) { row = i + 2; break; }
      }
    }

    if (row > 0) {
      sheet.getRange(row, 1, 1, 3).setValues([[safeName, side, attend]]);
      sheet.getRange(row, 5).setValue(now);
      return json_({ ok: true, updated: true });
    }
    sheet.appendRow([safeName, side, attend, now, now]);
    return json_({ ok: true, updated: false });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.getRange('D:E').setNumberFormat('yyyy-mm-dd hh:mm');
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
