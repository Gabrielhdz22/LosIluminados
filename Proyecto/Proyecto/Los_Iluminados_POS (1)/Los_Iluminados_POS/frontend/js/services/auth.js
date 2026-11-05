// Servicio: Autenticación (sesión de 8 horas).
// Los demás servicios usan require()/requireAdmin() para validar la sesión por su cuenta.
const authService = {
  async initialize() {
    const users = store.get('users', []);
    let admin = users.find(x =>
      (x.username || '').toLowerCase() === 'admin' || x.email === 'admin@losiluminados.local'
    );
    if (!admin || !admin.predefined) {
      const salt = uid('s');
      const credentials = {
        nombre: 'Administrador', username: 'ADMIN', email: 'admin@losiluminados.local',
        rol: 'admin', predefined: true, salt, hash: await sha256(salt + '123456789')
      };
      if (admin) Object.assign(admin, credentials);
      else {
        admin = { id: uid('u'), ...credentials };
        users.push(admin);
      }
    }
    users.forEach(u => { u.rol = u.id === admin.id ? 'admin' : 'cliente'; });
    store.set('users', users);
  },
  async login(identifier, password) {
    await this.initialize();
    identifier = (identifier || '').trim().toLowerCase();
    const u = store.get('users', []).find(x =>
      x.email === identifier || (x.username || '').toLowerCase() === identifier
    );
    if (!u || u.hash !== await sha256(u.salt + (password || ''))) throw new Error('Usuario o contraseña incorrectos.');
    store.set('session', { userId: u.id, token: uid('tok'), exp: Date.now() + 8 * 3600 * 1000 });
    return publicUser(u);
  },
  logout() { store.del('session'); },
  current() {
    const s = store.get('session', null);
    if (!s || s.exp < Date.now()) { store.del('session'); return null; }
    const u = store.get('users', []).find(x => x.id === s.userId);
    return u ? publicUser(u) : null;
  },
  require() {
    const u = this.current();
    if (!u) throw new Error('Inicia sesión para continuar.');
    return u;
  },
  requireAdmin() {
    const u = this.require();
    if (u.rol !== 'admin') throw new Error('Solo un administrador puede hacer esto.');
    return u;
  }
};
