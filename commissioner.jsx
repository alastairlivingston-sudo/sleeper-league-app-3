







import React, { useState, useEffect, useRef, useMemo } from "react";
const DEBUG = false; // set true to log system-prompt sizes to the console

const POS_COLORS = { QB: '#ff7a1a', RB: '#10b981', WR: '#60a5fa', TE: '#a855f7', K: '#94a3b8', DEF: '#f87171', FLEX: '#f59e0b' };

const ALIAS = { allyl900: 'AlastairL' };
function canonical(handle) {
const c = String(handle || '').replace(/^@/, '').trim();
return ALIAS[c] || c;
}
const NAMES = { AlastairL:'Alastair', dpol:'Dan', saulgoat:'Saul', sanfbe:'Benjy', joshjr11:'Josh', drjkay:'Jamie', GSac:'Gideon', benjlev:'Benjy' };
const DISAMBIG = { benjlev:'Lev', sanfbe:'Sanford' };
function displayName(h) { const c = canonical(h); return NAMES[c] || c; }
function distinctName(h) { const c = canonical(h); return DISAMBIG[c] || NAMES[c] || c; }
function teamLabel(k) {
const m = String(k).match(/\(@([^)]+)\)/);
const handle = m ? m[1] : null;
const team = String(k).replace(/\s*\(@[^)]+\)\s*$/, '').trim();
const nm = handle ? displayName(handle) : null;
return (nm && nm !== handle) ? `${nm} · ${team}` : (team || k);
}

const BUILT_AT = "2026-11-24T19:19:41.823Z";

function fmtBuiltAt(iso) {
try {
const d = new Date(iso);
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
} catch(e) { return 'recently'; }
}

const HISTORY_DATA = {"seasons":[{"season":"2023","name":"Borehamwood","champion":"saulgoat","complete":true,"lastFinalWeek":17,"liveWeek":null,"standings":[{"manager":"drjkay","team":"Obi-Quan Kenobi","wins":10,"losses":4,"ties":0,"pf":1805.28,"pa":1782.94,"high":154.7},{"manager":"joshjr11","team":"Denver Brochos","wins":10,"losses":4,"ties":0,"pf":1795.48,"pa":1721.18,"high":179.48},{"manager":"saulgoat","team":"Saul","wins":7,"losses":7,"ties":0,"pf":1855.7,"pa":1728.1,"high":189.76},{"manager":"sanfbe","team":"sanfbe","wins":7,"losses":7,"ties":0,"pf":1726.64,"pa":1745.1,"high":180.98},{"manager":"allyl900","team":"allyl900","wins":6,"losses":8,"ties":0,"pf":1756.06,"pa":1719.54,"high":151.4},{"manager":"dpol","team":"dpol","wins":6,"losses":8,"ties":0,"pf":1718.68,"pa":1638.22,"high":173.18},{"manager":"GSac","team":"GSac","wins":6,"losses":8,"ties":0,"pf":1582.04,"pa":1745.12,"high":135.02},{"manager":"benjlev","team":"benjlev","wins":4,"losses":10,"ties":0,"pf":1571.92,"pa":1731.6,"high":144.1}],"games":[{"week":1,"a":"dpol","b":"allyl900","pa":69,"pb":120.54},{"week":1,"a":"benjlev","b":"saulgoat","pa":116.34,"pb":146.08},{"week":1,"a":"joshjr11","b":"sanfbe","pa":97.86,"pb":92.34},{"week":1,"a":"drjkay","b":"GSac","pa":138.16,"pb":103.54},{"week":2,"a":"benjlev","b":"sanfbe","pa":144.1,"pb":110.76},{"week":2,"a":"dpol","b":"saulgoat","pa":111.02,"pb":82.48},{"week":2,"a":"allyl900","b":"GSac","pa":105.66,"pb":110.14},{"week":2,"a":"joshjr11","b":"drjkay","pa":179.48,"pb":138},{"week":3,"a":"dpol","b":"sanfbe","pa":173.18,"pb":151.32},{"week":3,"a":"drjkay","b":"allyl900","pa":136.46,"pb":147.26},{"week":3,"a":"saulgoat","b":"GSac","pa":125.18,"pb":111.26},{"week":3,"a":"joshjr11","b":"benjlev","pa":109.28,"pb":130.88},{"week":4,"a":"benjlev","b":"drjkay","pa":105.6,"pb":132.88},{"week":4,"a":"joshjr11","b":"allyl900","pa":141.94,"pb":113.88},{"week":4,"a":"dpol","b":"GSac","pa":99.36,"pb":123.6},{"week":4,"a":"saulgoat","b":"sanfbe","pa":97.56,"pb":168.6},{"week":5,"a":"joshjr11","b":"dpol","pa":54.84,"pb":159.32},{"week":5,"a":"saulgoat","b":"drjkay","pa":189.76,"pb":76},{"week":5,"a":"GSac","b":"sanfbe","pa":101.78,"pb":130.36},{"week":5,"a":"benjlev","b":"allyl900","pa":89.84,"pb":113.32},{"week":6,"a":"benjlev","b":"GSac","pa":130.94,"pb":102.12},{"week":6,"a":"dpol","b":"drjkay","pa":120.3,"pb":128.18},{"week":6,"a":"allyl900","b":"sanfbe","pa":102.98,"pb":114.96},{"week":6,"a":"joshjr11","b":"saulgoat","pa":101.02,"pb":152.3},{"week":7,"a":"saulgoat","b":"allyl900","pa":121.44,"pb":145.34},{"week":7,"a":"benjlev","b":"dpol","pa":86.46,"pb":87.56},{"week":7,"a":"joshjr11","b":"GSac","pa":128.98,"pb":94.18},{"week":7,"a":"drjkay","b":"sanfbe","pa":132.66,"pb":94.3},{"week":8,"a":"dpol","b":"sanfbe","pa":121.16,"pb":126.56},{"week":8,"a":"benjlev","b":"drjkay","pa":86.6,"pb":122.92},{"week":8,"a":"joshjr11","b":"saulgoat","pa":110.1,"pb":132.68},{"week":8,"a":"allyl900","b":"GSac","pa":127.96,"pb":134.48},{"week":9,"a":"benjlev","b":"dpol","pa":117,"pb":114.18},{"week":9,"a":"saulgoat","b":"GSac","pa":127.82,"pb":123.48},{"week":9,"a":"allyl900","b":"sanfbe","pa":92.52,"pb":100.12},{"week":9,"a":"joshjr11","b":"drjkay","pa":120.66,"pb":89.54},{"week":10,"a":"saulgoat","b":"allyl900","pa":134.18,"pb":142.86},{"week":10,"a":"dpol","b":"drjkay","pa":131.34,"pb":146.02},{"week":10,"a":"GSac","b":"sanfbe","pa":135.02,"pb":69.88},{"week":10,"a":"joshjr11","b":"benjlev","pa":138.46,"pb":113.82},{"week":11,"a":"benjlev","b":"allyl900","pa":78.68,"pb":130},{"week":11,"a":"joshjr11","b":"dpol","pa":105.56,"pb":122.74},{"week":11,"a":"saulgoat","b":"sanfbe","pa":116.54,"pb":126.7},{"week":11,"a":"drjkay","b":"GSac","pa":154.7,"pb":109.56},{"week":12,"a":"joshjr11","b":"GSac","pa":150.74,"pb":97.08},{"week":12,"a":"saulgoat","b":"drjkay","pa":132.28,"pb":132.66},{"week":12,"a":"dpol","b":"allyl900","pa":144.3,"pb":129.74},{"week":12,"a":"benjlev","b":"sanfbe","pa":124.52,"pb":133.86},{"week":13,"a":"benjlev","b":"GSac","pa":87,"pb":98.56},{"week":13,"a":"dpol","b":"saulgoat","pa":106.04,"pb":137.18},{"week":13,"a":"drjkay","b":"sanfbe","pa":125.18,"pb":118.36},{"week":13,"a":"joshjr11","b":"allyl900","pa":168.56,"pb":151.4},{"week":14,"a":"dpol","b":"GSac","pa":109.08,"pb":106.54},{"week":14,"a":"benjlev","b":"saulgoat","pa":124.64,"pb":128.12},{"week":14,"a":"joshjr11","b":"sanfbe","pa":140.74,"pb":125.42},{"week":14,"a":"drjkay","b":"allyl900","pa":114.94,"pb":118.2},{"week":15,"playoff":true,"a":"allyl900","b":"sanfbe","pa":130.26,"pb":81.66},{"week":15,"playoff":true,"a":"dpol","b":"saulgoat","pa":88.12,"pb":113.32},{"week":15,"phase":"consolation","playoff":true,"a":"benjlev","b":"GSac","pa":91.1,"pb":107.24},{"week":16,"playoff":true,"a":"drjkay","b":"allyl900","pa":119.24,"pb":127.12},{"week":16,"playoff":true,"a":"joshjr11","b":"saulgoat","pa":97.42,"pb":118.3},{"week":16,"phase":"consolation","playoff":true,"a":"dpol","b":"sanfbe","pa":91.44,"pb":180.98},{"week":17,"playoff":true,"a":"saulgoat","b":"allyl900","pa":163.68,"pb":85.72},{"week":17,"playoff":true,"a":"joshjr11","b":"drjkay","pa":106.5,"pb":114.56}],"byes":[{"week":15,"manager":"joshjr11","pts":124.16},{"week":15,"manager":"drjkay","pts":105.6}],"schedule":[]},{"season":"2024","name":"Borehamwood","champion":"saulgoat","complete":true,"lastFinalWeek":17,"liveWeek":null,"standings":[{"manager":"saulgoat","team":"Chase waddle waddle ","wins":11,"losses":3,"ties":0,"pf":1903.3,"pa":1711.8,"high":196.9},{"manager":"AlastairL","team":"Fourth and Goalda Meir","wins":10,"losses":4,"ties":0,"pf":1968.96,"pa":1730,"high":178.94},{"manager":"dpol","team":"Plancey Neutral","wins":9,"losses":5,"ties":0,"pf":1732.22,"pa":1716.86,"high":189},{"manager":"joshjr11","team":"Denver Brochos","wins":8,"losses":6,"ties":0,"pf":1713.02,"pa":1709.2,"high":181.32},{"manager":"GSac","team":"War & Childbirth","wins":7,"losses":7,"ties":0,"pf":1758.44,"pa":1729.02,"high":159.22},{"manager":"drjkay","team":"To infinity and Bijan","wins":6,"losses":8,"ties":0,"pf":1767.8,"pa":1761.36,"high":192.72},{"manager":"sanfbe","team":"The Twinder Swindler","wins":5,"losses":9,"ties":0,"pf":1504.7,"pa":1656.34,"high":144.4},{"manager":"benjlev","team":"benjlev","wins":0,"losses":14,"ties":0,"pf":1522.48,"pa":1856.34,"high":131.44}],"games":[{"week":1,"a":"dpol","b":"drjkay","pa":127.86,"pb":119.98},{"week":1,"a":"saulgoat","b":"sanfbe","pa":115.76,"pb":108.38},{"week":1,"a":"benjlev","b":"AlastairL","pa":108.34,"pb":138.28},{"week":1,"a":"joshjr11","b":"GSac","pa":102.32,"pb":99.52},{"week":2,"a":"dpol","b":"saulgoat","pa":146.7,"pb":113.1},{"week":2,"a":"drjkay","b":"sanfbe","pa":153.24,"pb":88.96},{"week":2,"a":"joshjr11","b":"AlastairL","pa":181.32,"pb":104.26},{"week":2,"a":"benjlev","b":"GSac","pa":97.84,"pb":115.88},{"week":3,"a":"dpol","b":"sanfbe","pa":92.36,"pb":126.04},{"week":3,"a":"saulgoat","b":"drjkay","pa":121.02,"pb":109.58},{"week":3,"a":"AlastairL","b":"GSac","pa":116.88,"pb":108.68},{"week":3,"a":"joshjr11","b":"benjlev","pa":137.14,"pb":106.28},{"week":4,"a":"dpol","b":"AlastairL","pa":142.08,"pb":138.32},{"week":4,"a":"benjlev","b":"drjkay","pa":125,"pb":129.48},{"week":4,"a":"joshjr11","b":"saulgoat","pa":109.32,"pb":118.9},{"week":4,"a":"GSac","b":"sanfbe","pa":129.72,"pb":84.1},{"week":5,"a":"benjlev","b":"dpol","pa":104.34,"pb":144.96},{"week":5,"a":"drjkay","b":"AlastairL","pa":101.46,"pb":159.62},{"week":5,"a":"saulgoat","b":"GSac","pa":137.24,"pb":159.22},{"week":5,"a":"joshjr11","b":"sanfbe","pa":77.04,"pb":97.24},{"week":6,"a":"joshjr11","b":"dpol","pa":109.86,"pb":118.3},{"week":6,"a":"drjkay","b":"GSac","pa":160.76,"pb":135.62},{"week":6,"a":"saulgoat","b":"AlastairL","pa":145.72,"pb":120.06},{"week":6,"a":"benjlev","b":"sanfbe","pa":83.22,"pb":112.7},{"week":7,"a":"dpol","b":"GSac","pa":98.66,"pb":145.04},{"week":7,"a":"joshjr11","b":"drjkay","pa":119.66,"pb":116.9},{"week":7,"a":"benjlev","b":"saulgoat","pa":109.06,"pb":119.3},{"week":7,"a":"AlastairL","b":"sanfbe","pa":121.94,"pb":110.12},{"week":8,"a":"dpol","b":"drjkay","pa":108.64,"pb":124.9},{"week":8,"a":"saulgoat","b":"sanfbe","pa":135.44,"pb":98.42},{"week":8,"a":"benjlev","b":"AlastairL","pa":104.38,"pb":163.96},{"week":8,"a":"joshjr11","b":"GSac","pa":153.34,"pb":115.86},{"week":9,"a":"dpol","b":"saulgoat","pa":128.4,"pb":101.22},{"week":9,"a":"drjkay","b":"sanfbe","pa":142.5,"pb":144.4},{"week":9,"a":"joshjr11","b":"AlastairL","pa":123,"pb":150.76},{"week":9,"a":"benjlev","b":"GSac","pa":114.34,"pb":141.68},{"week":10,"a":"dpol","b":"sanfbe","pa":107.4,"pb":91.5},{"week":10,"a":"saulgoat","b":"drjkay","pa":134.44,"pb":130.24},{"week":10,"a":"AlastairL","b":"GSac","pa":128.02,"pb":127.42},{"week":10,"a":"joshjr11","b":"benjlev","pa":124.08,"pb":123.44},{"week":11,"a":"dpol","b":"AlastairL","pa":86.38,"pb":178.94},{"week":11,"a":"benjlev","b":"drjkay","pa":88.64,"pb":104.8},{"week":11,"a":"joshjr11","b":"saulgoat","pa":150.34,"pb":196.9},{"week":11,"a":"GSac","b":"sanfbe","pa":128.26,"pb":93.18},{"week":12,"a":"benjlev","b":"dpol","pa":116.96,"pb":133.08},{"week":12,"a":"drjkay","b":"AlastairL","pa":116.16,"pb":175.4},{"week":12,"a":"saulgoat","b":"GSac","pa":162.92,"pb":106.62},{"week":12,"a":"joshjr11","b":"sanfbe","pa":91.76,"pb":85.06},{"week":13,"a":"joshjr11","b":"dpol","pa":112.52,"pb":170.18},{"week":13,"a":"drjkay","b":"GSac","pa":152.2,"pb":110.78},{"week":13,"a":"saulgoat","b":"AlastairL","pa":132.66,"pb":111.96},{"week":13,"a":"benjlev","b":"sanfbe","pa":117.14,"pb":122.32},{"week":14,"a":"dpol","b":"GSac","pa":127.22,"pb":134.14},{"week":14,"a":"joshjr11","b":"drjkay","pa":121.32,"pb":105.6},{"week":14,"a":"benjlev","b":"saulgoat","pa":123.5,"pb":168.68},{"week":14,"a":"AlastairL","b":"sanfbe","pa":160.56,"pb":142.28},{"week":15,"playoff":true,"a":"joshjr11","b":"GSac","pa":130.3,"pb":127.04},{"week":15,"playoff":true,"a":"dpol","b":"drjkay","pa":189,"pb":116.68},{"week":15,"phase":"consolation","playoff":true,"a":"benjlev","b":"sanfbe","pa":119.76,"pb":137.78},{"week":16,"playoff":true,"a":"joshjr11","b":"saulgoat","pa":94.24,"pb":124.94},{"week":16,"playoff":true,"a":"dpol","b":"AlastairL","pa":141.88,"pb":176.68},{"week":16,"phase":"consolation","playoff":true,"a":"drjkay","b":"GSac","pa":192.72,"pb":111.9},{"week":17,"playoff":true,"a":"saulgoat","b":"AlastairL","pa":149.16,"pb":143.08},{"week":17,"phase":"consolation","playoff":true,"a":"benjlev","b":"sanfbe","pa":131.44,"pb":108.78}],"byes":[{"week":15,"manager":"saulgoat","pts":107.74},{"week":15,"manager":"AlastairL","pts":86.24}],"schedule":[]},{"season":"2025","name":"Borehamwood","champion":"AlastairL","complete":true,"lastFinalWeek":17,"liveWeek":null,"standings":[{"manager":"dpol","team":"Plancey Neutral","wins":11,"losses":3,"ties":0,"pf":1878.92,"pa":1696.02,"high":186.44},{"manager":"AlastairL","team":"Fourth and Goalda Meir","wins":9,"losses":5,"ties":0,"pf":1828.36,"pa":1785.46,"high":156.58},{"manager":"sanfbe","team":"J’Allen Plancey z’l","wins":8,"losses":6,"ties":0,"pf":1778.06,"pa":1854.68,"high":163.6},{"manager":"saulgoat","team":"Love Thy Naber","wins":8,"losses":6,"ties":0,"pf":1689.66,"pa":1588.06,"high":172.42},{"manager":"joshjr11","team":"Denver Brochos","wins":6,"losses":8,"ties":0,"pf":1818.96,"pa":1792.34,"high":173.36},{"manager":"drjkay","team":"A rookie error","wins":6,"losses":8,"ties":0,"pf":1770.74,"pa":1824.38,"high":169.02},{"manager":"GSac","team":"This One Really Hurts","wins":5,"losses":9,"ties":0,"pf":1786.8,"pa":1833.52,"high":202.36},{"manager":"benjlev","team":"benjlev","wins":3,"losses":11,"ties":0,"pf":1562.56,"pa":1739.6,"high":163.26}],"games":[{"week":1,"a":"dpol","b":"drjkay","pa":107.02,"pb":99.74},{"week":1,"a":"saulgoat","b":"AlastairL","pa":88.72,"pb":95.08},{"week":1,"a":"joshjr11","b":"benjlev","pa":91.32,"pb":163.26},{"week":1,"a":"GSac","b":"sanfbe","pa":112.08,"pb":155.26},{"week":2,"a":"dpol","b":"saulgoat","pa":138.08,"pb":137.6},{"week":2,"a":"drjkay","b":"AlastairL","pa":126.08,"pb":133.88},{"week":2,"a":"joshjr11","b":"GSac","pa":127.64,"pb":101.44},{"week":2,"a":"benjlev","b":"sanfbe","pa":109.9,"pb":111.72},{"week":3,"a":"dpol","b":"AlastairL","pa":131.86,"pb":131.84},{"week":3,"a":"saulgoat","b":"drjkay","pa":137.62,"pb":113.4},{"week":3,"a":"joshjr11","b":"sanfbe","pa":90.18,"pb":135.02},{"week":3,"a":"benjlev","b":"GSac","pa":96.92,"pb":115.04},{"week":4,"a":"joshjr11","b":"dpol","pa":141.88,"pb":154.2},{"week":4,"a":"benjlev","b":"drjkay","pa":88.98,"pb":169.02},{"week":4,"a":"saulgoat","b":"GSac","pa":131.28,"pb":121.2},{"week":4,"a":"AlastairL","b":"sanfbe","pa":140.52,"pb":151.26},{"week":5,"a":"benjlev","b":"dpol","pa":135.16,"pb":136.42},{"week":5,"a":"joshjr11","b":"drjkay","pa":145.72,"pb":102.04},{"week":5,"a":"saulgoat","b":"sanfbe","pa":140.54,"pb":138.42},{"week":5,"a":"AlastairL","b":"GSac","pa":127.72,"pb":121.5},{"week":6,"a":"dpol","b":"GSac","pa":128.38,"pb":118.42},{"week":6,"a":"drjkay","b":"sanfbe","pa":108.74,"pb":163.6},{"week":6,"a":"joshjr11","b":"saulgoat","pa":137.16,"pb":106.96},{"week":6,"a":"benjlev","b":"AlastairL","pa":103.54,"pb":115.04},{"week":7,"a":"dpol","b":"sanfbe","pa":186.44,"pb":77.44},{"week":7,"a":"drjkay","b":"GSac","pa":118.16,"pb":192.04},{"week":7,"a":"benjlev","b":"saulgoat","pa":79.32,"pb":86.94},{"week":7,"a":"joshjr11","b":"AlastairL","pa":119.98,"pb":156.58},{"week":8,"a":"dpol","b":"drjkay","pa":147.16,"pb":118.52},{"week":8,"a":"saulgoat","b":"AlastairL","pa":108.88,"pb":123.88},{"week":8,"a":"joshjr11","b":"benjlev","pa":146.48,"pb":154.34},{"week":8,"a":"GSac","b":"sanfbe","pa":145.66,"pb":116.62},{"week":9,"a":"dpol","b":"saulgoat","pa":79.9,"pb":120.92},{"week":9,"a":"drjkay","b":"AlastairL","pa":119.1,"pb":154.96},{"week":9,"a":"joshjr11","b":"GSac","pa":165.3,"pb":123.54},{"week":9,"a":"benjlev","b":"sanfbe","pa":124.56,"pb":125.42},{"week":10,"a":"dpol","b":"AlastairL","pa":127.7,"pb":148.7},{"week":10,"a":"saulgoat","b":"drjkay","pa":145.5,"pb":146.6},{"week":10,"a":"joshjr11","b":"sanfbe","pa":162.8,"pb":103.44},{"week":10,"a":"benjlev","b":"GSac","pa":99.74,"pb":157.52},{"week":11,"a":"joshjr11","b":"dpol","pa":114.54,"pb":116.44},{"week":11,"a":"benjlev","b":"drjkay","pa":98.02,"pb":131.72},{"week":11,"a":"saulgoat","b":"GSac","pa":128.96,"pb":67.9},{"week":11,"a":"AlastairL","b":"sanfbe","pa":140.74,"pb":160.48},{"week":12,"a":"benjlev","b":"dpol","pa":96.02,"pb":121.48},{"week":12,"a":"joshjr11","b":"drjkay","pa":113.46,"pb":130.08},{"week":12,"a":"saulgoat","b":"sanfbe","pa":105.12,"pb":95.82},{"week":12,"a":"AlastairL","b":"GSac","pa":133.56,"pb":202.36},{"week":13,"a":"dpol","b":"GSac","pa":157.44,"pb":100.2},{"week":13,"a":"drjkay","b":"sanfbe","pa":141,"pb":88.52},{"week":13,"a":"joshjr11","b":"saulgoat","pa":148.64,"pb":114.16},{"week":13,"a":"benjlev","b":"AlastairL","pa":110.14,"pb":95.02},{"week":14,"a":"dpol","b":"sanfbe","pa":146.4,"pb":155.04},{"week":14,"a":"drjkay","b":"GSac","pa":146.54,"pb":107.9},{"week":14,"a":"benjlev","b":"saulgoat","pa":102.66,"pb":136.46},{"week":14,"a":"joshjr11","b":"AlastairL","pa":113.86,"pb":130.84},{"week":15,"playoff":true,"a":"joshjr11","b":"saulgoat","pa":143.2,"pb":172.42},{"week":15,"playoff":true,"a":"drjkay","b":"sanfbe","pa":94.94,"pb":160.82},{"week":15,"phase":"consolation","playoff":true,"a":"benjlev","b":"GSac","pa":98.9,"pb":107.4},{"week":16,"playoff":true,"a":"dpol","b":"sanfbe","pa":161.02,"pb":108.9},{"week":16,"playoff":true,"a":"saulgoat","b":"AlastairL","pa":113.46,"pb":130.5},{"week":16,"phase":"consolation","playoff":true,"a":"joshjr11","b":"drjkay","pa":173.36,"pb":116.02},{"week":17,"playoff":true,"a":"dpol","b":"AlastairL","pa":118.58,"pb":143.96},{"week":17,"playoff":true,"a":"saulgoat","b":"sanfbe","pa":76.78,"pb":143.58}],"byes":[{"week":15,"manager":"dpol","pts":121.06},{"week":15,"manager":"AlastairL","pts":102.82}],"schedule":[]},{"season":"2026","name":"Borehamwood","champion":null,"complete":false,"lastFinalWeek":11,"liveWeek":12,"standings":[{"manager":"GSac","team":"Jewish McCaffrey","wins":7,"losses":4,"ties":0,"pf":1352.42,"pa":1316.14,"high":182.36},{"manager":"joshjr11","team":"Denver Brochos","wins":6,"losses":5,"ties":0,"pf":1501.42,"pa":1477.7,"high":185.48},{"manager":"AlastairL","team":"Fourth and Goalda Meir","wins":6,"losses":5,"ties":0,"pf":1442.84,"pa":1387.6,"high":164.7},{"manager":"drjkay","team":"Lloyd of the Rings","wins":6,"losses":5,"ties":0,"pf":1385.2,"pa":1384.72,"high":151.46},{"manager":"sanfbe","team":"Twinder Swindler","wins":6,"losses":5,"ties":0,"pf":1314.8,"pa":1237.06,"high":150.5},{"manager":"saulgoat","team":"A jeanty angle ","wins":5,"losses":6,"ties":0,"pf":1415.18,"pa":1421.62,"high":160.5},{"manager":"dpol","team":"Plancey Neutral","wins":4,"losses":7,"ties":0,"pf":1496.2,"pa":1563.16,"high":218.12},{"manager":"benjlev","team":"benjlev","wins":4,"losses":7,"ties":0,"pf":1242.72,"pa":1362.78,"high":148.58}],"games":[{"week":1,"a":"joshjr11","b":"sanfbe","pa":161.56,"pb":139.42},{"week":1,"a":"dpol","b":"GSac","pa":108.12,"pb":182.36},{"week":1,"a":"saulgoat","b":"drjkay","pa":134.06,"pb":151.46},{"week":1,"a":"benjlev","b":"AlastairL","pa":112.96,"pb":99.66},{"week":2,"a":"dpol","b":"sanfbe","pa":102.52,"pb":122.26},{"week":2,"a":"joshjr11","b":"drjkay","pa":92.22,"pb":150.92},{"week":2,"a":"AlastairL","b":"GSac","pa":115.3,"pb":79.28},{"week":2,"a":"benjlev","b":"saulgoat","pa":110.98,"pb":135.54},{"week":3,"a":"drjkay","b":"sanfbe","pa":125.86,"pb":82.82},{"week":3,"a":"dpol","b":"AlastairL","pa":150.36,"pb":143.3},{"week":3,"a":"joshjr11","b":"benjlev","pa":157.54,"pb":92.48},{"week":3,"a":"saulgoat","b":"GSac","pa":114.94,"pb":146.18},{"week":4,"a":"AlastairL","b":"sanfbe","pa":107.38,"pb":150.06},{"week":4,"a":"benjlev","b":"drjkay","pa":147.22,"pb":102.42},{"week":4,"a":"dpol","b":"saulgoat","pa":130.44,"pb":160.5},{"week":4,"a":"joshjr11","b":"GSac","pa":141.28,"pb":104.32},{"week":5,"a":"benjlev","b":"sanfbe","pa":112.8,"pb":150.5},{"week":5,"a":"saulgoat","b":"AlastairL","pa":121.98,"pb":151.56},{"week":5,"a":"drjkay","b":"GSac","pa":137.4,"pb":138.56},{"week":5,"a":"joshjr11","b":"dpol","pa":137.14,"pb":206.42},{"week":6,"a":"saulgoat","b":"sanfbe","pa":95.74,"pb":87.38},{"week":6,"a":"benjlev","b":"GSac","pa":87.02,"pb":111.56},{"week":6,"a":"joshjr11","b":"AlastairL","pa":111.58,"pb":164.7},{"week":6,"a":"dpol","b":"drjkay","pa":105.14,"pb":137.2},{"week":7,"a":"GSac","b":"sanfbe","pa":82.92,"pb":135.38},{"week":7,"a":"joshjr11","b":"saulgoat","pa":127.1,"pb":155.72},{"week":7,"a":"benjlev","b":"dpol","pa":148.58,"pb":109.76},{"week":7,"a":"drjkay","b":"AlastairL","pa":117.62,"pb":152.64},{"week":8,"a":"joshjr11","b":"sanfbe","pa":147.8,"pb":118.86},{"week":8,"a":"dpol","b":"GSac","pa":116.78,"pb":136.48},{"week":8,"a":"saulgoat","b":"drjkay","pa":129.1,"pb":134.46},{"week":8,"a":"benjlev","b":"AlastairL","pa":121.18,"pb":119.76},{"week":9,"a":"dpol","b":"sanfbe","pa":100.78,"pb":129.64},{"week":9,"a":"joshjr11","b":"drjkay","pa":185.48,"pb":122.36},{"week":9,"a":"AlastairL","b":"GSac","pa":124.06,"pb":111.76},{"week":9,"a":"benjlev","b":"saulgoat","pa":95.14,"pb":123.5},{"week":10,"a":"drjkay","b":"sanfbe","pa":86.54,"pb":105.78},{"week":10,"a":"dpol","b":"AlastairL","pa":218.12,"pb":151.32},{"week":10,"a":"joshjr11","b":"benjlev","pa":133.58,"pb":102.66},{"week":10,"a":"saulgoat","b":"GSac","pa":129.72,"pb":139.16},{"week":11,"a":"AlastairL","b":"sanfbe","pa":113.16,"pb":92.7},{"week":11,"a":"benjlev","b":"drjkay","pa":111.7,"pb":118.96},{"week":11,"a":"dpol","b":"saulgoat","pa":147.76,"pb":114.38},{"week":11,"a":"joshjr11","b":"GSac","pa":106.14,"pb":119.84},{"week":12,"status":"live","a":"benjlev","b":"sanfbe","pa":0,"pb":0},{"week":12,"status":"live","a":"saulgoat","b":"AlastairL","pa":0,"pb":0},{"week":12,"status":"live","a":"drjkay","b":"GSac","pa":0,"pb":0},{"week":12,"status":"live","a":"joshjr11","b":"dpol","pa":0,"pb":0}],"byes":[],"schedule":[{"week":13,"a":"saulgoat","b":"sanfbe"},{"week":13,"a":"benjlev","b":"GSac"},{"week":13,"a":"joshjr11","b":"AlastairL"},{"week":13,"a":"dpol","b":"drjkay"},{"week":14,"a":"GSac","b":"sanfbe"},{"week":14,"a":"joshjr11","b":"saulgoat"},{"week":14,"a":"benjlev","b":"dpol"},{"week":14,"a":"drjkay","b":"AlastairL"}]}],"meta":{"generated":"2026-11-24T19:19:34.288Z"}};
const ROSTERS_DATA = {"Denver Brochos (@joshjr11)":[{"id":"11584","name":"Bucky Irving","pos":"RB"},{"id":"11604","name":"Brock Bowers","pos":"TE"},{"id":"11620","name":"Rome Odunze","pos":"WR"},{"id":"12506","name":"Harold Fannin Jr.","pos":"TE"},{"id":"13279","name":"Carnell Tate","pos":"WR"},{"id":"13286","name":"Jadarian Price","pos":"RB"},{"id":"2449","name":"Stefon Diggs","pos":"WR"},{"id":"3451","name":"Ka'imi Fairbairn","pos":"K"},{"id":"7523","name":"Trevor Lawrence","pos":"QB"},{"id":"7564","name":"Ja'Marr Chase","pos":"WR"},{"id":"7588","name":"Javonte Williams","pos":"RB"},{"id":"8112","name":"Drake London","pos":"WR"},{"id":"8151","name":"Kenneth Walker III","pos":"RB"},{"id":"9482","name":"Michael Mayer","pos":"TE"},{"id":"HOU","name":"Houston Texans","pos":"DEF"},{"id":"TB","name":"Tampa Bay Buccaneers","pos":"DEF"}],"benjlev (@benjlev)":[{"id":"11783","name":"Ryan Flournoy","pos":"WR"},{"id":"12489","name":"RJ Harvey","pos":"RB"},{"id":"12514","name":"Emeka Egbuka","pos":"WR"},{"id":"12526","name":"Tetairoa McMillan","pos":"WR"},{"id":"13276","name":"Omar Cooper Jr.","pos":"WR"},{"id":"2020","name":"Cairo Santos","pos":"K"},{"id":"3294","name":"Dak Prescott","pos":"QB"},{"id":"4866","name":"Saquon Barkley","pos":"RB"},{"id":"4993","name":"Mike Gesicki","pos":"TE"},{"id":"5850","name":"Josh Jacobs","pos":"RB"},{"id":"6770","name":"Joe Burrow","pos":"QB"},{"id":"7547","name":"Amon-Ra St. Brown","pos":"WR"},{"id":"8121","name":"Romeo Doubs","pos":"WR"},{"id":"8150","name":"Kyren Williams","pos":"RB"},{"id":"8154","name":"Brian Robinson Jr.","pos":"RB"},{"id":"8155","name":"Breece Hall","pos":"RB"},{"id":"9484","name":"Tucker Kraft","pos":"TE"},{"id":"9500","name":"Josh Downs","pos":"WR"},{"id":"DET","name":"Detroit Lions","pos":"DEF"}],"Plancey Neutral (@dpol)":[{"id":"11792","name":"Will Reichard","pos":"K"},{"id":"13337","name":"Emmett Johnson","pos":"RB"},{"id":"4046","name":"Patrick Mahomes","pos":"QB"},{"id":"4983","name":"DJ Moore","pos":"WR"},{"id":"5844","name":"T.J. Hockenson","pos":"TE"},{"id":"6794","name":"Justin Jefferson","pos":"WR"},{"id":"6804","name":"Jordan Love","pos":"QB"},{"id":"7594","name":"Chuba Hubbard","pos":"RB"},{"id":"8137","name":"George Pickens","pos":"WR"},{"id":"8228","name":"Jaylen Warren","pos":"RB"},{"id":"9221","name":"Jahmyr Gibbs","pos":"RB"},{"id":"9224","name":"Chase Brown","pos":"RB"},{"id":"9487","name":"Parker Washington","pos":"WR"},{"id":"9502","name":"Tank Dell","pos":"WR"},{"id":"MIN","name":"Minnesota Vikings","pos":"DEF"},{"id":"SEA","name":"Seattle Seahawks","pos":"DEF"}],"A jeanty angle  (@saulgoat)":[{"id":"10859","name":"Sam LaPorta","pos":"TE"},{"id":"11533","name":"Brandon Aubrey","pos":"K"},{"id":"11586","name":"Blake Corum","pos":"RB"},{"id":"12481","name":"Cam Skattebo","pos":"RB"},{"id":"12495","name":"Ollie Gordon II","pos":"RB"},{"id":"12527","name":"Ashton Jeanty","pos":"RB"},{"id":"12540","name":"Chimere Dike","pos":"WR"},{"id":"12545","name":"Tyler Shough","pos":"QB"},{"id":"13424","name":"Seth McGowan","pos":"RB"},{"id":"3163","name":"Jared Goff","pos":"QB"},{"id":"5892","name":"David Montgomery","pos":"RB"},{"id":"6786","name":"CeeDee Lamb","pos":"WR"},{"id":"6801","name":"Tee Higgins","pos":"WR"},{"id":"7525","name":"DeVonta Smith","pos":"WR"},{"id":"9493","name":"Puka Nacua","pos":"WR"},{"id":"9753","name":"Zach Charbonnet","pos":"RB"},{"id":"DEN","name":"Denver Broncos","pos":"DEF"}],"Lloyd of the Rings (@drjkay)":[{"id":"11579","name":"Audric Estime","pos":"RB"},{"id":"12501","name":"Matthew Golden","pos":"WR"},{"id":"12507","name":"Omarion Hampton","pos":"RB"},{"id":"12519","name":"Luther Burden III","pos":"WR"},{"id":"12534","name":"Kyle Monangai","pos":"RB"},{"id":"13345","name":"Jonah Coleman","pos":"RB"},{"id":"13346","name":"Denzel Boston","pos":"WR"},{"id":"2133","name":"Davante Adams","pos":"WR"},{"id":"2216","name":"Mike Evans","pos":"WR"},{"id":"4217","name":"George Kittle","pos":"TE"},{"id":"4984","name":"Josh Allen","pos":"QB"},{"id":"5119","name":"Jason Sanders","pos":"K"},{"id":"6790","name":"D'Andre Swift","pos":"RB"},{"id":"6813","name":"Jonathan Taylor","pos":"RB"},{"id":"8144","name":"Chris Olave","pos":"WR"},{"id":"8146","name":"Garrett Wilson","pos":"WR"},{"id":"KC","name":"Kansas City Chiefs","pos":"DEF"}],"Fourth and Goalda Meir (@AlastairL)":[{"id":"11564","name":"Drake Maye","pos":"QB"},{"id":"11566","name":"Jayden Daniels","pos":"QB"},{"id":"11583","name":"Jonathon Brooks","pos":"RB"},{"id":"11632","name":"Malik Nabers","pos":"WR"},{"id":"11786","name":"Cam Little","pos":"K"},{"id":"12490","name":"Bhayshul Tuten","pos":"RB"},{"id":"12512","name":"Quinshon Judkins","pos":"RB"},{"id":"12517","name":"Colston Loveland","pos":"TE"},{"id":"13274","name":"Germie Bernard","pos":"WR"},{"id":"13281","name":"Jordyn Tyson","pos":"WR"},{"id":"13287","name":"Jeremiyah Love","pos":"RB"},{"id":"13296","name":"Caleb Douglas","pos":"WR"},{"id":"13298","name":"KC Concepcion Jr.","pos":"WR"},{"id":"13414","name":"Kaelon Black","pos":"RB"},{"id":"1466","name":"Travis Kelce","pos":"TE"},{"id":"4034","name":"Christian McCaffrey","pos":"RB"},{"id":"4881","name":"Lamar Jackson","pos":"QB"},{"id":"9488","name":"Jaxon Smith-Njigba","pos":"WR"},{"id":"BUF","name":"Buffalo Bills","pos":"DEF"}],"Jewish McCaffrey (@GSac)":[{"id":"10229","name":"Rashee Rice","pos":"WR"},{"id":"11560","name":"Caleb Williams","pos":"QB"},{"id":"11635","name":"Ladd McConkey","pos":"WR"},{"id":"12487","name":"Terrance Ferguson","pos":"TE"},{"id":"12533","name":"Jacory Croskey-Merritt","pos":"RB"},{"id":"12718","name":"Konata Mumpfield","pos":"WR"},{"id":"3198","name":"Derrick Henry","pos":"RB"},{"id":"4199","name":"Aaron Jones Sr.","pos":"RB"},{"id":"5872","name":"Deebo Samuel Sr.","pos":"WR"},{"id":"7042","name":"Tyler Bass","pos":"K"},{"id":"7543","name":"Travis Etienne Jr.","pos":"RB"},{"id":"8131","name":"Isaiah Likely","pos":"TE"},{"id":"8132","name":"Tyler Allgeier","pos":"RB"},{"id":"8148","name":"Jameson Williams","pos":"WR"},{"id":"8183","name":"Brock Purdy","pos":"QB"},{"id":"9509","name":"Bijan Robinson","pos":"RB"},{"id":"PIT","name":"Pittsburgh Steelers","pos":"DEF"}],"Twinder Swindler (@sanfbe)":[{"id":"11563","name":"Bo Nix","pos":"QB"},{"id":"11625","name":"Adonai Mitchell","pos":"WR"},{"id":"11646","name":"Jalen Coker","pos":"WR"},{"id":"1166","name":"Kirk Cousins","pos":"QB"},{"id":"12185","name":"Spencer Shrader","pos":"K"},{"id":"12499","name":"Elic Ayomanor","pos":"WR"},{"id":"2505","name":"Darren Waller","pos":"TE"},{"id":"5967","name":"Tony Pollard","pos":"RB"},{"id":"7526","name":"Jaylen Waddle","pos":"WR"},{"id":"7569","name":"Nico Collins","pos":"WR"},{"id":"7611","name":"Rhamondre Stevenson","pos":"RB"},{"id":"8130","name":"Trey McBride","pos":"TE"},{"id":"8138","name":"James Cook III","pos":"RB"},{"id":"8167","name":"Christian Watson","pos":"WR"},{"id":"9226","name":"De'Von Achane","pos":"RB"},{"id":"9997","name":"Zay Flowers","pos":"WR"},{"id":"JAX","name":"Jacksonville Jaguars","pos":"DEF"}]};
const TRADE_VALUES = [{"player":{"name":"Jahmyr Gibbs","sleeperId":"9221","position":"RB"},"redraftValue":10804},{"player":{"name":"Jaxon Smith-Njigba","sleeperId":"9488","position":"WR"},"redraftValue":10145},{"player":{"name":"Bijan Robinson","sleeperId":"9509","position":"RB"},"redraftValue":9226},{"player":{"name":"Ja'Marr Chase","sleeperId":"7564","position":"WR"},"redraftValue":9360},{"player":{"name":"Christian McCaffrey","sleeperId":"4034","position":"RB"},"redraftValue":9035},{"player":{"name":"CeeDee Lamb","sleeperId":"6786","position":"WR"},"redraftValue":8940},{"player":{"name":"Kenneth Walker III","sleeperId":"8151","position":"RB"},"redraftValue":8268},{"player":{"name":"Amon-Ra St. Brown","sleeperId":"7547","position":"WR"},"redraftValue":7939},{"player":{"name":"James Cook III","sleeperId":"8138","position":"RB"},"redraftValue":7628},{"player":{"name":"Chuba Hubbard","sleeperId":"7594","position":"RB"},"redraftValue":6490},{"player":{"name":"Justin Jefferson","sleeperId":"6794","position":"WR"},"redraftValue":6422},{"player":{"name":"Bucky Irving","sleeperId":"11584","position":"RB"},"redraftValue":6242},{"player":{"name":"Christian Watson","sleeperId":"8167","position":"WR"},"redraftValue":5953},{"player":{"name":"Tee Higgins","sleeperId":"6801","position":"WR"},"redraftValue":5847},{"player":{"name":"Brock Bowers","sleeperId":"11604","position":"TE"},"redraftValue":5578},{"player":{"name":"Josh Allen","sleeperId":"4984","position":"QB"},"redraftValue":5589},{"player":{"name":"Javonte Williams","sleeperId":"7588","position":"RB"},"redraftValue":5139},{"player":{"name":"Matthew Golden","sleeperId":"12501","position":"WR"},"redraftValue":5238},{"player":{"name":"Jonah Coleman","sleeperId":"13345","position":"RB"},"redraftValue":4991},{"player":{"name":"Malik Nabers","sleeperId":"11632","position":"WR"},"redraftValue":5063},{"player":{"name":"Joe Burrow","sleeperId":"6770","position":"QB"},"redraftValue":5226},{"player":{"name":"Trey McBride","sleeperId":"8130","position":"TE"},"redraftValue":4933},{"player":{"name":"Parker Washington","sleeperId":"9487","position":"WR"},"redraftValue":4795},{"player":{"name":"D'Andre Swift","sleeperId":"6790","position":"RB"},"redraftValue":4597},{"player":{"name":"Chase Brown","sleeperId":"9224","position":"RB"},"redraftValue":4586},{"player":{"name":"Nico Collins","sleeperId":"7569","position":"WR"},"redraftValue":4659},{"player":{"name":"Derrick Henry","sleeperId":"3198","position":"RB"},"redraftValue":4505},{"player":{"name":"Drake London","sleeperId":"8112","position":"WR"},"redraftValue":4531},{"player":{"name":"Chris Olave","sleeperId":"8144","position":"WR"},"redraftValue":4428},{"player":{"name":"George Pickens","sleeperId":"8137","position":"WR"},"redraftValue":4328},{"player":{"name":"Jonathan Taylor","sleeperId":"6813","position":"RB"},"redraftValue":4141},{"player":{"name":"Bhayshul Tuten","sleeperId":"12490","position":"RB"},"redraftValue":4139},{"player":{"name":"Ashton Jeanty","sleeperId":"12527","position":"RB"},"redraftValue":3973},{"player":{"name":"Jaylen Warren","sleeperId":"8228","position":"RB"},"redraftValue":3820},{"player":{"name":"Luther Burden III","sleeperId":"12519","position":"WR"},"redraftValue":3899},{"player":{"name":"Zay Flowers","sleeperId":"9997","position":"WR"},"redraftValue":3786},{"player":{"name":"Kyren Williams","sleeperId":"8150","position":"RB"},"redraftValue":3624},{"player":{"name":"Tony Pollard","sleeperId":"5967","position":"RB"},"redraftValue":3474},{"player":{"name":"Isaiah Likely","sleeperId":"8131","position":"TE"},"redraftValue":3537},{"player":{"name":"Breece Hall","sleeperId":"8155","position":"RB"},"redraftValue":3355},{"player":{"name":"George Kittle","sleeperId":"4217","position":"TE"},"redraftValue":3441},{"player":{"name":"Josh Jacobs","sleeperId":"5850","position":"RB"},"redraftValue":3214},{"player":{"name":"Garrett Wilson","sleeperId":"8146","position":"WR"},"redraftValue":3188},{"player":{"name":"Cam Skattebo","sleeperId":"12481","position":"RB"},"redraftValue":2969},{"player":{"name":"Tetairoa McMillan","sleeperId":"12526","position":"WR"},"redraftValue":3031},{"player":{"name":"Davante Adams","sleeperId":"2133","position":"WR"},"redraftValue":2945},{"player":{"name":"Saquon Barkley","sleeperId":"4866","position":"RB"},"redraftValue":2791},{"player":{"name":"Brock Purdy","sleeperId":"8183","position":"QB"},"redraftValue":2887},{"player":{"name":"Trevor Lawrence","sleeperId":"7523","position":"QB"},"redraftValue":2796},{"player":{"name":"Mike Evans","sleeperId":"2216","position":"WR"},"redraftValue":2664},{"player":{"name":"Patrick Mahomes","sleeperId":"4046","position":"QB"},"redraftValue":2678},{"player":{"name":"Colston Loveland","sleeperId":"12517","position":"TE"},"redraftValue":2523},{"player":{"name":"Rashee Rice","sleeperId":"10229","position":"WR"},"redraftValue":2468},{"player":{"name":"Dak Prescott","sleeperId":"3294","position":"QB"},"redraftValue":2496},{"player":{"name":"Blake Corum","sleeperId":"11586","position":"RB"},"redraftValue":2290},{"player":{"name":"DJ Moore","sleeperId":"4983","position":"WR"},"redraftValue":2265},{"player":{"name":"DeVonta Smith","sleeperId":"7525","position":"WR"},"redraftValue":2244},{"player":{"name":"Caleb Williams","sleeperId":"11560","position":"QB"},"redraftValue":2300},{"player":{"name":"Jeremiyah Love","sleeperId":"13287","position":"RB"},"redraftValue":2091},{"player":{"name":"Omarion Hampton","sleeperId":"12507","position":"RB"},"redraftValue":2044},{"player":{"name":"Jameson Williams","sleeperId":"8148","position":"WR"},"redraftValue":1961},{"player":{"name":"Carnell Tate","sleeperId":"13279","position":"WR"},"redraftValue":1921},{"player":{"name":"Harold Fannin Jr.","sleeperId":"12506","position":"TE"},"redraftValue":1941},{"player":{"name":"Emmett Johnson","sleeperId":"13337","position":"RB"},"redraftValue":1859},{"player":{"name":"Travis Kelce","sleeperId":"1466","position":"TE"},"redraftValue":1873},{"player":{"name":"Quinshon Judkins","sleeperId":"12512","position":"RB"},"redraftValue":1804},{"player":{"name":"Jordan Love","sleeperId":"6804","position":"QB"},"redraftValue":1928},{"player":{"name":"Ollie Gordon II","sleeperId":"12495","position":"RB"},"redraftValue":1742},{"player":{"name":"Jayden Daniels","sleeperId":"11566","position":"QB"},"redraftValue":1866},{"player":{"name":"C.J. Stroud","sleeperId":"9758","position":"QB"},"redraftValue":1822},{"player":{"name":"David Montgomery","sleeperId":"5892","position":"RB"},"redraftValue":1620},{"player":{"name":"Sam LaPorta","sleeperId":"10859","position":"TE"},"redraftValue":1592},{"player":{"name":"Jordyn Tyson","sleeperId":"13281","position":"WR"},"redraftValue":1551},{"player":{"name":"Rhamondre Stevenson","sleeperId":"7611","position":"RB"},"redraftValue":1478},{"player":{"name":"Rome Odunze","sleeperId":"11620","position":"WR"},"redraftValue":1508},{"player":{"name":"Jared Goff","sleeperId":"3163","position":"QB"},"redraftValue":1548},{"player":{"name":"Travis Etienne Jr.","sleeperId":"7543","position":"RB"},"redraftValue":1417},{"player":{"name":"Stefon Diggs","sleeperId":"2449","position":"WR"},"redraftValue":1447},{"player":{"name":"Zach Charbonnet","sleeperId":"9753","position":"RB"},"redraftValue":1399},{"player":{"name":"Ladd McConkey","sleeperId":"11635","position":"WR"},"redraftValue":1422},{"player":{"name":"Josh Downs","sleeperId":"9500","position":"WR"},"redraftValue":1389},{"player":{"name":"Jadarian Price","sleeperId":"13286","position":"RB"},"redraftValue":1251},{"player":{"name":"Tucker Kraft","sleeperId":"9484","position":"TE"},"redraftValue":1261},{"player":{"name":"Kyle Monangai","sleeperId":"12534","position":"RB"},"redraftValue":1196},{"player":{"name":"Emeka Egbuka","sleeperId":"12514","position":"WR"},"redraftValue":1154},{"player":{"name":"Aaron Jones Sr.","sleeperId":"4199","position":"RB"},"redraftValue":1109},{"player":{"name":"T.J. Hockenson","sleeperId":"5844","position":"TE"},"redraftValue":1148},{"player":{"name":"Jaylen Waddle","sleeperId":"7526","position":"WR"},"redraftValue":1133},{"player":{"name":"KC Concepcion Jr.","sleeperId":"13298","position":"WR"},"redraftValue":1102},{"player":{"name":"Tyler Warren","sleeperId":"12518","position":"TE"},"redraftValue":1025},{"player":{"name":"DK Metcalf","sleeperId":"5846","position":"WR"},"redraftValue":956},{"player":{"name":"Kirk Cousins","sleeperId":"1166","position":"QB"},"redraftValue":954},{"player":{"name":"Jacory Croskey-Merritt","sleeperId":"12533","position":"RB"},"redraftValue":884},{"player":{"name":"Denzel Boston","sleeperId":"13346","position":"WR"},"redraftValue":887},{"player":{"name":"Kaelon Black","sleeperId":"13414","position":"RB"},"redraftValue":800},{"player":{"name":"Dalton Kincaid","sleeperId":"10236","position":"TE"},"redraftValue":826},{"player":{"name":"Deebo Samuel Sr.","sleeperId":"5872","position":"WR"},"redraftValue":814},{"player":{"name":"A.J. Brown","sleeperId":"5859","position":"WR"},"redraftValue":798},{"player":{"name":"Jalen Coker","sleeperId":"11646","position":"WR"},"redraftValue":773},{"player":{"name":"Braelon Allen","sleeperId":"11576","position":"RB"},"redraftValue":737},{"player":{"name":"Jordan Mason","sleeperId":"8408","position":"RB"},"redraftValue":712},{"player":{"name":"Rico Dowdle","sleeperId":"7021","position":"RB"},"redraftValue":657},{"player":{"name":"Bo Nix","sleeperId":"11563","position":"QB"},"redraftValue":680},{"player":{"name":"Chris Rodriguez Jr.","sleeperId":"10219","position":"RB"},"redraftValue":627},{"player":{"name":"Kenny Gainwell","sleeperId":"7567","position":"RB"},"redraftValue":596},{"player":{"name":"Fernando Mendoza","sleeperId":"13269","position":"QB"},"redraftValue":616},{"player":{"name":"Caleb Douglas","sleeperId":"13296","position":"WR"},"redraftValue":586},{"player":{"name":"Omar Cooper Jr.","sleeperId":"13276","position":"WR"},"redraftValue":580},{"player":{"name":"Keenan Allen","sleeperId":"1479","position":"WR"},"redraftValue":575},{"player":{"name":"Kyle Pitts Sr.","sleeperId":"7553","position":"TE"},"redraftValue":579},{"player":{"name":"Matthew Stafford","sleeperId":"421","position":"QB"},"redraftValue":589},{"player":{"name":"Jakobi Meyers","sleeperId":"5947","position":"WR"},"redraftValue":553},{"player":{"name":"Khalil Shakir","sleeperId":"8134","position":"WR"},"redraftValue":551},{"player":{"name":"Antonio Williams","sleeperId":"13301","position":"WR"},"redraftValue":526},{"player":{"name":"Bryce Young","sleeperId":"9228","position":"QB"},"redraftValue":533},{"player":{"name":"Dallas Goedert","sleeperId":"5022","position":"TE"},"redraftValue":508},{"player":{"name":"Mark Andrews","sleeperId":"5012","position":"TE"},"redraftValue":507},{"player":{"name":"Brenton Strange","sleeperId":"9480","position":"TE"},"redraftValue":503},{"player":{"name":"Makai Lemon","sleeperId":"13294","position":"WR"},"redraftValue":486},{"player":{"name":"Ryan Flournoy","sleeperId":"11783","position":"WR"},"redraftValue":484},{"player":{"name":"Rachaad White","sleeperId":"8136","position":"RB"},"redraftValue":461},{"player":{"name":"Tyler Allgeier","sleeperId":"8132","position":"RB"},"redraftValue":454},{"player":{"name":"Tyler Shough","sleeperId":"12545","position":"QB"},"redraftValue":475},{"player":{"name":"Germie Bernard","sleeperId":"13274","position":"WR"},"redraftValue":444},{"player":{"name":"Chig Okonkwo","sleeperId":"8210","position":"TE"},"redraftValue":448},{"player":{"name":"Adonai Mitchell","sleeperId":"11625","position":"WR"},"redraftValue":431},{"player":{"name":"Alvin Kamara","sleeperId":"4035","position":"RB"},"redraftValue":419},{"player":{"name":"Malik Washington","sleeperId":"11610","position":"WR"},"redraftValue":426},{"player":{"name":"Pat Bryant","sleeperId":"12492","position":"WR"},"redraftValue":403},{"player":{"name":"Tank Dell","sleeperId":"9502","position":"WR"},"redraftValue":397},{"player":{"name":"Tre Tucker","sleeperId":"10213","position":"WR"},"redraftValue":378},{"player":{"name":"Michael Mayer","sleeperId":"9482","position":"TE"},"redraftValue":376},{"player":{"name":"Woody Marks","sleeperId":"12474","position":"RB"},"redraftValue":351},{"player":{"name":"Jordan Addison","sleeperId":"9756","position":"WR"},"redraftValue":344},{"player":{"name":"Justice Hill","sleeperId":"5995","position":"RB"},"redraftValue":328},{"player":{"name":"Cam Ward","sleeperId":"12522","position":"QB"},"redraftValue":351},{"player":{"name":"Mike Gesicki","sleeperId":"4993","position":"TE"},"redraftValue":328},{"player":{"name":"RJ Harvey","sleeperId":"12489","position":"RB"},"redraftValue":303},{"player":{"name":"Lamar Jackson","sleeperId":"4881","position":"QB"},"redraftValue":300},{"player":{"name":"Seth McGowan","sleeperId":"13424","position":"RB"},"redraftValue":264},{"player":{"name":"Pat Freiermuth","sleeperId":"7600","position":"TE"},"redraftValue":261},{"player":{"name":"Juwan Johnson","sleeperId":"7002","position":"TE"},"redraftValue":246},{"player":{"name":"Dylan Sampson","sleeperId":"12469","position":"RB"},"redraftValue":232},{"player":{"name":"Aaron Rodgers","sleeperId":"96","position":"QB"},"redraftValue":245},{"player":{"name":"Courtland Sutton","sleeperId":"5045","position":"WR"},"redraftValue":232},{"player":{"name":"Elic Ayomanor","sleeperId":"12499","position":"WR"},"redraftValue":226},{"player":{"name":"J.K. Dobbins","sleeperId":"6806","position":"RB"},"redraftValue":208},{"player":{"name":"Xavier Hutchinson","sleeperId":"10218","position":"WR"},"redraftValue":173},{"player":{"name":"Deshaun Watson","sleeperId":"4017","position":"QB"},"redraftValue":176},{"player":{"name":"Darren Waller","sleeperId":"2505","position":"TE"},"redraftValue":166},{"player":{"name":"Justin Herbert","sleeperId":"6797","position":"QB"},"redraftValue":168},{"player":{"name":"J.J. McCarthy","sleeperId":"11565","position":"QB"},"redraftValue":166},{"player":{"name":"Chimere Dike","sleeperId":"12540","position":"WR"},"redraftValue":152},{"player":{"name":"Mike Washington Jr.","sleeperId":"13305","position":"RB"},"redraftValue":129},{"player":{"name":"Geno Smith","sleeperId":"1373","position":"QB"},"redraftValue":138},{"player":{"name":"Xavier Worthy","sleeperId":"11624","position":"WR"},"redraftValue":132},{"player":{"name":"Chris Godwin Jr.","sleeperId":"4037","position":"WR"},"redraftValue":131},{"player":{"name":"Samaje Perine","sleeperId":"4147","position":"RB"},"redraftValue":125},{"player":{"name":"DeMario Douglas","sleeperId":"9501","position":"WR"},"redraftValue":126},{"player":{"name":"Baker Mayfield","sleeperId":"4892","position":"QB"},"redraftValue":131},{"player":{"name":"Konata Mumpfield","sleeperId":"12718","position":"WR"},"redraftValue":121},{"player":{"name":"Hunter Henry","sleeperId":"3214","position":"TE"},"redraftValue":121},{"player":{"name":"Ja'Kobi Lane","sleeperId":"13293","position":"WR"},"redraftValue":112},{"player":{"name":"Michael Penix Jr.","sleeperId":"11559","position":"QB"},"redraftValue":115},{"player":{"name":"Sam Darnold","sleeperId":"4943","position":"QB"},"redraftValue":106},{"player":{"name":"Jacoby Brissett","sleeperId":"3257","position":"QB"},"redraftValue":102},{"player":{"name":"TreVeyon Henderson","sleeperId":"12529","position":"RB"},"redraftValue":93},{"player":{"name":"Devaughn Vele","sleeperId":"11834","position":"WR"},"redraftValue":91},{"player":{"name":"Keon Coleman","sleeperId":"11637","position":"WR"},"redraftValue":87},{"player":{"name":"Tyler Higbee","sleeperId":"3271","position":"TE"},"redraftValue":81},{"player":{"name":"Marvin Harrison Jr.","sleeperId":"11628","position":"WR"},"redraftValue":78},{"player":{"name":"Corey Kiner","sleeperId":"12491","position":"RB"},"redraftValue":68},{"player":{"name":"De'Zhaun Stribling","sleeperId":"13417","position":"WR"},"redraftValue":67},{"player":{"name":"Joe Milton","sleeperId":"11557","position":"QB"},"redraftValue":65},{"player":{"name":"Jonathon Brooks","sleeperId":"11583","position":"RB"},"redraftValue":56},{"player":{"name":"Wan'Dale Robinson","sleeperId":"8126","position":"WR"},"redraftValue":55},{"player":{"name":"Brian Thomas Jr.","sleeperId":"11631","position":"WR"},"redraftValue":50},{"player":{"name":"Malachi Fields","sleeperId":"13285","position":"WR"},"redraftValue":46},{"player":{"name":"Terrance Ferguson","sleeperId":"12487","position":"TE"},"redraftValue":43},{"player":{"name":"Roman Wilson","sleeperId":"11630","position":"WR"},"redraftValue":40},{"player":{"name":"Tre' Harris","sleeperId":"12509","position":"WR"},"redraftValue":37},{"player":{"name":"Dalton Schultz","sleeperId":"5001","position":"TE"},"redraftValue":37},{"player":{"name":"Michael Pittman Jr.","sleeperId":"6819","position":"WR"},"redraftValue":28},{"player":{"name":"Daniel Jones","sleeperId":"5870","position":"QB"},"redraftValue":25},{"player":{"name":"Kaleb Johnson","sleeperId":"12504","position":"RB"},"redraftValue":20},{"player":{"name":"Kyle McCord","sleeperId":"12494","position":"QB"},"redraftValue":19},{"player":{"name":"Carson Beck","sleeperId":"13272","position":"QB"},"redraftValue":16},{"player":{"name":"Drew Lock","sleeperId":"5854","position":"QB"},"redraftValue":12},{"player":{"name":"Romeo Doubs","sleeperId":"8121","position":"WR"},"redraftValue":12},{"player":{"name":"Austin Ekeler","sleeperId":"4663","position":"RB"},"redraftValue":8},{"player":{"name":"Kimani Vidal","sleeperId":"11647","position":"RB"},"redraftValue":8},{"player":{"name":"MarShawn Lloyd","sleeperId":"11581","position":"RB"},"redraftValue":7},{"player":{"name":"Jauan Jennings","sleeperId":"7049","position":"WR"},"redraftValue":2}];
const ALLTIME_DATA = null;
const TRANSACTIONS_DATA = [{"season":"2024","week":2,"managerA":"drjkay","managerB":"sanfbe","aReceives":[{"name":"Christian McCaffrey","pos":"RB"},{"name":"George Kittle","pos":"TE"}],"bReceives":[{"name":"DeVonta Smith","pos":"WR"},{"name":"Kyren Williams","pos":"RB"}]},{"season":"2024","week":3,"managerA":"joshjr11","managerB":"drjkay","aReceives":[{"name":"Deebo Samuel Sr.","pos":"WR"},{"name":"Dalton Kincaid","pos":"TE"}],"bReceives":[{"name":"Chris Godwin Jr.","pos":"WR"},{"name":"Zamir White","pos":"RB"}]},{"season":"2024","week":3,"managerA":"drjkay","managerB":"GSac","aReceives":[{"name":"Kenneth Walker III","pos":"RB"},{"name":"Xavier Worthy","pos":"WR"}],"bReceives":[{"name":"Jordan Mason","pos":"RB"},{"name":"Rashid Shaheed","pos":"WR"}]},{"season":"2024","week":5,"managerA":"dpol","managerB":"GSac","aReceives":[{"name":"Davante Adams","pos":"WR"},{"name":"Jordan Mason","pos":"RB"}],"bReceives":[{"name":"Tony Pollard","pos":"RB"},{"name":"D'Andre Swift","pos":"RB"}]},{"season":"2024","week":9,"managerA":"dpol","managerB":"GSac","aReceives":[{"name":"Lamar Jackson","pos":"QB"},{"name":"Terry McLaurin","pos":"WR"},{"name":"Tony Pollard","pos":"RB"}],"bReceives":[{"name":"Alvin Kamara","pos":"RB"},{"name":"Sam Darnold","pos":"QB"},{"name":"Garrett Wilson","pos":"WR"}]},{"season":"2024","week":11,"managerA":"joshjr11","managerB":"drjkay","aReceives":[{"name":"Kenneth Walker III","pos":"RB"},{"name":"Jayden Reed","pos":"WR"}],"bReceives":[{"name":"DK Metcalf","pos":"WR"},{"name":"James Cook III","pos":"RB"}]},{"season":"2024","week":14,"managerA":"drjkay","managerB":"GSac","aReceives":[{"name":"Tee Higgins","pos":"WR"},{"name":"Jonathan Taylor","pos":"RB"}],"bReceives":[{"name":"Calvin Ridley","pos":"WR"},{"name":"De'Von Achane","pos":"RB"}]},{"season":"2024","week":14,"managerA":"benjlev","managerB":"dpol","aReceives":[{"name":"Tyreek Hill","pos":"WR"},{"name":"Tony Pollard","pos":"RB"}],"bReceives":[{"name":"George Pickens","pos":"WR"},{"name":"Brock Bowers","pos":"TE"}]},{"season":"2024","week":14,"managerA":"joshjr11","managerB":"sanfbe","aReceives":[{"name":"DeVonta Smith","pos":"WR"},{"name":"Rhamondre Stevenson","pos":"RB"}],"bReceives":[{"name":"Deebo Samuel Sr.","pos":"WR"},{"name":"Rico Dowdle","pos":"RB"}]},{"season":"2025","week":2,"managerA":"joshjr11","managerB":"sanfbe","aReceives":[],"bReceives":[{"name":"Cedric Tillman","pos":"WR"}]},{"season":"2025","week":4,"managerA":"joshjr11","managerB":"GSac","aReceives":[{"name":"Tony Pollard","pos":"RB"},{"name":"Brian Thomas Jr.","pos":"WR"}],"bReceives":[{"name":"DeVonta Smith","pos":"WR"},{"name":"Javonte Williams","pos":"RB"}]},{"season":"2025","week":6,"managerA":"drjkay","managerB":"sanfbe","aReceives":[{"name":"J.K. Dobbins","pos":"RB"}],"bReceives":[{"name":"DK Metcalf","pos":"WR"}]},{"season":"2025","week":6,"managerA":"dpol","managerB":"GSac","aReceives":[{"name":"Alvin Kamara","pos":"RB"},{"name":"CeeDee Lamb","pos":"WR"},{"name":"Tucker Kraft","pos":"TE"},{"name":"Quentin Johnston","pos":"WR"}],"bReceives":[{"name":"Davante Adams","pos":"WR"},{"name":"Jake Ferguson","pos":"TE"},{"name":"Ashton Jeanty","pos":"RB"}]},{"season":"2025","week":8,"managerA":"joshjr11","managerB":"drjkay","aReceives":[{"name":"Justin Jefferson","pos":"WR"}],"bReceives":[{"name":"Emeka Egbuka","pos":"WR"}]},{"season":"2025","week":8,"managerA":"joshjr11","managerB":"drjkay","aReceives":[{"name":"Michael Carter","pos":"RB"},{"name":"Chase Brown","pos":"RB"}],"bReceives":[{"name":"Tetairoa McMillan","pos":"WR"},{"name":"Jacory Croskey-Merritt","pos":"RB"}]},{"season":"2025","week":10,"managerA":"AlastairL","managerB":"GSac","aReceives":[{"name":"Khalil Shakir","pos":"WR"}],"bReceives":[{"name":"Cam Little","pos":"K"}]},{"season":"2025","week":10,"managerA":"dpol","managerB":"sanfbe","aReceives":[{"name":"Jaylen Warren","pos":"RB"}],"bReceives":[{"name":"Zay Flowers","pos":"WR"}]},{"season":"2025","week":11,"managerA":"dpol","managerB":"drjkay","aReceives":[{"name":"Omarion Hampton","pos":"RB"}],"bReceives":[{"name":"Jaylen Warren","pos":"RB"}]},{"season":"2025","week":12,"managerA":"dpol","managerB":"GSac","aReceives":[{"name":"Jonathan Taylor","pos":"RB"},{"name":"Juwan Johnson","pos":"TE"},{"name":"Javonte Williams","pos":"RB"}],"bReceives":[{"name":"Jauan Jennings","pos":"WR"},{"name":"James Cook III","pos":"RB"},{"name":"Jahmyr Gibbs","pos":"RB"}]},{"season":"2025","week":13,"managerA":"dpol","managerB":"drjkay","aReceives":[{"name":"George Kittle","pos":"TE"},{"name":"Puka Nacua","pos":"WR"}],"bReceives":[{"name":"Jaxon Smith-Njigba","pos":"WR"},{"name":"Oronde Gadsden","pos":"TE"}]},{"season":"2025","week":13,"managerA":"dpol","managerB":"GSac","aReceives":[{"name":"Mike Evans","pos":"WR"},{"name":"Wan'Dale Robinson","pos":"WR"}],"bReceives":[{"name":"Christian Watson","pos":"WR"},{"name":"Tampa Bay Buccaneers","pos":"DEF"}]},{"season":"2025","week":13,"managerA":"dpol","managerB":"saulgoat","aReceives":[{"name":"Bucky Irving","pos":"RB"}],"bReceives":[{"name":"Javonte Williams","pos":"RB"}]},{"season":"2026","week":5,"managerA":"AlastairL","managerB":"GSac","aReceives":[{"name":"Travis Kelce","pos":"TE"},{"name":"Marvin Harrison Jr.","pos":"WR"}],"bReceives":[{"name":"Caleb Williams","pos":"QB"}]},{"season":"2026","week":5,"managerA":"dpol","managerB":"GSac","aReceives":[{"name":"DJ Moore","pos":"WR"},{"name":"Justin Jefferson","pos":"WR"}],"bReceives":[{"name":"Aaron Jones Sr.","pos":"RB"},{"name":"A.J. Brown","pos":"WR"},{"name":"Rashee Rice","pos":"WR"}]}];
const PLAYER_SCORES = null;
const LORE_DATA = null;

const REPO = 'alastairlivingston-sudo/sleeper-league-app-3';
const PAGES_BASE = 'https://alastairlivingston-sudo.github.io/' + REPO.split('/')[1];

const DATA_SOURCES = [
{ history: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/data/history.json', rosters: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/data/rosters.json', trades: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/data/fc-values.json', alltime: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/data/alltime.json', transactions: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/data/transactions.json', players: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/data/player-scores.json' },
{ history: PAGES_BASE + '/data/history.json', rosters: PAGES_BASE + '/data/rosters.json', trades: PAGES_BASE + '/data/fc-values.json', alltime: PAGES_BASE + '/data/alltime.json', transactions: PAGES_BASE + '/data/transactions.json', players: PAGES_BASE + '/data/player-scores.json' },
];

const LORE_SOURCES = [
{ master: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/lore/master.json', archive: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/lore/archive-index.json', quotes: 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/docs/lore/quotes-index.json' },
{ master: PAGES_BASE + '/lore/master.json', archive: PAGES_BASE + '/lore/archive-index.json', quotes: PAGES_BASE + '/lore/quotes-index.json' },
];


const BUST = '?v=' + new Date().toISOString().slice(0, 10);

const T = {
bg: '#090d18', panel: '#0f1625', panel2: '#141e32', raised: '#1a2640',
border: '#24344e', borderHi: '#304260', text: '#e8f1ff', dim: '#6e8db0',
faint: '#3d5470', indigo: '#6366f1', indigoDk: '#4f46e5',
green: '#10b981', amber: '#f59e0b', blue: '#60a5fa', red: '#f87171',
};








const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
let modelIdx = 0;

function flattenPrompt(messages, systemPrompt) {
const convo = (messages || [])
.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; })
.map(function(m) { return (m.role === 'user' ? 'Human' : 'Assistant') + ': ' + m.content; })
.join('\n\n');
return systemPrompt + '\n\n' + convo + '\n\nAssistant:';
}










let SAMPLE_P = null;
let AI_STATE = 'pending';
const AI_LISTENERS = [];
function setAIState(v) { if (AI_STATE === v) return; AI_STATE = v; AI_LISTENERS.slice().forEach(function(f) { f(v); }); }
function hasWindowClaude() { return typeof window !== 'undefined' && !!window.claude; }
function getSample() {
if (SAMPLE_P) return SAMPLE_P;
if (hasWindowClaude() && typeof window.claude.use === 'function') {
SAMPLE_P = Promise.resolve().then(function() { return window.claude.use('sample'); }).catch(function() { return null; });
} else {
SAMPLE_P = Promise.resolve(null);
}
SAMPLE_P.then(function(sample) {
if (sample) setAIState('on');
else if (hasWindowClaude() && typeof window.claude.complete === 'function') setAIState('on');
else if (hasWindowClaude()) setAIState('off'); // a Claude viewer that can't sample here
else setAIState('on');                         // no bridge at all → legacy Messages API path
});
return SAMPLE_P;
}
function useAIState() {
const [v, setV] = useState(AI_STATE);
useEffect(function() {
getSample();
AI_LISTENERS.push(setV);
setV(AI_STATE);
return function() { const i = AI_LISTENERS.indexOf(setV); if (i !== -1) AI_LISTENERS.splice(i, 1); };
}, []);
return v;
}
const SAMPLE_OFF = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];



async function claudeCall(messages, systemPrompt, opts) {
const sample = await getSample();
if (sample) {
const turns = (messages || []).filter(function(m) { return (m.role === 'user' || m.role === 'assistant') && m.content; })
.map(function(m) { return { role: m.role, content: String(m.content) }; });
const input = [{ role: 'user', content: systemPrompt || 'Answer briefly.' }].concat(turns);
if (input[input.length - 1].role !== 'user') input.push({ role: 'user', content: 'Continue.' });
try {
if (opts && opts.json) return JSON.stringify(await sample.json(input, { modelTier: 'quick' }));
const r = await sample(input, { modelTier: 'quick', cache: false });
return r.text;
} catch (e) {
if (e && SAMPLE_OFF.indexOf(e.code) !== -1) setAIState('off');
throw new Error(e && e.code === 'rate_limited' ? 'MODEL_ERROR' : ((e && e.message) || 'sample failed'));
}
}

if (hasWindowClaude() && typeof window.claude.complete === 'function') {
const out = await window.claude.complete(flattenPrompt(messages, systemPrompt));
if (!out) throw new Error('Empty response');
return out;
}
if (hasWindowClaude()) throw new Error('MODEL_ERROR'); // Claude viewer without sampling

return messagesApiCall(messages, systemPrompt);
}

async function messagesApiCall(messages, systemPrompt) {
const body = (model) => JSON.stringify({
model,
max_tokens: 2000,
system: systemPrompt,
messages: messages
.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; })
.map(function(m) { return { role: m.role, content: m.content }; }),
});
let lastErr = null;
while (modelIdx < MODELS.length) {
for (let attempt = 0; attempt < 3; attempt++) {
const ctrl = new AbortController();
const timer = setTimeout(function() { ctrl.abort(); }, 60000);
try {
const res = await fetch('https://api.anthropic.com/v1/messages', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: body(MODELS[modelIdx]),
signal: ctrl.signal,
});
if (res.status === 404) { lastErr = new Error('MODEL_ERROR'); break; } // next model
if (res.status === 429 || res.status >= 500) {
lastErr = new Error('API ' + res.status);
const ra = parseInt(res.headers.get('retry-after') || '0', 10);
await new Promise(function(r) { setTimeout(r, ra > 0 ? ra * 1000 : (attempt + 1) * 2000); });
continue; // retry same model
}
if (!res.ok) throw new Error('API ' + res.status);
const data = await res.json();
const text = (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
if (!text) throw new Error('Empty response');
return text;
} catch (e) {
if (e.message === 'MODEL_ERROR') break;
lastErr = e;
if (e.name === 'AbortError') continue; // timeout → retry
throw e; // real network/4xx error — surface it
} finally {
clearTimeout(timer);
}
}
if (lastErr && lastErr.message === 'MODEL_ERROR') { modelIdx++; lastErr = null; continue; }
break; // retries exhausted on a live model
}
throw modelIdx >= MODELS.length ? new Error('MODEL_ERROR') : (lastErr || new Error('API failed'));
}











function factRound(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function factPhase(g) {
if (g.phase) return g.phase;
return g.playoff ? 'playoff' : 'regular';
}

function buildFactRows(history, canon) {
const seasons = (history && history.seasons) ? history.seasons : [];
const rows = [];
for (let si = 0; si < seasons.length; si++) {
const s = seasons[si];
const season = String(s.season);
const games = s.games || [];
const perWeek = {};
for (let gi = 0; gi < games.length; gi++) {
const g = games[gi];
const status = g.status || 'final';
if (status !== 'final' && status !== 'live') continue;
perWeek[g.week] = (perWeek[g.week] || 0) + 1;
const gameId = season + '-' + g.week + '-m' + perWeek[g.week];
const phase = factPhase(g);
const sides = [
{ m: g.a, o: g.b, pf: g.pa, pa: g.pb, pos: g.ap, bench: g.ab },
{ m: g.b, o: g.a, pf: g.pb, pa: g.pa, pos: g.bp, bench: g.bb },
];
for (let k = 0; k < 2; k++) {
const x = sides[k];
const pf = factRound(x.pf), pa = factRound(x.pa);
const manager = canon(x.m), opponent = canon(x.o);
const result = status !== 'final' ? null : (pf > pa ? 'W' : (pf < pa ? 'L' : 'T'));
rows.push({
id: season + '-' + g.week + '-' + manager,
gameId: gameId, season: season, week: g.week, phase: phase, status: status,
manager: manager, opponent: opponent, pf: pf, pa: pa, result: result,
margin: factRound(pf - pa), combined: factRound(pf + pa),
bye: false, weekRank: null, allPlayW: null, allPlayL: null,
benchPts: Array.isArray(x.bench) ? factRound(x.bench.reduce(function(t, p) { return t + (p.pts || 0); }, 0)) : null,
pos: (x.pos && typeof x.pos === 'object') ? x.pos : null,
});
}
}
const byes = s.byes || [];
for (let bi = 0; bi < byes.length; bi++) {
const y = byes[bi];
const manager = canon(y.manager);
rows.push({
id: season + '-' + y.week + '-' + manager, gameId: season + '-' + y.week + '-bye-' + manager,
season: season, week: y.week, phase: 'playoff', status: 'final',
manager: manager, opponent: null, pf: factRound(y.pts), pa: null, result: null,
margin: null, combined: null, bye: true, weekRank: null, allPlayW: null, allPlayL: null,
benchPts: null, pos: null,
});
}
}

const byWeek = {};
rows.forEach(function(r) {
if (r.status !== 'final' || r.phase !== 'regular' || r.bye) return;
const k = r.season + '|' + r.week;
(byWeek[k] = byWeek[k] || []).push(r);
});
Object.keys(byWeek).forEach(function(k) {
const wk = byWeek[k];
wk.forEach(function(r) {
let higher = 0, w = 0, l = 0;
wk.forEach(function(o) {
if (o === r) return;
if (o.pf > r.pf) { higher++; l++; } else if (o.pf < r.pf) { w++; }
});
r.weekRank = higher + 1;
r.allPlayW = w; r.allPlayL = l;
});
});
rows.sort(function(x, y) {
return x.season.localeCompare(y.season) || x.week - y.week || x.gameId.localeCompare(y.gameId) || x.manager.localeCompare(y.manager);
});
return rows;
}


function factPlayed(r) { return r.status === 'final' && !r.bye; }
function factInScope(r, scope) { return scope === 'all' ? true : r.phase === 'regular'; }


function buildSeasonRows(history, rows, canon) {
const seasons = (history && history.seasons) ? history.seasons : [];
const latest = seasons.length ? String(seasons[seasons.length - 1].season) : null;
const out = [];
seasons.forEach(function(s) {
const season = String(s.season);
const complete = s.complete != null ? !!s.complete : s.champion != null;
const champ = s.champion ? canon(s.champion) : null;
const sRows = rows.filter(function(r) { return r.season === season; });
const playoffRows = sRows.filter(function(r) { return r.phase === 'playoff' && r.status === 'final'; });
const lastPlayoffWeek = playoffRows.reduce(function(m, r) { return Math.max(m, r.week); }, 0);

let runnerUp = null;
if (champ) {
const cg = playoffRows.filter(function(r) { return r.manager === champ && !r.bye; }).sort(function(a, b) { return b.week - a.week; })[0];
if (cg) runnerUp = cg.opponent;
}
const field = {};
playoffRows.forEach(function(r) { field[r.manager] = true; });
(s.standings || []).forEach(function(st, idx) {
const m = canon(st.manager);
const reg = sRows.filter(function(r) { return r.manager === m && r.phase === 'regular' && factPlayed(r); });
let w = 0, l = 0, t = 0, pf = 0, pa = 0, apW = 0, apL = 0, xw = 0;
reg.forEach(function(r) {
if (r.result === 'W') w++; else if (r.result === 'L') l++; else if (r.result === 'T') t++;
pf += r.pf; pa += r.pa; apW += r.allPlayW || 0; apL += r.allPlayL || 0;
const n = (r.allPlayW || 0) + (r.allPlayL || 0);
if (n) xw += (r.allPlayW || 0) / n;
});
let finish = 'missed';
if (!complete) finish = null;
else if (m === champ) finish = 'champion';
else if (m === runnerUp) finish = 'runner-up';
else if (field[m]) {


const lastWk = playoffRows.filter(function(r) { return r.manager === m && !r.bye; }).reduce(function(x, r) { return Math.max(x, r.week); }, 0);
finish = lastWk >= lastPlayoffWeek - 1 ? 'semi' : 'consolation';
}
out.push({
id: season + '-' + m, season: season, manager: m,
wins: w, losses: l, ties: t, games: reg.length,
pf: factRound(pf), pa: factRound(pa), pfAvg: reg.length ? factRound(pf / reg.length) : 0,
rank: idx + 1, allPlayW: apW, allPlayL: apL,
expectedWins: factRound(xw), luck: factRound(w - xw),
playoffFinish: finish, complete: complete, current: season === latest && !complete,
sleeperWins: st.wins || 0, sleeperLosses: st.losses || 0,
});
});
});
return out;
}


function factBest(list, key, dir) {
if (!list.length) return [];
let best = null;
list.forEach(function(r) {
const v = key(r);
if (v == null) return;
if (best == null || (dir === 'max' ? v > best : v < best)) best = v;
});
if (best == null) return [];
return list.filter(function(r) { return key(r) === best; });
}


function factStreaks(rows) {
const by = {};
rows.forEach(function(r) { (by[r.manager] = by[r.manager] || []).push(r); });
const runs = [];
Object.keys(by).forEach(function(m) {
const list = by[m];
let cur = null;
list.forEach(function(r) {
if (cur && cur.type === r.result) { cur.length++; cur.to = { season: r.season, week: r.week }; }
else {
if (cur) runs.push(cur);
cur = { manager: m, type: r.result, length: 1, from: { season: r.season, week: r.week }, to: { season: r.season, week: r.week }, current: false };
}
});
if (cur) { cur.current = true; runs.push(cur); }
});
return runs;
}

function factCountBy(list, pred) {
const c = {};
list.forEach(function(r) { if (pred(r)) c[r.manager] = (c[r.manager] || 0) + 1; });
return Object.keys(c).map(function(m) { return { manager: m, count: c[m] }; });
}




function factRecordDefs(rows, scope) {
const played = rows.filter(function(r) { return factPlayed(r) && factInScope(r, scope); });
const W = played.filter(function(r) { return r.result === 'W'; });
const L = played.filter(function(r) { return r.result === 'L'; });
const oneSide = played.filter(function(r) { return r.result === 'W' || (r.result === 'T' && r.manager < r.opponent); });
const ranked = played.filter(function(r) { return r.weekRank != null; });
const weekSize = {};
ranked.forEach(function(r) { const k = r.season + '|' + r.week; weekSize[k] = (weekSize[k] || 0) + 1; });
const pf = function(r) { return r.pf; };
return {
played: played, ranked: ranked, weekSize: weekSize,
games: {
highestScore: { list: played, key: pf, dir: 'max' },
lowestScore: { list: played, key: pf, dir: 'min' },
highestScoreInLoss: { list: L, key: pf, dir: 'max' },
lowestScoreInWin: { list: W, key: pf, dir: 'min' },
biggestMargin: { list: W, key: function(r) { return r.margin; }, dir: 'max' },
closestGame: { list: oneSide, key: function(r) { return Math.abs(r.margin); }, dir: 'min' },
highestCombined: { list: oneSide, key: function(r) { return r.combined; }, dir: 'max' },
lowestCombined: { list: oneSide, key: function(r) { return r.combined; }, dir: 'min' },
},
};
}


function factGameRecords(rows, scope) {
const d = factRecordDefs(rows, scope);
const played = d.played, ranked = d.ranked, weekSize = d.weekSize;
const runs = factStreaks(played.slice());
const lossRanked = ranked.filter(function(r) { return r.result === 'L'; });
const winRanked = ranked.filter(function(r) { return r.result === 'W'; });
const bestRank = lossRanked.length ? Math.min.apply(null, lossRanked.map(function(r) { return r.weekRank; })) : null;
const worstRank = winRanked.length ? Math.max.apply(null, winRanked.map(function(r) { return r.weekRank; })) : null;
const out = {};
Object.keys(d.games).forEach(function(name) { const g = d.games[name]; out[name] = factBest(g.list, g.key, g.dir); });
out.longestWinStreak = factBest(runs.filter(function(x) { return x.type === 'W'; }), function(x) { return x.length; }, 'max');
out.longestLossStreak = factBest(runs.filter(function(x) { return x.type === 'L'; }), function(x) { return x.length; }, 'max');
out.currentStreaks = runs.filter(function(x) { return x.current; }).sort(function(a, b) { return b.length - a.length || a.manager.localeCompare(b.manager); });
out.mostTopScoreWeeks = factBest(factCountBy(ranked, function(r) { return r.weekRank === 1; }), function(x) { return x.count; }, 'max');
out.mostBottomScoreWeeks = factBest(factCountBy(ranked, function(r) { return r.weekRank === weekSize[r.season + '|' + r.week]; }), function(x) { return x.count; }, 'max');
out.unluckiestLoss = bestRank == null ? [] : factBest(lossRanked.filter(function(r) { return r.weekRank === bestRank; }), function(r) { return r.pf; }, 'max');
out.luckiestWin = worstRank == null ? [] : factBest(winRanked.filter(function(r) { return r.weekRank === worstRank; }), function(r) { return r.pf; }, 'min');
return out;
}



function factGameRanked(rows, scope, name) {
const d = factRecordDefs(rows, scope);
const newest = function(a, b) { return b.season.localeCompare(a.season) || b.week - a.week; };
const sortBy = function(list, key, dir) {
return list.filter(function(r) { return key(r) != null; }).slice().sort(function(a, b) {
const c = dir === 'max' ? key(b) - key(a) : key(a) - key(b);
return c || newest(a, b);
});
};
if (d.games[name]) { const g = d.games[name]; return sortBy(g.list, g.key, g.dir); }
if (name === 'longestWinStreak' || name === 'longestLossStreak') {
const t = name === 'longestWinStreak' ? 'W' : 'L';
return factStreaks(d.played.slice()).filter(function(x) { return x.type === t; })
.sort(function(a, b) { return b.length - a.length || b.to.season.localeCompare(a.to.season) || b.to.week - a.to.week; });
}
if (name === 'currentStreaks') return factGameRecords(rows, scope).currentStreaks;
if (name === 'mostTopScoreWeeks' || name === 'mostBottomScoreWeeks') {
const top = name === 'mostTopScoreWeeks';
return factCountBy(d.ranked, function(r) { return top ? r.weekRank === 1 : r.weekRank === d.weekSize[r.season + '|' + r.week]; })
.sort(function(a, b) { return b.count - a.count || a.manager.localeCompare(b.manager); });
}
if (name === 'unluckiestLoss') return d.ranked.filter(function(r) { return r.result === 'L'; }).sort(function(a, b) { return a.weekRank - b.weekRank || b.pf - a.pf || newest(a, b); });
if (name === 'luckiestWin') return d.ranked.filter(function(r) { return r.result === 'W'; }).sort(function(a, b) { return b.weekRank - a.weekRank || a.pf - b.pf || newest(a, b); });
return [];
}


function factRecordValue(name, r) {
switch (name) {
case 'highestScore': case 'lowestScore': case 'highestScoreInLoss': case 'lowestScoreInWin': return r.pf;
case 'biggestMargin': return r.margin;
case 'closestGame': return r.margin == null ? null : Math.abs(r.margin);
case 'highestCombined': case 'lowestCombined': return r.combined;
default: return null;
}
}
const RECORD_DIR = { highestScore: 'max', lowestScore: 'min', highestScoreInLoss: 'max', lowestScoreInWin: 'min',
biggestMargin: 'max', closestGame: 'min', highestCombined: 'max', lowestCombined: 'min' };

const RECORD_NAMES = ['highestScore', 'lowestScore', 'highestScoreInLoss', 'lowestScoreInWin', 'biggestMargin',
'closestGame', 'highestCombined', 'lowestCombined', 'bestSeasonPF', 'worstSeasonPF', 'longestWinStreak',
'longestLossStreak', 'currentStreaks', 'mostTopScoreWeeks', 'mostBottomScoreWeeks', 'unluckiestLoss', 'luckiestWin'];

function buildRecords(rows, seasonRows) {
const complete = seasonRows.filter(function(r) { return r.complete; });
const reg = factGameRecords(rows, 'regular');
const all = factGameRecords(rows, 'all');
const records = {};
RECORD_NAMES.forEach(function(name) {
if (name === 'bestSeasonPF' || name === 'worstSeasonPF') {
const v = factBest(complete, function(r) { return r.pf; }, name === 'bestSeasonPF' ? 'max' : 'min');
records[name] = { regular: v, all: v };
} else {
records[name] = { regular: reg[name], all: all[name] };
}
});

const seasonsList = [];
rows.forEach(function(r) { if (seasonsList.indexOf(r.season) === -1) seasonsList.push(r.season); });
const cur = seasonsList[seasonsList.length - 1];
if (cur) {
const curRows = rows.filter(function(r) { return r.season === cur; });
records.current = { season: cur, regular: factGameRecords(curRows, 'regular'), all: factGameRecords(curRows, 'all') };
}
return records;
}


function factCurrent(history, rows) {
const seasons = (history && history.seasons) ? history.seasons : [];
const s = seasons[seasons.length - 1];
if (!s) return null;
const season = String(s.season);
const finals = rows.filter(function(r) { return r.season === season && r.status === 'final' && !r.bye; });
const lastFinalWeek = s.lastFinalWeek != null ? s.lastFinalWeek : finals.reduce(function(m, r) { return Math.max(m, r.week); }, 0);
const live = rows.filter(function(r) { return r.season === season && r.status === 'live'; });
return {
season: season, complete: s.complete != null ? !!s.complete : s.champion != null,
lastFinalWeek: lastFinalWeek, liveWeek: s.liveWeek != null ? s.liveWeek : (live.length ? live[0].week : null),
champion: s.champion || null, schedule: s.schedule || [],
};
}

function buildFactTable(history, canon) {
const c = canon || function(h) { return String(h || '').replace(/^@/, '').trim(); };
const rows = buildFactRows(history, c);
const seasonRows = buildSeasonRows(history, rows, c);
return { games: rows, seasons: seasonRows, records: buildRecords(rows, seasonRows), current: factCurrent(history, rows) };
}













function matchManagers(query) {
const q = ' ' + String(query || '').toLowerCase() + ' ';
const hits = [];
Object.keys(NAMES).forEach(function(h) {
const names = [distinctName(h), displayName(h), h];
let at = -1;
for (let i = 0; i < names.length && at === -1; i++) {
const full = String(names[i] || '').toLowerCase();
if (!full) continue;
const candidates = [full].concat(full.split(' '));
for (let j = 0; j < candidates.length; j++) {
const w = candidates[j];
if (w.length < 3) continue;

if (i === 1 && Object.keys(NAMES).filter(function(o) { return displayName(o).toLowerCase() === w; }).length > 1) continue;
const m = new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "('s)?([^a-z]|$)").exec(q);
if (m) { at = m.index; break; }
}
}
if (at !== -1 && !hits.some(function(x) { return x.h === h; })) hits.push({ h: h, at: at });
});
hits.sort(function(a, b) { return a.at - b.at; });
return hits.map(function(x) { return x.h; });
}



const COLUMNS = {
manager: { label: 'Manager', type: 'mgr' }, opponent: { label: 'Opponent', type: 'mgr' },
pf: { label: 'PF', type: 'pts' }, pa: { label: 'PA', type: 'pts' }, result: { label: 'W/L', type: 'result' },
margin: { label: 'Margin', type: 'pts' }, combined: { label: 'Total', type: 'pts' },
season: { label: 'Season', type: 'int' }, week: { label: 'Wk', type: 'int' }, phase: { label: 'Phase', type: 'text' },
weekRank: { label: 'Wk rank', type: 'int' }, benchPts: { label: 'Bench', type: 'pts' },
wins: { label: 'W', type: 'int' }, losses: { label: 'L', type: 'int' }, ties: { label: 'T', type: 'int' },
games: { label: 'GP', type: 'int' }, winPct: { label: 'Win%', type: 'pct' },
pf_sum: { label: 'PF', type: 'pts' }, pf_avg: { label: 'Avg', type: 'pts' }, pf_max: { label: 'High', type: 'pts' },
pf_min: { label: 'Low', type: 'pts' }, pa_sum: { label: 'PA', type: 'pts' }, pa_avg: { label: 'PA avg', type: 'pts' },
margin_avg: { label: 'Avg margin', type: 'pts' }, topScoreWeeks: { label: 'Top wks', type: 'int' },
rank: { label: 'Rank', type: 'int' }, pfAvg: { label: 'Avg', type: 'pts' }, expectedWins: { label: 'xW', type: 'pts' },
luck: { label: 'Luck', type: 'pts' }, playoffFinish: { label: 'Finish', type: 'text' },
player: { label: 'Player', type: 'text' }, pos: { label: 'Pos', type: 'text' }, pts: { label: 'Pts', type: 'pts' },
avg: { label: 'Avg', type: 'pts' }, best: { label: 'Best', type: 'pts' },
type: { label: 'Streak', type: 'text' }, length: { label: 'Len', type: 'int' }, count: { label: 'Count', type: 'int' },
from: { label: 'From', type: 'text' }, to: { label: 'To', type: 'text' },
};

const SPEC_TABLES = ['games', 'seasons', 'players', 'record'];
const SPEC_GROUPS = ['', 'manager', 'opponent', 'season', 'manager,season', 'week', 'manager,opponent'];
const SPEC_SELECT = ['games', 'wins', 'losses', 'ties', 'winPct', 'pf_sum', 'pf_avg', 'pf_max', 'pf_min', 'pa_sum', 'pa_avg', 'margin_avg', 'topScoreWeeks'];
const GAME_COLS = ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'combined', 'season', 'week', 'phase', 'weekRank', 'benchPts'];
const SEASON_COLS = ['manager', 'season', 'rank', 'wins', 'losses', 'ties', 'pf', 'pa', 'pfAvg', 'expectedWins', 'luck', 'playoffFinish'];
const PLAYER_COLS = ['player', 'pos', 'manager', 'season', 'games', 'pts', 'avg', 'best'];



function validateSpec(raw, facts) {
if (!raw || typeof raw !== 'object') return { ok: false, error: 'not an object' };
if (raw.table === 'none' || raw.type === 'none') return { ok: false, error: 'none' };
if (raw.v !== 2) return { ok: false, error: 'not a v2 spec' };
if (SPEC_TABLES.indexOf(raw.table) === -1) return { ok: false, error: 'unknown table ' + raw.table };
const handles = Object.keys(NAMES);
const seasonsKnown = {};
((facts && facts.seasons) || []).forEach(function(r) { seasonsKnown[r.season] = true; });
const w = raw.where || {};
const where = {};
function handleList(key) {
if (w[key] == null) return true;
if (!Array.isArray(w[key])) return false;
const out = [];
for (let i = 0; i < w[key].length; i++) {
const c = canonical(w[key][i]);
if (handles.indexOf(c) === -1) return false;
out.push(c);
}
if (out.length) where[key] = out;
return true;
}
if (!handleList('managers')) return { ok: false, error: 'unknown manager' };
if (!handleList('opponents')) return { ok: false, error: 'unknown opponent' };
if (w.seasons != null) {
if (!Array.isArray(w.seasons)) return { ok: false, error: 'seasons must be a list' };
const ss = w.seasons.map(String);
for (let i = 0; i < ss.length; i++) if (!seasonsKnown[ss[i]]) return { ok: false, error: 'unknown season ' + ss[i] };
if (ss.length) where.seasons = ss;
}
if (w.weeks != null) {
if (!Array.isArray(w.weeks) || w.weeks.some(function(x) { return !(Number(x) >= 1 && Number(x) <= 18); })) return { ok: false, error: 'bad weeks' };
if (w.weeks.length) where.weeks = w.weeks.map(Number);
}
if (w.gameIds != null) {
if (!Array.isArray(w.gameIds) || w.gameIds.some(function(g) { return !/^\d{4}-\d{1,2}-(m\d+|bye-[A-Za-z0-9_]+)$/.test(String(g)); })) return { ok: false, error: 'bad gameIds' };
if (w.gameIds.length) where.gameIds = w.gameIds.map(String);
}
where.phase = w.phase == null ? 'regular' : w.phase;
if (['regular', 'playoff', 'consolation', 'all'].indexOf(where.phase) === -1) return { ok: false, error: 'bad phase' };
if (w.result != null) { if (['W', 'L', 'T'].indexOf(w.result) === -1) return { ok: false, error: 'bad result' }; where.result = w.result; }
where.status = w.status == null ? 'final' : w.status;
if (['final', 'live', 'any'].indexOf(where.status) === -1) return { ok: false, error: 'bad status' };
if (w.playoffFinish != null) {
if (['champion', 'runner-up', 'semi', 'consolation', 'missed'].indexOf(w.playoffFinish) === -1) return { ok: false, error: 'bad finish' };
where.playoffFinish = w.playoffFinish;
}
if (w.positions != null) {
if (!Array.isArray(w.positions) || w.positions.some(function(p) { return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].indexOf(String(p).toUpperCase()) === -1; })) return { ok: false, error: 'bad positions' };
if (w.positions.length) where.positions = w.positions.map(function(p) { return String(p).toUpperCase(); });
}
if (w.player != null) { if (typeof w.player !== 'string' || w.player.length > 40) return { ok: false, error: 'bad player' }; where.player = w.player; }

const spec = { v: 2, table: raw.table, where: where };
if (typeof raw._recipe === 'string' && /^[a-z-]+$/.test(raw._recipe)) spec.recipe = raw._recipe;
if (raw.table === 'record') {
if (RECORD_NAMES.indexOf(raw.record) === -1) return { ok: false, error: 'unknown record ' + raw.record };
spec.record = raw.record;
if (raw.top === true) spec.top = true; // ranked list ("top 10") instead of the record holder(s)
}
const gb = Array.isArray(raw.groupBy) ? raw.groupBy.join(',') : '';
if (SPEC_GROUPS.indexOf(gb) === -1) return { ok: false, error: 'bad groupBy' };
if (gb && raw.table !== 'games') return { ok: false, error: 'groupBy only on games' };
spec.groupBy = gb ? gb.split(',') : [];
if (raw.select != null) {
if (!Array.isArray(raw.select) || raw.select.some(function(c) { return SPEC_SELECT.indexOf(c) === -1; })) return { ok: false, error: 'bad select' };
}
spec.select = spec.groupBy.length ? ((raw.select && raw.select.length) ? raw.select : ['games', 'wins', 'losses', 'ties', 'pf_sum', 'pf_avg']) : [];
const allowedOrder = spec.groupBy.length ? spec.groupBy.concat(SPEC_SELECT)
: (raw.table === 'games' ? GAME_COLS : raw.table === 'seasons' ? SEASON_COLS : raw.table === 'players' ? PLAYER_COLS : []);
spec.orderBy = [];
if (raw.orderBy != null) {
if (!Array.isArray(raw.orderBy)) return { ok: false, error: 'orderBy must be a list' };
for (let i = 0; i < raw.orderBy.length; i++) {
const o = raw.orderBy[i] || {};
if (allowedOrder.indexOf(o.col) === -1) return { ok: false, error: 'bad orderBy ' + o.col };
if (o.dir != null && o.dir !== 'asc' && o.dir !== 'desc') return { ok: false, error: 'bad dir' };
spec.orderBy.push({ col: o.col, dir: o.dir || 'desc' });
}
}
const lim = raw.limit == null ? 10 : Number(raw.limit);
if (!(lim >= 1 && lim <= 25)) return { ok: false, error: 'bad limit' };
spec.limit = Math.floor(lim);
return { ok: true, spec: spec };
}

function qRound(n) { return Math.round(n * 100) / 100; }

function qSort(rows, orderBy) {
if (!orderBy || !orderBy.length) return rows;
return rows.slice().sort(function(x, y) {
for (let i = 0; i < orderBy.length; i++) {
const o = orderBy[i];
const a = x[o.col], b = y[o.col];
if (a === b) continue;
if (a == null) return 1;
if (b == null) return -1;
const c = (typeof a === 'number' && typeof b === 'number') ? a - b : String(a).localeCompare(String(b));
if (c !== 0) return o.dir === 'asc' ? c : -c;
}
return 0;
});
}

function qGameFilter(spec, facts) {
const w = spec.where;
const ids = w.gameIds ? w.gameIds : null;
return facts.games.filter(function(r) {
if (ids) return ids.indexOf(r.gameId) !== -1;
if (r.bye) return false;
if (w.status !== 'any' && r.status !== w.status) return false;
if (w.phase !== 'all' && r.phase !== w.phase) return false;
if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
if (w.opponents && w.opponents.indexOf(r.opponent) === -1) return false;
if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
if (w.weeks && w.weeks.indexOf(r.week) === -1) return false;
if (w.result && r.result !== w.result) return false;
return true;
});
}

function qAggregate(rows, groupBy, select) {
const groups = {};
const order = [];
rows.forEach(function(r) {
const k = groupBy.map(function(g) { return r[g]; }).join('|');
if (!groups[k]) { groups[k] = { key: {}, rows: [] }; groupBy.forEach(function(g) { groups[k].key[g] = r[g]; }); order.push(k); }
groups[k].rows.push(r);
});
return order.map(function(k) {
const g = groups[k];
const rs = g.rows;
const out = Object.assign({}, g.key);
const pfs = rs.map(function(r) { return r.pf; });
const w = rs.filter(function(r) { return r.result === 'W'; }).length;
const l = rs.filter(function(r) { return r.result === 'L'; }).length;
const t = rs.filter(function(r) { return r.result === 'T'; }).length;
const sum = function(f) { return rs.reduce(function(s, r) { return s + (r[f] || 0); }, 0); };
const all = {
games: rs.length, wins: w, losses: l, ties: t,
winPct: rs.length ? Math.round(w / rs.length * 1000) / 1000 : 0,
pf_sum: qRound(sum('pf')), pf_avg: rs.length ? qRound(sum('pf') / rs.length) : 0,
pf_max: pfs.length ? Math.max.apply(null, pfs) : 0, pf_min: pfs.length ? Math.min.apply(null, pfs) : 0,
pa_sum: qRound(sum('pa')), pa_avg: rs.length ? qRound(sum('pa') / rs.length) : 0,
margin_avg: rs.length ? qRound(sum('margin') / rs.length) : 0,
topScoreWeeks: rs.filter(function(r) { return r.weekRank === 1; }).length,
};
select.forEach(function(c) { out[c] = all[c]; });
return out;
});
}



function runQuery(spec, facts, players) {
const w = spec.where;
if (spec.table === 'games') {
let rows = qGameFilter(spec, facts);
if (spec.groupBy.length) {
rows = qAggregate(rows, spec.groupBy, spec.select);
rows = qSort(rows, spec.orderBy.length ? spec.orderBy : [{ col: 'wins', dir: 'desc' }, { col: 'pf_sum', dir: 'desc' }]);
return { table: 'games', columns: spec.groupBy.concat(spec.select), rows: rows.slice(0, spec.limit), total: rows.length, spec: spec };
}
rows = qSort(rows, spec.orderBy.length ? spec.orderBy : [{ col: 'season', dir: 'desc' }, { col: 'week', dir: 'desc' }, { col: 'pf', dir: 'desc' }]);
return { table: 'games', columns: ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'], rows: rows.slice(0, spec.limit), total: rows.length, spec: spec };
}
if (spec.table === 'seasons') {
let rows = facts.seasons.filter(function(r) {
if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
if (w.playoffFinish && r.playoffFinish !== w.playoffFinish) return false;
return true;
});
rows = qSort(rows, spec.orderBy.length ? spec.orderBy : [{ col: 'season', dir: 'desc' }, { col: 'rank', dir: 'asc' }]);
return { table: 'seasons', columns: ['manager', 'season', 'rank', 'wins', 'losses', 'pf', 'pa', 'playoffFinish'], rows: rows.slice(0, spec.limit), total: rows.length, spec: spec };
}
if (spec.table === 'players') {
const needle = w.player ? w.player.toLowerCase() : null;
const by = (spec.orderBy[0] && spec.orderBy[0].col) || 'pts';
const minGames = by === 'avg' ? 4 : 1;
let rows = (players || []).filter(function(r) {
if (needle && String(r.player).toLowerCase().indexOf(needle) === -1) return false;
if (w.positions && w.positions.indexOf(r.pos) === -1) return false;
if (w.managers && w.managers.indexOf(canonical(r.manager)) === -1) return false;
if (w.seasons && w.seasons.indexOf(String(r.season)) === -1) return false;
return r.games >= minGames;
}).map(function(r) { return Object.assign({}, r, { manager: canonical(r.manager), season: String(r.season) }); });
rows = qSort(rows, spec.orderBy.length ? spec.orderBy : [{ col: 'pts', dir: 'desc' }]);
return { table: 'players', columns: PLAYER_COLS, rows: rows.slice(0, spec.limit), total: rows.length, spec: spec };
}
if (spec.table === 'record') {
const scope = w.phase === 'all' ? 'all' : 'regular';
const name = spec.record;
if (name === 'bestSeasonPF' || name === 'worstSeasonPF') {
const pool = facts.seasons.filter(function(r) {
if (!r.complete && !(w.seasons && w.seasons.indexOf(r.season) !== -1)) return false;
if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
return true;
});
const rows = factBest(pool, function(r) { return r.pf; }, name === 'bestSeasonPF' ? 'max' : 'min');
return { table: 'record', record: name, columns: ['manager', 'season', 'pf', 'wins', 'losses'], rows: rows, total: rows.length, spec: spec };
}


const sub = facts.games.filter(function(r) {
if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
return true;
});
const rec = spec.top ? factGameRanked(sub, scope, name).slice(0, spec.limit) : (factGameRecords(sub, scope)[name] || []);
const recTotal = spec.top ? factGameRanked(sub, scope, name).length : rec.length;
if (name === 'longestWinStreak' || name === 'longestLossStreak' || name === 'currentStreaks') {
const rows = rec.map(function(x) { return { manager: x.manager, type: x.type, length: x.length, from: x.from.season + ' wk' + x.from.week, to: x.to.season + ' wk' + x.to.week }; });
return { table: 'record', record: name, top: !!spec.top, columns: ['manager', 'type', 'length', 'from', 'to'], rows: rows.slice(0, name === 'currentStreaks' ? 25 : spec.limit), total: recTotal, spec: spec };
}
if (name === 'mostTopScoreWeeks' || name === 'mostBottomScoreWeeks') {
return { table: 'record', record: name, top: !!spec.top, columns: ['manager', 'count'], rows: rec, total: recTotal, spec: spec };
}
const cols = (name === 'highestCombined' || name === 'lowestCombined')
? ['manager', 'pf', 'opponent', 'pa', 'combined', 'result', 'season', 'week', 'phase']
: ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'];
return { table: 'record', record: name, top: !!spec.top, columns: cols, rows: rec, total: recTotal, spec: spec };
}
return { table: spec.table, columns: [], rows: [], total: 0, spec: spec };
}


function fmt2(n) { return n == null ? '' : (Math.round(Number(n) * 100) / 100).toFixed(2); }
function nm(h) { return h ? distinctName(h) : '—'; }
function wkLabel(r) { return r.season + ' week ' + r.week; }

const RECORD_LABELS = {
highestScore: 'Highest score', lowestScore: 'Lowest score', highestScoreInLoss: 'Most points in a loss',
lowestScoreInWin: 'Fewest points in a win', biggestMargin: 'Biggest margin', closestGame: 'Closest game',
highestCombined: 'Highest combined score', lowestCombined: 'Lowest combined score', bestSeasonPF: 'Best season PF',
worstSeasonPF: 'Worst season PF', longestWinStreak: 'Longest win streak', longestLossStreak: 'Longest losing streak',
currentStreaks: 'Current streaks', mostTopScoreWeeks: 'Most top-score weeks', mostBottomScoreWeeks: 'Most bottom-score weeks',
unluckiestLoss: 'Unluckiest loss', luckiestWin: 'Luckiest win',
};



function templateSentence(spec, result, ctx) {
const rows = (result && result.rows) || [];
if (!rows.length) return 'Nothing in the data matches that.';
const r = rows[0];
const tie = rows.length > 1 ? ' (tied — ' + rows.length + ' share it)' : '';
if (result.table === 'record' && result.top && rows.length > 1) {
const label = RECORD_LABELS[result.record] || 'Record';
const lead = (function() {
switch (result.record) {
case 'highestCombined': case 'lowestCombined': return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' (' + wkLabel(r) + ', ' + fmt2(r.combined) + ' combined)';
case 'biggestMargin': case 'closestGame': return nm(r.manager) + ' over ' + nm(r.opponent) + ' by ' + fmt2(Math.abs(r.margin)) + ' (' + wkLabel(r) + ')';
case 'longestWinStreak': case 'longestLossStreak': return nm(r.manager) + ' with ' + r.length + ' (' + r.from + ' to ' + r.to + ')';
case 'currentStreaks': return nm(r.manager) + ' with ' + r.length;
case 'mostTopScoreWeeks': case 'mostBottomScoreWeeks': return nm(r.manager) + ' with ' + r.count;
default: return nm(r.manager) + ' with ' + fmt2(r.pf) + ' against ' + nm(r.opponent) + ' (' + wkLabel(r) + ')';
}
})();
return 'Top ' + rows.length + ' — ' + label.toLowerCase() + (spec.where.seasons ? ' (' + spec.where.seasons.join(', ') + ')' : '') + (spec.where.phase === 'all' ? ', all games' : ', regular season') + '. ' + lead + ' leads.';
}
if (result.table === 'record') {
switch (result.record) {
case 'highestScoreInLoss': return nm(r.manager) + ' scored ' + fmt2(r.pf) + ' and still lost — ' + nm(r.opponent) + ' put up ' + fmt2(r.pa) + ' in ' + wkLabel(r) + '.' + tie;
case 'lowestScoreInWin': return nm(r.manager) + ' won with just ' + fmt2(r.pf) + ', beating ' + nm(r.opponent) + "'s " + fmt2(r.pa) + ' in ' + wkLabel(r) + '.' + tie;
case 'highestScore': return nm(r.manager) + ' holds it with ' + fmt2(r.pf) + ' against ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ') in ' + wkLabel(r) + '.' + tie;
case 'lowestScore': return nm(r.manager) + "'s " + fmt2(r.pf) + ' against ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ') in ' + wkLabel(r) + ' is the low mark.' + tie;
case 'biggestMargin': return nm(r.manager) + ' beat ' + nm(r.opponent) + ' by ' + fmt2(r.margin) + ' (' + fmt2(r.pf) + '–' + fmt2(r.pa) + ') in ' + wkLabel(r) + '.' + tie;
case 'closestGame': return nm(r.manager) + ' edged ' + nm(r.opponent) + ' ' + fmt2(r.pf) + '–' + fmt2(r.pa) + ', a ' + fmt2(Math.abs(r.margin)) + ' margin, in ' + wkLabel(r) + '.' + tie;
case 'highestCombined':
case 'lowestCombined': return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' in ' + wkLabel(r) + ': ' + fmt2(r.pf + r.pa) + ' combined.' + tie;
case 'unluckiestLoss': return nm(r.manager) + ' scored ' + fmt2(r.pf) + ' — rank ' + r.weekRank + ' that week — and still lost to ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ') in ' + wkLabel(r) + '.' + tie;
case 'luckiestWin': return nm(r.manager) + ' won with ' + fmt2(r.pf) + ' — rank ' + r.weekRank + ' that week — because ' + nm(r.opponent) + ' managed ' + fmt2(r.pa) + ' in ' + wkLabel(r) + '.' + tie;
case 'bestSeasonPF':
case 'worstSeasonPF': return nm(r.manager) + ' scored ' + fmt2(r.pf) + ' over the ' + r.season + ' regular season.' + tie;
case 'longestWinStreak':
case 'longestLossStreak': return rows.map(function(x) { return nm(x.manager); }).join(' and ') + ': ' + r.length + ' straight ' + (r.type === 'W' ? 'wins' : 'losses') + ' (' + r.from + ' to ' + r.to + ').';
case 'currentStreaks': return nm(r.manager) + ' has the longest current run: ' + r.length + ' ' + (r.type === 'W' ? 'straight wins' : r.type === 'L' ? 'straight losses' : 'ties') + '.';
case 'mostTopScoreWeeks': return rows.map(function(x) { return nm(x.manager); }).join(' and ') + ' topped the weekly scoring ' + r.count + ' times.';
case 'mostBottomScoreWeeks': return rows.map(function(x) { return nm(x.manager); }).join(' and ') + ' finished bottom of the weekly scoring ' + r.count + ' times.';
}
}
const w = spec.where || {};
if (result.table === 'games' && w.gameIds && rows.length === 2 && !r.bye) {
const win = rows[0].result === 'W' ? rows[0] : rows[1].result === 'W' ? rows[1] : null;
const lose = win === rows[0] ? rows[1] : rows[0];
const total = fmt2(rows[0].pf + rows[1].pf);
if (!win) return nm(rows[0].manager) + ' and ' + nm(rows[1].manager) + ' tied ' + fmt2(rows[0].pf) + '–' + fmt2(rows[1].pf) + ' in ' + wkLabel(r) + ' (' + total + ' total).';
return nm(win.manager) + ' ' + fmt2(win.pf) + ' – ' + fmt2(lose.pf) + ' ' + nm(lose.manager) + ' in ' + wkLabel(r) + ': ' + total + ' total points. ' + nm(win.manager) + ' won.';
}
if (result.table === 'games' && spec.groupBy.join(',') === 'manager,opponent' && rows.length === 1) {
return nm(r.manager) + ' is ' + r.wins + '–' + r.losses + (r.ties ? '–' + r.ties : '') + ' against ' + nm(r.opponent) + (w.phase === 'all' ? ' (all games)' : ' in the regular season') + (w.seasons ? ' (' + w.seasons.join(', ') + ')' : '') + '.';
}
if (result.table === 'games' && spec.groupBy.join(',') === 'manager' && rows.length === 1) {
return nm(r.manager) + ' is ' + r.wins + '–' + r.losses + (r.ties ? '–' + r.ties : '') + (w.seasons ? ' in ' + w.seasons.join(', ') : ' all-time') + (w.phase === 'all' ? ' (all games)' : ' in the regular season') + ', ' + fmt2(r.pf_sum) + ' points for.';
}
if (result.table === 'seasons' && rows.length === 1) {
if (w.playoffFinish === 'champion') return nm(r.manager) + ' won the ' + r.season + ' title.';
return nm(r.manager) + ' went ' + r.wins + '–' + r.losses + (r.ties ? '–' + r.ties : '') + ' in ' + r.season + ', finishing rank ' + r.rank + ' with ' + fmt2(r.pf) + ' points' + (r.playoffFinish ? ' (' + r.playoffFinish + ')' : '') + '.';
}
if (result.table === 'seasons' && w.playoffFinish === 'champion' && !rows.length) return 'That season has no champion yet.';
if (spec.recipe === 'upset' && rows.length === 1) {
return nm(r.manager) + ' pulled the upset of ' + wkLabel(r) + ': ' + fmt2(r.pf) + (r.weekRank ? ' (rank ' + r.weekRank + ' that week)' : '') + ' was enough to beat ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ').';
}
if (spec.recipe === 'week-top' && rows.length === 1) {
return nm(r.manager) + ' topped ' + wkLabel(r) + ' with ' + fmt2(r.pf) + ' against ' + nm(r.opponent) + '.';
}
if (result.table === 'games' && !spec.groupBy.length && rows.length === 1) {
return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' in ' + wkLabel(r) + ' (' + (r.result === 'W' ? 'won' : r.result === 'L' ? 'lost' : r.result === 'T' ? 'tied' : 'in progress') + ').';
}
if (ctx && ctx.title) return ctx.title + '.';
return 'Here is what the data shows.';
}





function guardAllowed(rows, extra) {
const nums = [];
function add(v) {
if (typeof v === 'number' && isFinite(v)) nums.push(v);
else if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) nums.push(Number(v));
else if (typeof v === 'string') { const m = v.match(/\d+(\.\d+)?/g); if (m) m.forEach(function(x) { nums.push(Number(x)); }); }
else if (v && typeof v === 'object') Object.keys(v).forEach(function(k) { add(v[k]); });
}
(rows || []).forEach(add);
(extra || []).forEach(add);

(rows || []).forEach(function(r) { if (typeof r.pf === 'number' && typeof r.pa === 'number') { nums.push(qRound(r.pf + r.pa)); nums.push(qRound(Math.abs(r.pf - r.pa))); } });
return nums;
}
function numberGuard(sentence, rows, extra) {
const allowed = guardAllowed(rows, extra);


const text = String(sentence || '').replace(/(\d),(?=\d{3}\b)/g, '$1');
const found = [];
const re = /(^|[^A-Za-z0-9.])(\d+(?:\.\d+)?)(?![A-Za-z0-9])/g;
let mm;
while ((mm = re.exec(text)) !== null) found.push(mm[2]);
const bad = [];
found.forEach(function(tok) {
const n = Number(tok);
const dp = (tok.split('.')[1] || '').length;
const okNum = allowed.some(function(v) {
const a = Math.abs(v);
if (dp >= 2) return Math.abs(Math.round(a * 100) / 100 - n) < 1e-9;
if (dp === 1) return Math.abs(Math.round(a * 10) / 10 - n) < 1e-9;
return a === n || (Number.isInteger(a) && a === n);
});
if (!okNum) bad.push(tok);
});
return { ok: bad.length === 0, bad: bad };
}


const NUMERIC_HINT = /\b(most|highest|lowest|fewest|least|record|how many|points?|pts|average|avg|score[ds]?|scoring|wins?|won|loss(es)?|lost|streaks?|best|worst|margin|blowout|closest|standings|rank(ed|ing)?|total|biggest|largest|smallest)\b|\d/i;
const PLAYOFF_HINT = /\b(playoffs?|post-?season|including playoffs|all games)\b/i;
const DISPUTE_HINT = /\b(how could|how can|how did .* (lose|win)|that'?s wrong|that is wrong|are you sure|that can'?t be|not true|incorrect|wrong|fabricat\w*|made (that|it) up|really\?|\b(had|has|have|got|scored|put up) (a |an |one )?(bigger|higher|better|lower|closer|larger|tighter|more)\b|^\W*no[,.!\s]+\w+ (had|has|got|scored|was))/i;


const RANKING_HINT = /\b(highest|lowest|biggest|largest|smallest|most|fewest|least|best|worst|top|record|ever|all[- ]time|in history|of all time|any(one|body)?)\b/i;

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, 'twenty five': 25 };
function topN(query) {
const q = String(query || '').toLowerCase();
let m = q.match(/\btop[- ]?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\b/) ||
q.match(/\b(\d{1,2}|three|four|five|six|seven|eight|nine|ten|fifteen|twenty) (highest|lowest|biggest|largest|best|worst|most|closest|longest|smallest)\b/);
if (!m) return /\b(list|rank(ed|ing)?|leaderboard|show (me )?(more|all|the rest))\b/.test(q) ? 10 : null;
const n = NUM_WORDS[m[1]] || Number(m[1]);
return n >= 1 ? Math.min(25, n) : null;
}
const FOLLOW_GAME_HINT = /\b(total (game )?score|game total|combined( score)?|that game|the game|final score|who won (it|that|the game)|what was the score|full score|both scores)\b/i;

function recipeSpec(table, where, extra) {
return Object.assign({ v: 2, table: table, where: Object.assign({}, where || {}) }, extra || {});
}



const RECIPES = [
{ id: 'inLoss-high', re: /\b(most|highest|biggest|max(imum)?|best)\b.*\b(loss|losing|lost|defeat)\b|\b(scored|score) .*\b(still|and) (lost|lose)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'highestScoreInLoss' }); } },
{ id: 'inLoss-low', re: /\b(lowest|fewest|least|worst)\b.*\b(loss|losing|lost|defeat)\b/i, make: function(i) { return recipeSpec('games', Object.assign({ result: 'L' }, i.where), { orderBy: [{ col: 'pf', dir: 'asc' }], limit: 5 }); } },
{ id: 'inWin-low', re: /\b(lowest|fewest|least|worst)\b.*\b(win|won|winning|victory)\b|\b(won|win) with (the )?(lowest|fewest|least)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'lowestScoreInWin' }); } },
{ id: 'inWin-high', re: /\b(most|highest)\b.*\b(in a win|winning (score|effort)|in victory)\b/i, make: function(i) { return recipeSpec('games', Object.assign({ result: 'W' }, i.where), { orderBy: [{ col: 'pf', dir: 'desc' }], limit: 5 }); } },
{ id: 'unlucky', re: /\bunluck(y|iest)\b.*\b(loss|defeat)\b|\bunluckiest\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'unluckiestLoss' }); } },
{ id: 'lucky', re: /\bluck(y|iest)\b.*\b(win|victory)\b|\bluckiest\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'luckiestWin' }); } },
{ id: 'closest', re: /\b(closest|narrowest|tightest)\b|\bsmallest (margin|win|victory)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'closestGame' }); } },
{ id: 'blowout', re: /\b(blowouts?|thrashing|hammering|drubbing)\b|\b(biggest|largest|widest) (margin|win|victory|beating)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'biggestMargin' }); } },
{ id: 'combined-high', re: /\b(highest|most|biggest)\b.*\b(combined|total)\b.*\b(game|score|points|matchup)\b|\bhighest[- ]scoring (game|matchup)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'highestCombined' }); } },
{ id: 'combined-low', re: /\b(lowest|fewest)\b.*\b(combined|total)\b|\blowest[- ]scoring (game|matchup)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'lowestCombined' }); } },
{ id: 'season-best', re: /\b(most|highest|best)\b.*\b(points|pf|scoring)\b.*\b(season|year)\b|\bbest season\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'bestSeasonPF' }); } },
{ id: 'season-worst', re: /\b(fewest|lowest|worst)\b.*\b(points|pf|scoring)\b.*\b(season|year)\b|\bworst season\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'worstSeasonPF' }); } },
{ id: 'streak-current', re: /\b(current|active|right now)\b.*\bstreaks?\b|\bstreaks? (right now|currently)\b|\bon a (win(ning)?|los(ing|s)) streak\b|^\s*streaks\??\s*$/i, make: function(i) { return recipeSpec('record', i.where, { record: 'currentStreaks' }); } },
{ id: 'streak-loss', re: /\b(longest|worst)\b.*\b(los(ing|s)|skid)\b.*\bstreak|\blongest (losing|loss) (run|streak)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'longestLossStreak' }); } },
{ id: 'streak-win', re: /\blongest\b.*\b(win(ning)?)?\s*streaks?\b|\blongest win(ning)? run\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'longestWinStreak' }); } },
{ id: 'top-weeks', re: /\b(most|how many)\b.*\b(top|highest)[- ]scor\w* weeks?\b|\btopped the (weekly )?scoring\b|\bmost weekly (high|top) scores?\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'mostTopScoreWeeks' }); } },
{ id: 'bottom-weeks', re: /\b(most|how many)\b.*\b(bottom|lowest)[- ]scor\w* weeks?\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'mostBottomScoreWeeks' }); } },
{ id: 'upset', re: /\bupsets?\b/i, make: function(i) { return recipeSpec('games', { seasons: [i.cur.season], weeks: [i.cur.lastFinalWeek], result: 'W', phase: 'all' }, { orderBy: [{ col: 'weekRank', dir: 'desc' }, { col: 'pf', dir: 'asc' }], limit: 1 }); } },
{ id: 'points-total', re: /\b(most|total|career|all[- ]time) points\b|\bpoints (all[- ]time|overall|in total)\b/i, not: /\b(game|week|single|matchup|in a|loss|lost|win|won|season|year)\b/i, make: function(i) { return recipeSpec('games', { managers: i.where.managers, seasons: i.where.seasons, phase: i.where.phase }, { groupBy: ['manager'], select: ['games', 'pf_sum', 'pf_avg', 'wins', 'losses'], orderBy: [{ col: 'pf_sum', dir: 'desc' }], limit: 10 }); } },
{ id: 'week-top', re: /\b(top|highest|best) (scorer|score)\b.*\bthis week\b|\bthis week'?s? (top|high(est)?) (scorer|score)\b|\bwho (scored|had) (the )?most (points )?this week\b/i, make: function(i) { return recipeSpec('games', { seasons: [i.cur.season], weeks: [i.cur.lastFinalWeek], phase: 'all' }, { orderBy: [{ col: 'pf', dir: 'desc' }], limit: 1 }); } },
{ id: 'week-scores', re: /\b(this|last) week'?s? (scores?|results|games?|matchups?)\b|\b(scores?|results) (from )?(this|last) week\b|\bweek (\d{1,2}) (scores?|results)\b/i, make: function(i, q) {
const m = q.match(/\bweek (\d{1,2})\b/i);
return recipeSpec('games', { seasons: [i.cur.season], weeks: [m ? Number(m[1]) : i.cur.lastFinalWeek], result: 'W', phase: 'all' }, { orderBy: [{ col: 'pf', dir: 'desc' }], limit: 8 });
} },
{ id: 'champion', re: /\bwho won (the )?(20\d\d|title|league|championship|plancey)\b|\b(20\d\d) (champion|winner|title)\b|\bchampion (in|of) 20\d\d\b/i, make: function(i) { return recipeSpec('seasons', { seasons: i.years.length ? i.years : [i.cur.season], playoffFinish: 'champion' }); } },
{ id: 'best-week', re: /\b(best|highest|biggest)\b.*\b(week|game|score)\b/i, need: 'oneMgr', make: function(i) { return recipeSpec('record', i.where, { record: 'highestScore' }); } },
{ id: 'worst-week', re: /\b(worst|lowest)\b.*\b(week|game|score)\b/i, need: 'oneMgr', make: function(i) { return recipeSpec('record', i.where, { record: 'lowestScore' }); } },
{ id: 'highest-score', re: /\b(highest|most points|biggest|best|max(imum)?|record)\b.*\b(score|points|total|week|game)\b|\bmost points\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'highestScore' }); } },
{ id: 'lowest-score', re: /\b(lowest|fewest|worst|least)\b.*\b(score|points|total|week|game)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'lowestScore' }); } },
{ id: 'h2h', re: /\b(vs\.?|versus|v|against|head[\s-]?to[\s-]?head|h2h|beat|record against)\b/i, need: 'twoMgr', make: function(i) {
return recipeSpec('games', { managers: [i.mgrs[0]], opponents: [i.mgrs[1]], seasons: i.where.seasons, phase: i.where.phase }, { groupBy: ['manager', 'opponent'], select: ['games', 'wins', 'losses', 'ties', 'pf_sum', 'pa_sum', 'pf_avg'] });
} },
{ id: 'h2h-bare', re: /^\W*\w+\W+(and|&|\/)?\W*\w+\W*\??$/i, need: 'twoMgr', make: function(i) {
return recipeSpec('games', { managers: [i.mgrs[0]], opponents: [i.mgrs[1]], phase: i.where.phase }, { groupBy: ['manager', 'opponent'], select: ['games', 'wins', 'losses', 'ties', 'pf_sum', 'pa_sum', 'pf_avg'] });
} },
{ id: 'season-record', re: /\b(record|do|did|go|went|finish(ed)?|fare|season)\b/i, need: 'oneMgrYear', make: function(i) { return recipeSpec('seasons', { managers: i.mgrs, seasons: i.years }); } },
{ id: 'alltime-standings', re: /\ball[\s-]?time (standings|table|record|rankings?)\b|\bcareer (records?|standings|wins)\b|\bmost wins\b/i, make: function(i) { return recipeSpec('games', { phase: i.where.phase }, { groupBy: ['manager'], select: ['games', 'wins', 'losses', 'ties', 'winPct', 'pf_sum', 'pf_avg'], limit: 10 }); } },
{ id: 'standings', re: /\b(standings|league table|table|rankings|who'?s top|who is top|leading the league)\b/i, make: function(i) { return recipeSpec('seasons', { seasons: i.years.length ? i.years : [i.cur.season] }, { orderBy: [{ col: 'rank', dir: 'asc' }], limit: 10 }); } },
{ id: 'mgr-record', re: /\b(record|wins|losses|how many (wins|games)|how good)\b/i, need: 'oneMgr', make: function(i) { return recipeSpec('games', i.where, { groupBy: ['manager'], select: ['games', 'wins', 'losses', 'ties', 'winPct', 'pf_sum', 'pf_avg'] }); } },
];

function recipeInfo(query, facts) {
const mgrs = matchManagers(query);
const years = (String(query).match(/\b20\d\d\b/g) || []).filter(function(y, i, a) { return a.indexOf(y) === i; });
const cur = (facts && facts.current) || { season: years[0] || '', lastFinalWeek: 1 };
const where = {};
if (mgrs.length === 1) where.managers = mgrs;
if (years.length) where.seasons = years;
if (PLAYOFF_HINT.test(query)) where.phase = /\bplayoffs? only\b|\bin the playoffs\b/i.test(query) ? 'playoff' : 'all';
return { mgrs: mgrs, years: years, cur: cur, where: where };
}


function fastPlan(query, facts) {
const q = String(query || '');
if (/\b(wr|rb|qb|te|kicker|player|players|touchdowns?|position)\b/i.test(q)) return null; // player scoring → planner
const n = topN(q);

let qm = n && !/\b(highest|lowest|biggest|largest|smallest|most|fewest|least|best|worst|closest|longest|narrowest)\b/i.test(q)
? q.replace(/\btop[- ]?(\d{1,2}|[a-z]+)\b/i, 'highest') : q;
qm = qm.replace(/\b(score|game|matchup)s\b/gi, '$1'); // "highest scores" reads as "highest score"
const info = recipeInfo(qm, facts);
for (let k = 0; k < RECIPES.length; k++) {
const r = RECIPES[k];
if (r.need === 'oneMgr' && info.mgrs.length !== 1) continue;
if (r.need === 'twoMgr' && info.mgrs.length < 2) continue;
if (r.need === 'oneMgrYear' && !(info.mgrs.length === 1 && info.years.length)) continue;
if (!r.need && info.mgrs.length >= 2) continue; // two names → only the H2H recipes
if (!r.re.test(qm)) continue;
if (r.not && r.not.test(qm)) continue;
const spec = r.make(info, qm);
if (spec) { spec._recipe = r.id; return n ? widen(spec, n) : spec; }
}
return null;
}


function widen(spec, n) {
const s = JSON.parse(JSON.stringify(spec));
if (s.table === 'record') { s.top = true; s.limit = n; }
else if (!(s.groupBy && s.groupBy.length && s.groupBy.join(',') === 'manager,opponent')) s.limit = n;
return s;
}


function followUpSpec(query, ctx, facts) {
if (!ctx || !ctx.lastResult) return null;
const rows = ctx.lastResult.rows || [];
const q = String(query || '');

const n = topN(q);
const base = ctx.metricSpec || ctx.lastSpec;
if (n && base && !(base.where && base.where.gameIds) && !(facts && fastPlan(q, facts)) && /\b(this|that|these|those|them|it|same|more|the rest|of (this|that)|in history|ever|all[- ]time|of all time)\b|^\W*(top[- ]?\w+|show (me )?more|list( them)?)\W*$/i.test(q)) {
const prevN = (ctx.lastResult.rows || []).length;
const spec = widen(base, /\b(more|the rest)\b/i.test(q) && !/\d/.test(q) ? Math.min(25, Math.max(n, prevN + 10)) : n);
delete spec._recipe;
if (/\b(in history|ever|all[- ]time|of all time)\b/i.test(q) && spec.where) delete spec.where.seasons;
spec._recipe = 'follow-top';
return spec;
}
if (FOLLOW_GAME_HINT.test(q) && !RANKING_HINT.test(q) && rows.length && rows[0].gameId) {
return { v: 2, table: 'games', where: { gameIds: [rows[0].gameId], status: 'any', phase: 'all' }, orderBy: [{ col: 'pf', dir: 'desc' }], _recipe: 'follow-game' };
}

const m = q.match(/^\s*(and|what about|how about|same for|now)\b/i);
if (m && ctx.lastSpec) {
const years = (q.match(/\b20\d\d\b/g) || []);
const mgrs = matchManagers(q);
if (!years.length && !mgrs.length) return null;
const spec = JSON.parse(JSON.stringify(ctx.lastSpec));
delete spec._recipe;
if (years.length) spec.where.seasons = years;
if (mgrs.length && spec.where.managers) spec.where.managers = mgrs.slice(0, Math.max(1, spec.where.managers.length));
else if (mgrs.length) spec.where.managers = mgrs.slice(0, 1);
spec._recipe = 'follow-swap';
return spec;
}
return null;
}



function counterClaim(query, ctx, facts) {
const spec = ctx.metricSpec || ctx.lastSpec;
if (!spec || spec.table !== 'record' || !RECORD_DIR[spec.record]) return null;
const q = String(query || '');
if (!/\b(bigger|higher|better|more|lower|smaller|closer|tighter|larger|beat (it|that))\b/i.test(q)) return null;
const named = matchManagers(q);
const cur = facts.current || {};
let season = null, week = null;
if (/\blast week\b|\bthis week\b/i.test(q)) { season = cur.season; week = cur.lastFinalWeek; }
const wm = q.match(/\bweek (\d{1,2})\b/i); if (wm) week = Number(wm[1]);
const ym = q.match(/\b20\d\d\b/); if (ym) season = ym[0];
if (week != null && season == null) season = (spec.where && spec.where.seasons && spec.where.seasons.length === 1) ? spec.where.seasons[0] : cur.season;
if (!named.length && week == null && season == null) return null;
const otherSeason = season != null && !!(spec.where && spec.where.seasons) && spec.where.seasons.indexOf(season) === -1;
const name = spec.record;
const scope = spec.where && spec.where.phase === 'all' ? 'all' : 'regular';
const pool = facts.games.filter(function(r) {

if (!otherSeason && spec.where && spec.where.seasons && spec.where.seasons.indexOf(r.season) === -1) return false;
if (spec.where && spec.where.managers && spec.where.managers.indexOf(r.manager) === -1) return false;
return true;
});
const ranked = factGameRanked(pool, 'all', name);
const inScope = factGameRanked(pool, scope, name);
const cands = ranked.filter(function(r) {
if (season != null && r.season !== season) return false;
if (week != null && r.week !== week) return false;
return named.every(function(h) { return r.manager === h || r.opponent === h; });
});
if (!cands.length) return null;
const claim = cands[0];
const v = factRecordValue(name, claim);
const best = inScope[0];
const shown = (ctx.lastResult && ctx.lastResult.rows && ctx.lastResult.rows[0]) || null;
const shownV = shown ? factRecordValue(name, shown) : null;
const label = (RECORD_LABELS[name] || 'record').toLowerCase();
const desc = nm(claim.manager) + ' ' + fmt2(claim.pf) + ' – ' + fmt2(claim.pa) + ' ' + nm(claim.opponent) + ' in ' + wkLabel(claim) + ' (' + fmt2(v) + ')';
const rank = inScope.indexOf(claim) + 1;
const better = function(a, b) { return RECORD_DIR[name] === 'max' ? a > b + 1e-9 : a < b - 1e-9; };
let content;
const isRecord = best && factRecordValue(name, best) === v && rank > 0;
if (otherSeason) {
content = 'That one is from ' + season + ', and the answer above was for ' + spec.where.seasons.join(', ') + '. ' + desc + (rank === 1 ? ' is the ' + label + ' across all seasons.' : ' ranks #' + rank + ' across all seasons; the ' + label + ' is ' + fmt2(factRecordValue(name, best)) + '.');
} else if (isRecord && shown && shown.gameId === claim.gameId) {
content = 'Yes — ' + desc + ' is the ' + label + ' on record, the answer above.';
} else if (shownV != null && better(v, shownV)) {
content = "You're right — " + desc + ' beats the ' + fmt2(shownV) + ' I gave. ' +
(best === claim || (best && factRecordValue(name, best) === v) ? 'It is the ' + label + ' on record.' : 'It ranks #' + rank + '; the ' + label + ' is ' + fmt2(factRecordValue(name, best)) + '.');
} else if (rank > 0) {
content = 'Checked: ' + desc + ' ranks #' + rank + ' for ' + label + ' — behind ' + fmt2(factRecordValue(name, best)) + '.';
} else {
content = desc + ' is a ' + claim.phase + ' game, outside the regular-season record. Add "including playoffs" to rank it.';
}
const top = inScope.slice(0, 5);
if (rank > 5) top.push(claim);
const rspec = Object.assign({}, spec, { top: true, limit: top.length });
const cols = (name === 'highestCombined' || name === 'lowestCombined')
? ['manager', 'pf', 'opponent', 'pa', 'combined', 'result', 'season', 'week', 'phase']
: ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'];
return { content: content, table: { table: 'record', record: name, top: true, columns: cols, rows: top, total: inScope.length, spec: rspec } };
}


function disputeReply(query, ctx, facts) {
if (!ctx || !ctx.lastResult || !DISPUTE_HINT.test(String(query || ''))) return null;
const claim = counterClaim(query, ctx, facts);
if (claim) return claim;


if (ctx.lastQ && ctx.lastSpec && ctx.lastSpec._recipe && /^follow-/.test(ctx.lastSpec._recipe)) {
const fresh = fastPlan(ctx.lastQ, facts);
const v = fresh && validateSpec(fresh, facts);
if (v && v.ok) {
const res = runQuery(v.spec, facts);
const a = res.rows[0], b = (ctx.lastResult.rows || [])[0];
if (a && (!b || a.gameId !== b.gameId)) {
return { content: 'I got that wrong — I answered about the previous game instead of the question. ' + templateSentence(v.spec, res), table: res };
}
}
}
const rows = ctx.lastResult.rows || [];
const gid = rows.length && rows[0].gameId;
if (!gid) {
return { content: 'The table above is computed directly from the league data — those are the source rows. Ask about a specific game and I can show both sides of it.', table: ctx.lastResult };
}
const both = facts.games.filter(function(r) { return r.gameId === gid; });
const win = both.find(function(r) { return r.result === 'W'; });
const lose = both.find(function(r) { return r.result === 'L'; });
const result = { table: 'games', columns: ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'], rows: both, total: both.length, spec: { v: 2, table: 'games', where: { gameIds: [gid] }, groupBy: [] } };
if (!win || !lose) return { content: 'Here are both sides of that game, straight from the data.', table: result };
const named = matchManagers(query);
let lead = '';
if (named.indexOf(win.manager) !== -1 && /\blos(e|t|ing)\b/i.test(query)) lead = nm(win.manager) + " didn't lose. ";
else if (named.indexOf(lose.manager) !== -1 && /\bw(in|on)\b/i.test(query)) lead = nm(lose.manager) + " didn't win. ";
const label = ctx.lastResult.record ? ' That is the ' + RECORD_LABELS[ctx.lastResult.record].toLowerCase() + ' answer: ' + nm(lose.manager) + ' is the side that scored ' + fmt2(lose.pf) + ' and lost.' : '';
return {
content: lead + nm(win.manager) + ' won ' + fmt2(win.pf) + '–' + fmt2(lose.pf) + ' against ' + nm(lose.manager) + ' in ' + wkLabel(win) + '.' + label + ' The rows below are the league data itself.',
table: result,
};
}

const CLARIFY = "Which stat do you mean? For example: “Top 10 combined scores”, “Most points in a loss”, “Biggest blowout”, “Dan vs Josh” or “Longest win streak”.";
const CANT_ANSWER = "I can't answer that one from the league data, and I won't guess a number. Try: “Most points in a loss?”, “Dan vs Josh”, “Lev's record in 2024”, “Current standings”, “This week's scores” or “Longest win streak”.";


function rowsPipe(result, max) {
const cols = (result && result.columns) || [];
const rows = ((result && result.rows) || []).slice(0, max || 25);
return [cols.join('|')].concat(rows.map(function(r) {
return cols.map(function(c) {
const v = r[c];
if (v == null) return '';
if ((COLUMNS[c] || {}).type === 'mgr') return nm(v);
if ((COLUMNS[c] || {}).type === 'pts') return fmt2(v);
return String(v);
}).join('|');
})).join('\n');
}

function plannerPrompt(query, ctx) {
const handles = Object.keys(NAMES).map(function(h) { return h + '=' + distinctName(h); }).join(', ');
const lines = [
'You translate a fantasy-football question into a JSON query spec. Output ONLY valid JSON, nothing else.',
'Manager handles (use these exact strings): ' + handles + '. benjlev=Lev, sanfbe=Sanford, allyl900 maps to AlastairL.',
'Spec v2: { "v": 2, "table": "games"|"seasons"|"players"|"record", "record": "<name>" (table=record only),',
'  "where": { "managers": [], "opponents": [], "seasons": ["2024"], "weeks": [1], "phase": "regular"|"playoff"|"consolation"|"all", "result": "W"|"L"|"T", "positions": ["WR"], "player": "substring", "playoffFinish": "champion"|"runner-up"|"semi"|"consolation"|"missed" },',
'  "groupBy": [] | ["manager"] | ["opponent"] | ["season"] | ["manager","season"] | ["week"] | ["manager","opponent"],   (games table only)',
'  "select": ["games","wins","losses","ties","winPct","pf_sum","pf_avg","pf_max","pf_min","pa_sum","pa_avg","margin_avg","topScoreWeeks"],',
'  "orderBy": [{ "col": "pf", "dir": "desc" }], "limit": 10 }',
'games rows are one per manager per game: manager, pf, opponent, pa, result (W/L/T from that manager\'s side), margin, combined, season, week, phase, weekRank. seasons rows: manager, season, rank, wins, losses, pf, pa, expectedWins, luck, playoffFinish. players rows: player, pos, manager, season, games, pts, avg, best.',
'records: ' + RECORD_NAMES.join(', ') + '. A record spec returns only the holder(s); add "top": true and "limit": N for a ranked top-N list (e.g. top 10 combined scores = {"v":2,"table":"record","record":"highestCombined","top":true,"limit":10}).',
'Defaults: phase regular, final games only, limit 10. If the question is not a data lookup (opinion, lore, definitions) output {"table":"none"}.',
];
if (ctx && ctx.lastQ) {
lines.push('PREVIOUS QUESTION: ' + ctx.lastQ);
if (ctx.lastSpec) lines.push('PREVIOUS SPEC: ' + JSON.stringify(ctx.lastSpec));
if (ctx.lastResult) lines.push('PREVIOUS TOP ROWS:\n' + rowsPipe(ctx.lastResult, 3));
}
lines.push('QUESTION: ' + query);
return lines.join('\n');
}

function narrationPrompt(query, ctx, result) {
const names = Object.keys(NAMES).map(function(h) { return h + '=' + distinctName(h); }).join(', ');
const parts = [
'You are the statistician for the Borehamwood Plancy League.',
'Write ONE or TWO short sentences that answer the question using ONLY the rows below. The table is shown to the user under your sentences, so do not repeat it.',
'The rows are ground truth computed from the league data. Never claim you fabricated, invented or made up anything, and never apologise for the data. Do not compute new numbers (no sums, averages or differences that are not in the rows). Use names, not handles.',
'NAMES: ' + names,
];
if (ctx && ctx.lastQ) parts.push('PREVIOUS QUESTION: ' + ctx.lastQ + (ctx.lastResult ? '\nPREVIOUS TOP ROWS:\n' + rowsPipe(ctx.lastResult, 3) : ''));
parts.push('QUESTION: ' + query);
parts.push('ROWS (' + ((result && result.total) || 0) + ' total, top ' + Math.min(25, ((result && result.rows) || []).length) + ' shown):\n' + rowsPipe(result, 25));
parts.push('Answer:');
return parts.join('\n\n');
}


function parseSpecJson(raw) {
if (!raw) return null;
if (typeof raw === 'object') return raw;
try { return JSON.parse(String(raw).trim()); } catch (e) { /* not bare JSON */ }
const s = String(raw), first = s.indexOf('{'), last = s.lastIndexOf('}');
if (first !== -1 && last > first) { try { return JSON.parse(s.slice(first, last + 1)); } catch (e) { /* fall through */ } }
return null;
}



async function answerStatQuestion(query, ctx, deps) {
const facts = deps.facts;
let modelCalls = 0;
const log = deps.log || function() {};
const next = function(spec, result) {
const metric = spec && !(spec.where && spec.where.gameIds) ? spec : (ctx && ctx.metricSpec) || null;
return { lastQ: query, lastSpec: spec, lastResult: result, metricSpec: metric };
};

const dispute = disputeReply(query, ctx, facts);
if (dispute) return { content: dispute.content, table: dispute.table, ctx: Object.assign(next(dispute.table.spec, dispute.table), { lastQ: (ctx && ctx.lastQ) || query }), source: 'dispute', modelCalls: 0 };

let raw = followUpSpec(query, ctx, facts) || fastPlan(query, facts);
let source = raw ? 'recipe' : 'planner';

if (!raw && String(query || '').trim().split(/\s+/).length <= 2 && !matchManagers(query).length && !/\b20\d\d\b/.test(query)) {
return { content: CLARIFY, table: null, ctx: ctx, source: 'clarify', modelCalls: 0 };
}
if (!raw && deps.plan) {
try { modelCalls++; raw = parseSpecJson(await deps.plan(plannerPrompt(query, ctx))); } catch (e) { raw = null; }
}
const v = validateSpec(raw, facts);
if (!v.ok) {
if (v.error !== 'none' || NUMERIC_HINT.test(query)) return { content: CANT_ANSWER, table: null, ctx: ctx, source: 'cant', modelCalls: modelCalls };
return { content: null, table: null, ctx: ctx, source: 'chat', modelCalls: modelCalls };
}
const spec = v.spec;
const result = runQuery(spec, facts, deps.players);
const tmpl = templateSentence(spec, result);
if (!result.rows.length) return { content: tmpl, table: null, ctx: next(spec, result), source: source, modelCalls: modelCalls };
const single = result.table === 'record' || result.rows.length === 1 || (spec.where.gameIds && result.rows.length <= 2);
if (single || !deps.narrate) return { content: tmpl, table: result, ctx: next(spec, result), source: source, modelCalls: modelCalls };
let sentence = null;
try { modelCalls++; sentence = String(await deps.narrate(narrationPrompt(query, ctx, result)) || '').trim(); } catch (e) { sentence = null; }
const g = sentence ? numberGuard(sentence, result.rows) : { ok: false, bad: [] };
if (!sentence || !g.ok || /fabricat|made (that|it) up|invented/i.test(sentence)) {
log('number guard rejected narration', g.bad, sentence);
sentence = tmpl;
}
return { content: sentence, table: result, ctx: next(spec, result), source: source, modelCalls: modelCalls };
}



function thisWeekFacts(facts) {
const cur = facts && facts.current;
if (!cur || !cur.lastFinalWeek) return null;
const rows = facts.games.filter(function(r) { return r.season === cur.season && r.week === cur.lastFinalWeek && r.status === 'final' && !r.bye; });
if (!rows.length) return null;
const byGame = {};
rows.forEach(function(r) { (byGame[r.gameId] = byGame[r.gameId] || []).push(r); });
const games = Object.keys(byGame).map(function(k) {
const p = byGame[k];
const w = p.find(function(r) { return r.result === 'W'; }) || p[0];
const l = p.find(function(r) { return r !== w; }) || p[0];
return { w: w, l: l, tie: w.result === 'T' };
}).sort(function(a, b) { return b.w.pf - a.w.pf; });
const high = factBest(rows, function(r) { return r.pf; }, 'max')[0];
const low = factBest(rows, function(r) { return r.pf; }, 'min')[0];
const winners = rows.filter(function(r) { return r.result === 'W'; });
const closest = factBest(winners, function(r) { return r.margin; }, 'min')[0] || null;
const ranked = winners.filter(function(r) { return r.weekRank != null; });
const upset = ranked.length ? factBest(ranked, function(r) { return r.weekRank; }, 'max')[0] : (factBest(winners, function(r) { return r.pf; }, 'min')[0] || null);
const streaks = {};
(((facts.records.current || {}).regular || {}).currentStreaks || []).forEach(function(s) { streaks[s.manager] = s.type + s.length; });
const standings = facts.seasons.filter(function(r) { return r.season === cur.season; })
.sort(function(a, b) { return a.rank - b.rank; })
.map(function(r) { return { rank: r.rank, manager: r.manager, wins: r.wins, losses: r.losses, ties: r.ties, pf: r.pf, streak: streaks[r.manager] || '' }; });
return { season: cur.season, week: cur.lastFinalWeek, liveWeek: cur.liveWeek, complete: cur.complete, games: games, high: high, low: low, closest: closest, upset: upset, standings: standings };
}


function badgeText(facts) {
const cur = facts && facts.current;
if (!cur) return '';
if (cur.complete) return cur.season + ' · season complete';
if (!cur.lastFinalWeek) return cur.season + ' · season starting';
return cur.season + ' · through Week ' + cur.lastFinalWeek + (cur.liveWeek ? ' · Week ' + cur.liveWeek + ' live' : '');
}

function recordLine(name, res) {
const r = res.rows[0];
if (!r) return null;
const label = RECORD_LABELS[name];
if (r.type) return label + ': ' + res.rows.map(function(x) { return nm(x.manager); }).join(', ') + ' ' + r.length + r.type + ' (' + r.from + ' to ' + r.to + ')';
if (r.count != null) return label + ': ' + res.rows.map(function(x) { return nm(x.manager); }).join(', ') + ' ' + r.count;
if (r.opponent === undefined) return label + ': ' + nm(r.manager) + ' ' + fmt2(r.pf) + ' (' + r.season + ')';
return label + ': ' + nm(r.manager) + ' ' + fmt2(r.pf) + ' v ' + nm(r.opponent) + ' ' + fmt2(r.pa) + ' (' + r.result + ', ' + r.season + ' wk' + r.week + ')';
}




function leagueRecap(facts, history) {
if (!facts) return '';
const out = [];
const tw = thisWeekFacts(facts);
if (tw) {
out.push('THIS WEEK (' + tw.season + ' week ' + tw.week + '): ' + tw.games.map(function(g) {
return nm(g.w.manager) + ' ' + fmt2(g.w.pf) + (g.tie ? ' tied ' : ' beat ') + nm(g.l.manager) + ' ' + fmt2(g.l.pf);
}).join('; '));
out.push('Week high: ' + nm(tw.high.manager) + ' ' + fmt2(tw.high.pf) + '. Week low: ' + nm(tw.low.manager) + ' ' + fmt2(tw.low.pf) + '.'
+ (tw.closest ? ' Closest: ' + nm(tw.closest.manager) + ' over ' + nm(tw.closest.opponent) + ' by ' + fmt2(tw.closest.margin) + '.' : '')
+ (tw.upset ? ' Upset: ' + nm(tw.upset.manager) + ' won with ' + fmt2(tw.upset.pf) + (tw.upset.weekRank ? ' (rank ' + tw.upset.weekRank + ' that week)' : '') + '.' : ''));
out.push('STANDINGS ' + tw.season + ' (rank name W-L PF streak):\n' + tw.standings.map(function(r) {
return r.rank + ' ' + nm(r.manager) + ' ' + r.wins + '-' + r.losses + (r.ties ? '-' + r.ties : '') + ' ' + fmt2(r.pf) + ' ' + r.streak;
}).join('\n'));
}
const seasons = (history && history.seasons) || [];
const champs = seasons.filter(function(s) { return s.champion; }).map(function(s) { return s.season + ' ' + nm(s.champion); });
if (champs.length) out.push('CHAMPIONS: ' + champs.join(', '));
const career = {};
facts.seasons.forEach(function(r) {
const c = career[r.manager] = career[r.manager] || { w: 0, l: 0, t: 0, pf: 0, titles: 0, xw: 0 };
c.w += r.wins; c.l += r.losses; c.t += r.ties; c.pf += r.pf; c.xw += r.expectedWins;
if (r.playoffFinish === 'champion') c.titles++;
});
out.push('CAREER regular season (name W-L PF titles luck=W-expected):\n' + Object.keys(career).sort(function(a, b) { return career[b].w - career[a].w; }).map(function(m) {
const c = career[m];
return nm(m) + ' ' + c.w + '-' + c.l + (c.t ? '-' + c.t : '') + ' ' + fmt2(c.pf) + ' ' + c.titles + ' ' + fmt2(c.w - c.xw);
}).join('\n'));
const lines = [];
RECORD_NAMES.forEach(function(name) {
if (name === 'currentStreaks') return;
const v = validateSpec({ v: 2, table: 'record', record: name }, facts);
if (!v.ok) return;
const line = recordLine(name, runQuery(v.spec, facts, []));
if (line) lines.push(line);
});
if (lines.length) out.push('RECORDS (regular season):\n' + lines.join('\n'));
return out.join('\n\n');
}


function guardSentences(text, allowedText) {

const DOT = '\u2024';
const shielded = String(text || '').replace(/(\d)\.(\d)/g, '$1' + DOT + '$2');
const parts = shielded.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [];
const unshield = function(p) { return p.split(DOT).join('.'); };
const kept = parts.map(unshield).filter(function(p) { return numberGuard(p, [], [allowedText]).ok; });
const out = kept.join('').trim();
return { text: out, dropped: parts.length - kept.length };
}
function useLeagueData() {
const [data, setData] = useState({ history: HISTORY_DATA, rosters: ROSTERS_DATA, trades: TRADE_VALUES, alltime: ALLTIME_DATA, transactions: TRANSACTIONS_DATA, players: PLAYER_SCORES, live: false });
useEffect(function() {
let cancelled = false;
(async function() {
for (let i = 0; i < DATA_SOURCES.length; i++) {
try {
const urls = DATA_SOURCES[i];
const keys = Object.keys(urls);
const fetched = await Promise.all(keys.map(function(k) {
return fetch(urls[k] + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); });
}));
const result = { live: true };
keys.forEach(function(k, idx) { result[k] = fetched[idx]; });


const gen = function(h) { return Date.parse((h && h.meta && h.meta.generated) || '') || 0; };
if (HISTORY_DATA && gen(result.history) && gen(result.history) < gen(HISTORY_DATA)) return;
if (!cancelled) setData(result);
return;
} catch (e) { /* try next */ }
}
})();
return function() { cancelled = true; };
}, []);
return data;
}

function useLore(active) {

const [lore, setLore] = useState(LORE_DATA
? { master: (LORE_DATA.master && LORE_DATA.master.text) || '', archive: LORE_DATA.archive || [], quotes: LORE_DATA.quotes || [], ready: true }
: { master: '', archive: [], quotes: [], ready: false });
const fetchedRef = useRef(false);
useEffect(function() {
if (!active || fetchedRef.current || LORE_DATA) return;
fetchedRef.current = true;
let cancelled = false;
(async function() {
for (let i = 0; i < LORE_SOURCES.length; i++) {
try {
const urls = LORE_SOURCES[i];
const [mData, aData, qData] = await Promise.all([
fetch(urls.master + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
fetch(urls.archive + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
fetch(urls.quotes + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
]);
if (!cancelled) setLore({ master: mData.text || '', archive: aData || [], quotes: qData || [], ready: true });
return;
} catch(e) { /* try next source */ }
}
})();
return function() { cancelled = true; };
}, [active]);
return lore;
}

function retrieveLore(query, archive, quotes) {
const MAX = 3500;
if (!query || (!archive.length && !quotes.length)) return '';
const STOP = new Set(['the','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','can','and','but','or','not','so','yet','no','only','than','too','very','just','now','for','with','about','from','into','before','after','out','over','under','then','once','in','on','at','by','of','to','up','down','off','me','my','we','our','you','your','he','his','she','her','it','its','they','them','their','what','which','who','this','that','these','those','some','any','all','when','where','how','why']);
const tokens = query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function(t) { return t.length > 2 && !STOP.has(t); });
if (!tokens.length) return '';

const PMAP = {
dan:'Daniel Polak', daniel:'Daniel Polak', polak:'Daniel Polak', commissioner:'Daniel Polak',
saul:'Saul Freedman', freedman:'Saul Freedman', goat:'Saul Freedman',
alastair:'Alastair Livingston', ally:'Alastair Livingston', livingston:'Alastair Livingston',
gideon:'Gideon Sakofsky', sac:'Gideon Sakofsky', sakofsky:'Gideon Sakofsky',
josh:'Josh Gaon', gaon:'Josh Gaon', trader:'Josh Gaon',
jamie:'Jamie Kay', kay:'Jamie Kay', doctor:'Jamie Kay',
lev:'Benjy Levey', levey:'Benjy Levey', autodraft:'Benjy Levey',
sanford:'Benjy Sanford', snaff:'Benjy Sanford', darkwa:'Benjy Sanford',
};
const mentioned = new Set();
tokens.forEach(function(t) { if (PMAP[t]) mentioned.add(PMAP[t]); });

const parts = [];


if (quotes.length && mentioned.size) {
quotes.forEach(function(chunk) {
if (mentioned.has(chunk.person)) {
const sample = (chunk.lines || []).slice(0, 10).join('\n');
if (sample) parts.push('QUOTES — ' + chunk.person + ':\n' + sample);
}
});
}


if (archive.length) {
const yearMatch = query.match(/\b(201[7-9]|202[0-6])\b/);
const scored = archive.map(function(chunk) {
const haystack = (chunk.title + ' ' + chunk.text).toLowerCase();
let score = tokens.reduce(function(s, t) { return s + (haystack.split(t).length - 1); }, 0);
if (yearMatch && String(chunk.year) === yearMatch[1]) score += 8;
mentioned.forEach(function(nm) {
score += (haystack.split(nm.split(' ')[0].toLowerCase()).length - 1) * 2;
});
return { chunk: chunk, score: score };
});
scored.sort(function(a, b) { return b.score - a.score; });
scored.slice(0, 2).forEach(function(x) {
if (x.score > 1) parts.push('ARCHIVE — ' + x.chunk.title + ':\n' + x.chunk.text.slice(0, 1800));
});
}

return parts.join('\n\n---\n\n').slice(0, MAX);
}

function useViewport() {
const [keyboardOpen, setKb] = useState(false);
useEffect(function() {
const vv = window.visualViewport;
function apply() {
const h = vv ? vv.height : window.innerHeight;
document.documentElement.style.setProperty('--app-h', h + 'px');
setKb((window.innerHeight - h) > 120);
}
apply();
if (vv) { vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply); }
window.addEventListener('resize', apply);
window.addEventListener('orientationchange', apply);
return function() {
if (vv) { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply); }
window.removeEventListener('resize', apply);
window.removeEventListener('orientationchange', apply);
};
}, []);
return { keyboardOpen: keyboardOpen };
}

function renderInline(str, kb) {
return str.split(/(\*\*[^*]+\*\*)/g).map(function(p, i) {
if (/^\*\*[^*]+\*\*$/.test(p)) return React.createElement('strong', { key: kb + '-' + i }, p.slice(2, -2));
return React.createElement('span', { key: kb + '-' + i }, p);
});
}
function splitRow(line) {
return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function(c) { return c.trim(); });
}
function MarkdownMessage(props) {
const lines = String(props.text || '').split('\n');
const out = [];
let i = 0, key = 0;
function isRow(l) { return /^\s*\|.*\|\s*$/.test(l); }
function isSep(l) { return /^\s*\|[\s:|-]+\|\s*$/.test(l); }
while (i < lines.length) {
const line = lines[i];
if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
const header = splitRow(line);
i += 2;
const rows = [];
while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) { rows.push(splitRow(lines[i])); i++; }
const tbl = React.createElement('div', { key: key++, style: { overflowX: 'auto', margin: '8px 0' } },
React.createElement('table', { className: 'md-table' },
React.createElement('thead', null, React.createElement('tr', null, header.map(function(h, j) { return React.createElement('th', { key: j }, renderInline(h, 'h' + j)); }))),
React.createElement('tbody', null, rows.map(function(r, ri) { return React.createElement('tr', { key: ri }, r.map(function(c, ci) { return React.createElement('td', { key: ci }, renderInline(c, ri + '-' + ci)); })); }))
)
);
out.push(tbl);
continue;
}
if (line.trim() === '') { i++; continue; }
const para = [];
while (i < lines.length && lines[i].trim() !== '' && !(isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1]))) { para.push(lines[i]); i++; }
const children = [];
for (let li = 0; li < para.length; li++) {
const inlined = renderInline(para[li], key + '-' + li);
inlined.forEach(function(el) { children.push(el); });
if (li < para.length - 1) children.push(React.createElement('br', { key: 'br-' + li }));
}
out.push(React.createElement('p', { key: key++, style: { margin: '0 0 7px', lineHeight: 1.55 } }, children));
}
return React.createElement(React.Fragment, null, out);
}



function fmtCell(col, v) {
const t = (COLUMNS[col] || {}).type;
if (v == null || v === '') return '—';
if (t === 'mgr') return distinctName(v);
if (t === 'pts') return fmt2(v);
if (t === 'pct') return (Number(v) * 100).toFixed(1) + '%';
return String(v);
}
function ResultTable(props) {
const result = props.result;
if (!result || !result.rows || !result.rows.length) return null;
const cols = result.columns || [];
return (
<div className="rt-wrap">
<table className="md-table rt">
<thead><tr>{cols.map(function(c) { return <th key={c}>{(COLUMNS[c] || {}).label || c}</th>; })}</tr></thead>
<tbody>
{result.rows.map(function(r, i) {
return <tr key={r.id || (r.gameId ? r.gameId + i : i)}>{cols.map(function(c) {
if (c === 'result') return <td key={c}><span className={'res res-' + (r.result || 'x')}>{r.result || '·'}</span></td>;
return <td key={c}>{fmtCell(c, r[c])}</td>;
})}</tr>;
})}
</tbody>
</table>
{result.total > result.rows.length ? <div className="rt-more">{'Top ' + result.rows.length + ' of ' + result.total}</div> : null}
</div>
);
}

function ChatTab(props) {
const { systemPrompt, chips, placeholder, errorMsg, intro, buildContext, answer, header, postProcess } = props;
const [messages, setMessages] = useState([]);


const ctxRef = useRef(null);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const bottomRef = useRef(null);
const taRef = useRef(null);

useEffect(function() { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

function autoResize() {
const ta = taRef.current;
if (!ta) return;
ta.style.height = 'auto';
ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

async function send(text) {
const t = (text || input).trim();
if (!t || loading) return;
const next = messages.concat([{ role: 'user', content: t }]);
setMessages(next); setInput(''); setLoading(true);
if (taRef.current) taRef.current.style.height = 'auto';
try {
if (answer) {
const out = await answer(t, next, ctxRef.current);
if (out && out.content != null) {
ctxRef.current = out.ctx || ctxRef.current;
setMessages(function(p) { return p.concat([{ role: 'assistant', content: out.content, table: out.table || null }]); });
return;
}
}
const extra = buildContext ? await buildContext(t, next) : '';
const fullPrompt = extra ? systemPrompt + '\n\n' + extra : systemPrompt;
const raw = await claudeCall(next.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; }), fullPrompt);
let reply = raw.replace(/\[(FACT|MYTH|REAL|EVENT)\]/g, '').replace(/  +/g, ' ').trim();
if (postProcess) reply = postProcess(reply, fullPrompt);
setMessages(function(p) { return p.concat([{ role: 'assistant', content: reply }]); });
} catch (e) {
const txt = (e && e.message === 'MODEL_ERROR') ? 'Model hiccup — try again.' : errorMsg;
setMessages(function(p) { return p.concat([{ role: 'error', content: txt }]); });
} finally { setLoading(false); }
}

const bubUser = { alignSelf: 'flex-end', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '11px 15px', maxWidth: '82%', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap', boxShadow: '0 3px 14px rgba(99,102,241,0.3)' };
const bubAsst = { alignSelf: 'flex-start', background: '#141e32', color: '#e8f1ff', border: '1px solid #24344e', borderLeft: '3px solid #6366f1', borderRadius: '4px 18px 18px 18px', padding: '12px 15px', maxWidth: '88%', fontSize: 15, lineHeight: 1.6 };
const bubErr  = { alignSelf: 'flex-start', background: '#141e32', color: '#f59e0b', border: '1px solid #24344e', borderLeft: '3px solid #f59e0b', borderRadius: '4px 18px 18px 18px', padding: '12px 15px', maxWidth: '88%', fontSize: 15, whiteSpace: 'pre-wrap' };

return (
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
<div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid ' + T.border, overflowX: 'auto', flexShrink: 0, background: T.panel }}>
{chips.map(function(c, i) {
return <button key={i} className="chip" onClick={function() { send(c); }} disabled={loading}>{c}</button>;
})}
</div>
<div style={{ flexGrow: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
{typeof header === 'function' ? header(messages.length) : (header || null)}
{messages.length === 0 && !loading && (
<div style={{ margin: 'auto', textAlign: 'center', color: T.faint, fontSize: 14, maxWidth: 300, lineHeight: 1.7, padding: '20px 8px' }}>{intro}</div>
)}
{messages.map(function(m, i) {
if (m.role === 'assistant') return <div key={i} style={bubAsst}><MarkdownMessage text={m.content} />{m.table ? <ResultTable result={m.table} /> : null}</div>;
if (m.role === 'error') return <div key={i} style={bubErr}>{m.content}</div>;
return <div key={i} style={bubUser}>{m.content}</div>;
})}
{loading && (
<div style={bubAsst}>
<span className="ld" /><span className="ld" /><span className="ld" />
</div>
)}
<div ref={bottomRef} />
</div>
<div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid ' + T.border, background: T.panel, flexShrink: 0 }}>
<textarea ref={taRef} rows={1} value={input}
onChange={function(e) { setInput(e.target.value); }}
onInput={autoResize}
onKeyDown={function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
placeholder={placeholder}
style={{ flex: 1, background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 11, padding: '12px 13px', fontSize: 16, resize: 'none', outline: 'none', lineHeight: 1.4 }}
/>
<button onClick={function() { send(); }} disabled={loading || !input.trim()} className="send-btn" style={{ opacity: (loading || !input.trim()) ? 0.4 : 1 }}>SEND</button>
</div>
</div>
);
}


function tsv(cols, rows) {
return [cols.join('|')].concat((rows || []).map(function(r) {
return cols.map(function(c) { const v = r[c]; return v == null ? '' : v; }).join('|');
})).join('\n');
}



function alltimeSummary(d) {
if (!d) return '';
const out = [];
const pr = d.playoffRecords || {};
const prRows = Object.keys(pr).map(function(h) { const r = pr[h]; return { name: distinctName(h), rec: r.wins + '-' + r.losses, apps: r.appearances, pf: r.pf, pa: r.pa }; });
if (prRows.length) out.push('PLAYOFFS (W-L, apps=appearances):\n' + tsv(['name', 'rec', 'apps', 'pf', 'pa'], prRows));
if (d.nemesis) out.push('NEMESIS (worst matchup, min 3 mtgs): ' + Object.keys(d.nemesis).map(function(h) { const n = d.nemesis[h]; return distinctName(h) + '→' + distinctName(n.opponent) + '(' + n.wins + '-' + n.losses + ')'; }).join('; '));
if (d.bunny)   out.push('BUNNY (best matchup, min 3 mtgs): '   + Object.keys(d.bunny).map(function(h)   { const b = d.bunny[h];   return distinctName(h) + '→' + distinctName(b.opponent) + '(' + b.wins + '-' + b.losses + ')'; }).join('; '));
if (d.consistencyStats) out.push('CONSISTENCY (SD of weekly scores, lower=steadier; avg):\n' + Object.keys(d.consistencyStats).map(function(h) { const c = d.consistencyStats[h].allTime; return distinctName(h) + ' SD ' + c.stdDev + ' avg ' + c.avg; }).join('\n'));
if (d.benchStats && d.benchStats.perManager) out.push('BENCH (avg pts left on bench per game): ' + d.benchStats.perManager.map(function(b) { return distinctName(b.manager) + ' ' + b.avgBenchPts; }).join(', '));
if (d.seasonalTrends) {
const tl = Object.keys(d.seasonalTrends).map(function(h) {
return distinctName(h) + ': ' + (d.seasonalTrends[h] || []).map(function(t) { return t.season + ' r' + t.rank + ' ' + t.ppg + 'ppg'; }).join(', ');
});
if (tl.length) out.push('SEASON TREND (r=finish rank, ppg=points/game):\n' + tl.join('\n'));
}
if (d.positionalStrengths) {
const rows = [];
Object.keys(d.positionalStrengths).forEach(function(h) {
const seasonsObj = d.positionalStrengths[h] || {};
const last = Object.keys(seasonsObj).sort().pop();
if (!last) return;
const p = seasonsObj[last];
rows.push({ name: distinctName(h), yr: last, QB: p.QB, RB: p.RB, WR: p.WR, TE: p.TE, K: p.K, DEF: p.DEF });
});
if (rows.length) out.push('POSITIONAL avg pts/game (latest season):\n' + tsv(['name', 'yr', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'], rows));
}
return out.join('\n\n');
}

function tradesLines(txns) {
const list = Array.isArray(txns) ? txns : ((txns && txns.items) || []);
if (!list.length) return '(none on record)';
return list.map(function(t) {
const a = (t.aReceives || []).join(', '), b = (t.bReceives || []).join(', ');
return t.season + ' wk' + t.week + ': ' + distinctName(t.managerA) + ' gets [' + a + '] ↔ ' + distinctName(t.managerB) + ' gets [' + b + ']';
}).join('\n');
}


function ThisWeekCard(props) {
const tw = useMemo(function() { return thisWeekFacts(props.facts); }, [props.facts]);
const [open, setOpen] = useState(true);

useEffect(function() { if (props.started) setOpen(false); }, [props.started]);
if (!tw) return null;
const line = function(label, r, extra) { return r ? <div className="tw-line"><span className="tw-k">{label}</span> {nm(r.manager) + ' ' + fmt2(r.pf) + (extra ? extra(r) : '')}</div> : null; };
return (
<div className="tw-card" data-testid="this-week">
<div className="tw-head">
<button className="tw-toggle" onClick={function() { setOpen(!open); }}>{(open ? '▾ ' : '▸ ') + 'This week · ' + tw.season + ' Week ' + tw.week}</button>
<button className="tw-rb" onClick={props.onRecordBook}>Record Book</button>
</div>
{open && (
<div className="tw-body">
<div className="tw-games">
{tw.games.map(function(g) {
return <div key={g.w.gameId} className="tw-game"><b>{nm(g.w.manager)}</b> {fmt2(g.w.pf)} <span className="tw-dim">{g.tie ? 'tied' : 'beat'}</span> {nm(g.l.manager)} {fmt2(g.l.pf)}</div>;
})}
</div>
{line('High', tw.high)}
{line('Low', tw.low)}
{tw.closest ? <div className="tw-line"><span className="tw-k">Closest</span> {nm(tw.closest.manager) + ' over ' + nm(tw.closest.opponent) + ' by ' + fmt2(tw.closest.margin)}</div> : null}
{line('Upset', tw.upset, function(r) { return ' beat ' + nm(r.opponent) + (r.weekRank ? ' (rank ' + r.weekRank + ' that week)' : ''); })}
<table className="md-table tw-table">
<thead><tr><th>#</th><th>Manager</th><th>W-L</th><th>PF</th><th>Streak</th></tr></thead>
<tbody>{tw.standings.map(function(r) {
return <tr key={r.manager}><td>{r.rank}</td><td>{nm(r.manager)}</td><td>{r.wins + '-' + r.losses + (r.ties ? '-' + r.ties : '')}</td><td>{fmt2(r.pf)}</td><td>{r.streak}</td></tr>;
})}</tbody>
</table>
</div>
)}
</div>
);
}


function RecordBook(props) {
const facts = props.facts;
const [scope, setScope] = useState('regular');
const [season, setSeason] = useState('all');
const seasons = useMemo(function() { const s = []; facts.seasons.forEach(function(r) { if (s.indexOf(r.season) === -1) s.push(r.season); }); return s; }, [facts]);
const books = useMemo(function() {
return RECORD_NAMES.map(function(name) {
const v = validateSpec({ v: 2, table: 'record', record: name, where: { phase: scope, seasons: season === 'all' ? undefined : [season] } }, facts);
return { name: name, res: v.ok ? runQuery(v.spec, facts, []) : { rows: [] } };
});
}, [facts, scope, season]);
function side(r) {
if (r.type) return nm(r.manager) + ' · ' + r.length + r.type + ' · ' + r.from + ' → ' + r.to;
if (r.count != null) return nm(r.manager) + ' · ' + r.count;
if (r.opponent === undefined) return nm(r.manager) + ' · ' + fmt2(r.pf) + ' · ' + r.season;
return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' · ' + r.season + ' wk' + r.week;
}
return (
<div className="rb-panel" data-testid="record-book">
<div className="rb-head">
<b>Record Book</b>
<select value={scope} onChange={function(e) { setScope(e.target.value); }}><option value="regular">Regular season</option><option value="all">All games</option></select>
<select value={season} onChange={function(e) { setSeason(e.target.value); }}><option value="all">All seasons</option>{seasons.map(function(s) { return <option key={s} value={s}>{s}</option>; })}</select>
<button className="tw-rb" onClick={props.onClose}>Close</button>
</div>
<div className="rb-list">
{books.map(function(b) {
return (
<div key={b.name} className="rb-item" data-record={b.name}>
<div className="rb-label">{RECORD_LABELS[b.name]}</div>
{b.res.rows.length ? b.res.rows.slice(0, 8).map(function(r, i) { return <div key={i} className="rb-row">{side(r)}</div>; }) : <div className="rb-row tw-dim">—</div>}
</div>
);
})}
</div>
</div>
);
}

function StatsTab(props) {
const { historyData, facts, alltimeData, transactionsData, playersData, loreMaster } = props;
const [book, setBook] = useState(false);
const ai = useAIState();
const loreCtx = loreMaster
? '\n\nLEAGUE CONTEXT (names, champions, glossary — for resolving names only, NOT for inventing stats):\n' + loreMaster.slice(0, 2500)
: '';



const sp = useMemo(function() {
return 'You are the statistician for the Borehamwood Plancy League. Answer ONLY from the data below — NEVER compute or invent numbers. If a number is not given to you, say you do not have it. Use names, never Sleeper handles; two Benjys: Lev and Sanford. Be brief.'
+ loreCtx
+ '\n\n' + leagueRecap(facts, historyData)
+ '\n\n' + alltimeSummary(alltimeData)
+ '\n\nTRADES:\n' + tradesLines(transactionsData);
}, [facts, historyData, alltimeData, transactionsData, loreCtx]);


async function answer(query, conversation, ctx) {
const aiOn = ai !== 'off';
const out = await answerStatQuestion(query, ctx, {
facts: facts, players: playersData,
plan: aiOn ? function(prompt) { return claudeCall([{ role: 'user', content: prompt }], 'Output only JSON.', { json: true }); } : null,
narrate: aiOn ? function(prompt) { return claudeCall([{ role: 'user', content: prompt }], 'Reply in one or two plain sentences.'); } : null,
log: function() { if (DEBUG) console.log.apply(console, ['[stats]'].concat([].slice.call(arguments))); },
});
if (out.content != null) return out;
if (!aiOn) return { content: CANT_ANSWER, table: null, ctx: ctx };
const reply = await claudeCall(conversation.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; }), sp);
const g = numberGuard(reply, [], [sp]);
if (!g.ok) { if (DEBUG) console.log('[stats] chat reply rejected by number guard', g.bad); return { content: CANT_ANSWER, table: null, ctx: ctx }; }
return { content: reply, table: null, ctx: ctx };
}

return (
<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
{book && <RecordBook facts={facts} onClose={function() { setBook(false); }} />}
<ChatTab systemPrompt={sp} answer={answer}
header={function(n) { return <ThisWeekCard facts={facts} started={n > 0} onRecordBook={function() { setBook(true); }} />; }}
chips={['Most points in a loss?', "This week's upset?", 'Current standings', 'Longest streaks']}
placeholder="Message…" errorMsg="Something went wrong — try again."
intro="Ask about records, standings, head-to-heads or any week. Numbers come straight from the league data." />
</div>
);
}

function BanterTab(props) {
const { historyData, facts, alltimeData, lore } = props;
const ai = useAIState();

const banterPrompt = useMemo(function() {
const rule = [
'══ PRIME DIRECTIVE ══',
'You are the resident wind-up merchant of the Borehamwood Plancy League.',
'STYLE: ESPN mock-grandeur, bone-dry British wit, mock gravity. Punchy 3-5 sentences. Lean on Jewish/Borehamwood texture. Sign off big beats with "a hearty hearty mazel tov."',
'Never be cruel — mockery is the love language. Never invent statistics: every score, record or number you use must appear in the RECAP below (pre-2023 lore is unverified and may be referenced as lore only).',
'NEVER print tag labels like [FACT], [MYTH], [REAL], or [EVENT].',
'',
'══ LORE MASTER ══',
].join('\n');

const recap = '\n\n══ RECAP (verified data — the only source of numbers) ══\n' + leagueRecap(facts, historyData)
+ (alltimeData && alltimeData.nemesis ? '\n\nNEMESIS: ' + Object.keys(alltimeData.nemesis).map(function(h) { const n = alltimeData.nemesis[h]; return distinctName(h) + '→' + distinctName(n.opponent) + '(' + n.wins + '-' + n.losses + ')'; }).join('; ') : '');
if (lore.master) return rule + '\n' + lore.master.slice(0, 12000) + recap;
return rule + '\nThe Miriam = wooden spoon. Sanford = king of the Miriam. Lev = autodraft legend ("Does it auto-draft automatically?"). Dan = Commissioner/narrator. Gideon lives in Israel (4am watches). The Plancey = championship belt named after Rabbi Alan Plancey.'
+ '\nTWO BENJYS: benjlev=Lev, sanfbe=Sanford. allyl900=Alastair.'
+ '\nNAME MAP: ' + JSON.stringify(NAMES)
+ recap;
}, [lore.master, historyData, facts, alltimeData]);

function buildContext(query) {
if (!lore.ready) return '';
const lore_ctx = retrieveLore(query, lore.archive, lore.quotes);
return lore_ctx ? '--- RETRIEVED LORE ---\n' + lore_ctx : '';
}

function postProcess(reply, fullPrompt) {
const g = guardSentences(reply, fullPrompt);
if (DEBUG && g.dropped) console.log('[banter] number guard dropped', g.dropped, 'sentence(s)');
return g.text || "I'll keep the numbers out of this one — ask the Stats tab for the receipts.";
}

if (ai === 'off') {
return <div data-testid="ai-off" style={{ margin: 'auto', padding: '24px 16px', textAlign: 'center', color: T.dim, fontSize: 14, lineHeight: 1.7, maxWidth: 320 }}>Banter needs Claude, which isn't available in this view. The Stats tab still answers every record and standings question from the league data.</div>;
}
return <ChatTab
systemPrompt={banterPrompt}
buildContext={buildContext}
postProcess={postProcess}
chips={['Roast the 2025 champion', 'Most cursed manager?', "This week's smack bulletin", 'Roast Lev']}
placeholder="Message…"
errorMsg="Blimey — give it another go."
intro="Pull up a chair. Ask for a roast, a smack-talk bulletin, or just stir the pot."
/>;
}

function normalizeName(str) { return str.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }

function TradeGrader(props) {
const { rostersData, tradeValues } = props;
const ai = useAIState();
const teamKeys = useMemo(function() { return Object.keys(rostersData || {}); }, [rostersData]);
const [teamA, setTeamA] = useState(teamKeys[0] || '');
const [teamB, setTeamB] = useState(teamKeys[1] || '');
const [sideAText, setSideAText] = useState('');
const [sideBText, setSideBText] = useState('');
const [result, setResult] = useState(null);
const [verdict, setVerdict] = useState(null);
const [vLoading, setVL] = useState(false);
const [vError, setVE] = useState(false);
const [showWaiver, setShowWaiver] = useState(true);

useEffect(function() {
if (document.getElementById('tg-spin')) return;
const s = document.createElement('style');
s.id = 'tg-spin';
s.textContent = '@keyframes tg-spin{to{transform:rotate(360deg)}}';
document.head.appendChild(s);
}, []);

const { idMap, nameMap } = useMemo(function() {
const id = new Map(), nm = new Map();
(tradeValues || []).forEach(function(item) {
const p = item.player, val = item.redraftValue || 0;
if (p.sleeperId) id.set(p.sleeperId, { value: val, officialName: p.name, position: p.position });
nm.set(normalizeName(p.name), { value: val, sleeperId: p.sleeperId, officialName: p.name, position: p.position });
});
return { idMap: id, nameMap: nm };
}, [tradeValues]);

const waiverByPos = useMemo(function() {
const rostered = new Set(Object.values(rostersData || {}).reduce(function(acc, team) { return acc.concat(team.map(function(p) { return p.id; })); }, []));
const avail = (tradeValues || []).filter(function(x) { return x.player.sleeperId && !rostered.has(x.player.sleeperId); });
const byPos = {};
avail.forEach(function(p) {
const pos = p.player.position;
if (!byPos[pos]) byPos[pos] = [];
if (byPos[pos].length < 5) byPos[pos].push(p);
});
return byPos;
}, [rostersData, tradeValues]);

function lookupPlayer(txt) {
const n = normalizeName(txt);
const hit = function(e) { return { found: true, value: e.value, officialName: e.officialName, position: e.position }; };

if (nameMap.has(n)) return hit(nameMap.get(n));
if (n.length < 2) return { found: false, value: 0, officialName: txt, position: null };

if (n.length >= 4) { for (const [k, e] of nameMap) { if (k.startsWith(n)) return hit(e); } }

const toks = n.split(' ').filter(Boolean);
for (const [k, e] of nameMap) {
if (toks.every(function(t) { return k.indexOf(t) !== -1; })) return hit(e);
}
return { found: false, value: 0, officialName: txt, position: null };
}

function gradeTrade() {
function parse(txt) { return txt.split('\n').map(function(l) { return l.trim(); }).filter(Boolean).map(function(line) { return Object.assign({ input: line }, lookupPlayer(line)); }); }
const sA = parse(sideAText), sB = parse(sideBText);
const tA = sA.reduce(function(s, p) { return s + p.value; }, 0);
const tB = sB.reduce(function(s, p) { return s + p.value; }, 0);
const gap = Math.abs(tA - tB), gapPct = (gap / Math.max(tA, tB, 1)) * 100;
const winner = gapPct < 5 ? 'even' : tA > tB ? 'A' : 'B';
const tier = gapPct < 5 ? 'DEAD EVEN' : gapPct < 12 ? 'SLIGHT EDGE' : gapPct < 25 ? 'CLEAR WINNER' : 'LOPSIDED';
const icon = gapPct < 5 ? '⚖️' : gapPct < 12 ? '📊' : gapPct < 25 ? '🏆' : '🚨';
let addOns = [];
if (winner !== 'even') {
const wTeam = winner === 'A' ? teamA : teamB;
const wSide = winner === 'A' ? sA : sB;
const exclude = new Set(wSide.map(function(p) { return p.officialName; }));
addOns = ((rostersData || {})[wTeam] || [])
.map(function(rp) { return { name: idMap.has(rp.id) ? idMap.get(rp.id).officialName : rp.name, value: idMap.has(rp.id) ? idMap.get(rp.id).value : 0 }; })
.filter(function(rp) { return !exclude.has(rp.name) && rp.value > 0; })
.sort(function(a, b) { return Math.abs(a.value - gap) - Math.abs(b.value - gap); })
.slice(0, 3);
}
const positions = new Set(sA.concat(sB).map(function(p) { return p.position; }).filter(Boolean));
const waiverContext = {};
positions.forEach(function(pos) { waiverContext[pos] = (waiverByPos[pos] || []).slice(0, 3); });
setResult({ sA: sA, sB: sB, tA: tA, tB: tB, winner: winner, tier: tier, icon: icon, gap: gap, gapPct: gapPct, addOns: addOns, waiverContext: waiverContext });
setVerdict(null); setVE(false);
}

async function getVerdict() {
if (!result) return;
setVL(true); setVE(false); setVerdict(null);
const sys = "You are the wind-up merchant of the Borehamwood Plancy League. Quick funny verdict in 2-4 sentences. Bone-dry British banter. Use real names not team names. Numbers are computed — do NOT recalculate.";
const margin = result.winner === 'even' ? 'Even.' : ('Side ' + result.winner + ' wins by ' + result.gap.toFixed(0) + ' (' + result.gapPct.toFixed(0) + '%)');
const addOnStr = result.addOns.length ? ' Suggested add-on: ' + result.addOns.map(function(a) { return a.name; }).join(' or ') + '.' : '';
const sAStr = result.sA.map(function(p) { return p.officialName + '(' + p.value + ')'; }).join(', ');
const sBStr = result.sB.map(function(p) { return p.officialName + '(' + p.value + ')'; }).join(', ');
const msg = 'Trade:\nSide A (' + teamLabel(teamA) + ') gives: ' + sAStr + ' — Total ' + result.tA + '\nSide B (' + teamLabel(teamB) + ') gives: ' + sBStr + ' — Total ' + result.tB + '\nVerdict: ' + result.tier + '. ' + margin + addOnStr;
try {
const r = await claudeCall([{ role: 'user', content: msg }], sys);
setVerdict(r);
} catch (e) { setVE(true); }
finally { setVL(false); }
}

const teamOpts = teamKeys.map(function(k) { return <option key={k} value={k}>{teamLabel(k)}</option>; });
const winA = result && result.winner === 'A';
const winB = result && result.winner === 'B';
const spin = { width: 14, height: 14, border: '2px solid ' + T.amber, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'tg-spin 0.8s linear infinite' };

return (
<div style={{ background: T.bg, color: T.text, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
<div style={{ borderBottom: '1px solid ' + T.border, background: T.panel }}>
<button onClick={function() { setShowWaiver(function(v) { return !v; }); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', background: 'none', border: 'none', color: T.dim, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
<span>Waiver Wire <span style={{ color: T.faint, fontSize: 11, fontWeight: 400 }}>(top available by position)</span></span>
<span style={{ fontSize: 10, color: T.faint }}>{showWaiver ? '▲ hide' : '▼ show'}</span>
</button>
{showWaiver && (
<div style={{ padding: '0 13px 13px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
{['QB', 'RB', 'WR', 'TE'].map(function(pos) {
const players = waiverByPos[pos] || [];
if (!players.length) return null;
return (
<div key={pos} style={{ background: T.raised, border: '1px solid ' + T.border, borderTop: '2px solid ' + (POS_COLORS[pos] || T.border), borderRadius: '3px 3px 9px 9px', padding: '9px 11px', minWidth: 120, flex: '1 1 120px', maxWidth: 170 }}>
<div style={{ color: POS_COLORS[pos] || T.dim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{pos}</div>
{players.map(function(p, i) {
return (
<div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', borderBottom: i < players.length - 1 ? '1px solid ' + T.border : 'none' }}>
<span style={{ color: T.text }}>{p.player.name}</span>
<span style={{ color: T.dim, fontSize: 11.5 }}>{p.redraftValue.toLocaleString()}</span>
</div>
);
})}
</div>
);
})}
</div>
)}
</div>

<div style={{ padding: 15 }}>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
{[{ side: 'A', team: teamA, setTeam: setTeamA, text: sideAText, setText: setSideAText, accent: T.blue },
{ side: 'B', team: teamB, setTeam: setTeamB, text: sideBText, setText: setSideBText, accent: T.indigo }].map(function(cfg) {
return (
<div key={cfg.side} style={{ background: T.panel, border: '1px solid ' + T.border, borderTop: '3px solid ' + cfg.accent, borderRadius: '4px 4px 12px 12px', padding: 13, flex: 1, minWidth: 0 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
<span style={{ background: cfg.accent, color: '#fff', fontWeight: 700, fontSize: 12, width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cfg.side}</span>
<span style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{'Side ' + cfg.side + ' gives up'}</span>
</div>
<select value={cfg.team} onChange={function(e) { cfg.setTeam(e.target.value); }} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: 10, width: '100%', marginBottom: 8, fontSize: 16 }}>
{teamOpts}
</select>
<textarea value={cfg.text} onChange={function(e) { cfg.setText(e.target.value); }} placeholder={"One player per line\ne.g. Ja'Marr Chase"} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: 11, width: '100%', minHeight: 92, fontSize: 16, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
</div>
);
})}
</div>

<button onClick={gradeTrade} disabled={!sideAText.trim() && !sideBText.trim()} style={{ width: '100%', background: (!sideAText.trim() && !sideBText.trim()) ? T.raised : 'linear-gradient(135deg,' + T.indigo + ',' + T.indigoDk + ')', color: (!sideAText.trim() && !sideBText.trim()) ? T.faint : '#fff', border: 'none', borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', marginTop: 12 }}>
Grade This Trade
</button>

{result && (
<div style={{ marginTop: 16 }}>
<div style={{ background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
<div style={{ display: 'flex' }}>
<div style={{ flex: 1, padding: '15px 10px', textAlign: 'center', background: winA ? 'rgba(16,185,129,0.08)' : 'transparent', borderRight: '1px solid ' + T.border }}>
<div style={{ fontSize: 10, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>SIDE A</div>
<div style={{ fontWeight: 700, fontSize: 32, color: winA ? T.green : T.text, lineHeight: 1 }}>{result.tA.toLocaleString()}</div>
{winA && <div style={{ fontSize: 10, color: T.green, fontWeight: 700, marginTop: 3, textTransform: 'uppercase' }}>▲ WINS</div>}
</div>
<div style={{ flex: 1, padding: '15px 10px', textAlign: 'center', background: winB ? 'rgba(16,185,129,0.08)' : 'transparent', borderLeft: '1px solid ' + T.border }}>
<div style={{ fontSize: 10, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>SIDE B</div>
<div style={{ fontWeight: 700, fontSize: 32, color: winB ? T.green : T.text, lineHeight: 1 }}>{result.tB.toLocaleString()}</div>
{winB && <div style={{ fontSize: 10, color: T.green, fontWeight: 700, marginTop: 3, textTransform: 'uppercase' }}>▲ WINS</div>}
</div>
</div>
<div style={{ textAlign: 'center', padding: '10px 0', borderTop: '1px solid ' + T.border, background: T.panel2 }}>
<span style={{ fontSize: 20 }}>{result.icon}</span>
<span style={{ fontWeight: 800, fontSize: 12.5, color: T.amber, letterSpacing: '0.04em', marginLeft: 8 }}>{result.tier}</span>
{result.winner !== 'even' && <span style={{ fontSize: 10.5, color: T.dim, marginLeft: 8 }}>{'by ' + result.gap.toLocaleString() + ' (' + result.gapPct.toFixed(0) + '%)'}</span>}
</div>
</div>

<div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, marginBottom: 12 }}>
{[{ side: 'A', players: result.sA, team: teamA, accent: T.blue }, { side: 'B', players: result.sB, team: teamB, accent: T.indigo }].map(function(cfg) {
return (
<div key={cfg.side} style={{ flex: 1, minWidth: 140, background: T.panel, border: '1px solid ' + T.border, borderRadius: 11, padding: '11px 13px' }}>
<div style={{ color: cfg.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{teamLabel(cfg.team) + ' gives'}</div>
{cfg.players.length ? cfg.players.map(function(p, i) {
return (
<div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid ' + T.border, fontSize: 13.5 }}>
<span style={{ color: p.found ? T.text : T.amber }}>{p.found ? p.officialName : p.input + ' ⚠'}</span>
<span style={{ color: p.found ? T.dim : T.amber, fontSize: 12.5, marginLeft: 8, fontWeight: 700 }}>{p.found ? p.value.toLocaleString() : 'no match'}</span>
</div>
);
}) : <div style={{ color: T.faint, fontSize: 12 }}>—</div>}
</div>
);
})}
</div>

{result.winner !== 'even' && result.addOns.length > 0 && (
<div style={{ background: T.panel, border: '1px solid ' + T.border, borderLeft: '3px solid ' + T.amber, borderRadius: '4px 11px 11px 4px', padding: '11px 13px', marginBottom: 12 }}>
<div style={{ color: T.amber, fontSize: 11, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'To balance, ' + teamLabel(result.winner === 'A' ? teamA : teamB) + ' could add'}</div>
{result.addOns.map(function(a, i) {
return <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0' }}><span>{a.name}</span><span style={{ color: T.dim }}>{a.value.toLocaleString()}</span></div>;
})}
</div>
)}

{Object.keys(result.waiverContext).length > 0 && (
<div style={{ background: T.panel, border: '1px solid ' + T.border, borderRadius: 11, padding: '11px 13px', marginBottom: 12 }}>
<div style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Waiver alternatives for traded positions</div>
{Object.keys(result.waiverContext).map(function(pos) {
const players = result.waiverContext[pos];
return (
<div key={pos} style={{ marginBottom: 8 }}>
<span style={{ color: POS_COLORS[pos] || T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{pos + ': '}</span>
{players.map(function(p, i) {
return <span key={i} style={{ fontSize: 13, color: T.text }}>{p.player.name + ' '}<span style={{ color: T.dim, fontSize: 12 }}>{'(' + p.redraftValue.toLocaleString() + ')'}</span>{i < players.length - 1 ? <span style={{ color: T.faint }}> · </span> : ''}</span>;
})}
</div>
);
})}
</div>
)}

{ai !== 'off' && <button onClick={getVerdict} disabled={vLoading} style={{ width: '100%', background: T.panel, border: '1px solid ' + T.amber, color: T.amber, borderRadius: 11, padding: '13px 20px', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: vLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: vLoading ? 0.7 : 1 }}>
{vLoading ? <span style={spin} /> : "🎙"} The Commissioner's Verdict
</button>}

{(verdict || vError) && (
<div style={{ background: T.panel2, border: '1px solid ' + (vError ? T.amber : T.border), borderLeft: '3px solid ' + (vError ? T.amber : T.indigo), borderRadius: '4px 12px 12px 4px', padding: 14, color: vError ? T.amber : T.text, marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
{vError ? 'The Commissioner is unavailable — give it another go.' : <MarkdownMessage text={verdict} />}
</div>
)}
</div>
)}
</div>
</div>
);
}









const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const LIVE_USERNAME = 'AlastairL';
const NFL_WEEKS = Array.from({ length: 18 }, function(_, i) { return i + 1; });


function buildPlayerIndex(rostersData) {
const idx = {};
Object.values(rostersData || {}).forEach(function(arr) {
(arr || []).forEach(function(p) { if (p && p.id != null) idx[String(p.id)] = { name: p.name, pos: p.pos }; });
});
return idx;
}

async function sget(url) {
const r = await fetch(url);
if (!r.ok) throw new Error('Sleeper ' + r.status);
return r.json();
}

function fmtPts(n) { return (Math.round((n || 0) * 100) / 100).toFixed(2); }


function LiveTab(props) {
const { rostersData } = props;
const playerIdx = useMemo(function() { return buildPlayerIndex(rostersData); }, [rostersData]);

const [base, setBase] = useState(null);     // { leagueId, leagueName, season, slots, teamByRoster, myRosterId, liveWeek }
const [baseErr, setBaseErr] = useState(false);
const [week, setWeek] = useState(null);
const [pairs, setPairs] = useState(null);   // [{ mid, entries:[entry,...] }]
const [loadingM, setLoadingM] = useState(false);
const [matchErr, setMatchErr] = useState(false);
const [viewMid, setViewMid] = useState(null);
const [revealed, setRevealed] = useState({}); // `${rosterId}:${slotIdx}` -> true

useEffect(function() {
if (document.getElementById('live-spin')) return;
const s = document.createElement('style');
s.id = 'live-spin';
s.textContent = '@keyframes live-spin{to{transform:rotate(360deg)}}';
document.head.appendChild(s);
}, []);


useEffect(function() {
let cancelled = false;
(async function() {
try {
const state = await sget(SLEEPER_BASE + '/state/nfl');
const user = await sget(SLEEPER_BASE + '/user/' + LIVE_USERNAME);
let league = null, usedSeason = null;
const years = [String(state.season), String(+state.season - 1), String(+state.season - 2)];
for (let i = 0; i < years.length; i++) {
const leagues = await sget(SLEEPER_BASE + '/user/' + user.user_id + '/leagues/nfl/' + years[i]);
const lg = (leagues || []).find(function(l) { return /borehamwood|plancy/i.test(l.name); });
if (lg) { league = lg; usedSeason = years[i]; break; }
}
if (!league) throw new Error('No Plancy league found');
const [users, rosters] = await Promise.all([
sget(SLEEPER_BASE + '/league/' + league.league_id + '/users'),
sget(SLEEPER_BASE + '/league/' + league.league_id + '/rosters'),
]);
const userByUid = {};
users.forEach(function(u) { userByUid[u.user_id] = { handle: u.display_name, team: (u.metadata && u.metadata.team_name) || u.display_name }; });
const teamByRoster = {};
let myRosterId = null;
rosters.forEach(function(r) {
const u = userByUid[r.owner_id] || {};
teamByRoster[r.roster_id] = {
handle: u.handle || null,
name: u.handle ? displayName(u.handle) : ('Roster ' + r.roster_id),
team: u.team || '',
isMe: r.owner_id === user.user_id,
};
if (r.owner_id === user.user_id) myRosterId = r.roster_id;
});
const slots = (league.roster_positions || []).filter(function(p) { return p !== 'BN'; });
const isLive = String(state.season) === String(usedSeason) && state.week > 0;
if (cancelled) return;
setBase({ leagueId: league.league_id, leagueName: league.name, season: usedSeason, slots: slots, teamByRoster: teamByRoster, myRosterId: myRosterId, liveWeek: isLive ? state.week : null });
setWeek(isLive ? state.week : 1);
} catch (e) { if (!cancelled) setBaseErr(true); }
})();
return function() { cancelled = true; };
}, []);


function loadMatchups(b, wk) {
if (!b || !wk) return;
setLoadingM(true); setMatchErr(false);
sget(SLEEPER_BASE + '/league/' + b.leagueId + '/matchups/' + wk).then(function(raw) {
const byMid = {};
(raw || []).forEach(function(e) { if (e.matchup_id == null) return; (byMid[e.matchup_id] = byMid[e.matchup_id] || []).push(e); });
const list = Object.keys(byMid).map(function(mid) { return { mid: mid, entries: byMid[mid] }; });
let mine = null;
list.forEach(function(p) { if (p.entries.some(function(e) { return e.roster_id === b.myRosterId; })) mine = p.mid; });
setPairs(list);
setViewMid(mine || (list[0] && list[0].mid) || null);
setRevealed({});
setLoadingM(false);
}).catch(function() { setMatchErr(true); setLoadingM(false); });
}

useEffect(function() { if (base && week) loadMatchups(base, week); }, [base, week]);

function startersOf(entry, b) {
return b.slots.map(function(slot, i) {
const pid = entry.starters && entry.starters[i];
const empty = !pid || pid === '0';
const info = !empty ? playerIdx[String(pid)] : null;
const pts = (entry.starters_points && entry.starters_points[i] != null)
? entry.starters_points[i]
: (entry.players_points && entry.players_points[pid]) || 0;
return { slot: slot, i: i, pid: pid, empty: empty, name: info ? info.name : (empty ? null : 'Player ' + pid), pos: info ? info.pos : null, pts: pts };
});
}

function revealedTotal(entry, rows) {
return rows.reduce(function(s, row) { return revealed[entry.roster_id + ':' + row.i] && !row.empty ? s + row.pts : s; }, 0);
}
function revealedCount(entry, rows) {
return rows.reduce(function(n, row) { return revealed[entry.roster_id + ':' + row.i] && !row.empty ? n + 1 : n; }, 0);
}

function toggle(key) {
setRevealed(function(r) { const n = Object.assign({}, r); if (n[key]) delete n[key]; else n[key] = true; return n; });
}
function setAll(entry, rows, on) {
setRevealed(function(r) {
const n = Object.assign({}, r);
rows.forEach(function(row) { if (row.empty) return; const k = entry.roster_id + ':' + row.i; if (on) n[k] = true; else delete n[k]; });
return n;
});
}

const spin = { width: 16, height: 16, border: '2px solid ' + T.amber, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'live-spin 0.8s linear infinite' };


if (baseErr) {
return (
<div style={{ background: T.bg, color: T.text, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
<div>
<div style={{ fontSize: 30, marginBottom: 10 }}>📡</div>
<div style={{ color: T.amber, fontWeight: 700, marginBottom: 6 }}>Live scores unavailable here</div>
<div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6, maxWidth: 340 }}>This artifact runs in a sandbox that blocks live calls to the Sleeper API, so real-time scores can't load. Stats, Banter and Trades still work — they use the built-in league data.</div>
</div>
</div>
);
}
if (!base) {
return (
<div style={{ background: T.bg, color: T.text, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11 }}>
<span style={spin} /><span style={{ color: T.dim, fontSize: 14 }}>Connecting to Sleeper…</span>
</div>
);
}

const pair = (pairs || []).find(function(p) { return p.mid === viewMid; });
let entries = pair ? pair.entries.slice() : [];
entries.sort(function(a, b) { return (a.roster_id === base.myRosterId ? -1 : 0) - (b.roster_id === base.myRosterId ? -1 : 0); });

function teamLabelOf(rid) { const t = base.teamByRoster[rid] || {}; return t.team ? (t.name + ' · ' + t.team) : t.name; }

return (
<div style={{ background: T.bg, color: T.text, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
{/* controls */}
<div style={{ position: 'sticky', top: 0, zIndex: 2, background: T.panel, borderBottom: '1px solid ' + T.border, padding: '11px 14px' }}>
<div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
<div style={{ flex: '0 0 auto' }}>
<div style={{ fontSize: 9.5, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontWeight: 700 }}>Week</div>
<select value={week} onChange={function(e) { setWeek(+e.target.value); }} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: '8px 10px', fontSize: 15 }}>
{NFL_WEEKS.map(function(w) { return <option key={w} value={w}>{'Week ' + w + (w === base.liveWeek ? ' • now' : '')}</option>; })}
</select>
</div>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontSize: 9.5, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontWeight: 700 }}>Matchup</div>
<select value={viewMid || ''} onChange={function(e) { setViewMid(e.target.value); }} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: '8px 10px', fontSize: 15, width: '100%' }}>
{(pairs || []).map(function(p) {
const nm = p.entries.map(function(e) { const t = base.teamByRoster[e.roster_id] || {}; return t.name + (t.isMe ? ' (you)' : ''); }).join('  vs  ');
return <option key={p.mid} value={p.mid}>{nm}</option>;
})}
</select>
</div>
<button onClick={function() { loadMatchups(base, week); }} title="Refresh live points" style={{ flex: '0 0 auto', alignSelf: 'flex-end', background: T.raised, border: '1px solid ' + T.borderHi, color: T.dim, borderRadius: 8, padding: '8px 11px', fontSize: 14, cursor: 'pointer' }}>↻</button>
</div>
<div style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.45 }}>
Tap a player whose game you've <em>already watched</em> to reveal their score. Nothing is shown otherwise — unwatched games stay unspoiled.
</div>
</div>

{loadingM && (
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, padding: 40 }}>
<span style={spin} /><span style={{ color: T.dim, fontSize: 14 }}>{'Loading week ' + week + '…'}</span>
</div>
)}

{!loadingM && matchErr && (
<div style={{ padding: 30, textAlign: 'center', color: T.amber, fontSize: 14 }}>Couldn't load this week's matchups — try ↻.</div>
)}

{!loadingM && !matchErr && (!pairs || !pairs.length) && (
<div style={{ padding: 30, textAlign: 'center', color: T.dim, fontSize: 14 }}>{'No matchups posted for week ' + week + ' yet.'}</div>
)}

{!loadingM && !matchErr && pair && (
<div style={{ padding: 14 }}>
{/* running scoreboard — revealed totals only */}
<div style={{ display: 'flex', background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
{entries.map(function(entry, idx) {
const rows = startersOf(entry, base);
const tot = revealedTotal(entry, rows);
const cnt = revealedCount(entry, rows);
const playable = rows.filter(function(r) { return !r.empty; }).length;
const t = base.teamByRoster[entry.roster_id] || {};
return (
<div key={entry.roster_id} style={{ flex: 1, padding: '13px 10px', textAlign: 'center', borderRight: idx === 0 ? '1px solid ' + T.border : 'none', background: t.isMe ? 'rgba(99,102,241,0.07)' : 'transparent' }}>
<div style={{ fontSize: 10.5, color: t.isMe ? T.indigo : T.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}{t.isMe ? ' (you)' : ''}</div>
<div style={{ fontWeight: 800, fontSize: 30, color: cnt ? T.text : T.faint, lineHeight: 1 }}>{fmtPts(tot)}</div>
<div style={{ fontSize: 10.5, color: T.dim, marginTop: 4 }}>{cnt + '/' + playable + ' revealed'}</div>
</div>
);
})}
</div>

{/* per-team starter lists */}
{entries.map(function(entry) {
const rows = startersOf(entry, base);
const t = base.teamByRoster[entry.roster_id] || {};
const cnt = revealedCount(entry, rows);
const playable = rows.filter(function(r) { return !r.empty; }).length;
const allOn = cnt === playable && playable > 0;
return (
<div key={entry.roster_id} style={{ background: T.panel, border: '1px solid ' + T.border, borderTop: '3px solid ' + (t.isMe ? T.indigo : T.border), borderRadius: '4px 4px 12px 12px', padding: '12px 13px', marginBottom: 12 }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
<div style={{ minWidth: 0 }}>
<div style={{ fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teamLabelOf(entry.roster_id)}{t.isMe ? <span style={{ color: T.indigo, fontSize: 10.5, fontWeight: 800, marginLeft: 6 }}>YOU</span> : null}</div>
</div>
<button onClick={function() { setAll(entry, rows, !allOn); }} style={{ flex: '0 0 auto', background: 'none', border: '1px solid ' + T.borderHi, color: T.dim, borderRadius: 7, padding: '5px 9px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>{allOn ? 'Hide all' : 'Reveal all'}</button>
</div>
{rows.map(function(row) {
const key = entry.roster_id + ':' + row.i;
const isOpen = !!revealed[key];
const tint = POS_COLORS[row.slot] || T.dim;
if (row.empty) {
return (
<div key={row.i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid ' + T.border }}>
<span style={{ flex: '0 0 38px', fontSize: 10, fontWeight: 800, color: T.faint, textTransform: 'uppercase' }}>{row.slot}</span>
<span style={{ flex: 1, color: T.faint, fontSize: 13, fontStyle: 'italic' }}>Empty</span>
</div>
);
}
return (
<div key={row.i} onClick={function() { toggle(key); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid ' + T.border, cursor: 'pointer' }}>
<span style={{ flex: '0 0 38px', fontSize: 10, fontWeight: 800, color: tint, textTransform: 'uppercase' }}>{row.slot}</span>
<span style={{ flex: 1, minWidth: 0, color: isOpen ? T.text : T.dim, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
{row.name}{row.pos ? <span style={{ color: T.faint, fontSize: 11, marginLeft: 6 }}>{row.pos}</span> : null}
</span>
{isOpen
? <span style={{ flex: '0 0 auto', fontWeight: 800, fontSize: 14.5, color: row.pts > 0 ? T.green : T.faint, minWidth: 48, textAlign: 'right' }}>{fmtPts(row.pts)}</span>
: <span style={{ flex: '0 0 auto', fontSize: 10.5, fontWeight: 700, color: T.indigo, border: '1px solid ' + T.borderHi, borderRadius: 20, padding: '4px 11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reveal</span>}
</div>
);
})}
</div>
);
})}
</div>
)}
</div>
);
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;}
body{background:#090d18;-webkit-font-smoothing:antialiased;overflow:hidden;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-thumb{background:#24344e;border-radius:3px;}
@keyframes ld-pulse{0%,80%,100%{opacity:.2;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}
.ld{display:inline-block;width:7px;height:7px;background:#6366f1;border-radius:50%;margin:0 2px;animation:ld-pulse 1.4s infinite ease-in-out both;}
.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}
.md-table{border-collapse:collapse;width:100%;font-size:13px;background:#0f1625;border-radius:10px;overflow:hidden;}
.md-table th{text-align:left;padding:9px 12px;background:#090d18;color:#f59e0b;font-weight:800;text-transform:uppercase;font-size:10.5px;letter-spacing:0.07em;border-bottom:1px solid #24344e;white-space:nowrap;}
.md-table td{padding:8px 12px;border-bottom:1px solid #1a2640;color:#e8f1ff;}
.md-table td:first-child{font-weight:600;}
.md-table tr:last-child td{border-bottom:none;}
.md-table tbody tr:nth-child(even) td{background:rgba(99,102,241,0.04);}
.chip{background:#1a2640;border:1px solid #304260;color:#e8f1ff;border-radius:20px;padding:8px 15px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:border-color .15s,background .15s;}
.chip:hover:not(:disabled){border-color:#6366f1;background:#232e50;}
.chip:disabled{opacity:0.4;cursor:default;}
.send-btn{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:12px;padding:0 18px;font-weight:700;font-size:12.5px;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;align-self:stretch;flex-shrink:0;}
.send-btn:disabled{background:#1a2640;color:#3d5470;cursor:default;}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;background:transparent;border:none;cursor:pointer;position:relative;}
.nav-btn .nav-ico{font-size:20px;}
.nav-btn:not(.active) .nav-ico{filter:grayscale(0.7) opacity(0.5);}
.nav-lab{font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;}
.plaincy-app{display:flex;flex-direction:column;height:var(--app-h,100dvh);width:100%;max-width:560px;margin:0 auto;background:#090d18;overflow:hidden;}
@media(min-width:640px){.plaincy-app{max-width:780px;}}
.rt-wrap{overflow-x:auto;margin:8px -4px 0;}
.tw-card{background:#0f1625;border:1px solid #24344e;border-radius:12px;padding:10px 12px;font-size:13px;color:#e8f1ff;}
.tw-head{display:flex;align-items:center;gap:8px;justify-content:space-between;}
.tw-toggle{background:none;border:none;color:#f59e0b;font-weight:800;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;padding:0;text-align:left;}
.tw-rb{background:#1a2640;border:1px solid #304260;color:#e8f1ff;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;}
.tw-body{margin-top:8px;display:flex;flex-direction:column;gap:4px;}
.tw-game{line-height:1.5;}
.tw-k{color:#6e8db0;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin-right:4px;}
.tw-dim{color:#6e8db0;}
.tw-table{margin-top:6px;}
.tw-table td,.tw-table th{padding:5px 8px;}
.rb-panel{position:absolute;inset:0;z-index:5;background:#090d18;display:flex;flex-direction:column;}
.rb-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #24344e;background:#0f1625;color:#e8f1ff;}
.rb-head select{background:#1a2640;color:#e8f1ff;border:1px solid #304260;border-radius:8px;padding:5px 6px;font-size:13px;max-width:44%;}
.rb-list{overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}
.rb-item{background:#0f1625;border:1px solid #24344e;border-radius:10px;padding:9px 11px;}
.rb-label{color:#f59e0b;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;}
.rb-row{font-size:13px;color:#e8f1ff;line-height:1.5;overflow-wrap:anywhere;}
.rt td,.rt th{white-space:nowrap;}
.rt-more{font-size:11px;color:#6e8db0;margin-top:4px;}
.res{display:inline-block;min-width:18px;text-align:center;border-radius:5px;padding:1px 5px;font-size:11px;font-weight:800;}
.res-W{background:rgba(16,185,129,0.18);color:#10b981;}
.res-L{background:rgba(248,113,113,0.18);color:#f87171;}
.res-T,.res-x{background:rgba(110,141,176,0.18);color:#6e8db0;}
button{font-family:inherit;}
textarea,select{font-family:inherit;font-size:16px;}
textarea:focus,select:focus{outline:none;}
select option{background:#141e32;color:#e8f1ff;}
`;

const TABS = [
{ id: 'stats', icon: '📊', label: 'STATS' },
{ id: 'banter', icon: '🎙', label: 'BANTER' },
{ id: 'trade', icon: '⚖️', label: 'TRADES' },
{ id: 'live', icon: '🏈', label: 'SCORES' },
];

export default function App() {
const [tab, setTab] = useState('stats');
const { history, rosters, trades, alltime, transactions, players } = useLeagueData();

const facts = useMemo(function() { return buildFactTable(history, canonical); }, [history]);
const { keyboardOpen } = useViewport();
const lore = useLore(tab === 'banter');

useEffect(function() {
if (document.getElementById('plaincy-css')) return;
const el = document.createElement('style');
el.id = 'plaincy-css';
el.textContent = CSS;
document.head.appendChild(el);
}, []);

return (
<div className="plaincy-app">
<div style={{ height: 3, background: 'linear-gradient(90deg,#6366f1 0%,#f59e0b 60%,#6366f1 100%)', flexShrink: 0 }} />
<div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', background: T.panel, borderBottom: '1px solid ' + T.border, flexShrink: 0 }}>
<div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff', flexShrink: 0 }}>P</div>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 900, fontSize: 22, color: T.text, letterSpacing: '-0.5px', lineHeight: 1 }}>Pl<span style={{ color: T.indigo }}>AI</span>ncy</div>
<div style={{ fontSize: 11, color: T.dim, marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Borehamwood Plancy League</div>
</div>
<div data-testid="freshness" title={'Data built ' + fmtBuiltAt(BUILT_AT) + ' (' + BUILT_AT + ')'} style={{ fontSize: 10.5, color: T.dim, border: '1px solid ' + T.border, borderRadius: 6, padding: '4px 9px', flexShrink: 0, maxWidth: '44%', fontWeight: 600, textAlign: 'right', lineHeight: 1.35 }}>
{badgeText(facts) || fmtBuiltAt(BUILT_AT)}
</div>
</div>

<div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
{/* Stats / Banter / Trade stay MOUNTED (toggle display) so chat history and
trade inputs survive tab switches — storage APIs throw in the artifact
sandbox, so keep-alive is the only option. Live mounts on demand: it
fetches Sleeper on mount and is spoiler-safe, so a fresh mount is correct. */}
<div style={{ display: tab === 'stats' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
<StatsTab historyData={history} facts={facts} alltimeData={alltime} transactionsData={transactions} playersData={players} loreMaster={lore.master} />
</div>
<div style={{ display: tab === 'banter' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
<BanterTab historyData={history} facts={facts} alltimeData={alltime} lore={lore} />
</div>
<div style={{ display: tab === 'trade' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
<TradeGrader rostersData={rosters} tradeValues={trades} />
</div>
{tab === 'live' && <LiveTab rostersData={rosters} />}
</div>

{!keyboardOpen && (
<nav style={{ display: 'flex', background: T.panel, borderTop: '1px solid ' + T.border, flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
{TABS.map(function(t) {
const active = tab === t.id;
return (
<button key={t.id} onClick={function() { setTab(t.id); }} className={'nav-btn' + (active ? ' active' : '')} style={{ color: active ? T.text : T.faint }}>
{active && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 36, height: 3, borderRadius: '0 0 4px 4px', background: T.indigo }} />}
<span className="nav-ico">{t.icon}</span>
<span className="nav-lab">{t.label}</span>
</button>
);
})}
</nav>
)}
</div>
);
}
