const AdmZip = require("adm-zip");
const zip = new AdmZip("UFBA_TEMPLATE.docx");
const xml = zip.readAsText("word/document.xml");
const paragraphs = Array.from(xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)).map(m=>m[0]);
const plain = (p)=>Array.from(p.matchAll(/<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g)).map(m=>m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')).join('').replace(/\s+/g,' ').trim();
for(let i=0;i<paragraphs.length;i++){
  const t=plain(paragraphs[i]);
  if(/Nome:|Assinatura|Docente\(s\)|Aprovado em reunião|Assinatura do Chefe|OBJETIVOS ESPECÍFICOS|OBJETIVO GERAL/i.test(t)){
    const hasDrawing = /<w:drawing[\s>]/.test(paragraphs[i]);
    console.log(`${i}\t${hasDrawing?'[drawing]':''}\t${t}`);
  }
}
