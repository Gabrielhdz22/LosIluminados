// Servicio: Métodos de Pago del POS (efectivo en mostrador + tarjetas guardadas por usuario).
// Solo se guarda marca y últimos 4 dígitos; nunca el número completo ni el CVC.
const paymentMethodsService = {
  CASH: { id: 'cash', tipo: 'efectivo', etiqueta: 'Efectivo (mostrador)' },

  _key() { return 'methods:' + authService.require().id; },

  async list() { return [this.CASH, ...store.get(this._key(), [])]; },

  async get(id) { return (await this.list()).find(m => m.id === id) || null; },

  async add({ titular, numero, vence }) {
    const key = this._key();
    titular = (titular || '').trim();
    const rawNumber = (numero || '').trim();
    const digits = rawNumber.replace(/[\s-]/g, '');
    if (titular.length < 2) throw new Error('Escribe el nombre del titular.');
    if (!/^[\d\s-]+$/.test(rawNumber)) throw new Error('El número de tarjeta solo debe contener dígitos.');
    if (digits.length < 13 || digits.length > 19 || !this._luhn(digits)) throw new Error('El número de tarjeta no es válido.');
    const expiry = (vence || '').trim();
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
    if (!m) throw new Error('La fecha debe tener el formato MM/AA.');
    const expYear = 2000 + Number(m[2]), expMonth = Number(m[1]);
    const now = new Date();
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      throw new Error('La tarjeta está vencida.');
    }
    const bin = Number(digits.slice(0, 6));
    const mastercard = /^5[1-5]/.test(digits) || (bin >= 222100 && bin <= 272099);
    const marca = /^4/.test(digits) ? 'Visa' : mastercard ? 'Mastercard' : /^3[47]/.test(digits) ? 'Amex' : 'Tarjeta';
    const ultimos4 = digits.slice(-4);
    const list = store.get(key, []);
    if (list.some(x => x.marca === marca && x.ultimos4 === ultimos4 && x.vence === expiry)) throw new Error('Esa tarjeta ya está guardada.');
    const method = { id: uid('pm'), tipo: 'tarjeta', marca, ultimos4, titular, vence: expiry, etiqueta: `${marca} •••• ${ultimos4}` };
    list.push(method);
    store.set(key, list);
    return method;
  },

  async remove(id) {
    const key = this._key();
    const list = store.get(key, []);
    const updated = list.filter(x => x.id !== id);
    if (updated.length === list.length) throw new Error('No se encontró la tarjeta guardada.');
    store.set(key, updated);
  },

  _luhn(d) {
    let sum = 0, alt = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let n = Number(d[i]);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }
};
