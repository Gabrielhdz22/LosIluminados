// Servicio: Procesamiento de Pagos
// Recibe el id del pedido y del método de pago, obtiene el importe desde el servicio de pedidos
// y confirma el resultado mediante un evento tipo webhook de Stripe.
// MODO LOCAL: el cobro se simula; las tarjetas terminadas en 0002 son rechazadas (como en Stripe de pruebas).
const paymentsService = {
  async pay(orderId, methodId) {
    const order = await ordersService.get(orderId);              // valida sesión y pertenencia
    if (!order) throw new Error('Pedido no encontrado.');
    if (order.estado === 'pagado') throw new Error('Este pedido ya está pagado.');
    if (order.estado === 'cancelado') throw new Error('Este pedido fue cancelado.');
    const method = await paymentMethodsService.get(methodId);
    if (!method) throw new Error('Elige un método de pago válido.');
    await inventoryService.check(order.items);

    const declined = method.tipo === 'tarjeta' && method.ultimos4 === '0002';
    const reason = declined ? 'Tarjeta rechazada por el emisor.' : '';
    await this.handleWebhook({
      id: uid('evt'),
      type: declined ? 'payment_intent.payment_failed' : 'payment_intent.succeeded',
      data: { paymentId: uid('pi'), orderId, amount: order.total, method: method.etiqueta, reason }
    });
    return { ok: !declined, reason };
  },

  // Punto de entrada de los eventos de Stripe (en producción llega por HTTP desde Stripe).
  // Es idempotente: un evento con el mismo id solo se procesa una vez.
  async handleWebhook(evt) {
    const seen = store.get('events', []);
    if (!evt || !evt.id || seen.includes(evt.id)) return { processed: false };
    const { orderId, paymentId, amount, method, reason } = evt.data || {};
    const order = ordersService._find(orderId);
    seen.push(evt.id);
    store.set('events', seen.slice(-200));
    if (!order || order.estado === 'pagado' || order.estado === 'cancelado') return { processed: false };

    if (evt.type === 'payment_intent.succeeded') {
      if (amount !== order.total) {
        ordersService._update(orderId, { estado: 'pago_rechazado', error: 'El importe cobrado no coincide con el pedido.' });
        return { processed: true };
      }
      await inventoryService.discount(order.items);
      ordersService._update(orderId, { estado: 'pagado', error: '', pago: { paymentId, metodo: method, pagado: new Date().toISOString() } });
      return { processed: true };
    }
    if (evt.type === 'payment_intent.payment_failed') {
      ordersService._update(orderId, { estado: 'pago_rechazado', error: reason || 'El pago fue rechazado.' });
      return { processed: true };
    }
    return { processed: false };
  }
};
