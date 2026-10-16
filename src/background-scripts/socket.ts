import { io, type ManagerOptions, type SocketOptions } from 'socket.io-client';
import { BACKEND_URL } from '../common/backend';

export function backendConnectionError(error: Error): Error {
  if (!['xhr poll error', 'websocket error', 'timeout'].includes(error.message))
    return error;
  return new Error(
    `Geen verbinding met ${BACKEND_URL}. Controleer of de backend draait en chrome-extension://${chrome.runtime.id} is toegestaan in ALLOWED_ORIGINS.`,
  );
}

export function createBackendSocket(
  options: Partial<ManagerOptions & SocketOptions> = {},
) {
  return io(BACKEND_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    timeout: 8000,
    ...options,
  });
}

export function authRequest(event: string, payload: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const connection = createBackendSocket({
      auth: { mode: 'auth' },
      autoConnect: false,
      reconnection: false,
    });
    let settled = false;
    const finish = (error: Error | null, data?: unknown) => {
      if (settled) return;
      settled = true;
      connection.removeAllListeners();
      connection.disconnect();
      if (error) reject(error);
      else resolve(data);
    };
    connection.once('connect_error', (error) => finish(backendConnectionError(error)));
    connection.once('disconnect', () =>
      finish(new Error('Verbinding verbroken voordat de backend antwoordde.')),
    );
    connection.once('connect', () => {
      connection
        .timeout(15000)
        .emit(event, payload, (error: Error | null, data: unknown) => {
          if (error) finish(new Error('Geen antwoord van de backend.'));
          else if (!data || typeof data !== 'object' || !('ok' in data))
            finish(new Error('Ongeldig antwoord van de backend.'));
          else finish(null, data);
        });
    });
    connection.connect();
  });
}
