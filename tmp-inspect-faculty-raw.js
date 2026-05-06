const AdmZip = require("adm-zip");
const file = "tmp/docx-validation/docx-curta-IC900.docx";
const zip = new AdmZip(file);
const xml = zip.readAsText("word/document.xml");
const idx = xml.indexOf("Docente(s) Respons");
console.log("idx", idx);
if(idx >= 0){
  console.log(xml.slice(Math.max(0, idx-900), idx+2000));
}
