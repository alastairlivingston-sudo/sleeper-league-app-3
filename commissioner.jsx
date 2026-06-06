const { useState, useEffect, useRef, useMemo } = React;

// ── Name / alias helpers ──────────────────────────────────────────────────────
const ALIAS = { allyl900: "AlastairL" };
function canonical(handle) {
  const c = String(handle || "").replace(/^@/, "").trim();
  return ALIAS[c] || c;
}
const NAMES = { AlastairL:"Alastair", dpol:"Dan", saulgoat:"Saul", sanfbe:"Benjy", joshjr11:"Josh", drjkay:"Jamie", GSac:"Gideon", benjlev:"Benjy" };
const DISAMBIG = { benjlev:"Lev", sanfbe:"Sanford" };
function displayName(h) { const c = canonical(h); return NAMES[c] || c; }
function distinctName(h) { const c = canonical(h); return DISAMBIG[c] || NAMES[c] || c; }
function teamLabel(k) {
  const m = String(k).match(/\(@([^)]+)\)/);
  const handle = m ? m[1] : null;
  const team = String(k).replace(/\s*\(@[^)]+\)\s*$/, "").trim();
  const nm = handle ? displayName(handle) : null;
  return (nm && nm !== handle) ? nm + " · " + team : (team || k);
}

const BUILT_AT = "2026-06-05T15:09:08.750Z";
function fmtBuiltAt(iso) {
  try {
    const d = new Date(iso);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return "Updated " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  } catch(e) { return "Updated recently"; }
}

// ── Colour tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:"#090d18", panel:"#0f1625", panel2:"#141e32", raised:"#1a2640",
  border:"#24344e", borderHi:"#304260", text:"#e8f1ff", dim:"#6e8db0",
  faint:"#3d5470", indigo:"#6366f1", indigoDk:"#4f46e5",
  green:"#10b981", amber:"#f59e0b", blue:"#60a5fa", red:"#f87171",
};

// ── Inlined data ──────────────────────────────────────────────────────────────
const HISTORY_DATA = {"seasons":[{"season":"2023","name":"Borehamwood","champion":"saulgoat","standings":[{"manager":"drjkay","team":"Obi-Quan Kenobi","wins":10,"losses":4,"pf":1805.28},{"manager":"joshjr11","team":"Denver Brochos","wins":10,"losses":4,"pf":1795.48},{"manager":"saulgoat","team":"Saul","wins":7,"losses":7,"pf":1855.7},{"manager":"sanfbe","team":"sanfbe","wins":7,"losses":7,"pf":1726.64},{"manager":"allyl900","team":"allyl900","wins":6,"losses":8,"pf":1756.06},{"manager":"dpol","team":"dpol","wins":6,"losses":8,"pf":1718.68},{"manager":"GSac","team":"GSac","wins":6,"losses":8,"pf":1582.04},{"manager":"benjlev","team":"benjlev","wins":4,"losses":10,"pf":1571.92}],"games":[{"week":1,"playoff":false,"a":"dpol","b":"allyl900","pa":69,"pb":120.54},{"week":1,"playoff":false,"a":"benjlev","b":"saulgoat","pa":116.34,"pb":146.08},{"week":1,"playoff":false,"a":"joshjr11","b":"sanfbe","pa":97.86,"pb":92.34},{"week":1,"playoff":false,"a":"drjkay","b":"GSac","pa":138.16,"pb":103.54},{"week":2,"playoff":false,"a":"benjlev","b":"sanfbe","pa":144.1,"pb":110.76},{"week":2,"playoff":false,"a":"dpol","b":"saulgoat","pa":111.02,"pb":82.48},{"week":2,"playoff":false,"a":"allyl900","b":"GSac","pa":105.66,"pb":110.14},{"week":2,"playoff":false,"a":"joshjr11","b":"drjkay","pa":179.48,"pb":138},{"week":3,"playoff":false,"a":"dpol","b":"sanfbe","pa":173.18,"pb":151.32},{"week":3,"playoff":false,"a":"drjkay","b":"allyl900","pa":136.46,"pb":147.26},{"week":3,"playoff":false,"a":"saulgoat","b":"GSac","pa":125.18,"pb":111.26},{"week":3,"playoff":false,"a":"joshjr11","b":"benjlev","pa":109.28,"pb":130.88},{"week":4,"playoff":false,"a":"benjlev","b":"drjkay","pa":105.6,"pb":132.88},{"week":4,"playoff":false,"a":"joshjr11","b":"allyl900","pa":141.94,"pb":113.88},{"week":4,"playoff":false,"a":"dpol","b":"GSac","pa":99.36,"pb":123.6},{"week":4,"playoff":false,"a":"saulgoat","b":"sanfbe","pa":97.56,"pb":168.6},{"week":5,"playoff":false,"a":"joshjr11","b":"dpol","pa":54.84,"pb":159.32},{"week":5,"playoff":false,"a":"saulgoat","b":"drjkay","pa":189.76,"pb":76},{"week":5,"playoff":false,"a":"GSac","b":"sanfbe","pa":101.78,"pb":130.36},{"week":5,"playoff":false,"a":"benjlev","b":"allyl900","pa":89.84,"pb":113.32},{"week":6,"playoff":false,"a":"benjlev","b":"GSac","pa":130.94,"pb":102.12},{"week":6,"playoff":false,"a":"dpol","b":"drjkay","pa":120.3,"pb":128.18},{"week":6,"playoff":false,"a":"allyl900","b":"sanfbe","pa":102.98,"pb":114.96},{"week":6,"playoff":false,"a":"joshjr11","b":"saulgoat","pa":101.02,"pb":152.3},{"week":7,"playoff":false,"a":"saulgoat","b":"allyl900","pa":121.44,"pb":145.34},{"week":7,"playoff":false,"a":"benjlev","b":"dpol","pa":86.46,"pb":87.56},{"week":7,"playoff":false,"a":"joshjr11","b":"GSac","pa":128.98,"pb":94.18},{"week":7,"playoff":false,"a":"drjkay","b":"sanfbe","pa":132.66,"pb":94.3},{"week":8,"playoff":false,"a":"dpol","b":"sanfbe","pa":121.16,"pb":126.56},{"week":8,"playoff":false,"a":"benjlev","b":"drjkay","pa":86.6,"pb":122.92},{"week":8,"playoff":false,"a":"joshjr11","b":"saulgoat","pa":110.1,"pb":132.68},{"week":8,"playoff":false,"a":"allyl900","b":"GSac","pa":127.96,"pb":134.48},{"week":9,"playoff":false,"a":"benjlev","b":"dpol","pa":117,"pb":114.18},{"week":9,"playoff":false,"a":"saulgoat","b":"GSac","pa":127.82,"pb":123.48},{"week":9,"playoff":false,"a":"allyl900","b":"sanfbe","pa":92.52,"pb":100.12},{"week":9,"playoff":false,"a":"joshjr11","b":"drjkay","pa":120.66,"pb":89.54},{"week":10,"playoff":false,"a":"saulgoat","b":"allyl900","pa":134.18,"pb":142.86},{"week":10,"playoff":false,"a":"dpol","b":"drjkay","pa":131.34,"pb":146.02},{"week":10,"playoff":false,"a":"GSac","b":"sanfbe","pa":135.02,"pb":69.88},{"week":10,"playoff":false,"a":"joshjr11","b":"benjlev","pa":138.46,"pb":113.82},{"week":11,"playoff":false,"a":"benjlev","b":"allyl900","pa":78.68,"pb":130},{"week":11,"playoff":false,"a":"joshjr11","b":"dpol","pa":105.56,"pb":122.74},{"week":11,"playoff":false,"a":"saulgoat","b":"sanfbe","pa":116.54,"pb":126.7},{"week":11,"playoff":false,"a":"drjkay","b":"GSac","pa":154.7,"pb":109.56},{"week":12,"playoff":false,"a":"joshjr11","b":"GSac","pa":150.74,"pb":97.08},{"week":12,"playoff":false,"a":"saulgoat","b":"drjkay","pa":132.28,"pb":132.66},{"week":12,"playoff":false,"a":"dpol","b":"allyl900","pa":144.3,"pb":129.74},{"week":12,"playoff":false,"a":"benjlev","b":"sanfbe","pa":124.52,"pb":133.86},{"week":13,"playoff":false,"a":"benjlev","b":"GSac","pa":87,"pb":98.56},{"week":13,"playoff":false,"a":"dpol","b":"saulgoat","pa":106.04,"pb":137.18},{"week":13,"playoff":false,"a":"drjkay","b":"sanfbe","pa":125.18,"pb":118.36},{"week":13,"playoff":false,"a":"joshjr11","b":"allyl900","pa":168.56,"pb":151.4},{"week":14,"playoff":false,"a":"dpol","b":"GSac","pa":109.08,"pb":106.54},{"week":14,"playoff":false,"a":"benjlev","b":"saulgoat","pa":124.64,"pb":128.12},{"week":14,"playoff":false,"a":"joshjr11","b":"sanfbe","pa":140.74,"pb":125.42},{"week":14,"playoff":false,"a":"drjkay","b":"allyl900","pa":114.94,"pb":118.2},{"week":15,"playoff":true,"a":"allyl900","b":"sanfbe","pa":130.26,"pb":81.66},{"week":15,"playoff":true,"a":"dpol","b":"saulgoat","pa":88.12,"pb":113.32},{"week":15,"playoff":true,"a":"benjlev","b":"GSac","pa":91.1,"pb":107.24},{"week":16,"playoff":true,"a":"drjkay","b":"allyl900","pa":119.24,"pb":127.12},{"week":16,"playoff":true,"a":"joshjr11","b":"saulgoat","pa":97.42,"pb":118.3},{"week":16,"playoff":true,"a":"dpol","b":"sanfbe","pa":91.44,"pb":180.98},{"week":17,"playoff":true,"a":"saulgoat","b":"allyl900","pa":163.68,"pb":85.72},{"week":17,"playoff":true,"a":"joshjr11","b":"drjkay","pa":106.5,"pb":114.56}]},{"season":"2024","name":"Borehamwood","champion":"saulgoat","standings":[{"manager":"saulgoat","wins":11,"losses":3,"pf":1903.3},{"manager":"AlastairL","wins":10,"losses":4,"pf":1968.96},{"manager":"dpol","wins":9,"losses":5,"pf":1732.22},{"manager":"joshjr11","wins":8,"losses":6,"pf":1713.02},{"manager":"GSac","wins":7,"losses":7,"pf":1758.44},{"manager":"drjkay","wins":6,"losses":8,"pf":1767.8},{"manager":"sanfbe","wins":5,"losses":9,"pf":1504.7},{"manager":"benjlev","wins":0,"losses":14,"pf":1522.48}],"games":[{"week":1,"playoff":false,"a":"dpol","b":"drjkay","pa":127.86,"pb":119.98},{"week":1,"playoff":false,"a":"saulgoat","b":"sanfbe","pa":115.76,"pb":108.38},{"week":1,"playoff":false,"a":"benjlev","b":"AlastairL","pa":108.34,"pb":138.28},{"week":1,"playoff":false,"a":"joshjr11","b":"GSac","pa":102.32,"pb":99.52},{"week":2,"playoff":false,"a":"dpol","b":"saulgoat","pa":146.7,"pb":113.1},{"week":2,"playoff":false,"a":"drjkay","b":"sanfbe","pa":153.24,"pb":88.96},{"week":2,"playoff":false,"a":"joshjr11","b":"AlastairL","pa":181.32,"pb":104.26},{"week":2,"playoff":false,"a":"benjlev","b":"GSac","pa":97.84,"pb":115.88},{"week":3,"playoff":false,"a":"dpol","b":"sanfbe","pa":92.36,"pb":126.04},{"week":3,"playoff":false,"a":"saulgoat","b":"drjkay","pa":121.02,"pb":109.58},{"week":3,"playoff":false,"a":"AlastairL","b":"GSac","pa":116.88,"pb":108.68},{"week":3,"playoff":false,"a":"joshjr11","b":"benjlev","pa":137.14,"pb":106.28},{"week":4,"playoff":false,"a":"dpol","b":"AlastairL","pa":142.08,"pb":138.32},{"week":4,"playoff":false,"a":"benjlev","b":"drjkay","pa":125,"pb":129.48},{"week":4,"playoff":false,"a":"joshjr11","b":"saulgoat","pa":109.32,"pb":118.9},{"week":4,"playoff":false,"a":"GSac","b":"sanfbe","pa":129.72,"pb":84.1},{"week":5,"playoff":false,"a":"benjlev","b":"dpol","pa":104.34,"pb":144.96},{"week":5,"playoff":false,"a":"drjkay","b":"AlastairL","pa":101.46,"pb":159.62},{"week":5,"playoff":false,"a":"saulgoat","b":"GSac","pa":137.24,"pb":159.22},{"week":5,"playoff":false,"a":"joshjr11","b":"sanfbe","pa":77.04,"pb":97.24},{"week":6,"playoff":false,"a":"joshjr11","b":"dpol","pa":109.86,"pb":118.3},{"week":6,"playoff":false,"a":"drjkay","b":"GSac","pa":160.76,"pb":135.62},{"week":6,"playoff":false,"a":"saulgoat","b":"AlastairL","pa":145.72,"pb":120.06},{"week":6,"playoff":false,"a":"benjlev","b":"sanfbe","pa":83.22,"pb":112.7},{"week":7,"playoff":false,"a":"dpol","b":"GSac","pa":98.66,"pb":145.04},{"week":7,"playoff":false,"a":"joshjr11","b":"drjkay","pa":119.66,"pb":116.9},{"week":7,"playoff":false,"a":"benjlev","b":"saulgoat","pa":109.06,"pb":119.3},{"week":7,"playoff":false,"a":"AlastairL","b":"sanfbe","pa":121.94,"pb":110.12},{"week":8,"playoff":false,"a":"dpol","b":"drjkay","pa":108.64,"pb":124.9},{"week":8,"playoff":false,"a":"saulgoat","b":"sanfbe","pa":135.44,"pb":98.42},{"week":8,"playoff":false,"a":"benjlev","b":"AlastairL","pa":104.38,"pb":163.96},{"week":8,"playoff":false,"a":"joshjr11","b":"GSac","pa":153.34,"pb":115.86},{"week":9,"playoff":false,"a":"dpol","b":"saulgoat","pa":128.4,"pb":101.22},{"week":9,"playoff":false,"a":"drjkay","b":"sanfbe","pa":142.5,"pb":144.4},{"week":9,"playoff":false,"a":"joshjr11","b":"AlastairL","pa":123,"pb":150.76},{"week":9,"playoff":false,"a":"benjlev","b":"GSac","pa":114.34,"pb":141.68},{"week":10,"playoff":false,"a":"dpol","b":"sanfbe","pa":107.4,"pb":91.5},{"week":10,"playoff":false,"a":"saulgoat","b":"drjkay","pa":134.44,"pb":130.24},{"week":10,"playoff":false,"a":"AlastairL","b":"GSac","pa":128.02,"pb":127.42},{"week":10,"playoff":false,"a":"joshjr11","b":"benjlev","pa":124.08,"pb":123.44},{"week":11,"playoff":false,"a":"dpol","b":"AlastairL","pa":86.38,"pb":178.94},{"week":11,"playoff":false,"a":"benjlev","b":"drjkay","pa":88.64,"pb":104.8},{"week":11,"playoff":false,"a":"joshjr11","b":"saulgoat","pa":150.34,"pb":196.9},{"week":11,"playoff":false,"a":"GSac","b":"sanfbe","pa":128.26,"pb":93.18},{"week":12,"playoff":false,"a":"benjlev","b":"dpol","pa":116.96,"pb":133.08},{"week":12,"playoff":false,"a":"drjkay","b":"AlastairL","pa":116.16,"pb":175.4},{"week":12,"playoff":false,"a":"saulgoat","b":"GSac","pa":162.92,"pb":106.62},{"week":12,"playoff":false,"a":"joshjr11","b":"sanfbe","pa":91.76,"pb":85.06},{"week":13,"playoff":false,"a":"joshjr11","b":"dpol","pa":112.52,"pb":170.18},{"week":13,"playoff":false,"a":"drjkay","b":"GSac","pa":152.2,"pb":110.78},{"week":13,"playoff":false,"a":"saulgoat","b":"AlastairL","pa":132.66,"pb":111.96},{"week":13,"playoff":false,"a":"benjlev","b":"sanfbe","pa":117.14,"pb":122.32},{"week":14,"playoff":false,"a":"dpol","b":"GSac","pa":127.22,"pb":134.14},{"week":14,"playoff":false,"a":"joshjr11","b":"drjkay","pa":121.32,"pb":105.6},{"week":14,"playoff":false,"a":"benjlev","b":"saulgoat","pa":123.5,"pb":168.68},{"week":14,"playoff":false,"a":"AlastairL","b":"sanfbe","pa":160.56,"pb":142.28},{"week":15,"playoff":true,"a":"joshjr11","b":"GSac","pa":130.3,"pb":127.04},{"week":15,"playoff":true,"a":"dpol","b":"drjkay","pa":189,"pb":116.68},{"week":15,"playoff":true,"a":"benjlev","b":"sanfbe","pa":119.76,"pb":137.78},{"week":16,"playoff":true,"a":"joshjr11","b":"saulgoat","pa":94.24,"pb":124.94},{"week":16,"playoff":true,"a":"dpol","b":"AlastairL","pa":141.88,"pb":176.68},{"week":16,"playoff":true,"a":"drjkay","b":"GSac","pa":192.72,"pb":111.9},{"week":17,"playoff":true,"a":"saulgoat","b":"AlastairL","pa":149.16,"pb":143.08},{"week":17,"playoff":true,"a":"benjlev","b":"sanfbe","pa":131.44,"pb":108.78}]},{"season":"2025","name":"Borehamwood","champion":"AlastairL","standings":[{"manager":"dpol","wins":11,"losses":3,"pf":1878.92},{"manager":"AlastairL","wins":9,"losses":5,"pf":1828.36},{"manager":"sanfbe","wins":8,"losses":6,"pf":1778.06},{"manager":"saulgoat","wins":8,"losses":6,"pf":1689.66},{"manager":"joshjr11","wins":6,"losses":8,"pf":1818.96},{"manager":"drjkay","wins":6,"losses":8,"pf":1770.74},{"manager":"GSac","wins":5,"losses":9,"pf":1786.8},{"manager":"benjlev","wins":3,"losses":11,"pf":1562.56}],"games":[{"week":1,"playoff":false,"a":"dpol","b":"drjkay","pa":107.02,"pb":99.74},{"week":1,"playoff":false,"a":"saulgoat","b":"AlastairL","pa":88.72,"pb":95.08},{"week":1,"playoff":false,"a":"joshjr11","b":"benjlev","pa":91.32,"pb":163.26},{"week":1,"playoff":false,"a":"GSac","b":"sanfbe","pa":112.08,"pb":155.26},{"week":2,"playoff":false,"a":"dpol","b":"saulgoat","pa":138.08,"pb":137.6},{"week":2,"playoff":false,"a":"drjkay","b":"AlastairL","pa":126.08,"pb":133.88},{"week":2,"playoff":false,"a":"joshjr11","b":"GSac","pa":127.64,"pb":101.44},{"week":2,"playoff":false,"a":"benjlev","b":"sanfbe","pa":109.9,"pb":111.72},{"week":3,"playoff":false,"a":"dpol","b":"AlastairL","pa":131.86,"pb":131.84},{"week":3,"playoff":false,"a":"saulgoat","b":"drjkay","pa":137.62,"pb":113.4},{"week":3,"playoff":false,"a":"joshjr11","b":"sanfbe","pa":90.18,"pb":135.02},{"week":3,"playoff":false,"a":"benjlev","b":"GSac","pa":96.92,"pb":115.04},{"week":4,"playoff":false,"a":"joshjr11","b":"dpol","pa":141.88,"pb":154.2},{"week":4,"playoff":false,"a":"benjlev","b":"drjkay","pa":88.98,"pb":169.02},{"week":4,"playoff":false,"a":"saulgoat","b":"GSac","pa":131.28,"pb":121.2},{"week":4,"playoff":false,"a":"AlastairL","b":"sanfbe","pa":140.52,"pb":151.26},{"week":5,"playoff":false,"a":"benjlev","b":"dpol","pa":135.16,"pb":136.42},{"week":5,"playoff":false,"a":"joshjr11","b":"drjkay","pa":145.72,"pb":102.04},{"week":5,"playoff":false,"a":"saulgoat","b":"sanfbe","pa":140.54,"pb":138.42},{"week":5,"playoff":false,"a":"AlastairL","b":"GSac","pa":127.72,"pb":121.5},{"week":6,"playoff":false,"a":"dpol","b":"GSac","pa":128.38,"pb":118.42},{"week":6,"playoff":false,"a":"drjkay","b":"sanfbe","pa":108.74,"pb":163.6},{"week":6,"playoff":false,"a":"joshjr11","b":"saulgoat","pa":137.16,"pb":106.96},{"week":6,"playoff":false,"a":"benjlev","b":"AlastairL","pa":103.54,"pb":115.04},{"week":7,"playoff":false,"a":"dpol","b":"sanfbe","pa":186.44,"pb":77.44},{"week":7,"playoff":false,"a":"drjkay","b":"GSac","pa":118.16,"pb":192.04},{"week":7,"playoff":false,"a":"benjlev","b":"saulgoat","pa":79.32,"pb":86.94},{"week":7,"playoff":false,"a":"joshjr11","b":"AlastairL","pa":119.98,"pb":156.58},{"week":8,"playoff":false,"a":"dpol","b":"drjkay","pa":147.16,"pb":118.52},{"week":8,"playoff":false,"a":"saulgoat","b":"AlastairL","pa":108.88,"pb":123.88},{"week":8,"playoff":false,"a":"joshjr11","b":"benjlev","pa":146.48,"pb":154.34},{"week":8,"playoff":false,"a":"GSac","b":"sanfbe","pa":145.66,"pb":116.62},{"week":9,"playoff":false,"a":"dpol","b":"saulgoat","pa":79.9,"pb":120.92},{"week":9,"playoff":false,"a":"drjkay","b":"AlastairL","pa":119.1,"pb":154.96},{"week":9,"playoff":false,"a":"joshjr11","b":"GSac","pa":165.3,"pb":123.54},{"week":9,"playoff":false,"a":"benjlev","b":"sanfbe","pa":124.56,"pb":125.42},{"week":10,"playoff":false,"a":"dpol","b":"AlastairL","pa":127.7,"pb":148.7},{"week":10,"playoff":false,"a":"saulgoat","b":"drjkay","pa":145.5,"pb":146.6},{"week":10,"playoff":false,"a":"joshjr11","b":"sanfbe","pa":162.8,"pb":103.44},{"week":10,"playoff":false,"a":"benjlev","b":"GSac","pa":99.74,"pb":157.52},{"week":11,"playoff":false,"a":"joshjr11","b":"dpol","pa":114.54,"pb":116.44},{"week":11,"playoff":false,"a":"benjlev","b":"drjkay","pa":98.02,"pb":131.72},{"week":11,"playoff":false,"a":"saulgoat","b":"GSac","pa":128.96,"pb":67.9},{"week":11,"playoff":false,"a":"AlastairL","b":"sanfbe","pa":140.74,"pb":160.48},{"week":12,"playoff":false,"a":"benjlev","b":"dpol","pa":96.02,"pb":121.48},{"week":12,"playoff":false,"a":"joshjr11","b":"drjkay","pa":113.46,"pb":130.08},{"week":12,"playoff":false,"a":"saulgoat","b":"sanfbe","pa":105.12,"pb":95.82},{"week":12,"playoff":false,"a":"AlastairL","b":"GSac","pa":133.56,"pb":202.36},{"week":13,"playoff":false,"a":"dpol","b":"GSac","pa":157.44,"pb":100.2},{"week":13,"playoff":false,"a":"drjkay","b":"sanfbe","pa":141,"pb":88.52},{"week":13,"playoff":false,"a":"joshjr11","b":"saulgoat","pa":148.64,"pb":114.16},{"week":13,"playoff":false,"a":"benjlev","b":"AlastairL","pa":110.14,"pb":95.02},{"week":14,"playoff":false,"a":"dpol","b":"sanfbe","pa":146.4,"pb":155.04},{"week":14,"playoff":false,"a":"drjkay","b":"GSac","pa":146.54,"pb":107.9},{"week":14,"playoff":false,"a":"benjlev","b":"saulgoat","pa":102.66,"pb":136.46},{"week":14,"playoff":false,"a":"joshjr11","b":"AlastairL","pa":113.86,"pb":130.84},{"week":15,"playoff":true,"a":"joshjr11","b":"saulgoat","pa":143.2,"pb":172.42},{"week":15,"playoff":true,"a":"drjkay","b":"sanfbe","pa":94.94,"pb":160.82},{"week":15,"playoff":true,"a":"benjlev","b":"GSac","pa":98.9,"pb":107.4},{"week":16,"playoff":true,"a":"dpol","b":"sanfbe","pa":161.02,"pb":108.9},{"week":16,"playoff":true,"a":"saulgoat","b":"AlastairL","pa":113.46,"pb":130.5},{"week":16,"playoff":true,"a":"joshjr11","b":"drjkay","pa":173.36,"pb":116.02},{"week":17,"playoff":true,"a":"dpol","b":"AlastairL","pa":118.58,"pb":143.96},{"week":17,"playoff":true,"a":"saulgoat","b":"sanfbe","pa":76.78,"pb":143.58}]},{"season":"2026","champion":null,"standings":[],"games":[]}]};

const ALLTIME_SUMMARY = {
  nemesis:{dpol:{opp:"AlastairL",w:3,l:3},AlastairL:{opp:"sanfbe",w:2,l:4},benjlev:{opp:"drjkay",w:0,l:6},saulgoat:{opp:"dpol",w:2,l:4},joshjr11:{opp:"dpol",w:0,l:6},sanfbe:{opp:"joshjr11",w:2,l:4},drjkay:{opp:"AlastairL",w:0,l:6},GSac:{opp:"joshjr11",w:0,l:6}},
  bunny:{dpol:{opp:"joshjr11",w:6,l:0},AlastairL:{opp:"drjkay",w:6,l:0},saulgoat:{opp:"benjlev",w:6,l:0},joshjr11:{opp:"GSac",w:6,l:0},drjkay:{opp:"benjlev",w:6,l:0},sanfbe:{opp:"benjlev",w:5,l:1},GSac:{opp:"benjlev",w:5,l:1},benjlev:{opp:"joshjr11",w:3,l:3}},
  playoffRecords:{AlastairL:{w:5,l:2,apps:3},saulgoat:{w:6,l:2,apps:3},dpol:{w:2,l:4,apps:3},joshjr11:{w:2,l:4,apps:3},drjkay:{w:2,l:4,apps:3},sanfbe:{w:4,l:3,apps:3},benjlev:{w:1,l:3,apps:3},GSac:{w:2,l:2,apps:3}}
};

const ROSTERS_DATA = {"Denver Brochos (@joshjr11)":[{"id":"7564","name":"Ja'Marr Chase","pos":"WR"},{"id":"6794","name":"Justin Jefferson","pos":"WR"},{"id":"8130","name":"Trey McBride","pos":"TE"},{"id":"9226","name":"De'Von Achane","pos":"RB"},{"id":"9224","name":"Chase Brown","pos":"RB"},{"id":"8112","name":"Drake London","pos":"WR"},{"id":"6770","name":"Joe Burrow","pos":"QB"},{"id":"8144","name":"Chris Olave","pos":"WR"},{"id":"10229","name":"Rashee Rice","pos":"WR"},{"id":"11631","name":"Brian Thomas","pos":"WR"},{"id":"12474","name":"Woody Marks","pos":"RB"},{"id":"4137","name":"James Conner","pos":"RB"},{"id":"7594","name":"Chuba Hubbard","pos":"RB"},{"id":"3451","name":"Ka'imi Fairbairn","pos":"K"},{"id":"8183","name":"Brock Purdy","pos":"QB"}],"benjlev (@benjlev)":[{"id":"4866","name":"Saquon Barkley","pos":"RB"},{"id":"4881","name":"Lamar Jackson","pos":"QB"},{"id":"1466","name":"Travis Kelce","pos":"TE"},{"id":"3198","name":"Derrick Henry","pos":"RB"},{"id":"8155","name":"Breece Hall","pos":"RB"},{"id":"3321","name":"Tyreek Hill","pos":"WR"},{"id":"11635","name":"Ladd McConkey","pos":"WR"},{"id":"9756","name":"Jordan Addison","pos":"WR"},{"id":"7611","name":"Rhamondre Stevenson","pos":"RB"},{"id":"4199","name":"Aaron Jones","pos":"RB"},{"id":"4983","name":"DJ Moore","pos":"WR"},{"id":"2747","name":"Jason Myers","pos":"K"},{"id":"7523","name":"Trevor Lawrence","pos":"QB"},{"id":"11638","name":"Ricky Pearsall","pos":"WR"},{"id":"8142","name":"Alec Pierce","pos":"WR"},{"id":"10213","name":"Tre Tucker","pos":"WR"}],"Plancey Neutral (@dpol)":[{"id":"6786","name":"CeeDee Lamb","pos":"WR"},{"id":"6813","name":"Jonathan Taylor","pos":"RB"},{"id":"5859","name":"A.J. Brown","pos":"WR"},{"id":"9493","name":"Puka Nacua","pos":"WR"},{"id":"12507","name":"Omarion Hampton","pos":"RB"},{"id":"11584","name":"Bucky Irving","pos":"RB"},{"id":"4217","name":"George Kittle","pos":"TE"},{"id":"3214","name":"Hunter Henry","pos":"TE"},{"id":"12481","name":"Cam Skattebo","pos":"RB"},{"id":"2216","name":"Mike Evans","pos":"WR"},{"id":"5947","name":"Jakobi Meyers","pos":"WR"},{"id":"8126","name":"Wan'Dale Robinson","pos":"WR"},{"id":"11655","name":"Tyrone Tracy","pos":"RB"},{"id":"7839","name":"Evan McPherson","pos":"K"},{"id":"3257","name":"Jacoby Brissett","pos":"QB"}],"Love Thy Naber (@saulgoat)":[{"id":"3163","name":"Jared Goff","pos":"QB"},{"id":"7543","name":"Travis Etienne","pos":"RB"},{"id":"7526","name":"Jaylen Waddle","pos":"WR"},{"id":"7569","name":"Nico Collins","pos":"WR"},{"id":"5045","name":"Courtland Sutton","pos":"WR"},{"id":"6801","name":"Tee Higgins","pos":"WR"},{"id":"11632","name":"Malik Nabers","pos":"WR"},{"id":"12529","name":"TreVeyon Henderson","pos":"RB"},{"id":"7588","name":"Javonte Williams","pos":"RB"},{"id":"12506","name":"Harold Fannin","pos":"TE"},{"id":"11586","name":"Blake Corum","pos":"RB"},{"id":"11539","name":"Jake Bates","pos":"K"},{"id":"8408","name":"Jordan Mason","pos":"RB"},{"id":"11589","name":"Trey Benson","pos":"RB"},{"id":"7607","name":"Michael Carter","pos":"RB"},{"id":"11643","name":"Jaylen Wright","pos":"RB"}],"A rookie error (@drjkay)":[{"id":"3294","name":"Dak Prescott","pos":"QB"},{"id":"9488","name":"Jaxon Smith-Njigba","pos":"WR"},{"id":"8137","name":"George Pickens","pos":"WR"},{"id":"12526","name":"Tetairoa McMillan","pos":"WR"},{"id":"12512","name":"Quinshon Judkins","pos":"RB"},{"id":"12489","name":"RJ Harvey","pos":"RB"},{"id":"8228","name":"Jaylen Warren","pos":"RB"},{"id":"6806","name":"J.K. Dobbins","pos":"RB"},{"id":"12514","name":"Emeka Egbuka","pos":"WR"},{"id":"6819","name":"Michael Pittman","pos":"WR"},{"id":"10236","name":"Dalton Kincaid","pos":"TE"},{"id":"4098","name":"Kareem Hunt","pos":"RB"},{"id":"12508","name":"Jaxson Dart","pos":"QB"},{"id":"7567","name":"Kenneth Gainwell","pos":"RB"},{"id":"9480","name":"Brenton Strange","pos":"TE"},{"id":"12711","name":"Tyler Loop","pos":"K"}],"Fourth and Goalda Meir (@AlastairL)":[{"id":"11564","name":"Drake Maye","pos":"QB"},{"id":"4034","name":"Christian McCaffrey","pos":"RB"},{"id":"7547","name":"Amon-Ra St. Brown","pos":"WR"},{"id":"8150","name":"Kyren Williams","pos":"RB"},{"id":"8151","name":"Kenneth Walker","pos":"RB"},{"id":"11604","name":"Brock Bowers","pos":"TE"},{"id":"2449","name":"Stefon Diggs","pos":"WR"},{"id":"8148","name":"Jameson Williams","pos":"WR"},{"id":"6790","name":"D'Andre Swift","pos":"RB"},{"id":"421","name":"Matthew Stafford","pos":"QB"},{"id":"7553","name":"Kyle Pitts","pos":"TE"},{"id":"8154","name":"Brian Robinson","pos":"RB"},{"id":"8132","name":"Tyler Allgeier","pos":"RB"},{"id":"11533","name":"Brandon Aubrey","pos":"K"},{"id":"12519","name":"Luther Burden","pos":"WR"},{"id":"7002","name":"Juwan Johnson","pos":"TE"}],"This One Really Hurts (@GSac)":[{"id":"6904","name":"Jalen Hurts","pos":"QB"},{"id":"9221","name":"Jahmyr Gibbs","pos":"RB"},{"id":"8138","name":"James Cook","pos":"RB"},{"id":"12527","name":"Ashton Jeanty","pos":"RB"},{"id":"7525","name":"DeVonta Smith","pos":"WR"},{"id":"2133","name":"Davante Adams","pos":"WR"},{"id":"11620","name":"Rome Odunze","pos":"WR"},{"id":"8110","name":"Jake Ferguson","pos":"TE"},{"id":"8134","name":"Khalil Shakir","pos":"WR"},{"id":"8167","name":"Christian Watson","pos":"WR"},{"id":"7049","name":"Jauan Jennings","pos":"WR"},{"id":"9508","name":"Tyjae Spears","pos":"RB"},{"id":"11786","name":"Cam Little","pos":"K"},{"id":"9504","name":"Kayshon Boutte","pos":"WR"},{"id":"12476","name":"Devin Neal","pos":"RB"}],"J'Allen Plancey z'l (@sanfbe)":[{"id":"4984","name":"Josh Allen","pos":"QB"},{"id":"9509","name":"Bijan Robinson","pos":"RB"},{"id":"5850","name":"Josh Jacobs","pos":"RB"},{"id":"8146","name":"Garrett Wilson","pos":"WR"},{"id":"5846","name":"DK Metcalf","pos":"WR"},{"id":"5872","name":"Deebo Samuel","pos":"WR"},{"id":"9997","name":"Zay Flowers","pos":"WR"},{"id":"9753","name":"Zach Charbonnet","pos":"RB"},{"id":"7021","name":"Rico Dowdle","pos":"RB"},{"id":"5022","name":"Dallas Goedert","pos":"TE"},{"id":"10859","name":"Sam LaPorta","pos":"TE"},{"id":"10222","name":"Jayden Reed","pos":"WR"},{"id":"11627","name":"Troy Franklin","pos":"WR"},{"id":"10232","name":"Michael Wilson","pos":"WR"},{"id":"12534","name":"Kyle Monangai","pos":"RB"},{"id":"5189","name":"Eddy Pineiro","pos":"K"},{"id":"6865","name":"Colby Parkinson","pos":"TE"}]};

const TRADE_VALUES = [{"player":{"name":"Bijan Robinson","sleeperId":"9509","position":"RB"},"redraftValue":10455},{"player":{"name":"Jahmyr Gibbs","sleeperId":"9221","position":"RB"},"redraftValue":10362},{"player":{"name":"Ja'Marr Chase","sleeperId":"7564","position":"WR"},"redraftValue":9823},{"player":{"name":"Jaxon Smith-Njigba","sleeperId":"9488","position":"WR"},"redraftValue":9008},{"player":{"name":"Puka Nacua","sleeperId":"9493","position":"WR"},"redraftValue":8951},{"player":{"name":"Jonathan Taylor","sleeperId":"6813","position":"RB"},"redraftValue":8795},{"player":{"name":"Amon-Ra St. Brown","sleeperId":"7547","position":"WR"},"redraftValue":8762},{"player":{"name":"Justin Jefferson","sleeperId":"6794","position":"WR"},"redraftValue":8421},{"player":{"name":"James Cook","sleeperId":"8138","position":"RB"},"redraftValue":7968},{"player":{"name":"De'Von Achane","sleeperId":"9226","position":"RB"},"redraftValue":7909},{"player":{"name":"Christian McCaffrey","sleeperId":"4034","position":"RB"},"redraftValue":7902},{"player":{"name":"Ashton Jeanty","sleeperId":"12527","position":"RB"},"redraftValue":7886},{"player":{"name":"CeeDee Lamb","sleeperId":"6786","position":"WR"},"redraftValue":7944},{"player":{"name":"Trey McBride","sleeperId":"8130","position":"TE"},"redraftValue":7034},{"player":{"name":"Omarion Hampton","sleeperId":"12507","position":"RB"},"redraftValue":7100},{"player":{"name":"Saquon Barkley","sleeperId":"4866","position":"RB"},"redraftValue":6866},{"player":{"name":"Josh Allen","sleeperId":"4984","position":"QB"},"redraftValue":6083},{"player":{"name":"Brock Bowers","sleeperId":"11604","position":"TE"},"redraftValue":6245},{"player":{"name":"Drake London","sleeperId":"8112","position":"WR"},"redraftValue":6015},{"player":{"name":"Kenneth Walker","sleeperId":"8151","position":"RB"},"redraftValue":5978},{"player":{"name":"Derrick Henry","sleeperId":"3198","position":"RB"},"redraftValue":5853},{"player":{"name":"Malik Nabers","sleeperId":"11632","position":"WR"},"redraftValue":5749},{"player":{"name":"Chase Brown","sleeperId":"9224","position":"RB"},"redraftValue":5604},{"player":{"name":"Breece Hall","sleeperId":"8155","position":"RB"},"redraftValue":5618},{"player":{"name":"A.J. Brown","sleeperId":"5859","position":"WR"},"redraftValue":5046},{"player":{"name":"Nico Collins","sleeperId":"7569","position":"WR"},"redraftValue":4819},{"player":{"name":"Kyren Williams","sleeperId":"8150","position":"RB"},"redraftValue":4785},{"player":{"name":"George Pickens","sleeperId":"8137","position":"WR"},"redraftValue":4630},{"player":{"name":"Garrett Wilson","sleeperId":"8146","position":"WR"},"redraftValue":4368},{"player":{"name":"Josh Jacobs","sleeperId":"5850","position":"RB"},"redraftValue":4368},{"player":{"name":"Tetairoa McMillan","sleeperId":"12526","position":"WR"},"redraftValue":4232},{"player":{"name":"Travis Etienne","sleeperId":"7543","position":"RB"},"redraftValue":4262},{"player":{"name":"Quinshon Judkins","sleeperId":"12512","position":"RB"},"redraftValue":4246},{"player":{"name":"DeVonta Smith","sleeperId":"7525","position":"WR"},"redraftValue":4074},{"player":{"name":"TreVeyon Henderson","sleeperId":"12529","position":"RB"},"redraftValue":4070},{"player":{"name":"Javonte Williams","sleeperId":"7588","position":"RB"},"redraftValue":4137},{"player":{"name":"Cam Skattebo","sleeperId":"12481","position":"RB"},"redraftValue":3806},{"player":{"name":"Emeka Egbuka","sleeperId":"12514","position":"WR"},"redraftValue":3781},{"player":{"name":"Chris Olave","sleeperId":"8144","position":"WR"},"redraftValue":3864},{"player":{"name":"Bucky Irving","sleeperId":"11584","position":"RB"},"redraftValue":3602},{"player":{"name":"Tee Higgins","sleeperId":"6801","position":"WR"},"redraftValue":3398},{"player":{"name":"Drake Maye","sleeperId":"11564","position":"QB"},"redraftValue":3427},{"player":{"name":"Lamar Jackson","sleeperId":"4881","position":"QB"},"redraftValue":3500},{"player":{"name":"Joe Burrow","sleeperId":"6770","position":"QB"},"redraftValue":3262},{"player":{"name":"Rashee Rice","sleeperId":"10229","position":"WR"},"redraftValue":3240},{"player":{"name":"Ladd McConkey","sleeperId":"11635","position":"WR"},"redraftValue":3165},{"player":{"name":"Jaylen Waddle","sleeperId":"7526","position":"WR"},"redraftValue":2966},{"player":{"name":"Zay Flowers","sleeperId":"9997","position":"WR"},"redraftValue":2703},{"player":{"name":"Rome Odunze","sleeperId":"11620","position":"WR"},"redraftValue":2643},{"player":{"name":"Davante Adams","sleeperId":"2133","position":"WR"},"redraftValue":2574},{"player":{"name":"D'Andre Swift","sleeperId":"6790","position":"RB"},"redraftValue":2394},{"player":{"name":"Patrick Mahomes","sleeperId":"4046","position":"QB"},"redraftValue":2357},{"player":{"name":"Mike Evans","sleeperId":"2216","position":"WR"},"redraftValue":2348},{"player":{"name":"Brian Thomas","sleeperId":"11631","position":"WR"},"redraftValue":2171},{"player":{"name":"DJ Moore","sleeperId":"4983","position":"WR"},"redraftValue":2104},{"player":{"name":"Terry McLaurin","sleeperId":"5927","position":"WR"},"redraftValue":2013},{"player":{"name":"Chuba Hubbard","sleeperId":"7594","position":"RB"},"redraftValue":1999},{"player":{"name":"Jalen Hurts","sleeperId":"6904","position":"QB"},"redraftValue":1906},{"player":{"name":"Luther Burden","sleeperId":"12519","position":"WR"},"redraftValue":1870},{"player":{"name":"Jameson Williams","sleeperId":"8148","position":"WR"},"redraftValue":1843},{"player":{"name":"Jaylen Warren","sleeperId":"8228","position":"RB"},"redraftValue":1833},{"player":{"name":"Rico Dowdle","sleeperId":"7021","position":"RB"},"redraftValue":1646},{"player":{"name":"Kyle Pitts","sleeperId":"7553","position":"TE"},"redraftValue":1577},{"player":{"name":"Sam LaPorta","sleeperId":"10859","position":"TE"},"redraftValue":1532},{"player":{"name":"Rhamondre Stevenson","sleeperId":"7611","position":"RB"},"redraftValue":1524},{"player":{"name":"George Kittle","sleeperId":"4217","position":"TE"},"redraftValue":1608},{"player":{"name":"RJ Harvey","sleeperId":"12489","position":"RB"},"redraftValue":1480},{"player":{"name":"DK Metcalf","sleeperId":"5846","position":"WR"},"redraftValue":1474},{"player":{"name":"Trevor Lawrence","sleeperId":"7523","position":"QB"},"redraftValue":1408},{"player":{"name":"Dak Prescott","sleeperId":"3294","position":"QB"},"redraftValue":1345},{"player":{"name":"Aaron Jones","sleeperId":"4199","position":"RB"},"redraftValue":1304},{"player":{"name":"Travis Kelce","sleeperId":"1466","position":"TE"},"redraftValue":1281},{"player":{"name":"Zach Charbonnet","sleeperId":"9753","position":"RB"},"redraftValue":1288},{"player":{"name":"Alvin Kamara","sleeperId":"4035","position":"RB"},"redraftValue":1238},{"player":{"name":"Christian Watson","sleeperId":"8167","position":"WR"},"redraftValue":1184},{"player":{"name":"Kenneth Gainwell","sleeperId":"7567","position":"RB"},"redraftValue":1153},{"player":{"name":"J.K. Dobbins","sleeperId":"6806","position":"RB"},"redraftValue":1142},{"player":{"name":"Courtland Sutton","sleeperId":"5045","position":"WR"},"redraftValue":1123},{"player":{"name":"Jaxson Dart","sleeperId":"12508","position":"QB"},"redraftValue":1028},{"player":{"name":"Alec Pierce","sleeperId":"8142","position":"WR"},"redraftValue":1086},{"player":{"name":"Blake Corum","sleeperId":"11586","position":"RB"},"redraftValue":1008},{"player":{"name":"Kyle Monangai","sleeperId":"12534","position":"RB"},"redraftValue":982},{"player":{"name":"Michael Wilson","sleeperId":"10232","position":"WR"},"redraftValue":946},{"player":{"name":"Michael Pittman","sleeperId":"6819","position":"WR"},"redraftValue":926},{"player":{"name":"Harold Fannin","sleeperId":"12506","position":"TE"},"redraftValue":889},{"player":{"name":"Jakobi Meyers","sleeperId":"5947","position":"WR"},"redraftValue":787},{"player":{"name":"Jordan Addison","sleeperId":"9756","position":"WR"},"redraftValue":766},{"player":{"name":"Jordan Mason","sleeperId":"8408","position":"RB"},"redraftValue":731},{"player":{"name":"Brock Purdy","sleeperId":"8183","position":"QB"},"redraftValue":751},{"player":{"name":"Tyrone Tracy","sleeperId":"11655","position":"RB"},"redraftValue":616},{"player":{"name":"Ricky Pearsall","sleeperId":"11638","position":"WR"},"redraftValue":601},{"player":{"name":"Tyler Allgeier","sleeperId":"8132","position":"RB"},"redraftValue":580},{"player":{"name":"Jayden Reed","sleeperId":"10222","position":"WR"},"redraftValue":552},{"player":{"name":"Brian Robinson","sleeperId":"8154","position":"RB"},"redraftValue":526},{"player":{"name":"Wan'Dale Robinson","sleeperId":"8126","position":"WR"},"redraftValue":515},{"player":{"name":"Stefon Diggs","sleeperId":"2449","position":"WR"},"redraftValue":494},{"player":{"name":"Dallas Goedert","sleeperId":"5022","position":"TE"},"redraftValue":360},{"player":{"name":"Dalton Kincaid","sleeperId":"10236","position":"TE"},"redraftValue":360},{"player":{"name":"Woody Marks","sleeperId":"12474","position":"RB"},"redraftValue":332},{"player":{"name":"Jake Ferguson","sleeperId":"8110","position":"TE"},"redraftValue":280},{"player":{"name":"Tyjae Spears","sleeperId":"9508","position":"RB"},"redraftValue":246},{"player":{"name":"Brenton Strange","sleeperId":"9480","position":"TE"},"redraftValue":120},{"player":{"name":"Khalil Shakir","sleeperId":"8134","position":"WR"},"redraftValue":179},{"player":{"name":"Jauan Jennings","sleeperId":"7049","position":"WR"},"redraftValue":159},{"player":{"name":"Tyreek Hill","sleeperId":"3321","position":"WR"},"redraftValue":136},{"player":{"name":"Kayshon Boutte","sleeperId":"9504","position":"WR"},"redraftValue":59},{"player":{"name":"Trey Benson","sleeperId":"11589","position":"RB"},"redraftValue":75},{"player":{"name":"Devin Neal","sleeperId":"12476","position":"RB"},"redraftValue":99},{"player":{"name":"James Conner","sleeperId":"4137","position":"RB"},"redraftValue":66},{"player":{"name":"Juwan Johnson","sleeperId":"7002","position":"TE"},"redraftValue":68},{"player":{"name":"Jaylen Wright","sleeperId":"11643","position":"RB"},"redraftValue":127},{"player":{"name":"Travis Hunter","sleeperId":"12530","position":"WR"},"redraftValue":318},{"player":{"name":"Colby Parkinson","sleeperId":"6865","position":"TE"},"redraftValue":200},{"player":{"name":"Troy Franklin","sleeperId":"11627","position":"WR"},"redraftValue":120},{"player":{"name":"Michael Carter","sleeperId":"7607","position":"RB"},"redraftValue":50}];

// ── Live data fetch ───────────────────────────────────────────────────────────
// The inlined data above is the offline fallback. On every open we pull the latest
// JSON the daily GitHub Action publishes, so the app self-refreshes — paste once,
// never re-paste for a data update. Both sources have CORS; jsDelivr first, Pages
// as fallback. Falls back silently to the inlined data if both are unreachable.
const REPO = "alastairlivingston-sudo/sleeper-league-app-3";
const CDN = "https://cdn.jsdelivr.net/gh/" + REPO + "@main/docs/data/";
const PAGES = "https://" + REPO.split("/")[0] + ".github.io/" + REPO.split("/")[1] + "/data/";
const DATA_SOURCES = [
  { history: CDN + "history.json", rosters: CDN + "rosters.json", trades: CDN + "fc-values.json", alltime: CDN + "alltime.json" },
  { history: PAGES + "history.json", rosters: PAGES + "rosters.json", trades: PAGES + "fc-values.json", alltime: PAGES + "alltime.json" },
];
// jsDelivr sets a 7-day browser cache; the daily bucket busts it so a returning
// user pulls fresh data each calendar day (the Action publishes once daily at 08:00 UTC).
const BUST = "?v=" + new Date().toISOString().slice(0, 10);

// The prompts expect a compact ALLTIME_SUMMARY subset; map the rich alltime.json
// into it. Returns the inlined fallback if the fetched shape is missing.
function buildAlltimeSummary(d) {
  if (!d || !d.nemesis) return ALLTIME_SUMMARY;
  const pick = (obj, fn) => Object.keys(obj || {}).reduce((o, k) => { o[k] = fn(obj[k]); return o; }, {});
  return {
    nemesis: pick(d.nemesis, v => ({ opp: v.opponent, w: v.wins, l: v.losses })),
    bunny: pick(d.bunny, v => ({ opp: v.opponent, w: v.wins, l: v.losses })),
    playoffRecords: pick(d.playoffRecords, v => ({ w: v.wins, l: v.losses, apps: v.appearances })),
  };
}

function useLeagueData() {
  const [data, setData] = useState({ history: HISTORY_DATA, rosters: ROSTERS_DATA, trades: TRADE_VALUES, alltime: null, live: false });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const urls of DATA_SOURCES) {
        try {
          const keys = Object.keys(urls);
          const got = await Promise.all(keys.map(k => fetch(urls[k] + BUST).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })));
          const result = { live: true };
          keys.forEach((k, i) => { result[k] = got[i]; });
          if (!cancelled) setData(result);
          return;
        } catch (e) { /* try next source */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return data;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function r2(n) { return Math.round(n * 100) / 100; }
function r1(n) { return Math.round(n * 10) / 10; }
function sdv(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}
function blankRow(h) { return { handle:h, w:0, l:0, t:0, pf:0, pa:0, scores:[], apW:0, apL:0, apT:0 }; }
function finalizeRow(m) {
  const g = m.w + m.l + m.t, apG = m.apW + m.apL + m.apT, apP = apG ? m.apW / apG : 0;
  const expW = apP * g, avg = m.scores.length ? m.scores.reduce((a,b) => a+b, 0) / m.scores.length : 0;
  return {
    name: displayName(m.handle), alias: distinctName(m.handle), handle: m.handle,
    record: m.w + "-" + m.l + (m.t ? "-" + m.t : ""), wins: m.w, losses: m.l,
    pf: r2(m.pf), pa: r2(m.pa), avgScore: r1(avg), consistencySD: r1(sdv(m.scores)),
    high: m.scores.length ? r2(Math.max(...m.scores)) : 0,
    low: m.scores.length ? r2(Math.min(...m.scores)) : 0,
    allPlay: m.apW + "-" + m.apL + (m.apT ? "-" + m.apT : ""),
    allPlayWinPct: r1(apP * 100), expectedWins: r1(expW), luck: r1(m.w - expW),
  };
}
function computeAnalytics(history) {
  const seasons = (history && history.seasons) || [];
  const perSeason = [], allAcc = {};
  for (const s of seasons) {
    const acc = {}, weeks = {};
    for (const g of (s.games || [])) {
      if (g.playoff || !(g.pa > 0 || g.pb > 0)) continue;
      if (!weeks[g.week]) weeks[g.week] = [];
      weeks[g.week].push(g);
    }
    for (const wk of Object.keys(weeks)) {
      const wg = weeks[wk], board = [];
      for (const g of wg) {
        const ha = canonical(g.a), hb = canonical(g.b);
        if (!acc[ha]) acc[ha] = blankRow(ha);
        if (!acc[hb]) acc[hb] = blankRow(hb);
        const A = acc[ha], B = acc[hb];
        A.pf += g.pa; A.pa += g.pb; A.scores.push(g.pa);
        B.pf += g.pb; B.pa += g.pa; B.scores.push(g.pb);
        if (g.pa > g.pb) { A.w++; B.l++; } else if (g.pb > g.pa) { B.w++; A.l++; } else { A.t++; B.t++; }
        board.push([ha, g.pa], [hb, g.pb]);
      }
      for (const [h, sc] of board) {
        const a = acc[h];
        for (const [h2, sc2] of board) {
          if (h2 === h) continue;
          if (sc > sc2) a.apW++; else if (sc < sc2) a.apL++; else a.apT++;
        }
      }
    }
    const rows = Object.values(acc);
    if (rows.length) {
      perSeason.push({ season: s.season, champion: s.champion ? displayName(s.champion) : null, managers: rows.map(finalizeRow).sort((a,b) => b.wins - a.wins || b.pf - a.pf) });
    }
    for (const m of rows) {
      if (!allAcc[m.handle]) allAcc[m.handle] = blankRow(m.handle);
      const t = allAcc[m.handle];
      t.w += m.w; t.l += m.l; t.t += m.t; t.pf += m.pf; t.pa += m.pa;
      t.apW += m.apW; t.apL += m.apL; t.apT += m.apT;
      for (const sc of m.scores) t.scores.push(sc);
    }
  }
  const allTime = Object.values(allAcc).map(finalizeRow).sort((a,b) => b.wins - a.wins || b.pf - a.pf);
  return { perSeason, allTime };
}

function flattenGames(history) {
  const rows = [];
  for (const s of ((history && history.seasons) || [])) {
    for (const g of (s.games || [])) {
      if (g.pa > 0 || g.pb > 0) {
        rows.push({ season: s.season, week: g.week, playoff: !!g.playoff, a: canonical(g.a), b: canonical(g.b), pa: g.pa, pb: g.pb });
      }
    }
  }
  return rows;
}

function runStatQuery(spec, games) {
  if (!spec || spec.type === "none") return null;
  const regOnly = spec.regularSeasonOnly !== false;
  const seasonSet = Array.isArray(spec.seasons) && spec.seasons.length ? new Set(spec.seasons.map(String)) : null;
  const mgrSet = Array.isArray(spec.managers) && spec.managers.length ? new Set(spec.managers.map(canonical)) : null;
  const pool = games.filter(g => {
    if (regOnly && g.playoff) return false;
    if (seasonSet && !seasonSet.has(String(g.season))) return false;
    return true;
  });
  if (spec.type === "headToHead") {
    const rec = {};
    const cell = (x, y) => { const k = x + "|" + y; if (!rec[k]) rec[k] = { manager:x, opponent:y, wins:0, losses:0, ties:0, pf:0, pa:0, games:0 }; return rec[k]; };
    for (const g of pool) {
      const A = cell(g.a, g.b), B = cell(g.b, g.a);
      A.pf += g.pa; A.pa += g.pb; A.games++; B.pf += g.pb; B.pa += g.pa; B.games++;
      if (g.pa > g.pb) { A.wins++; B.losses++; } else if (g.pb > g.pa) { B.wins++; A.losses++; } else { A.ties++; B.ties++; }
    }
    let rows = Object.values(rec);
    if (mgrSet) {
      if (mgrSet.size === 2) { const [m1,m2] = Array.from(mgrSet); rows = rows.filter(r => (r.manager===m1&&r.opponent===m2)||(r.manager===m2&&r.opponent===m1)); }
      else rows = rows.filter(r => mgrSet.has(r.manager));
    }
    rows.forEach(r => { r.pf = r2(r.pf); r.pa = r2(r.pa); r.winPct = r.games ? Math.round(r.wins/r.games*1000)/1000 : 0; });
    rows.sort((x,y) => x.manager.localeCompare(y.manager) || y.games - x.games);
    return { type:"headToHead", rows };
  }
  if (spec.type === "totals") {
    const acc = {};
    const row = m => { if (!acc[m]) acc[m] = { manager:m, games:0, wins:0, losses:0, ties:0, pf:0, pa:0, high:0, low:Infinity }; return acc[m]; };
    for (const g of pool) {
      if (mgrSet && !mgrSet.has(g.a) && !mgrSet.has(g.b)) continue;
      const A = row(g.a), B = row(g.b);
      A.games++; B.games++; A.pf += g.pa; A.pa += g.pb; B.pf += g.pb; B.pa += g.pa;
      A.high = Math.max(A.high, g.pa); A.low = Math.min(A.low, g.pa);
      B.high = Math.max(B.high, g.pb); B.low = Math.min(B.low, g.pb);
      if (g.pa > g.pb) { A.wins++; B.losses++; } else if (g.pb > g.pa) { B.wins++; A.losses++; } else { A.ties++; B.ties++; }
    }
    let rows = Object.values(acc);
    if (mgrSet) rows = rows.filter(r => mgrSet.has(r.manager));
    rows.forEach(r => { r.pf = r2(r.pf); r.pa = r2(r.pa); r.avg = r.games ? r2(r.pf/r.games) : 0; if (r.low===Infinity) r.low=0; });
    rows.sort((x,y) => y.wins - x.wins || y.pf - x.pf);
    return { type:"totals", rows };
  }
  if (spec.type === "gameList") {
    let rows = pool.slice();
    if (mgrSet) rows = rows.filter(g => mgrSet.has(g.a) || mgrSet.has(g.b));
    const by = spec.sortBy || "combined";
    const metric = g => by==="margin" ? Math.abs(g.pa-g.pb) : by==="high" ? Math.max(g.pa,g.pb) : by==="low" ? Math.min(g.pa,g.pb) : g.pa+g.pb;
    const ord = spec.order === "asc" ? 1 : -1;
    rows.sort((x,y) => (metric(x)-metric(y))*ord);
    return { type:"gameList", rows: rows.slice(0, Math.min(spec.limit||10, 25)) };
  }
  return null;
}

function formatQueryResult(spec, result) {
  if (!result || !result.rows || !result.rows.length) return "";
  const nm = h => distinctName(h);
  const lines = [];
  if (result.type === "headToHead") {
    lines.push("Head-to-head:");
    result.rows.forEach(r => lines.push("- " + nm(r.manager) + " vs " + nm(r.opponent) + ": " + r.wins + "-" + r.losses + (r.ties?"-"+r.ties:"") + " PF " + r.pf + " PA " + r.pa + " (" + r.games + "g)"));
  } else if (result.type === "totals") {
    lines.push("Totals:");
    result.rows.forEach(r => lines.push("- " + nm(r.manager) + ": " + r.wins + "-" + r.losses + " PF " + r.pf + " avg " + r.avg + " hi " + r.high + " (" + r.games + "g)"));
  } else if (result.type === "gameList") {
    lines.push("Games:");
    result.rows.forEach(g => lines.push("- " + g.season + " wk" + g.week + (g.playoff?" (PO)":"") + ": " + nm(g.a) + " " + g.pa + " – " + g.pb + " " + nm(g.b)));
  }
  return "═ DETERMINISTIC DATA (authoritative) ═\n" + lines.join("\n");
}

async function planStatQuery(query) {
  const handles = Object.keys(NAMES);
  const nl = handles.map(h => h + "=" + distinctName(h)).join(", ");
  const planner = "Output ONLY valid JSON. Translate a fantasy-football question into a query spec.\n"
    + "Handles: " + nl + ". benjlev=Lev, sanfbe=Sanford, allyl900=AlastairL.\n"
    + 'Schema: {"type":"headToHead"|"totals"|"gameList"|"none","managers":[...],"seasons":[...],"regularSeasonOnly":true,"sortBy":"margin"|"high"|"low"|"combined","order":"desc"|"asc","limit":10}\n'
    + "H2H/nemesis/who-beats-whom→headToHead. Records/standings→totals. Biggest/closest game→gameList. Opinion/lore→{\"type\":\"none\"}.";
  try {
    const raw = await claudeCall([{ role:"user", content: query }], planner);
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { type:"none" };
    return JSON.parse(m[0]);
  } catch(e) { return { type:"none" }; }
}

// ── API bridge ────────────────────────────────────────────────────────────────
async function claudeCall(messages, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role, content: m.content }))
    })
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  if (!text) throw new Error("Empty response");
  return text;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderInline(str, kb) {
  return str.split(/(\*\*[^*]+\*\*)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return React.createElement("strong", { key: kb+i }, p.slice(2,-2));
    return React.createElement("span", { key: kb+i }, p);
  });
}
function splitRow(line) { return line.replace(/^\s*\|/,"").replace(/\|\s*$/,"").split("|").map(c => c.trim()); }

function MarkdownMessage({ text }) {
  const lines = String(text || "").split("\n");
  const out = [];
  let i = 0, key = 0;
  const isRow = l => /^\s*\|.*\|\s*$/.test(l);
  const isSep = l => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (isRow(line) && i+1 < lines.length && isSep(lines[i+1])) {
      const header = splitRow(line); i += 2;
      const rows = [];
      while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      out.push(
        React.createElement("div", { key: key++, style:{overflowX:"auto",margin:"8px 0"} },
          React.createElement("table", { className:"md-table" },
            React.createElement("thead", null, React.createElement("tr", null, header.map((h,j) => React.createElement("th",{key:j}, renderInline(h,"h"+j))))),
            React.createElement("tbody", null, rows.map((r,ri) => React.createElement("tr",{key:ri}, r.map((c,ci) => React.createElement("td",{key:ci}, renderInline(c,ri+"-"+ci))))))
          )
        )
      );
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !(isRow(lines[i]) && i+1 < lines.length && isSep(lines[i+1]))) { para.push(lines[i]); i++; }
    const children = [];
    for (let li = 0; li < para.length; li++) {
      renderInline(para[li], key+"-"+li).forEach(el => children.push(el));
      if (li < para.length-1) children.push(React.createElement("br",{key:"br"+li}));
    }
    out.push(React.createElement("p", { key: key++, style:{margin:"0 0 7px",lineHeight:1.55} }, children));
  }
  return React.createElement(React.Fragment, null, out);
}

// ── Viewport hook ─────────────────────────────────────────────────────────────
function useViewport() {
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    function apply() {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-h", h + "px");
      setKb((window.innerHeight - h) > 120);
    }
    apply();
    if (vv) { vv.addEventListener("resize", apply); vv.addEventListener("scroll", apply); }
    window.addEventListener("resize", apply);
    return () => {
      if (vv) { vv.removeEventListener("resize", apply); vv.removeEventListener("scroll", apply); }
      window.removeEventListener("resize", apply);
    };
  }, []);
  return { keyboardOpen: kb };
}

// ── ChatTab ───────────────────────────────────────────────────────────────────
function ChatTab({ systemPrompt, chips, placeholder, errorMsg, intro, buildContext }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  function autoResize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  async function send(text) {
    const t = (text || input).trim();
    if (!t || loading) return;
    const next = messages.concat([{ role:"user", content:t }]);
    setMessages(next); setInput(""); setLoading(true);
    if (taRef.current) taRef.current.style.height = "auto";
    try {
      const extra = buildContext ? await buildContext(t, next) : "";
      const fullPrompt = extra ? systemPrompt + "\n\n" + extra : systemPrompt;
      const raw = await claudeCall(next, fullPrompt);
      const reply = raw.replace(/\[(FACT|MYTH|REAL|EVENT)\]/g, "").replace(/  +/g, " ").trim();
      setMessages(p => p.concat([{ role:"assistant", content:reply }]));
    } catch(e) {
      setMessages(p => p.concat([{ role:"error", content: errorMsg }]));
    } finally { setLoading(false); }
  }

  const bubUser = { alignSelf:"flex-end", background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff", borderRadius:"18px 18px 4px 18px", padding:"11px 15px", maxWidth:"82%", fontSize:15, lineHeight:1.5, whiteSpace:"pre-wrap", boxShadow:"0 3px 14px rgba(99,102,241,0.3)" };
  const bubAsst = { alignSelf:"flex-start", background:"#141e32", color:"#e8f1ff", border:"1px solid #24344e", borderLeft:"3px solid #6366f1", borderRadius:"4px 18px 18px 18px", padding:"12px 15px", maxWidth:"88%", fontSize:15, lineHeight:1.6 };
  const bubErr  = { alignSelf:"flex-start", background:"#141e32", color:"#f59e0b", border:"1px solid #24344e", borderLeft:"3px solid #f59e0b", borderRadius:"4px 18px 18px 18px", padding:"12px 15px", maxWidth:"88%", fontSize:15 };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:T.bg }}>
      <div style={{ display:"flex", gap:8, padding:"10px 14px", borderBottom:"1px solid "+T.border, overflowX:"auto", flexShrink:0, background:T.panel }}>
        {chips.map((c,i) => (
          <button key={i} className="chip" onClick={() => send(c)} disabled={loading}>{c}</button>
        ))}
      </div>
      <div style={{ flexGrow:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        {messages.length === 0 && !loading && (
          <div style={{ margin:"auto", textAlign:"center", color:T.faint, fontSize:14, maxWidth:300, lineHeight:1.7, padding:"20px 8px" }}>{intro}</div>
        )}
        {messages.map((m, i) => {
          if (m.role === "assistant") return <div key={i} style={bubAsst}><MarkdownMessage text={m.content} /></div>;
          if (m.role === "error") return <div key={i} style={bubErr}>{m.content}</div>;
          return <div key={i} style={bubUser}>{m.content}</div>;
        })}
        {loading && (
          <div style={bubAsst}>
            <span className="ld" /><span className="ld" /><span className="ld" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display:"flex", gap:8, padding:"10px 12px", borderTop:"1px solid "+T.border, background:T.panel, flexShrink:0 }}>
        <textarea ref={taRef} rows={1} value={input}
          onChange={e => setInput(e.target.value)}
          onInput={autoResize}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          style={{ flex:1, background:T.raised, color:T.text, border:"1px solid "+T.borderHi, borderRadius:11, padding:"12px 13px", fontSize:16, resize:"none", outline:"none", lineHeight:1.4 }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="send-btn" style={{ opacity:(loading || !input.trim()) ? 0.4 : 1 }}>▶</button>
      </div>
    </div>
  );
}

// ── StatsTab ──────────────────────────────────────────────────────────────────
function StatsTab({ historyData, alltimeSummary }) {
  const analytics = useMemo(() => computeAnalytics(historyData), [historyData]);
  const games = useMemo(() => flattenGames(historyData), [historyData]);
  const sp = "You are the statistician for the Borehamwood Plancy League.\n"
    + "Answer ONLY from provided data — never invent numbers.\n"
    + "TWO BENJYS: benjlev=Lev, sanfbe=Sanford.\n"
    + "FORMAT: 1 sentence on method, Markdown table for rankings, at most 1 closing sentence.\n"
    + "METRICS: allPlay, allPlayWinPct, expectedWins, luck (positive=lucky), consistencySD, avgScore, high, low, pf, pa, record. nemesis=worst H2H, bunny=best H2H.\n\n"
    + "Champions: Alastair 2025, Saul 2024+2023, Benjy Levey 2022, Jamie 2020, Josh 2019, Gideon 2018.\n\n"
    + "ANALYTICS:\n" + JSON.stringify(analytics)
    + "\n\nALL-TIME SUMMARY:\n" + JSON.stringify(alltimeSummary);

  async function buildContext(query) {
    try {
      const spec = await planStatQuery(query);
      const result = runStatQuery(spec, games);
      return formatQueryResult(spec, result);
    } catch(e) { return ""; }
  }

  return (
    <ChatTab systemPrompt={sp} buildContext={buildContext}
      chips={["Unluckiest manager?","Best playoff record?","Most consistent scorer?","Dan's nemesis?"]}
      placeholder="Ask about records, luck, H2H…"
      errorMsg="Something went wrong — try again."
      intro="Career records, luck ratings, playoff history, head-to-head — ask away."
    />
  );
}

// ── BanterTab ─────────────────────────────────────────────────────────────────
function BanterTab({ historyData }) {
  const sp = "You are the wind-up merchant of the Borehamwood Plancy League.\n"
    + "Style: bone-dry British wit, mock-ESPN grandeur, punchy 3-5 sentences. Jewish/Borehamwood texture.\n"
    + "Sign off big roasts with \"a hearty hearty mazel tov.\"\n"
    + "Never invent stats. Do NOT print [FACT],[MYTH],[REAL],[EVENT] tags.\n\n"
    + "NAMES: AlastairL=Alastair, dpol=Dan (Commissioner), saulgoat=Saul (2-time recent champ), sanfbe=Sanford, joshjr11=Josh, drjkay=Jamie, GSac=Gideon, benjlev=Lev.\n"
    + "TWO BENJYS: benjlev=Lev, sanfbe=Sanford. allyl900=Alastair.\n\n"
    + "Champions: Alastair 2025, Saul 2024+2023, Benjy Levey 2022, Jamie 2020, Josh 2019, Gideon 2018.\n"
    + "The Miriam=wooden spoon. Lev=autodraft legend. The Plancey=championship belt.\n\n"
    + "SEASON STANDINGS:\n" + JSON.stringify(
        historyData.seasons.map(s => ({ season:s.season, champion:s.champion, standings:s.standings }))
      );

  return (
    <ChatTab systemPrompt={sp}
      chips={["Roast the 2025 champion","Most cursed manager?","Roast Lev","Smack talk bulletin"]}
      placeholder="Stir the pot…"
      errorMsg="Blimey — give it another go."
      intro="Pull up a chair. Roasts, smack-talk bulletins, stirring the pot — all welcome."
    />
  );
}

// ── TradeGrader ───────────────────────────────────────────────────────────────
function TradeGrader({ rostersData, tradeValues }) {
  const teamKeys = useMemo(() => Object.keys(rostersData), [rostersData]);
  const [teamA, setTeamA] = useState(teamKeys[0] || "");
  const [teamB, setTeamB] = useState(teamKeys[1] || "");
  const [sideAText, setSideAText] = useState("");
  const [sideBText, setSideBText] = useState("");
  const [result, setResult] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [vLoading, setVL] = useState(false);
  const [vError, setVE] = useState(false);
  const [showWaiver, setShowWaiver] = useState(true);

  const { idMap, nameMap } = useMemo(() => {
    const id = new Map(), nm = new Map();
    tradeValues.forEach(item => {
      const p = item.player, val = item.redraftValue || 0;
      if (p.sleeperId) id.set(p.sleeperId, { value:val, officialName:p.name, position:p.position });
      nm.set(p.name.toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim(), { value:val, officialName:p.name, position:p.position });
    });
    return { idMap:id, nameMap:nm };
  }, [tradeValues]);

  const waiverByPos = useMemo(() => {
    const rostered = new Set(Object.values(rostersData).reduce((acc, team) => acc.concat(team.map(p => p.id)), []));
    const avail = tradeValues.filter(x => x.player.sleeperId && !rostered.has(x.player.sleeperId));
    const byPos = {};
    avail.forEach(p => { const pos = p.player.position; if (!byPos[pos]) byPos[pos] = []; if (byPos[pos].length < 5) byPos[pos].push(p); });
    return byPos;
  }, [rostersData, tradeValues]);

  function lookupPlayer(txt) {
    const n = txt.toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();
    if (nameMap.has(n)) { const e = nameMap.get(n); return { found:true, value:e.value, officialName:e.officialName, position:e.position }; }
    for (const [k, e] of nameMap) { if (k.includes(n) || n.includes(k)) return { found:true, value:e.value, officialName:e.officialName, position:e.position }; }
    return { found:false, value:0, officialName:txt, position:null };
  }

  function gradeTrade() {
    const parse = txt => txt.split("\n").map(l => l.trim()).filter(Boolean).map(line => ({ input:line, ...lookupPlayer(line) }));
    const sA = parse(sideAText), sB = parse(sideBText);
    const tA = sA.reduce((s,p) => s + p.value, 0), tB = sB.reduce((s,p) => s + p.value, 0);
    const gap = Math.abs(tA - tB), gapPct = (gap / Math.max(tA, tB, 1)) * 100;
    const winner = gapPct < 5 ? "even" : tA > tB ? "A" : "B";
    const tier = gapPct < 5 ? "DEAD EVEN" : gapPct < 12 ? "SLIGHT EDGE" : gapPct < 25 ? "CLEAR WINNER" : "LOPSIDED";
    const icon = gapPct < 5 ? "⚖️" : gapPct < 12 ? "📊" : gapPct < 25 ? "🏆" : "🚨";
    let addOns = [];
    if (winner !== "even") {
      const wTeam = winner === "A" ? teamA : teamB;
      const wSide = winner === "A" ? sA : sB;
      const exclude = new Set(wSide.map(p => p.officialName));
      addOns = (rostersData[wTeam] || [])
        .map(rp => ({ name: idMap.has(rp.id) ? idMap.get(rp.id).officialName : rp.name, value: idMap.has(rp.id) ? idMap.get(rp.id).value : 0 }))
        .filter(rp => !exclude.has(rp.name) && rp.value > 0)
        .sort((a,b) => Math.abs(a.value - gap) - Math.abs(b.value - gap))
        .slice(0, 3);
    }
    const positions = new Set(sA.concat(sB).map(p => p.position).filter(Boolean));
    const waiverContext = {};
    positions.forEach(pos => { waiverContext[pos] = (waiverByPos[pos] || []).slice(0, 3); });
    setResult({ sA, sB, tA, tB, winner, tier, icon, gap, gapPct, addOns, waiverContext });
    setVerdict(null); setVE(false);
  }

  async function getVerdict() {
    if (!result) return;
    setVL(true); setVE(false); setVerdict(null);
    const sys = "You are the wind-up merchant of the Borehamwood Plancy League. Quick funny verdict 2-4 sentences. Bone-dry British banter. Numbers are pre-computed — do NOT recalculate.";
    const margin = result.winner === "even" ? "Even." : ("Side " + result.winner + " wins by " + result.gap.toFixed(0) + " (" + result.gapPct.toFixed(0) + "%)");
    const addOnStr = result.addOns.length ? " Suggested add-on: " + result.addOns.map(a => a.name).join(" or ") + "." : "";
    const msg = "Trade:\nSide A (" + teamLabel(teamA) + ") gives: " + result.sA.map(p => p.officialName + "(" + p.value + ")").join(", ") + " — Total " + result.tA
      + "\nSide B (" + teamLabel(teamB) + ") gives: " + result.sB.map(p => p.officialName + "(" + p.value + ")").join(", ") + " — Total " + result.tB
      + "\nVerdict: " + result.tier + ". " + margin + addOnStr;
    try { const r = await claudeCall([{ role:"user", content:msg }], sys); setVerdict(r); }
    catch(e) { setVE(true); }
    finally { setVL(false); }
  }

  const POSColors = { QB:"#ff7a1a", RB:"#10b981", WR:"#60a5fa", TE:"#a855f7", K:"#888", DEF:"#c44" };
  const winA = result && result.winner === "A", winB = result && result.winner === "B";
  const teamOpts = teamKeys.map(k => <option key={k} value={k}>{teamLabel(k)}</option>);

  return (
    <div style={{ background:T.bg, color:T.text, overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      {/* Waiver */}
      <div style={{ borderBottom:"1px solid "+T.border, background:T.panel }}>
        <button onClick={() => setShowWaiver(v => !v)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 15px", background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:12.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>
          <span>Waiver Wire <span style={{ color:T.faint, fontSize:11, fontWeight:400 }}>(top available)</span></span>
          <span style={{ fontSize:10, color:T.faint }}>{showWaiver ? "▲ hide" : "▼ show"}</span>
        </button>
        {showWaiver && (
          <div style={{ padding:"0 13px 13px", display:"flex", flexWrap:"wrap", gap:8 }}>
            {["QB","RB","WR","TE"].map(pos => {
              const players = waiverByPos[pos] || [];
              if (!players.length) return null;
              return (
                <div key={pos} style={{ background:T.raised, border:"1px solid "+T.border, borderTop:"2px solid "+(POSColors[pos]||T.border), borderRadius:"3px 3px 9px 9px", padding:"9px 11px", minWidth:120, flex:"1 1 120px", maxWidth:170 }}>
                  <div style={{ color:POSColors[pos]||T.dim, fontSize:10.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{pos}</div>
                  {players.map((p, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"3px 0", borderBottom:i<players.length-1?"1px solid "+T.border:"none" }}>
                      <span style={{ color:T.text }}>{p.player.name}</span>
                      <span style={{ color:T.dim, fontSize:11.5 }}>{p.redraftValue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding:15 }}>
        {/* Side inputs */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:11 }}>
          {[{ side:"A", team:teamA, setTeam:setTeamA, text:sideAText, setText:setSideAText, accent:T.blue },
            { side:"B", team:teamB, setTeam:setTeamB, text:sideBText, setText:setSideBText, accent:T.indigo }].map(cfg => (
            <div key={cfg.side} style={{ background:T.panel, border:"1px solid "+T.border, borderTop:"3px solid "+cfg.accent, borderRadius:"4px 4px 12px 12px", padding:13, flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
                <span style={{ background:cfg.accent, color:"#fff", fontWeight:700, fontSize:12, width:20, height:20, borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center" }}>{cfg.side}</span>
                <span style={{ color:T.dim, fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Side {cfg.side} gives up</span>
              </div>
              <select value={cfg.team} onChange={e => cfg.setTeam(e.target.value)} style={{ background:T.raised, color:T.text, border:"1px solid "+T.borderHi, borderRadius:8, padding:10, width:"100%", marginBottom:8, fontSize:16 }}>{teamOpts}</select>
              <textarea value={cfg.text} onChange={e => cfg.setText(e.target.value)} placeholder={"One player per line\ne.g. Ja'Marr Chase"} style={{ background:T.raised, color:T.text, border:"1px solid "+T.borderHi, borderRadius:8, padding:11, width:"100%", minHeight:92, fontSize:16, resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
            </div>
          ))}
        </div>

        <button onClick={gradeTrade} disabled={!sideAText.trim() && !sideBText.trim()} style={{ width:"100%", background:(!sideAText.trim()&&!sideBText.trim()) ? T.raised : "linear-gradient(135deg,"+T.indigo+","+T.indigoDk+")", color:(!sideAText.trim()&&!sideBText.trim()) ? T.faint : "#fff", border:"none", borderRadius:12, padding:15, fontSize:15, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", cursor:"pointer", marginTop:12 }}>
          Grade This Trade
        </button>

        {result && (
          <div style={{ marginTop:16 }}>
            {/* Score bar */}
            <div style={{ background:T.panel, border:"1px solid "+T.border, borderRadius:14, overflow:"hidden", marginBottom:12 }}>
              <div style={{ display:"flex" }}>
                {[{ side:"A", total:result.tA, win:winA }, { side:"B", total:result.tB, win:winB }].map((s, idx) => (
                  <div key={s.side} style={{ flex:1, padding:"15px 10px", textAlign:"center", background:s.win?"rgba(16,185,129,0.08)":"transparent", borderRight:idx===0?"1px solid "+T.border:"none" }}>
                    <div style={{ fontSize:10, color:T.faint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>SIDE {s.side}</div>
                    <div style={{ fontWeight:700, fontSize:32, color:s.win?T.green:T.text, lineHeight:1 }}>{s.total.toLocaleString()}</div>
                    {s.win && <div style={{ fontSize:10, color:T.green, fontWeight:700, marginTop:3, textTransform:"uppercase" }}>▲ WINS</div>}
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center", padding:"10px 0", borderTop:"1px solid "+T.border, background:T.panel2 }}>
                <span style={{ fontSize:20 }}>{result.icon}</span>
                <span style={{ fontWeight:800, fontSize:12.5, color:T.amber, marginLeft:8 }}>{result.tier}</span>
                {result.winner !== "even" && <span style={{ fontSize:10.5, color:T.dim, marginLeft:8 }}>by {result.gap.toLocaleString()} ({result.gapPct.toFixed(0)}%)</span>}
              </div>
            </div>

            {/* Player lists */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:11, marginBottom:12 }}>
              {[{ side:"A", players:result.sA, team:teamA, accent:T.blue }, { side:"B", players:result.sB, team:teamB, accent:T.indigo }].map(cfg => (
                <div key={cfg.side} style={{ flex:1, minWidth:140, background:T.panel, border:"1px solid "+T.border, borderRadius:11, padding:"11px 13px" }}>
                  <div style={{ color:cfg.accent, fontSize:11, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>{teamLabel(cfg.team)} gives</div>
                  {cfg.players.length ? cfg.players.map((p, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid "+T.border, fontSize:13.5 }}>
                      <span style={{ color:p.found?T.text:T.amber }}>{p.found ? p.officialName : p.input + " ⚠"}</span>
                      <span style={{ color:p.found?T.dim:T.amber, fontSize:12.5, marginLeft:8, fontWeight:700 }}>{p.found ? p.value.toLocaleString() : "?"}</span>
                    </div>
                  )) : <div style={{ color:T.faint, fontSize:12 }}>—</div>}
                </div>
              ))}
            </div>

            {/* Add-on suggestion */}
            {result.winner !== "even" && result.addOns.length > 0 && (
              <div style={{ background:T.panel, border:"1px solid "+T.border, borderLeft:"3px solid "+T.amber, borderRadius:"4px 11px 11px 4px", padding:"11px 13px", marginBottom:12 }}>
                <div style={{ color:T.amber, fontSize:11, marginBottom:6, fontWeight:700, textTransform:"uppercase" }}>To balance, {teamLabel(result.winner==="A"?teamA:teamB)} could add</div>
                {result.addOns.map((a, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13.5, padding:"3px 0" }}>
                    <span>{a.name}</span><span style={{ color:T.dim }}>{a.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Commissioner verdict */}
            <button onClick={getVerdict} disabled={vLoading} style={{ width:"100%", background:T.panel, border:"1px solid "+T.amber, color:T.amber, borderRadius:11, padding:"13px 20px", fontSize:13.5, fontWeight:700, textTransform:"uppercase", cursor:vLoading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:9, opacity:vLoading?0.7:1 }}>
              {vLoading ? "⏳" : "🎙"} The Commissioner's Verdict
            </button>
            {(verdict || vError) && (
              <div style={{ background:T.panel2, border:"1px solid "+(vError?T.amber:T.border), borderLeft:"3px solid "+(vError?T.amber:T.indigo), borderRadius:"4px 12px 12px 4px", padding:14, color:vError?T.amber:T.text, marginTop:10, fontSize:14, lineHeight:1.6 }}>
                {vError ? "The Commissioner is unavailable — try again." : <MarkdownMessage text={verdict} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;}
body{background:#090d18;-webkit-font-smoothing:antialiased;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
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
.send-btn{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:12px;padding:0 18px;font-weight:700;font-size:18px;cursor:pointer;align-self:stretch;flex-shrink:0;}
.send-btn:disabled{background:#1a2640;color:#3d5470;cursor:default;}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;background:transparent;border:none;cursor:pointer;position:relative;}
.nav-btn .nav-ico{font-size:20px;}
.nav-btn:not(.active) .nav-ico{filter:grayscale(0.7) opacity(0.5);}
.nav-lab{font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;}
.plaincy-app{display:flex;flex-direction:column;height:var(--app-h,100dvh);width:100%;max-width:620px;margin:0 auto;background:#090d18;overflow:hidden;}
button,textarea,select{font-family:inherit;}
textarea:focus,select:focus{outline:none;}
select option{background:#141e32;color:#e8f1ff;}
`;

// ── Root App ──────────────────────────────────────────────────────────────────
const TABS = [{ id:"stats", icon:"📊", label:"STATS" }, { id:"banter", icon:"🎙", label:"BANTER" }, { id:"trade", icon:"⚖️", label:"TRADES" }];

function App() {
  const [tab, setTab] = useState("stats");
  const { keyboardOpen } = useViewport();
  const { history, rosters, trades, alltime, live } = useLeagueData();
  const alltimeSummary = useMemo(() => buildAlltimeSummary(alltime), [alltime]);

  useEffect(() => {
    if (document.getElementById("plaincy-css")) return;
    const el = document.createElement("style");
    el.id = "plaincy-css";
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  return (
    <div className="plaincy-app">
      <div style={{ height:3, background:"linear-gradient(90deg,#6366f1 0%,#f59e0b 60%,#6366f1 100%)", flexShrink:0 }} />
      <div style={{ display:"flex", alignItems:"center", gap:13, padding:"12px 16px", background:T.panel, borderBottom:"1px solid "+T.border, flexShrink:0 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:22, color:"#fff", flexShrink:0 }}>P</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:22, color:T.text, letterSpacing:"-0.5px", lineHeight:1 }}>
            Pl<span style={{ color:T.indigo }}>AI</span>ncy
          </div>
          <div style={{ fontSize:11, color:T.dim, marginTop:2, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>Borehamwood Plancy League</div>
        </div>
        <div style={{ fontSize:10.5, color:T.dim, border:"1px solid "+T.border, borderRadius:6, padding:"4px 9px", whiteSpace:"nowrap", flexShrink:0, fontWeight:600, display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background: live ? T.green : T.faint, display:"inline-block" }} />
          {fmtBuiltAt(BUILT_AT)}
        </div>
      </div>

      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {tab === "stats" && <StatsTab historyData={history} alltimeSummary={alltimeSummary} />}
        {tab === "banter" && <BanterTab historyData={history} />}
        {tab === "trade" && <TradeGrader rostersData={rosters} tradeValues={trades} />}
      </div>

      {!keyboardOpen && (
        <nav style={{ display:"flex", background:T.panel, borderTop:"1px solid "+T.border, flexShrink:0 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={"nav-btn" + (active ? " active" : "")} style={{ color: active ? T.text : T.faint }}>
                {active && <span style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:36, height:3, borderRadius:"0 0 4px 4px", background:T.indigo }} />}
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

export default App;
