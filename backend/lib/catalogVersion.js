"use strict";

/**
 * PamuDeX — contador de cambios del catálogo en caliente.
 *
 * El catálogo (tipos, Pokémon, movimientos…) solo cambia de una forma con el
 * servidor en marcha: una importación GLOBAL desde /datos. Varias piezas
 * guardan cosas derivadas de él para no leerlas en cada petición —los nombres y
 * colores de los tipos en el modo generación, la lista de tipos del motor de
 * efectividad— y antes se quedaban con el dato viejo hasta reiniciar el
 * contenedor.
 *
 * Quien cambia el catálogo llama a `catalogChanged()`; quien cachea guarda el
 * número con el que calculó y recalcula cuando ya no coincide. Es un entero y
 * no un sistema de eventos a propósito: no hay que suscribirse ni acordarse de
 * darse de baja.
 */
let version = 0;

module.exports = {
  catalogVersion: () => version,
  catalogChanged: () => {
    version += 1;
  },
};
