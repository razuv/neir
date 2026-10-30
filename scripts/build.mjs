import {mkdir,copyFile,cp,rm,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export function pagesConfig(apiURL,pagesURL='https://razuv.github.io/neir/') {
  let api,site;
  try {api=new URL(apiURL);site=new URL(pagesURL);} catch {throw Error('Для Pages укажите NEIR_API_URL — HTTPS-адрес опубликованного API Cloudflare.');}
  if(api.protocol!=='https:'||api.username||api.password||api.search||api.hash||api.pathname!=='/'||['localhost','127.0.0.1','[::1]'].includes(api.hostname))throw Error('NEIR_API_URL должен быть публичным HTTPS origin без пути, пароля и параметров.');
  if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash)throw Error('PAGES_URL должен быть HTTPS-адресом сайта.');
  if(!site.pathname.endsWith('/'))site.pathname+='/';
  return {apiURL:api.origin,pagesURL:site.href,basePath:site.pathname};
}

export async function buildSite({outDir='dist',pages=false,apiURL=process.env.NEIR_API_URL,pagesURL=process.env.PAGES_URL}={}) {
  const config=pages?pagesConfig(apiURL,pagesURL):apiURL?pagesConfig(apiURL,pagesURL):null;
  await rm(outDir,{recursive:true,force:true});
  await mkdir(outDir,{recursive:true});
  for(const file of ['index.html','styles.css','app.js','config.js','interactions.js','content-defaults.js','bootstrap.js','runtime-config.js','visual-editor.js'])await copyFile(file,path.join(outDir,file));
  await cp('public',path.join(outDir,'public'),{recursive:true,filter:source=>!config||!/^video-\d+\.(mp4|mov)$/i.test(path.basename(source))});
  await cp('admin',path.join(outDir,'admin'),{recursive:true});
  await writeFile(path.join(outDir,'.nojekyll'),'');
  if(config){
    await writeFile(path.join(outDir,'runtime-config.js'),`window.NEIR_API_URL=${JSON.stringify(config.apiURL)};\nwindow.NEIR_MEDIA_BASE=window.NEIR_API_URL+'/assets/';\n`);
    let html=await readFile(path.join(outDir,'index.html'),'utf8');
    html=html.replace('src="public/media/video-4.mp4"',`src="${config.apiURL}/assets/video-4.mp4"`);
    html=html.replace('</head>',`<link rel="canonical" href="${config.pagesURL}"></head>`);
    await writeFile(path.join(outDir,'index.html'),html);
    await writeFile(path.join(outDir,'robots.txt'),`User-agent: *\nDisallow: ${config.basePath}admin/\nSitemap: ${config.pagesURL}sitemap.xml\n`);
    await writeFile(path.join(outDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${config.pagesURL}</loc></url></urlset>`);
  }
  console.log(`Static ${pages?'GitHub Pages ':''}build ready: ${outDir}/`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await buildSite({pages:process.argv.includes('--pages')});
