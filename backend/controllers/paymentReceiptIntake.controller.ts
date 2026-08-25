// Express type imports (ALWAYS at the top)
import { Request, Response } from 'express';

// Model imports (esModuleInterop — require with export = in the .ts files)
import PaymentReceiptIntake from '../models/PaymentReceiptIntake';

const logger = require('../config/logger');

// invoice_glm.py manda el monto en formato local ("1.005.030,00": punto de
// miles, coma decimal) — mismo criterio que monto_formato() en sync_sheets.py.
function parseMontoLocal(raw: unknown): number | null {
  const texto = String(raw ?? '').trim();
  if (!texto) return null;
  const limpio = texto.replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(limpio);
  return isNaN(valor) ? null : valor;
}

const CAMPOS_TEXTO = [
  'banco', 'referencia', 'moneda', 'origen_nombre', 'origen_cuenta',
  'destino_nombre', 'destino_cuenta', 'concepto', 'tipo_pantalla',
] as const;

class PaymentReceiptIntakeController {
  // Ingesta cruda desde el bot de WhatsApp (vision-glm/whatsapp-bot + invoice_glm.py).
  // Sin matching todavía: solo guarda el comprobante tal cual llega, en estado
  // 'pendiente'. Ver docs/plan-comprobantes-whatsapp-erp.md.
  async create(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const flow = body.flow === 'compras' ? 'compras' : 'ventas';

      const data: Record<string, unknown> = { flow, status: 'pendiente' };
      for (const campo of CAMPOS_TEXTO) {
        if (body[campo] !== undefined && body[campo] !== null) data[campo] = String(body[campo]);
      }
      if (body.fecha) data.fecha = body.fecha;
      const monto = parseMontoLocal(body.monto);
      if (monto !== null) data.monto = monto;
      if (body.confidence !== undefined && body.confidence !== null && body.confidence !== '') {
        const confidence = parseFloat(body.confidence);
        if (!isNaN(confidence)) data.confidence = confidence;
      }
      const processedFiles = (req as any).processedFiles;
      if (processedFiles && processedFiles.length > 0) {
        data.image_url = processedFiles[0].url;
      } else if (body.image_url) {
        data.image_url = String(body.image_url);
      }
      data.raw_payload = body;

      const intake = await PaymentReceiptIntake.create(data as any);

      res.status(201).json({ message: 'Comprobante recibido', data: { id: (intake as any).id } });
    } catch (error: any) {
      logger.error('Error en payment-receipts intake:', error);
      res.status(500).json({ message: 'Error al guardar el comprobante', error: error.message });
    }
  }
}

export = new PaymentReceiptIntakeController();
