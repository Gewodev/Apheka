import { useEffect, useSyncExternalStore } from 'react';
import { useAppSlice } from '../../store/AppContext';
import { updaterStore } from '../../lib/updaterStore';

/**
 * Inyecta la notificación de actualización en el centro de notificaciones
 * (la campanita arriba a la derecha) cuando hay versión disponible.
 * Usa el mismo sistema que el resto de avisos de la app.
 */
export default function UpdateNotificationInjector() {
  const { addNotification } = useAppSlice(["addNotification"]);
  const state = useSyncExternalStore(updaterStore.subscribe, updaterStore.snapshot, updaterStore.snapshot);

  useEffect(() => {
    if (state.status === 'available') {
      const version = state.version || '';
      addNotification(
        `West ${version} está lista para instalarse. Tus datos se conservan.`,
        'success',
        {
          kind: 'update',
          label: 'Actualizar',
        }
      );
    }
  }, [state.status, state.version, addNotification]);

  return null;
}