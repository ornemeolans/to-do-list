// Configuración de Firebase (Consola de Firebase → Configuración del proyecto →
// Tus apps → App web). Estos valores NO son secretos: identifican el proyecto.
// La seguridad la dan las reglas de `firestore.rules` (cada usuario solo puede
// leer y escribir sus propios datos).
//
// Si se pone en `null`, la app funciona solo en local (localStorage + offline)
// y el botón de sincronizar no aparece.
export const firebaseConfig = {
    apiKey: 'AIzaSyC9Ful3mgacbh3i9cXCRAENiY2CYfsDgnE',
    authDomain: 'lavanda-todo.firebaseapp.com',
    projectId: 'lavanda-todo',
    storageBucket: 'lavanda-todo.firebasestorage.app',
    messagingSenderId: '596979545756',
    appId: '1:596979545756:web:9479a5a89b57bb956d1f59'
};
