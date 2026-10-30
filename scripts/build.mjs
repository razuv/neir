import {mkdir,copyFile,cp,rm,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','config.js','interactions.js','content-defaults.js','bootstrap.js','runtime-config.js']) await copyFile(file,`dist/${file}`);
await cp('public','dist/public',{recursive:true});
await cp('admin','dist/admin',{recursive:true});
await writeFile('dist/.nojekyll','');
if(process.env.NEIR_API_URL)await writeFile('dist/runtime-config.js',`window.NEIR_API_URL = ${JSON.stringify(process.env.NEIR_API_URL)}; window.NEIR_MEDIA_BASE = window.NEIR_API_URL + '/assets/';\n`);
if(process.env.NEIR_API_URL){
 const {readFile}=await import('node:fs/promises');
 const html=await readFile('dist/index.html','utf8');
 await writeFile('dist/index.html',html.replace('src="public/media/video-4.mp4"',`src="${process.env.NEIR_API_URL}/assets/video-4.mp4"`));
}
console.log('Static production build ready: dist/');
