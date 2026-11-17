import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../core/services/supabase.service';
import { ToastService } from './toast/toast.service';
import { subirComprobante } from './comprobantes';
import { mensajeError } from './formato';

/** Algo que el mensajero hizo sin señal y queda por enviar */
export interface OpSinSenal {
  id: string;
  tipo: 'entregar' | 'novedad';
  pedidoId: number;
  cliente: string;
  /** entregar: { tipo, efectivo, transferencia, propina, evidencias } · novedad: { motivo, detalle, accion } */
  datos: Record<string, unknown>;
  /** Foto del comprobante tomada sin señal (se sube al volver) */
  foto?: Blob | null;
  creado: number;
}

const BD = 'jasta-sin-senal';
const TABLA = 'cola';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function conTabla<T>(modo: IDBTransactionMode, f: (t: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(TABLA, modo);
    const r = f(tx.objectStore(TABLA));
    tx.oncomplete = () => { ok(r.result); bd.close(); };
    tx.onerror = () => { mal(tx.error); bd.close(); };
  });
}

/** ¿El error es por falta de internet (y no un error de verdad, como "ya estaba entregado")? */
export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = String((e as { message?: string })?.message ?? e ?? '');
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_internet|timeout/i.test(m);
}

/**
 * Modo sin señal del mensajero: entregas y "no se pudo" se guardan en el celular cuando no hay
 * internet y se envían solos, en orden, apenas vuelve la señal.
 */
@Injectable({ providedIn: 'root' })
export class SinSenalService {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  readonly enLinea = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly pendientes = signal<OpSinSenal[]>([]);
  readonly enviando = signal(false);
  /** Cambia cada vez que se envía algo (para recargar la ruta) */
  readonly enviados = signal(0);

  constructor() {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;
    window.addEventListener('online', () => { this.enLinea.set(true); void this.sincronizar(); });
    window.addEventListener('offline', () => this.enLinea.set(false));
    void this.leer().then(() => this.sincronizar());
    setInterval(() => { if (navigator.onLine && this.pendientes().length) void this.sincronizar(); }, 30000);
  }

  private async leer(): Promise<void> {
    try {
      const todo = await conTabla<OpSinSenal[]>('readonly', (t) => t.getAll() as IDBRequest<OpSinSenal[]>);
      this.pendientes.set(todo.sort((a, b) => a.creado - b.creado));
    } catch { /* sin almacenamiento */ }
  }

  /** IDs de pedidos con algo por enviar (no se muestran en la ruta mientras tanto) */
  idsPendientes(): Set<number> {
    return new Set(this.pendientes().map((o) => o.pedidoId));
  }

  async guardar(op: Omit<OpSinSenal, 'id' | 'creado'>): Promise<void> {
    const o: OpSinSenal = { ...op, id: `${op.tipo}-${op.pedidoId}-${Date.now()}`, creado: Date.now() };
    await conTabla('readwrite', (t) => t.put(o));
    this.pendientes.update((l) => [...l, o]);
  }

  private async quitar(id: string): Promise<void> {
    await conTabla('readwrite', (t) => t.delete(id));
    this.pendientes.update((l) => l.filter((o) => o.id !== id));
  }

  /** Envía lo pendiente, en el orden en que se hizo */
  async sincronizar(): Promise<void> {
    if (this.enviando() || !navigator.onLine || !this.pendientes().length) return;
    this.enviando.set(true);
    let ok = 0;
    try {
      for (const o of [...this.pendientes()]) {
        try {
          if (o.tipo === 'entregar') {
            const d = o.datos as { tipo: string; efectivo: number; transferencia: number; propina: number; evidencias: string[] };
            const evidencias = [...(d.evidencias ?? [])];
            if (o.foto) evidencias.push(await subirComprobante(this.sb.client, o.foto));
            const { error } = await this.sb.client.rpc('entregar_pedido', {
              p_pedido: o.pedidoId, p_tipo: d.tipo, p_efectivo: d.efectivo, p_transferencia: d.transferencia, p_evidencias: evidencias,
              ...(d.propina > 0 ? { p_propina: d.propina } : {}),
            });
            if (error) throw error;
          } else {
            const d = o.datos as { motivo: string; detalle: string; accion: string };
            const { error } = await this.sb.client.rpc('reportar_novedad', { p_pedido: o.pedidoId, p_motivo: d.motivo, p_detalle: d.detalle, p_accion: d.accion });
            if (error) throw error;
          }
          await this.quitar(o.id);
          ok++;
        } catch (e) {
          if (esErrorDeRed(e)) break; // se sigue intentando cuando haya señal
          // Un error de verdad (ej. el pedido ya no está en ruta): se avisa y se quita de la cola
          this.toast.error(`#${o.pedidoId} no se pudo enviar: ${mensajeError(e)}`);
          await this.quitar(o.id);
        }
      }
    } finally {
      this.enviando.set(false);
    }
    if (ok) {
      this.toast.ok(ok === 1 ? 'Volvió la señal: se envió 1 entrega guardada' : `Volvió la señal: se enviaron ${ok} cosas guardadas`);
      this.enviados.update((n) => n + 1);
    }
  }
}
