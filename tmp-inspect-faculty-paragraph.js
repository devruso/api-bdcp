const AdmZip = require("adm-zip");
const file = "tmp/docx-validation/docx-curta-IC900.docx";
const zip = new AdmZip(file);
const xml = zip.readAsText("word/document.xml");
const paragraphs = Array.from(xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)).map(m=>m[0]);
const plain = (p)=>Array.from(p.matchAll(/<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g)).map(m=>m[1]).join('').replace(/\s+/g,' ').trim();
for(const p of paragraphs){
  const t = plain(p);
  if(/Docente\(s\) Respons[aá]vel\(is\)/i.test(t)){
    console.log(p.slice(0,2400));
    break;
  }
}
