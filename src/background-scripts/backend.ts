import { io } from 'socket.io-client';
import { BACKEND_URL } from '../common/backend';
import { isStudentEmail } from '../common/user';
const sessionKey = (email: string) =>
  `chatSession:${BACKEND_URL}:${email.trim().toLowerCase()}`;
function authRequest(event: string, payload: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const connection = io(BACKEND_URL, {
      auth: { mode: 'auth' },
      transports: ['websocket'],
      timeout: 8000,
      reconnection: false,
    });
    connection.once('connect_error', (error) => {
      connection.disconnect();
      reject(error);
    });
    connection.once('connect', () =>
      connection.timeout(15000).emit(event, payload, (error: Error | null, data: any) => {
        connection.disconnect();
        if (error) reject(new Error('Geen antwoord van de backend.'));
        else resolve(data);
      }),
    );
  });
}

const identityTokens = new Map<string, Promise<string>>();

function chatToken(email: string): Promise<string> {
  const key = `chatAuth:${email.trim().toLowerCase()}`;

  if (!identityTokens.has(key))
    identityTokens.set(
      key,
      (async () => {
        const stored = await chrome.storage.local.get(key);
        if (typeof stored[key] === 'string') return stored[key];
        const token = crypto.randomUUID() + crypto.randomUUID();
        await chrome.storage.local.set({ [key]: token });
        return token;
      })(),
    );

  return identityTokens.get(key)!;
}

function trusted(sender: chrome.runtime.MessageSender): boolean {
  return (
    !!sender.tab &&
    !!sender.url &&
    new URL(sender.url).origin === 'https://kolvw.caspr.be'
  );
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === 'community:feature' && trusted(sender)) {
    const actions = [
      'roles',
      'role-set',
      'profile',
      'xp',
      'read',
      'preferences',
      'groups',
      'group-create',
      'group-change',
      'social-state',
      'social-action',
      'user-card',
      'friends-list',
      'badge-options',
      'badge-set',
      'task-summary',
      'search',
      'mention-candidates',
      'report-message',
      'reports',
      'report-resolve',
      'block-user',
    ];
    if (!isStudentEmail(message.email) || !actions.includes(message.action)) {
      reply({ ok: false, error: 'Ongeldige aanvraag.' });
      return;
    }
    void (async () => {
      const stored = await chrome.storage.local.get(sessionKey(message.email));
      if (!stored[sessionKey(message.email)])
        return { ok: false, error: 'Meld je eerst aan bij de chat.' };
      return authRequest(`features:${message.action}`, {
        ...message.payload,
        sessionToken: stored[sessionKey(message.email)],
      });
    })()
      .then(reply)
      .catch((error: Error) => reply({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'chat:auth' && trusted(sender)) {
    if (!isStudentEmail(message.email)) {
      reply({
        ok: false,
        error:
          'CASPR++ is alleen beschikbaar voor leerlingaccounts met een e-mailadres dat begint met ll.',
      });
      return;
    }
    if (
      typeof message.email !== 'string' ||
      ![
        'login',
        'activate',
        'reset',
        'request-code',
        'sessions',
        'revoke',
        'logout',
      ].includes(message.action)
    )
      return;
    void (async () => {
      const key = sessionKey(message.email);
      const stored = await chrome.storage.local.get(key);
      if (message.action === 'logout') {
        if (stored[key]) {
          const current = await authRequest('auth:sessions', {
            sessionToken: stored[key],
          });
          if (current.ok)
            await authRequest('auth:revoke', {
              sessionToken: stored[key],
              sessionId: current.currentSessionId,
            });
        }
        await chrome.storage.local.remove(key);
        return { ok: true };
      }
      const data = await authRequest(`auth:${message.action}`, {
        email: message.email,
        password: message.password,
        name: message.name,
        className: message.className,
        purpose: message.purpose,
        code: message.code,
        device: 'Chrome · CASPR++',
        sessionToken: stored[key],
        sessionId: message.sessionId,
      });
      if (data.ok && typeof data.token === 'string')
        await chrome.storage.local.set({ [key]: data.token });
      const { token, ...publicData } = data;
      return publicData;
    })()
      .then(reply)
      .catch((error: Error) => reply({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'gifs:search' && trusted(sender)) {
    if (typeof message.query !== 'string' || message.query.length > 50) {
      reply({ error: 'Gebruik maximaal 50 tekens.' });
      return;
    }

    void (async () => {
      const config = await authRequest('gifs:config', {});
      if (!config.ok)
        throw new Error(config.error || 'GIF-instellingen niet beschikbaar.');

      const query = message.query.trim();
      const url = new URL(
        `https://api.giphy.com/v1/gifs/${query ? 'search' : 'trending'}`,
      );
      url.searchParams.set('api_key', config.apiKey);
      url.searchParams.set('limit', '18');
      url.searchParams.set('rating', 'pg');

      if (query) {
        url.searchParams.set('q', query);
        url.searchParams.set('lang', 'nl');
      }

      const response = await fetch(url.href, {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });

      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'GIF-zoeklimiet bereikt. Probeer later opnieuw.'
            : 'GIPHY kon geen GIFs ophalen. Controleer de API-key.',
        );

      const data = await response.json();

      reply({
        items: data.data.map(
          (item: {
            id: string;
            title: string;
            images: {
              fixed_height: { url: string };
              fixed_height_small: { url: string };
            };
          }) => ({
            id: item.id,
            title: item.title,
            url: item.images.fixed_height.url,
            preview: item.images.fixed_height_small.url,
          }),
        ),
      });
    })().catch((error: Error) =>
      reply({ error: error.message || 'GIFs ophalen mislukt.' }),
    );

    return true;
  }
  if (message?.type === 'users:register' && trusted(sender)) {
    if (!isStudentEmail(message.email)) return;

    void chatToken(message.email)
      .then((authToken) => {
        const registration = io(BACKEND_URL, {
          auth: {
            name: message.name,
            email: message.email,
            className: message.className,
            authToken,
          },
          transports: ['websocket'],
          timeout: 8000,
          reconnection: false,
        });

        registration.once('connect', () => {
          registration.disconnect();
          reply({ ok: true });
        });

        registration.once('connect_error', () => {
          registration.disconnect();
          reply({ ok: false });
        });
      })
      .catch(() => reply({ ok: false }));
    return true;
  }

  if (message?.type !== 'games:unlock' || !trusted(sender)) return;

  if (typeof message.password !== 'string' || message.password.length > 200) {
    reply({ error: 'Ongeldig wachtwoord.' });
    return;
  }

  void fetch(`${BACKEND_URL}/api/games/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: message.password }),
    signal: AbortSignal.timeout(8000),
  })
    .then(async (response) => reply(await response.json()))
    .catch(() =>
      reply({ error: 'Backend niet bereikbaar. Start de backend en probeer opnieuw.' }),
    );
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'global-chat') return;

  if (!port.sender || !trusted(port.sender)) {
    port.disconnect();
    return;
  }

  let socket: ReturnType<typeof io> | undefined;
  let closed = false;

  const post = (message: unknown) => {
    if (!closed) port.postMessage(message);
  };

  port.onMessage.addListener(async (message) => {
    if (message.type === 'ping') {
      post({ type: 'pong' });
      return;
    }

    if (message.type === 'join' && typeof message.name === 'string' && !socket) {
      if (!isStudentEmail(message.email)) {
        post({
          type: 'status',
          connected: false,
          text: 'CASPR++ is alleen beschikbaar voor leerlingaccounts (ll-e-mailadres).',
        });
        port.disconnect();
        return;
      }
      try {
        post({ type: 'backend', url: BACKEND_URL });

        const stored = await chrome.storage.local.get('chatClientId');
        const clientId =
          typeof stored.chatClientId === 'string'
            ? stored.chatClientId
            : crypto.randomUUID();

        if (!stored.chatClientId)
          await chrome.storage.local.set({ chatClientId: clientId });
        if (closed) return;

        const session =
          typeof message.email === 'string'
            ? await chrome.storage.local.get(sessionKey(message.email))
            : {};
        const sessionToken =
          typeof message.email === 'string'
            ? session[sessionKey(message.email)]
            : undefined;
        if (closed) return;

        socket = io(BACKEND_URL, {
          auth: {
            name: message.name,
            email: message.email,
            className: message.className,
            scope: message.scope,
            peerId: message.peerId,
            groupId: message.groupId,
            sessionToken,
            clientId,
          },
          transports: ['websocket'],
          timeout: 8000,
          autoConnect: false,
        });

        for (const event of ['chat:social-changed', 'chat:groups-changed', 'chat:badge'])
          socket.on(event, (data) => post({ type: event.slice(5), ...data }));
        socket.on('connect', () => {
          post({ type: 'status', connected: true, text: 'Verbonden' });
          socket!.timeout(8000).emit(
            'chat:history',
            {},
            (
              error: Error | null,
              data: {
                ok: boolean;
                messages: unknown[];
                members: unknown[];
                contacts: unknown[];
                userId: number;
                role: string;
              },
            ) => {
              if (!error && data?.ok) {
                post({ type: 'history', messages: data.messages });
                post({ type: 'members', members: data.members });

                post({
                  type: 'contacts',
                  contacts: data.contacts || [],
                  userId: data.userId,
                  role: data.role,
                });
              } else
                post({
                  type: 'status',
                  connected: true,
                  text: 'Geschiedenis kon niet worden geladen.',
                });
            },
          );
        });

        socket.on('chat:message', (message) => post({ type: 'message', message }));
        socket.on('connect', () =>
          socket
            ?.timeout(8000)
            .emit('features:profile', {}, (error: Error | null, result: any) => {
              if (!error && result?.ok) post({ type: 'profile-result', ...result });
            }),
        );
        for (const event of [
          'inbox',
          'typing',
          'read',
          'role',
          'progression',
          'notification',
        ]) {
          socket.on(`chat:${event}`, (data) => post({ type: event, ...data }));
        }
        socket.on('chat:refresh', (data) =>
          post({ type: 'history', messages: data.messages }),
        );
        socket.on('chat:contacts', (data) => post({ type: 'contacts', ...data }));
        socket.on('chat:pm-notification', (data) =>
          post({ type: 'pm-notification', ...data }),
        );

        socket.on('chat:members', (data) =>
          post({ type: 'members', members: data.members }),
        );

        socket.on('chat:reactions', (data) => post({ type: 'reactions', ...data }));

        socket.on('chat:online', (data) => post({ type: 'online', count: data.count }));

        socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
          if (error.data?.code === 'AUTH_REQUIRED') post({ type: 'auth-required' });
          post({
            type: 'status',
            connected: false,
            text: error.message || 'Geen verbinding met de server',
          });
        });
        socket.on('chat:auth-required', () => post({ type: 'auth-required' }));

        socket.on('disconnect', () =>
          post({
            type: 'status',
            connected: false,
            text: 'Verbinding verbroken; opnieuw verbinden…',
          }),
        );

        socket.connect();
      } catch (error) {
        socket?.disconnect();
        socket = undefined;

        post({
          type: 'status',
          connected: false,
          text: `Chat starten mislukt: ${error instanceof Error ? error.message : 'onbekende extensiefout'}`,
        });
      }
    } else if (message.type === 'typing') {
      socket?.emit('chat:typing', { active: message.active });
    } else if (['read', 'preferences', 'profile'].includes(message.type)) {
      if (!socket?.connected) {
        post({ type: `${message.type}-result`, ok: false, error: 'Niet verbonden.' });
        return;
      }
      socket
        ?.timeout(8000)
        .emit(`features:${message.type}`, message, (error: Error | null, result: any) => {
          post({ type: `${message.type}-result`, ...result, ok: !error && result?.ok });
        });
    } else if (['mutation', 'reaction-people', 'older'].includes(message.type)) {
      if (!socket?.connected) {
        post({ type: 'action-result', ok: false, error: 'Niet verbonden.' });
        return;
      }
      const event = message.type === 'older' ? 'chat:history' : `chat:${message.type}`;
      socket.timeout(5000).emit(
        event,
        {
          messageId: message.messageId,
          action: message.action,
          text: message.text,
          before: message.before,
        },
        (error: Error | null, result: any) => {
          if (message.type === 'older')
            post({
              type: 'older',
              messages: result?.messages || [],
              ok: !error && result?.ok,
            });
          else if (message.type === 'reaction-people')
            post({
              type: 'reaction-people',
              people: result?.people || [],
              error: error ? 'Geen antwoord ontvangen.' : result?.error,
            });
          else
            post({
              type: 'action-result',
              ok: !error && result?.ok,
              error: error ? 'Geen antwoord ontvangen.' : result?.error,
            });
        },
      );
    } else if (message.type === 'friend') {
      if (!socket?.connected) {
        post({ type: 'friend-result', ok: false, error: 'Niet verbonden.' });
        return;
      }
      socket
        .timeout(5000)
        .emit(
          'chat:friend',
          { targetId: message.targetId, action: message.action },
          (error: Error | null, result: any) =>
            post({
              type: 'friend-result',
              ok: !error && result?.ok,
              error: error ? 'Geen antwoord ontvangen.' : result?.error,
            }),
        );
    } else if (message.type === 'react') {
      if (!socket?.connected) {
        post({
          type: 'reacted',
          messageId: message.messageId,
          emoji: message.emoji,
          ok: false,
          error: 'Niet verbonden.',
        });

        return;
      }

      socket
        .timeout(5000)
        .emit(
          'chat:react',
          { messageId: message.messageId, emoji: message.emoji, active: message.active },
          (error: Error | null, result: { ok: boolean; error?: string }) =>
            post({
              type: 'reacted',
              messageId: message.messageId,
              emoji: message.emoji,
              active: message.active,
              ok: !error && result?.ok,
              error: error ? 'Geen bevestiging ontvangen.' : result?.error,
            }),
        );
    } else if (
      message.type === 'send' &&
      socket?.connected &&
      typeof message.text === 'string'
    ) {
      socket.timeout(5000).emit(
        'chat:send',
        {
          text: message.text,
          replyTo: message.replyTo,
          gifUrl: message.gifUrl,
          mentionIds: message.mentionIds,
        },
        (error: Error | null, result: { ok: boolean; error?: string }) => {
          post({
            type: 'sent',
            ok: !error && result?.ok,
            error: error
              ? 'Geen bevestiging ontvangen. Controleer de chat voordat je opnieuw stuurt.'
              : result?.error,
          });
        },
      );
    } else if (message.type === 'send')
      post({ type: 'sent', ok: false, error: 'Niet verbonden.' });
  });

  port.onDisconnect.addListener(() => {
    closed = true;
    socket?.disconnect();
  });
});
