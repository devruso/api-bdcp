const AdmZip = require("adm-zip");
const file = "tmp/docx-validation/docx-curta-IC900.docx";
const zip = new AdmZip(file);
const xml = zip.readAsText("word/document.xml");
let pos = 0;
let i = 0;
while((pos = xml.indexOf("Docente", pos)) >= 0){
  i++;
  const start = Math.max(0, pos-300);
  const end = Math.min(xml.length, pos+600);
  const seg = xml.slice(start,end);
  console.log("occ", i, "at", pos, "hasDrawing", /<w:drawing|<w:pict/.test(seg));
  pos += 7;
}
console.log("total occurrences", i);
const drawingCount = (xml.match(/<w:drawing/g)||[]).length;
console.log("drawing count", drawingCount);
