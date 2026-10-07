import { mountModeration } from './moderation';
import { mountMentions } from './mentions';
import { mountSocial } from './social';
import { getCurrentUser, getCurrentClass } from '../common/user';
import { mountFlyingChair } from '../games/flying-chair';
import { mountChatAccount } from './chat-account';
import { roleBadge, levelBadge, rewardBadge } from '../common/badges';
import { mountRoleManager } from './role-manager';
import { mountChatTools } from './chat-tools';
import type { InboxRoom } from '../common/community-api';
import { reactionEmoji, composerEmoji, validGifUrl } from '../common/chat-media';
import { createChatLocal } from '../common/chat-local';

interface Message {
  id: number;
  name: string;
  className?: string;
  text: string;
  createdAt: string;
  reactions?: { emoji: string; count: number }[];
  reply?: { id: number; name: string; text: string } | null;
  gifUrl?: string;
  userId?: number;
  role?: string;
  level?: number;
  selectedBadge?: string | null;
  mentions?: { id: number; name: string }[];
  deletedAt?: string | null;
  editedAt?: string | null;
}

export function mountCommunity(container: HTMLElement): () => void {
  let disposed = false;
  const local = createChatLocal(getCurrentUser()?.email || 'anonymous');
  let draftRoom = '';
  let draftRevision = 0;
  let draftLoading = false;
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let cleanupGame: (() => void) | undefined;
  let port: chrome.runtime.Port | undefined;
  let connected = false;
  let sending = false;
  let ownUserId: number | undefined;
  let ownRole = 'member';
  let peerRead = 0;
  let lastMarkedRead = 0;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const columns: HTMLElement[] = [];
  const dialogs: HTMLDialogElement[] = [];

  const tile = (label: string, icon: string, action: () => void) => {
    const column = document.createElement('div');
    column.className = 'col-md-3';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'leerlingAppTile caspr-chair-tile';
    button.setAttribute('aria-haspopup', 'dialog');

    const emoji = document.createElement('span');
    emoji.className = 'caspr-tile-emoji';
    emoji.textContent = icon;

    button.append(emoji, document.createTextNode(label));
    button.addEventListener('click', action);
    column.append(button);

    container.append(column);
    columns.push(column);

    return column;
  };

  const modal = (title: string) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'caspr-community';
    dialog.setAttribute('aria-label', title);

    const header = document.createElement('header');
    const titleGroup = document.createElement('div');

    const eyebrow = document.createElement('span');
    eyebrow.className = 'caspr-community-eyebrow';
    eyebrow.textContent = 'CASPR++ · COMMUNITY';

    const heading = document.createElement('h2');
    heading.textContent = title;

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.className = 'caspr-community-close';
    close.setAttribute('aria-label', 'Venster sluiten');
    close.addEventListener('click', () => dialog.close());

    titleGroup.append(eyebrow, heading);
    header.append(titleGroup, close);
    dialog.append(header);
    document.body.append(dialog);
    dialogs.push(dialog);

    return dialog;
  };

  const games = modal('Games ontgrendelen');
  games.classList.add('caspr-unlock');

  const gameIntro = document.createElement('p');
  gameIntro.className = 'caspr-community-intro';
  gameIntro.textContent = 'Even ontgrendelen.';
  games.append(gameIntro);

  const gameForm = document.createElement('form');
  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = 'Games-wachtwoord';

  const password = document.createElement('input');
  password.type = 'password';
  password.required = true;
  password.maxLength = 200;
  password.autocomplete = 'off';
  passwordLabel.append(password);

  const unlock = document.createElement('button');
  unlock.textContent = 'Ontgrendelen';

  const gameStatus = document.createElement('p');
  gameStatus.setAttribute('role', 'status');
  gameForm.append(passwordLabel, unlock);
  games.append(gameForm, gameStatus);

  const gameTile = tile('Games ontgrendelen', '🔒', () => {
    games.showModal();
    password.focus();
  });

  games.addEventListener('close', () => {
    password.value = '';
  });

  gameForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (unlock.disabled) return;
    unlock.disabled = true;
    gameStatus.textContent = 'Controleren…';

    const secret = password.value;
    password.value = '';

    void chrome.runtime
      .sendMessage({ type: 'games:unlock', password: secret })
      .then((result) => {
        if (disposed) return;
        if (result?.ok) {
          games.close();
          gameTile.remove();

          cleanupGame = mountFlyingChair(container);
        } else gameStatus.textContent = result?.error || 'Ontgrendelen mislukt.';
      })
      .catch(() => {
        if (!disposed)
          gameStatus.textContent = 'Verbinding met extensie mislukt. Herlaad de pagina.';
      })
      .finally(() => {
        unlock.disabled = false;
      });
  });

  const chat = modal('Globale chat');
  chat.classList.add('caspr-chat');

  let replyTo: number | null = null;
  let gifUrl = '';

  const identity = document.createElement('p');
  identity.className = 'caspr-community-intro';

  const status = document.createElement('p');
  status.setAttribute('role', 'status');

  const online = document.createElement('p');
  const connection = document.createElement('div');
  connection.className = 'caspr-chat-connection';
  connection.append(status, online);

  const list = document.createElement('ol');
  list.className = 'caspr-chat-messages';
  list.setAttribute('aria-label', 'Chatberichten');
  const older = document.createElement('button');
  older.type = 'button';
  older.className = 'caspr-chat-reply-button caspr-chat-load-older';
  older.textContent = 'Oudere berichten laden';
  older.onclick = () => {
    if (!port || !connected || !messages.size) return;
    older.disabled = true;
    port.postMessage({ type: 'older', before: Math.min(...messages.keys()) });
  };

  const form = document.createElement('form');
  form.className = 'caspr-chat-composer';

  const label = document.createElement('label');
  label.textContent = 'Bericht';

  const input = document.createElement('textarea');
  input.maxLength = 2000;
  input.required = true;
  label.append(input);

  const send = document.createElement('button');
  send.textContent = 'Versturen';
  send.disabled = input.disabled = true;
  form.append(label, send);
  input.placeholder = 'Typ iets voor iedereen…';
  input.rows = 2;
  const saveDraft = () => {
    clearTimeout(draftTimer);
    if (draftRoom && !draftLoading)
      local.saveDraft(draftRoom, { text: input.value, gifUrl });
  };
  input.addEventListener('input', () => {
    draftLoading = false;
    ++draftRevision;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 350);
  });

  const tools = document.createElement('div');
  tools.className = 'caspr-chat-tools';

  const emojiButton = document.createElement('button');
  emojiButton.type = 'button';
  emojiButton.textContent = '😊 Emoji’s';

  const gifButton = document.createElement('button');
  gifButton.type = 'button';
  gifButton.textContent = 'GIF toevoegen';

  const hint = document.createElement('span');
  hint.textContent = 'Enter verstuurt · Shift+Enter nieuwe regel';
  tools.append(emojiButton, gifButton, hint);

  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'caspr-chat-emoji-picker';
  emojiPicker.hidden = true;
  emojiPicker.setAttribute('aria-label', 'Emoji-kiezer');

  for (const value of composerEmoji) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = value;
    button.setAttribute('aria-label', `Voeg ${value} toe`);

    button.addEventListener('click', () => {
      if (sending) return;
      const start = input.selectionStart;

      const next =
        input.value.slice(0, start) + value + input.value.slice(input.selectionEnd);
      if (next.length > input.maxLength) return;

      input.value = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      input.setSelectionRange(start + value.length, start + value.length);
    });

    emojiPicker.append(button);
  }

  emojiButton.setAttribute('aria-expanded', 'false');
  emojiButton.addEventListener('click', () => {
    emojiPicker.hidden = !emojiPicker.hidden;
    emojiButton.setAttribute('aria-expanded', String(!emojiPicker.hidden));
  });

  const gifPicker = document.createElement('div');
  gifPicker.className = 'caspr-chat-gif-picker';
  gifPicker.hidden = true;

  const searchLabel = document.createElement('label');
  searchLabel.textContent = 'Zoek een GIF';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.maxLength = 50;
  searchInput.placeholder = 'Bijvoorbeeld blij, lachen, weekend…';
  searchLabel.append(searchInput);

  const searchButton = document.createElement('button');
  searchButton.type = 'button';
  searchButton.textContent = 'Zoeken';

  const results = document.createElement('div');
  results.className = 'caspr-gif-results';

  const attribution = document.createElement('a');
  attribution.href = 'https://giphy.com';
  attribution.target = '_blank';
  attribution.rel = 'noopener noreferrer';
  attribution.textContent = 'Powered By GIPHY';

  const manual = document.createElement('details');
  const manualTitle = document.createElement('summary');
  manualTitle.textContent = 'Of plak een GIF-link';
  manual.append(manualTitle);

  const gifLabel = document.createElement('label');
  gifLabel.textContent = 'Directe GIPHY-GIF-link (https://media.giphy.com/…/giphy.gif)';

  const gifInput = document.createElement('input');
  gifInput.type = 'url';
  gifInput.maxLength = 500;
  gifLabel.append(gifInput);

  const attach = document.createElement('button');
  attach.type = 'button';
  attach.textContent = 'Toevoegen';

  const gifStatus = document.createElement('p');
  gifStatus.setAttribute('role', 'status');
  manual.append(gifLabel, attach);
  gifPicker.append(searchLabel, searchButton, gifStatus, results, attribution, manual);

  let searchRevision = 0;

  const searchGifs = async () => {
    const revision = ++searchRevision;
    searchButton.disabled = true;
    gifStatus.textContent = 'GIFs laden…';
    results.replaceChildren();

    try {
      const data = await chrome.runtime.sendMessage({
        type: 'gifs:search',
        query: searchInput.value,
      });

      if (disposed || revision !== searchRevision) return;

      if (data.error) {
        gifStatus.textContent = data.error;
        return;
      }

      gifStatus.textContent = data.items.length
        ? 'Klik op een GIF om toe te voegen.'
        : 'Geen GIFs gevonden.';

      for (const item of data.items as {
        title: string;
        url: string;
        preview: string;
      }[]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', item.title || 'Voeg GIF toe');

        const preview = document.createElement('img');
        preview.alt = item.title || 'GIF';
        preview.loading = 'lazy';
        preview.referrerPolicy = 'no-referrer';

        if (validGifUrl(item.preview)) preview.src = item.preview;
        button.append(preview);

        button.addEventListener('click', () => {
          if (sending || !validGifUrl(item.url)) return;
          ++draftRevision;
          draftLoading = false;
          gifUrl = item.url;
          gifPicker.hidden = true;
          updateContext();
          input.focus();
        });

        results.append(button);
      }
    } catch {
      if (!disposed && revision === searchRevision)
        gifStatus.textContent =
          'GIFs laden mislukt. Herlaad de extensie en probeer opnieuw.';
    } finally {
      if (revision === searchRevision) searchButton.disabled = false;
    }
  };

  searchButton.addEventListener('click', () => void searchGifs());
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void searchGifs();
    }
  });

  gifButton.addEventListener('click', () => {
    gifPicker.hidden = !gifPicker.hidden;
    if (!gifPicker.hidden) {
      searchInput.focus();
      if (!results.childElementCount) void searchGifs();
    }
  });

  const context = document.createElement('div');
  context.className = 'caspr-chat-draft-context';
  context.hidden = true;

  const contextText = document.createElement('span');
  const clearContext = document.createElement('button');
  clearContext.type = 'button';
  clearContext.textContent = 'Wissen';
  context.append(contextText, clearContext);

  const updateContext = () => {
    if (draftRoom && !draftLoading) saveDraft();
    const parent = replyTo ? messages.get(replyTo) : undefined;
    context.hidden = !replyTo && !gifUrl;

    contextText.textContent = [
      parent ? `Antwoord aan ${parent.name}: ${parent.text.slice(0, 100) || 'GIF'}` : '',
      gifUrl ? 'GIF bijgevoegd' : '',
    ]
      .filter(Boolean)
      .join(' · ');

    input.required = !gifUrl;
  };

  clearContext.addEventListener('click', () => {
    if (sending) return;
    ++draftRevision;
    draftLoading = false;
    replyTo = null;
    gifUrl = '';

    updateContext();
  });

  attach.addEventListener('click', () => {
    if (sending) return;

    const url = gifInput.value.trim();
    if (!validGifUrl(url)) {
      gifStatus.textContent =
        'Plak een directe HTTPS-link die eindigt op .gif van media.giphy.com of i.giphy.com.';
      return;
    }

    gifUrl = url;
    ++draftRevision;
    draftLoading = false;
    gifPicker.hidden = true;
    gifInput.value = '';
    gifStatus.textContent = '';

    updateContext();
  });

  const composer = document.createElement('div');
  composer.className = 'caspr-chat-compose-area';
  composer.append(context, emojiPicker, gifPicker, tools, form);
  const newest = document.createElement('button');
  newest.type = 'button';
  newest.className = 'caspr-chat-newest';
  newest.textContent = '↓ Naar nieuwste bericht';
  newest.hidden = true;
  composer.prepend(newest);
  const updateNewest = () => {
    newest.hidden =
      !messages.size || list.scrollHeight - list.scrollTop - list.clientHeight < 100;
  };
  newest.onclick = () => {
    list.scrollTop = list.scrollHeight;
    updateNewest();
    markRead();
  };
  list.addEventListener('scroll', updateNewest);
  chat.append(identity, connection, older, list, composer);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const messages = new Map<number, Message>();
  const selectedReactions = new Set<string>();
  const pendingReactions = new Set<string>();

  const render = (message: Message) => {
    const stickToBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 100;
    const previousScroll = list.scrollTop;

    messages.set(message.id, message);
    for (const existing of messages.values()) {
      if (existing.reply?.id === message.id)
        existing.reply.text = message.text.slice(0, 160) || 'GIF';
    }
    const recent = [...messages.values()].sort((a, b) => a.id - b.id);

    messages.clear();

    list.replaceChildren(
      ...recent.map((item) => {
        messages.set(item.id, item);

        const row = document.createElement('li');
        row.dataset.messageId = String(item.id);

        const author = document.createElement('strong');
        author.textContent = item.name;

        if (item.className) {
          const badge = document.createElement('span');
          badge.className = 'caspr-chat-class';
          badge.textContent = item.className;

          row.append(author, badge);
        } else row.append(author);
        if (item.userId) {
          author.tabIndex = 0;
          author.classList.add('caspr-profile-trigger');
          author.setAttribute('role', 'button');
          author.onclick = () => void social.profile(item.userId!);
          author.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void social.profile(item.userId!);
            }
          };
        }
        const role = roleBadge(item.role);
        if (role) row.append(role);
        const level = levelBadge(item.level);
        if (level) row.append(level);
        const reward = item.selectedBadge ? rewardBadge(item.selectedBadge) : null;
        if (reward) row.append(reward);

        const time = document.createElement('time');
        time.dateTime = item.createdAt;

        time.textContent = new Date(item.createdAt).toLocaleTimeString('nl-BE', {
          hour: '2-digit',
          minute: '2-digit',
        });
        time.title = new Date(item.createdAt).toLocaleString('nl-BE');

        const text = document.createElement('p');
        const mentions = item.mentions || [];
        let remainingText = item.text;
        while (remainingText) {
          const matches = mentions
            .map((m) => ({ ...m, index: remainingText.indexOf(`@${m.name}`) }))
            .filter((m) => m.index >= 0)
            .sort((a, b) => a.index - b.index || b.name.length - a.name.length);
          const mention = matches[0];
          if (!mention) {
            text.append(document.createTextNode(remainingText));
            break;
          }
          text.append(document.createTextNode(remainingText.slice(0, mention.index)));
          const highlight = document.createElement('mark');
          highlight.className = 'caspr-message-mention';
          highlight.textContent = `@${mention.name}`;
          text.append(highlight);
          remainingText = remainingText.slice(mention.index + mention.name.length + 1);
        }
        row.classList.toggle(
          'caspr-mentioned',
          mentions.some((m) => m.id === ownUserId),
        );

        row.append(time);
        const metadata = document.createElement('div');
        metadata.className = 'caspr-message-header';
        metadata.append(...Array.from(row.childNodes));
        row.append(metadata);

        if (item.reply) {
          const quote = document.createElement('blockquote');
          quote.textContent = `${item.reply.name} · ${item.reply.text}`;
          row.append(quote);
        }

        row.append(text);
        if (item.editedAt) {
          const edited = document.createElement('small');
          edited.textContent = 'Bewerkt';
          row.append(edited);
        }
        if (item.deletedAt) return row;

        if (item.gifUrl && validGifUrl(item.gifUrl)) {
          const image = document.createElement('img');
          image.className = 'caspr-chat-gif';
          image.alt = 'GIF bij chatbericht';
          image.loading = 'lazy';
          image.referrerPolicy = 'no-referrer';
          image.src = item.gifUrl;

          const fallback = document.createElement('a');
          fallback.href = item.gifUrl;
          fallback.target = '_blank';
          fallback.rel = 'noopener noreferrer';
          fallback.textContent = 'GIF openen';

          row.append(image, fallback);
        }

        const reactions = document.createElement('div');
        reactions.className = 'caspr-chat-reactions';

        for (const value of reactionEmoji) {
          const key = `${item.id}:${value}`;
          const react = document.createElement('button');
          react.type = 'button';

          const count =
            item.reactions?.find((entry) => entry.emoji === value)?.count || 0;
          react.textContent = `${value}${count ? ` ${count}` : ''}`;
          react.setAttribute('aria-label', `Reageer met ${value}, ${count} reacties`);

          react.setAttribute('aria-pressed', String(selectedReactions.has(key)));

          react.disabled = pendingReactions.has(key);

          react.addEventListener('click', () => {
            if (!port || !connected || pendingReactions.has(key)) return;
            pendingReactions.add(key);
            react.disabled = true;
            port.postMessage({
              type: 'react',
              messageId: item.id,
              emoji: value,
              active: !selectedReactions.has(key),
            });
          });

          reactions.append(react);
        }

        row.append(reactions);

        const answer = document.createElement('button');
        answer.type = 'button';
        answer.className = 'caspr-chat-reply-button';
        answer.textContent = '↩ Antwoorden';

        answer.addEventListener('click', () => {
          if (sending) return;
          replyTo = item.id;
          updateContext();
          input.focus();
        });

        row.append(answer);
        if (social.canPin()) {
          const pin = document.createElement('button');
          pin.type = 'button';
          pin.className = 'caspr-chat-reply-button';
          pin.textContent = '📌 Vastzetten';
          pin.onclick = () => social.pin(item.id);
          row.append(pin);
        }
        const isOwn = item.userId === ownUserId;
        if (!isOwn && !item.deletedAt) {
          const report = document.createElement('button');
          report.type = 'button';
          report.className = 'caspr-chat-reply-button';
          report.textContent = '⚑ Rapporteren';
          report.onclick = () => {
            if (chat.dataset.room) moderation.report(chat.dataset.room, item.id);
          };
          row.append(report);
        }
        if (isOwn) {
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'caspr-chat-reply-button';
          edit.textContent = 'Bewerken';
          edit.onclick = () => {
            const editor = document.createElement('textarea');
            editor.value = item.text;
            editor.maxLength = 2000;
            const save = document.createElement('button');
            save.type = 'button';
            save.textContent = 'Opslaan';
            save.onclick = () => {
              if (!editor.value.trim()) return;
              port?.postMessage({
                type: 'mutation',
                messageId: item.id,
                action: 'edit',
                text: editor.value,
              });
            };
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Annuleren';
            cancel.onclick = () => render(item);
            text.replaceWith(editor);
            edit.replaceWith(save, cancel);
            editor.focus();
          };
          row.append(edit);
        }
        if (
          isOwn ||
          (activeScope !== 'pm' &&
            activeScope !== 'group' &&
            ['mod', 'dev+'].includes(ownRole))
        ) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'caspr-chat-reply-button';
          remove.textContent = 'Verwijderen';
          remove.onclick = () =>
            port?.postMessage({ type: 'mutation', messageId: item.id, action: 'delete' });
          row.append(remove);
        }
        if (item.reactions?.some((r) => r.count)) {
          const people = document.createElement('button');
          people.type = 'button';
          people.className = 'caspr-chat-reply-button';
          people.textContent = 'Wie reageerde?';
          people.onclick = () =>
            port?.postMessage({ type: 'reaction-people', messageId: item.id });
          row.append(people);
        }
        if (
          ownUserId
            ? item.userId === ownUserId
            : item.name === getCurrentUser()?.name.trim().slice(0, 40)
        )
          row.classList.add('caspr-chat-own');
        if (isOwn && activeScope === 'pm') {
          const receipt = document.createElement('small');
          receipt.className = 'caspr-read-receipt';
          receipt.textContent = item.id <= peerRead ? '✓✓ Gelezen' : '✓ Verstuurd';
          row.append(receipt);
        }
        const actions = document.createElement('div');
        actions.className = 'caspr-message-actions';
        actions.append(
          ...Array.from(row.querySelectorAll(':scope > .caspr-chat-reply-button')),
        );
        if (actions.children.length) row.append(actions);
        return row;
      }),
    );
    list.scrollTop = stickToBottom ? list.scrollHeight : previousScroll;
    updateNewest();
  };

  const disconnect = () => {
    clearTimeout(connectTimer);
    clearInterval(heartbeat);

    port?.disconnect();
    port = undefined;
    connected = sending = false;
    mentions.setRoom('');
    chatTools.reset();

    send.disabled = input.disabled = true;
  };

  const members = document.createElement('details');
  members.className = 'caspr-chat-members';
  members.hidden = true;

  const membersTitle = document.createElement('summary');
  const membersList = document.createElement('p');
  members.append(membersTitle, membersList);
  connection.after(members);

  const sidebar = document.createElement('aside');
  sidebar.className = 'caspr-chat-sidebar';

  const sidebarTitle = document.createElement('h2');
  const brandLogo = document.createElement('img');
  brandLogo.src = chrome.runtime.getURL('assets/logo.png');
  brandLogo.alt = '';
  brandLogo.width = 36;
  brandLogo.height = 36;

  sidebarTitle.append(brandLogo, document.createTextNode('Chats'));

  const channelNav = document.createElement('nav');
  channelNav.setAttribute('aria-label', 'Chat kiezen');
  const favoritesSection = document.createElement('section');
  favoritesSection.className = 'caspr-chat-favorites';
  const favoritesTitle = document.createElement('h3');
  favoritesTitle.textContent = '⭐ Favorieten';
  const favoritesNav = document.createElement('nav');
  favoritesNav.setAttribute('aria-label', 'Favoriete chats');
  favoritesSection.append(favoritesTitle, favoritesNav);
  let favoriteGroups: { id: number; name: string; accepted: boolean }[] = [];

  const channels = new Map<'global' | 'class', HTMLButtonElement>();
  for (const [scope, label] of [
    ['global', '🌍 Globale chat'],
    ['class', `🏫 ${getCurrentClass() || 'Klaschat'}`],
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.label = label;
    button.addEventListener('click', () => openChat(scope));

    channels.set(scope, button);
    channelNav.append(button);
  }

  const future = document.createElement('p');
  future.textContent = 'Privéberichten';

  const contactList = document.createElement('nav');
  contactList.className = 'caspr-pm-contacts';
  contactList.setAttribute('aria-label', 'Privégesprekken');

  const contactSearch = document.createElement('input');
  contactSearch.type = 'search';
  contactSearch.placeholder = 'Zoek gebruiker…';
  contactSearch.setAttribute('aria-label', 'Zoek gebruiker');

  const contactHint = document.createElement('p');
  contactHint.className = 'caspr-pm-hint';
  contactHint.textContent = 'Open de chat om aangemelde gebruikers te laden.';
  const findUsers = document.createElement('button');
  findUsers.type = 'button';
  findUsers.className = 'caspr-find-users';
  findUsers.textContent = 'Zoek gebruikers';
  findUsers.hidden = true;
  findUsers.onclick = () => {
    contactSearch.value = '';
    renderContacts();
    contactSearch.focus();
    contactSearch.scrollIntoView?.({ block: 'nearest' });
  };

  type Contact = {
    id: number;
    name: string;
    className: string;
    role?: string;
    friendship?: 'none' | 'accepted' | 'incoming' | 'outgoing' | 'blocked';
  };

  let contacts: Contact[] = [];
  const pmMentions = new Map<number, number>();
  const unread = new Set<number>();

  const renderContacts = () => {
    contactList.replaceChildren();
    const incoming = contacts.filter((c) => c.friendship === 'incoming').length;
    future.textContent = `Privéberichten${incoming ? ` · ${incoming} verzoek${incoming === 1 ? '' : 'en'}` : ''}${unread.size ? ` · ${unread.size} nieuw` : ''}`;
    const filtered = contacts.filter((c) =>
      c.name.toLowerCase().includes(contactSearch.value.toLowerCase()),
    );

    const noFriends = !contacts.some((c) => c.friendship === 'accepted');
    contactHint.textContent = !filtered.length
      ? contactSearch.value
        ? 'Geen gebruikers gevonden voor deze zoekopdracht.'
        : 'Nog geen gebruikers beschikbaar.'
      : noFriends
        ? 'Nog geen vrienden. Zoek iemand en stuur een vriendschapsverzoek.'
        : '';
    findUsers.hidden = !noFriends && !!filtered.length;
    for (const contact of filtered) {
      const row = document.createElement('div');
      row.className = 'caspr-contact-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${unread.has(contact.id) ? '● ' : ''}${contact.name}${pmMentions.get(contact.id) ? ` · @${pmMentions.get(contact.id)}` : ''}`;

      button.setAttribute(
        'aria-pressed',
        String(activeScope === 'pm' && activePeer?.id === contact.id),
      );

      button.addEventListener('click', () => openChat('pm', contact));

      button.disabled = !!contact.friendship && contact.friendship !== 'accepted';
      row.append(button);
      const badge = roleBadge(contact.role);
      if (badge) row.append(badge);
      const actions: [string, string][] =
        contact.friendship === 'none'
          ? [
              ['request', 'Vriend toevoegen'],
              ['block', 'Blokkeren'],
            ]
          : contact.friendship === 'incoming'
            ? [
                ['accept', 'Accepteren'],
                ['decline', 'Weigeren'],
                ['block', 'Blokkeren'],
              ]
            : contact.friendship === 'outgoing'
              ? [
                  ['decline', 'Verzoek intrekken'],
                  ['block', 'Blokkeren'],
                ]
              : contact.friendship === 'accepted'
                ? [
                    ['remove', 'Verwijderen'],
                    ['block', 'Blokkeren'],
                  ]
                : contact.friendship === 'blocked'
                  ? [['unblock', 'Deblokkeren']]
                  : [];
      for (const [action, label] of actions) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'caspr-contact-action';
        control.textContent = label;
        control.onclick = () => {
          if (!port || !connected) return;
          control.disabled = true;
          port.postMessage({ type: 'friend', targetId: contact.id, action });
        };
        row.append(control);
      }
      contactList.append(row);
    }
    renderFavorites();
  };

  contactSearch.addEventListener('input', renderContacts);
  sidebar.append(
    sidebarTitle,
    channelNav,
    favoritesSection,
    future,
    contactSearch,
    contactList,
    contactHint,
    findUsers,
  );

  const main = document.createElement('div');
  main.className = 'caspr-chat-main';
  main.append(...Array.from(chat.children));
  chat.append(sidebar, main);

  let activeScope: 'global' | 'class' | 'pm' | 'group' = 'global';
  let activePeer: Contact | undefined;
  const renderFavorites = () => {
    favoritesNav.replaceChildren();
    const candidates = [
      {
        key: 'global',
        name: '🌍 Globale chat',
        scope: 'global' as const,
        peer: undefined as Contact | undefined,
      },
      {
        key: `class:${getCurrentClass()}`,
        name: `🏫 ${getCurrentClass() || 'Klaschat'}`,
        scope: 'class' as const,
        peer: undefined as Contact | undefined,
      },
      ...contacts
        .filter((c) => c.friendship === 'accepted')
        .map((c) => ({ key: `pm:${c.id}`, name: c.name, scope: 'pm' as const, peer: c })),
      ...favoriteGroups
        .filter((g) => g.accepted)
        .map((g) => ({
          key: `group:${g.id}`,
          name: g.name,
          scope: 'group' as const,
          peer: { id: g.id, name: g.name, className: '' },
        })),
    ];
    for (const item of candidates.filter((item) => local.favorite(item.key))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.name;
      button.onclick = () => openChat(item.scope, item.peer);
      favoritesNav.append(button);
    }
    favoritesSection.hidden = !favoritesNav.children.length;
  };
  channelNav.before(favoritesSection);
  const favoriteCurrent = document.createElement('button');
  favoriteCurrent.type = 'button';
  favoriteCurrent.className = 'caspr-favorite-current';
  const currentFavoriteKey = () =>
    activeScope === 'global'
      ? 'global'
      : activeScope === 'class'
        ? `class:${getCurrentClass()}`
        : `${activeScope}:${activePeer?.id}`;
  const refreshFavoriteControl = () => {
    const favorite = local.favorite(currentFavoriteKey());
    favoriteCurrent.textContent = favorite ? '★ Favoriet' : '☆ Favoriet maken';
    favoriteCurrent.setAttribute('aria-pressed', String(favorite));
  };
  favoriteCurrent.onclick = () => local.toggle(currentFavoriteKey());
  main
    .querySelector('header')!
    .insertBefore(favoriteCurrent, main.querySelector('header')!.lastElementChild);
  const unsubscribeFavorites = local.subscribe(() => {
    renderFavorites();
    refreshFavoriteControl();
  });
  renderFavorites();
  refreshFavoriteControl();
  const social = mountSocial(
    sidebar,
    main,
    (id, name) => openChat('group', { id, name, className: '' }),
    () => {
      const latest = [...messages.values()].at(-1);
      if (latest) render(latest);
    },
    (groups) => {
      favoriteGroups = groups;
      renderFavorites();
    },
  );
  const roles = mountRoleManager(sidebar);
  const moderation = mountModeration(sidebar);
  const mentions = mountMentions(input);
  const groupEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (Number.isSafeInteger(detail?.id) && typeof detail.name === 'string')
      openChat('group', { id: detail.id, name: detail.name, className: '' });
  };
  window.addEventListener('caspr-open-group', groupEvent);
  const chatTools = mountChatTools(connection, input, () => port);
  const markRead = () => {
    if (
      !chat.open ||
      document.hidden ||
      !document.hasFocus() ||
      !connected ||
      !port ||
      list.scrollHeight - list.scrollTop - list.clientHeight > 100
    )
      return;
    const latest = Math.max(0, ...messages.keys());
    if (latest > lastMarkedRead) {
      lastMarkedRead = latest;
      port.postMessage({ type: 'read', messageId: latest });
    }
  };
  document.addEventListener('visibilitychange', markRead);
  window.addEventListener('focus', markRead);
  list.addEventListener('scroll', markRead);
  const updateInbox = (rooms: InboxRoom[]) => {
    social.inbox(rooms);
    unread.clear();
    pmMentions.clear();
    for (const room of rooms) {
      if (room.room.startsWith('pm:') && room.unread) {
        const peer = room.room
          .slice(3)
          .split(':')
          .map(Number)
          .find((id) => id !== ownUserId);
        if (peer) {
          unread.add(peer);
          if (room.mentions) pmMentions.set(peer, room.mentions);
        }
      }
    }
    for (const [scope, button] of channels) {
      const mentionCount =
        rooms.find((r) =>
          scope === 'global' ? r.room === 'global' : r.room.startsWith('class:'),
        )?.mentions || 0;
      const count =
        rooms.find((r) =>
          scope === 'global' ? r.room === 'global' : r.room.startsWith('class:'),
        )?.unread || 0;
      button.textContent = `${button.dataset.label}${count ? ` · ${count}` : ''}${mentionCount ? ` · @${mentionCount}` : ''}`;
    }
    renderContacts();
  };
  const account = mountChatAccount(
    main,
    sidebar,
    () => {
      disconnect();
      openChat(activeScope, activePeer);
    },
    disconnect,
  );
  list.before(main.lastElementChild!);

  const openChat = (scope: 'global' | 'class' | 'pm' | 'group', peer?: Contact) => {
    if (chat.open && activeScope === scope && activePeer?.id === peer?.id && port) return;
    if (draftRoom) saveDraft();
    draftRoom =
      scope === 'global'
        ? 'global'
        : scope === 'class'
          ? `class:${getCurrentClass()}`
          : `${scope}:${peer?.id}`;
    draftLoading = true;
    const revision = ++draftRevision;
    input.value = '';
    void local.draft(draftRoom).then((draft) => {
      if (disposed || revision !== draftRevision) return;
      draftLoading = false;
      input.value = draft.text;
      gifUrl = validGifUrl(draft.gifUrl) ? draft.gifUrl : '';
      updateContext();
    });
    activeScope = scope;
    activePeer = peer;
    refreshFavoriteControl();
    mentions.setRoom('');
    chatTools.reset();
    peerRead = lastMarkedRead = 0;
    delete chat.dataset.room;

    if (peer) unread.delete(peer.id);

    renderContacts();

    channels.forEach((button, channel) =>
      button.setAttribute('aria-pressed', String(channel === scope)),
    );

    disconnect();

    messages.clear();
    newest.hidden = true;
    older.disabled = false;
    list.replaceChildren();
    selectedReactions.clear();
    pendingReactions.clear();
    replyTo = null;
    gifUrl = '';

    updateContext();

    members.hidden = true;

    main.querySelector('h2')!.textContent =
      scope === 'class'
        ? `Klaschat · ${getCurrentClass() || 'onbekend'}`
        : scope === 'pm' || scope === 'group'
          ? `${scope === 'group' ? 'Groep' : 'Gesprek met'} ${peer?.name || 'gebruiker'}`
          : 'Globale chat';

    if (!chat.open) chat.showModal();

    const name = getCurrentUser()?.name.trim().slice(0, 40);
    if (!name) {
      status.textContent = 'Je CASPR-naam kon niet worden gevonden. Herlaad de pagina.';
      return;
    }

    identity.textContent =
      scope === 'class'
        ? `Je chat als ${name} in ${getCurrentClass()}.`
        : scope === 'pm' || scope === 'group'
          ? scope === 'group'
            ? 'Privégroep · alleen geaccepteerde leden kunnen meelezen.'
            : `Privégesprek met ${peer?.name}.`
          : `Je chat als ${name}. Berichten zijn zichtbaar voor iedereen in deze chat.`;

    status.textContent = 'Verbinden…';

    try {
      port = chrome.runtime.connect({ name: 'global-chat' });
    } catch {
      status.textContent =
        'Herlaad de extensie via chrome://extensions en ververs CASPR.';
      return;
    }

    const current = port;
    connectTimer = setTimeout(() => {
      if (port !== current || disposed || connected) return;
      disconnect();
      status.textContent =
        'Geen antwoord van de extensie. Herlaad de extensie via chrome://extensions en ververs CASPR.';
    }, 12000);

    heartbeat = setInterval(() => {
      if (port === current && !disposed) {
        try {
          current.postMessage({ type: 'ping' });
        } catch {
          disconnect();
        }
      }
    }, 20000);

    current.onMessage.addListener((data) => {
      if (disposed || port !== current) return;
      chatTools.receive(data);
      if (data.type === 'profile-result' && data.ok && data.room)
        social.setRoom(data.room, data.user?.id || ownUserId, data.user?.role || ownRole);
      if (data.type === 'profile-result' && data.ok && data.room)
        mentions.setRoom(data.room);
      if (data.type === 'badge') {
        for (const item of messages.values())
          if (item.userId === data.userId) item.selectedBadge = data.selectedBadge;
        const latest = [...messages.values()].at(-1);
        if (latest) render(latest);
      }
      if (data.type === 'social-changed') void social.refresh();
      if (data.type === 'groups-changed') void social.refreshGroups();
      if (data.type === 'profile-result' && data.ok) {
        ownUserId = data.user.id;
        ownRole = data.user.role;
        roles.setRole(ownRole);
        moderation.setRole(ownRole);
        peerRead = data.peerRead || 0;
        chat.dataset.room = data.room;
        updateInbox(data.rooms);
        const latest = [...messages.values()].at(-1);
        if (latest) render(latest);
        markRead();
        return;
      }
      if (data.type === 'inbox') {
        updateInbox(data.rooms);
        return;
      }
      if (data.type === 'read') {
        if (data.userId === activePeer?.id) {
          peerRead = Math.max(peerRead, data.lastRead);
          const latest = [...messages.values()].at(-1);
          if (latest) render(latest);
        }
        return;
      }
      if (data.type === 'read-result' && !data.ok) {
        lastMarkedRead = 0;
        return;
      }
      if (data.type === 'role') {
        if (data.userId === ownUserId) {
          ownRole = data.role;
          roles.setRole(ownRole);
          moderation.setRole(ownRole);
        }
        contacts.forEach((c) => {
          if (c.id === data.userId) c.role = data.role;
        });
        messages.forEach((m) => {
          if (m.userId === data.userId) m.role = data.role;
        });
        renderContacts();
        const latest = [...messages.values()].at(-1);
        if (latest) render(latest);
        return;
      }

      if (data.type === 'status') {
        if (data.connected) account.hide();
        clearTimeout(connectTimer);

        connected = data.connected;

        connection.dataset.connected = String(connected);
        send.disabled = !connected || sending;
        input.disabled = !connected || sending;
        status.textContent = data.text;
      } else if (data.type === 'auth-required') {
        disconnect();
        account.show();
        status.textContent = 'Meld je aan bij de chat.';
      } else if (data.type === 'backend')
        status.textContent = `Verbinden met ${data.url}…`;
      else if (data.type === 'message') {
        render(data.message);
        markRead();
      } else if (data.type === 'history') {
        data.messages.forEach(render);
        markRead();
      } else if (data.type === 'older') {
        older.disabled = false;
        data.messages.forEach(render);
        if (!data.ok) status.textContent = 'Oudere berichten ophalen mislukt.';
        else if (!data.messages.length)
          status.textContent = 'Dit is het begin van de chat.';
      } else if (data.type === 'action-result') {
        status.textContent = data.ok ? 'Bericht bijgewerkt.' : data.error;
      } else if (data.type === 'reaction-people') {
        status.textContent =
          data.error ||
          data.people
            .map((p: { emoji: string; name: string }) => `${p.emoji} ${p.name}`)
            .join(' · ') ||
          'Nog geen reacties.';
      } else if (data.type === 'contacts') {
        ownUserId = data.userId;
        ownRole = data.role || 'member';
        roles.setRole(ownRole);
        moderation.setRole(ownRole);
        contacts = data.contacts;

        renderContacts();
        const latest = [...messages.values()].at(-1);
        if (latest) render(latest);
      } else if (data.type === 'friend-result') {
        status.textContent = data.ok ? 'Vriendschappen bijgewerkt.' : data.error;
        if (!data.ok) renderContacts();
      } else if (data.type === 'pm-notification') {
        if (!contacts.some((contact) => contact.id === data.peerId))
          contacts.push({ id: data.peerId, name: data.name, className: '' });
        renderContacts();
      } else if (data.type === 'members') {
        members.hidden = scope !== 'class';
        membersTitle.textContent = `Klasgenoten (${data.members.length})`;
        membersList.textContent =
          data.members.map((member: { name: string }) => member.name).join(' · ') ||
          'Nog geen klasgenoten aangemeld.';
      } else if (data.type === 'reactions') {
        const message = messages.get(data.messageId);
        if (message) render({ ...message, reactions: data.reactions });
      } else if (data.type === 'reacted') {
        const key = `${data.messageId}:${data.emoji}`;
        pendingReactions.delete(key);

        if (data.ok) {
          ++draftRevision;
          draftLoading = false;
          if (data.active) selectedReactions.add(key);
          else selectedReactions.delete(key);
        } else status.textContent = data.error;

        const message = messages.get(data.messageId);
        if (message) render(message);
      } else if (data.type === 'online')
        online.textContent = `${data.count} verbinding(en) online`;
      else if (data.type === 'sent') {
        sending = false;
        input.disabled = !connected;
        send.disabled = !connected;

        if (data.ok) {
          mentions.reset();
          input.value = '';
          replyTo = null;
          gifUrl = '';

          updateContext();

          status.textContent = 'Verbonden';
        } else status.textContent = data.error;
      }
    });

    current.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError?.message;
      if (port !== current || disposed) return;

      clearTimeout(connectTimer);
      clearInterval(heartbeat);

      port = undefined;
      connected = sending = false;

      send.disabled = input.disabled = true;
      status.textContent = error
        ? `Extensiefout: ${error}. Herlaad de extensie en ververs CASPR.`
        : 'Verbinding met extensie verbroken. Sluit en heropen de chat.';
    });

    current.postMessage({
      type: 'join',
      name,
      email: getCurrentUser()?.email,
      className: getCurrentClass(),
      scope,
      peerId: scope === 'pm' ? peer?.id : undefined,
      groupId: scope === 'group' ? peer?.id : undefined,
    });
  };

  const chatTile = tile('Chats', '💬', () => openChat(activeScope, activePeer));
  chatTile.querySelector('button')!.dataset.casprChat = 'true';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!connected || !port || sending) return;

    sending = true;
    input.disabled = true;
    send.disabled = true;

    port.postMessage({
      type: 'send',
      text: input.value,
      replyTo,
      gifUrl,
      mentionIds: mentions.ids(),
    });
    port.postMessage({ type: 'typing', active: false });
  });

  chat.addEventListener('close', disconnect);
  chat.addEventListener('close', saveDraft);

  const cleanup = () => {
    saveDraft();
    unsubscribeFavorites();
    mentions.cleanup();
    window.removeEventListener('caspr-open-group', groupEvent);
    social.cleanup();
    chatTools.cleanup();
    roles.cleanup();
    moderation.cleanup();
    document.removeEventListener('visibilitychange', markRead);
    window.removeEventListener('focus', markRead);
    account.cleanup();
    disposed = true;

    disconnect();
    cleanupGame?.();

    columns.forEach((column) => column.remove());
    dialogs.forEach((dialog) => dialog.remove());

    window.removeEventListener('pagehide', cleanup);
  };

  window.addEventListener('pagehide', cleanup, { once: true });
  return cleanup;
}
