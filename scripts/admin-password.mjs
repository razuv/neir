import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const password=randomBytes(24).toString('base64url');
const salt=randomBytes(24);
const hash=['pbkdf2_sha256',100000,salt.toString('base64'),pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')].join('$');
await writeFile('backend/.dev.vars',`ADMIN_PASSWORD_HASH=${JSON.stringify(hash)}\n`,{mode:0o600});
await writeFile('.admin-credentials',`Логин: neiradmin\nПароль: ${password}\n`,{mode:0o600});
console.log('Сгенерирован новый пароль. Он сохранён в игнорируемом файле .admin-credentials. Хеш — в backend/.dev.vars.');
