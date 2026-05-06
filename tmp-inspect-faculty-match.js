const AdmZip = require("adm-zip");
const file = "tmp/docx-validation/docx-curta-IC900.docx";
const zip = new AdmZip(file);
const xml = zip.readAsText("word/document.xml");
const match = xml.match(/<w:p[\s\S]*?Docente\(s\) Respons[aá]vel\(is\)[\s\S]*?<\/w:p>/i);
if(!match){ console.log("no match"); process.exit(0);}
const p = match[0];
console.log("len", p.length);
const idx = p.indexOf("<w:drawing");
console.log("drawing idx", idx);
if(idx>=0){ console.log(p.slice(Math.max(0,idx-200), idx+300)); }
console.log("head", p.slice(0,220));
console.log("tail", p.slice(-220));
