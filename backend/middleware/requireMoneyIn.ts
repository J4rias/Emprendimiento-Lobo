import { Request, Response, NextFunction } from 'express';

/**
 * Interruptor global de cobro: exige `payments.receive` en toda petición que
 * haga ENTRAR dinero al sistema, sin importar el módulo por el que llegue.
 *
 * Va aparte de `authorize()` por dos razones:
 *
 * 1. `authorize()` es OR (`.some()`): sumarle un permiso a una ruta AMPLÍA el
 *    acceso en vez de restringirlo. Este chequeo tiene que ser AND — el rol
 *    necesita su permiso de módulo (`sales.create`, `sales.collect`,
 *    `pre_orders.approve`) Y ADEMÁS `payments.receive`.
 *
 * 2. `POST /sales` hace doble función: el vendedor crea ventas `pos_pending`
 *    SIN dinero (`payment_lines: []`) y el cajero cobra CON dinero. Un gate
 *    plano a nivel de ruta le rompería el flujo al vendedor, así que el
 *    permiso solo se exige cuando la petición realmente mueve plata.
 *
 * Ningún rol lo tiene por herencia: `authorize`/`hasPermission` no hacen bypass
 * de Administrador, así que quitárselo a cualquier rol lo bloquea de verdad.
 */
const PERMISSION = 'payments.receive';

const requireMoneyIn = (req: Request, res: Response, next: NextFunction): void => {
  const lines = (req.body || {}).payment_lines;

  // Sin líneas de pago no entra dinero (venta enviada a caja, pre-pedido a
  // crédito). Si el campo no viene, se asume que sí mueve dinero: la ruta de
  // abono existe solo para eso.
  const movesMoney = Array.isArray(lines) ? lines.length > 0 : true;
  if (!movesMoney) {
    next();
    return;
  }

  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const permissionNames: string[] = (user.role?.permissions || []).map((p: any) => p.name);
  if (!permissionNames.includes(PERMISSION)) {
    res.status(403).json({
      message: 'No tienes permiso para recibir pagos.',
      required: [PERMISSION],
      current: permissionNames
    });
    return;
  }

  next();
};

export = requireMoneyIn;
