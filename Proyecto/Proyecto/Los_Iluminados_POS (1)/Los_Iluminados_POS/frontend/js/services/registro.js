// Servicio: Registro de Usuarios
const registroService = {
  async register({ nombre, email, password }) {
    nombre = (nombre || '').trim();
    email = (email || '').trim().toLowerCase();
    if (nombre.length < 2 || nombre.length > 60) throw new Error('Escribe tu nombre (2 a 60 caracteres).');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('El correo no es válido.');
    if ((password || '').length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    const users = store.get('users', []);
    if (email === 'admin@losiluminados.local') throw new Error('Ese correo está reservado.');
    if (users.some(u => u.email === email)) throw new Error('Ese correo ya está registrado.');
    const salt = uid('s');
    const user = { id: uid('u'), nombre, email, rol: 'cliente', salt, hash: await sha256(salt + password) };
    users.push(user);
    store.set('users', users);
    return publicUser(user);
  }
};
