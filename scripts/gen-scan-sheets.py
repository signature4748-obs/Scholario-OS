#!/usr/bin/env python3
"""
gen-scan-sheets.py — renders the spec's scan test-case sheets (TWC-SCAN
part 29) as real PNG images via Chromium canvas. The geometry mirrors the
SCHOLARIO blank marks sheet PDF (roll 13% | name 46% | marks 19% |
remarks 22% of the table width, generous ruled rows).

Outputs .qa/scan-sheets/*.png:
  01-perfect.png          clean sheet, 5 marked rolls
  02-rotated.png          same sheet rotated +2.5°
  03-low-contrast.png     washed-out grey-on-grey
  04-one-unreadable.png   one marks cell blurred into ambiguity
  05-over-max.png         one mark 108 (> 100 max)
  06-negative.png         one mark scribbled "-2"
  07-blank.png            roll 05's marks cell left empty
  08-duplicate-roll.png   roll 07 appears twice
  09-missing-student.png  only 4 of 5 roster rolls present
  10-extra-row.png        handwritten extra row "99 New Student 42"
  11-page1/12-page2.png   two pages splitting the roster
  13-not-a-table.png      a random photo-like page (no table)
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('/home/z/my-project/.qa/scan-sheets')
OUT.mkdir(parents=True, exist_ok=True)

# (roll, name, marks, style) — style: '' normal, 'blur', 'scribble'
ROSTER = [
    ('01', 'Reva Kulkarni', '78', ''),
    ('02', 'Yash Thakur', '91', ''),
    ('03', 'Navya Shetty', '64', ''),
    ('04', 'Abhimanyu Rathore', '88', ''),
    ('05', 'Kiara Bose', '95', ''),
]

SHEET_JS = """
([rows, opts]) => {
  const W = 1240, H = 1600;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const bg = opts.bg || '#ffffff', ink = opts.ink || '#1a1a1a';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const draw = (deg) => {
    ctx.save();
    ctx.translate(W/2, H/2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.translate(-W/2, -H/2);
    // header
    ctx.fillStyle = ink; ctx.textAlign = 'center';
    ctx.font = 'bold 30px Arial'; ctx.fillText('GREENWOOD PUBLIC SCHOOL', W/2, 70);
    ctx.font = '16px Arial'; ctx.fillText('Academic Session 2026-2027', W/2, 96);
    ctx.font = 'bold 22px Arial'; ctx.fillText('MARKS ENTRY SHEET', W/2, 130);
    ctx.font = '14px Arial';
    ctx.fillText('Unit Test 2 · Grade 10-B · Mathematics · Maximum: 100', W/2, 156);
    // table geometry (mirrors the SCHOLARIO blank sheet PDF)
    const L = 66, R = W - 66, T = 200;
    const tableW = R - L;
    const rollDiv = L + tableW * 0.133;
    const nameDiv = L + tableW * 0.594;
    const marksDiv = L + tableW * 0.78;
    const rowH = 62;
    const nRows = rows.length + 1; // + header
    const B = T + nRows * rowH;
    ctx.strokeStyle = ink; ctx.lineWidth = 3;
    // horizontal lines
    for (let i = 0; i <= nRows; i++) {
      ctx.beginPath(); ctx.moveTo(L, T + i * rowH); ctx.lineTo(R, T + i * rowH); ctx.stroke();
    }
    // vertical lines
    for (const x of [L, rollDiv, nameDiv, marksDiv, R]) {
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, B); ctx.stroke();
    }
    // header row text
    ctx.textAlign = 'left'; ctx.font = 'bold 17px Arial';
    ctx.fillText('ROLL', L + 14, T + 38);
    ctx.fillText('STUDENT NAME', rollDiv + 14, T + 38);
    ctx.fillText('MARKS', marksDiv + 14, T + 38);
    ctx.fillText('REMARKS', marksDiv + (R - marksDiv) / 2 - 30, T + 38);
    // rows
    rows.forEach((r, i) => {
      const y = T + (i + 1) * rowH;
      const cy = y + rowH / 2;
      ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
      ctx.fillText(r.roll, (L + rollDiv) / 2, cy + 7);
      ctx.font = '18px Georgia'; ctx.textAlign = 'left';
      ctx.fillText(r.name, rollDiv + 14, cy + 7);
      // handwritten-ish marks
      ctx.save();
      ctx.font = 'italic bold 26px "Comic Sans MS", "Segoe Print", cursive, Arial';
      ctx.textAlign = 'center';
      const mx = (marksDiv + R) / 2;
      if (r.style === 'blur') {
        ctx.filter = 'blur(3.2px)';
        ctx.fillText(r.marks, mx, cy + 9);
      } else if (r.style === 'scribble') {
        ctx.fillText(r.marks, mx, cy + 9);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(mx - 34, cy + 14);
        ctx.quadraticCurveTo(mx, cy + 30, mx + 30, cy + 10);
        ctx.stroke();
      } else if (r.marks) {
        ctx.fillText(r.marks, mx, cy + 9);
      }
      ctx.restore();
    });
    ctx.restore();
  };

  draw(opts.rotate || 0);
  // post-effects
  if (opts.wash) {
    const d = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = d.data[i];
      const washed = v * 0.55 + 140 * 0.45; // pull toward mid-grey
      d.data[i] = d.data[i+1] = d.data[i+2] = washed;
    }
    ctx.putImageData(d, 0, 0);
  }
  return c.toDataURL('image/png');
}
"""

NOT_A_TABLE_JS = """
() => {
  const W = 1240, H = 1600;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f2ea'; ctx.fillRect(0, 0, W, H);
  // a paragraph of text + a photo-ish rectangle — no table lines
  ctx.fillStyle = '#333';
  ctx.font = '20px Georgia'; ctx.textAlign = 'left';
  let y = 90;
  for (let i = 0; i < 22; i++) {
    ctx.fillText('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.', 80, y);
    y += 46;
  }
  ctx.fillStyle = '#7a9bb5'; ctx.fillRect(340, y + 20, 560, 380);
  ctx.fillStyle = '#5c7d97'; ctx.beginPath(); ctx.arc(620, y + 210, 120, 0, Math.PI * 2); ctx.fill();
  return c.toDataURL('image/png');
}
"""

def main():
    sheets = {
        '01-perfect': (ROSTER, {}),
        '02-rotated': (ROSTER, {'rotate': 2.5}),
        '03-low-contrast': (ROSTER, {'wash': True}),
        '04-one-unreadable': ([('01','Reva Kulkarni','78',''), ('02','Yash Thakur','81','blur'), ('03','Navya Shetty','64',''), ('04','Abhimanyu Rathore','88',''), ('05','Kiara Bose','95','')], {}),
        '05-over-max': ([('01','Reva Kulkarni','78',''), ('02','Yash Thakur','108',''), ('03','Navya Shetty','64',''), ('04','Abhimanyu Rathore','88',''), ('05','Kiara Bose','95','')], {}),
        '06-negative': ([('01','Reva Kulkarni','78',''), ('02','Yash Thakur','-2','scribble'), ('03','Navya Shetty','64',''), ('04','Abhimanyu Rathore','88',''), ('05','Kiara Bose','95','')], {}),
        '07-blank': ([('01','Reva Kulkarni','78',''), ('02','Yash Thakur','91',''), ('03','Navya Shetty','64',''), ('04','Abhimanyu Rathore','88',''), ('05','Kiara Bose','','')], {}),
        '08-duplicate-roll': ([('01','Reva Kulkarni','78',''), ('02','Yash Thakur','91',''), ('03','Navya Shetty','64',''), ('04','Abhimanyu Rathore','88',''), ('05','Kiara Bose','95',''), ('03','Navya Shetty','71','')], {}),
        '09-missing-student': ([('01','Reva Kulkarni','78',''), ('02','Yash Thakur','91',''), ('03','Navya Shetty','64',''), ('04','Abhimanyu Rathore','88','')], {}),
        '10-extra-row': (ROSTER + [('99', 'Ira Deshpande', '42', '')], {}),
        '11-page1': ([('01','Reva Kulkarni','78',''), ('02','Yash Thakur','91',''), ('03','Navya Shetty','64','')], {}),
        '12-page2': ([('04','Abhimanyu Rathore','88',''), ('05','Kiara Bose','95','')], {}),
    }
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.goto('about:blank')
        for name, (rows, opts) in sheets.items():
            row_dicts = [{'roll': r[0], 'name': r[1], 'marks': r[2], 'style': r[3]} for r in rows]
            data_url = pg.evaluate(SHEET_JS, [row_dicts, opts])
            (OUT / f'{name}.png').write_bytes(__import__('base64').b64decode(data_url.split(',', 1)[1]))
            print(f'{name}.png')
        data_url = pg.evaluate(NOT_A_TABLE_JS)
        (OUT / '13-not-a-table.png').write_bytes(__import__('base64').b64decode(data_url.split(',', 1)[1]))
        print('13-not-a-table.png')
        b.close()
    print(json.dumps({'ok': True, 'dir': str(OUT)}))

if __name__ == '__main__':
    main()
