const neirLocalHost = ['localhost','127.0.0.1'].includes(location.hostname);
window.NEIR_API_URL = neirLocalHost ? 'http://' + location.hostname + ':8787' : '';
window.NEIR_MEDIA_BASE = 'public/media/';
