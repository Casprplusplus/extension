import { communityRequest } from '../common/community-api';
import { roleBadge, levelBadge, rewardBadge } from '../common/badges';
import { appendSocialExtras } from './social-extras';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};
const button = (text: string, action: () => void) => {
  const node = element('button', text);
  node.type = 'button';
  node.onclick = action;
  return node;
};
export function mountSocial(
  sidebar: HTMLElement,
  main: HTMLElement,
  openGroup: (id: number, name: string) => void,
  onState: () => void,
  onGroups?: (groups: { id: number; name: string; accepted: boolean }[]) => void,
) {
  let disposed = false;
  let room = '';
  let ownId = 0;
  let state: any;
  let epoch = 0;
  let groupsEpoch = 0;
  let unread: Record<string, number> = {};
  let mentionCounts: Record<string, number> = {};
  const dialogs = new Set<HTMLDialogElement>();
  const groups = element('section');
  const ownProfile = button('👤 Mijn profiel', () => {
    if (ownId) void openProfile(ownId);
  });
  ownProfile.className = 'caspr-own-profile';
  ownProfile.disabled = true;
  sidebar.append(ownProfile);
  groups.className = 'caspr-social-groups';
  const groupsList = element('div');
  const status = element('p');
  status.setAttribute('role', 'status');
  const panel = element('section');
  panel.className = 'caspr-social-panel';
  panel.hidden = true;
  main.insertBefore(panel, main.querySelector('.caspr-chat-messages') || null);
  const report = (error: unknown) => {
    status.textContent = error instanceof Error ? error.message : 'Aanvraag mislukt.';
  };
  const request = async (action: string, payload: unknown) => {
    const result = await communityRequest(action, payload);
    if (!result.ok) throw new Error(result.error || 'Aanvraag mislukt.');
    status.textContent = '';
    return result;
  };
  const dialog = (title: string) => {
    const node = element('dialog');
    node.className = 'caspr-community caspr-social-dialog';
    node.setAttribute('aria-label', title);
    const header = element('header');
    header.append(
      element('h2', title),
      button('Sluiten', () => node.close()),
    );
    node.append(header);
    dialogs.add(node);
    node.addEventListener('close', () => {
      dialogs.delete(node);
      node.remove();
    });
    document.body.append(node);
    node.showModal();
    return node;
  };
  const form = (
    title: string,
    fields: { label: string; max: number; value?: string }[],
    submit: (values: string[]) => Promise<void>,
  ) => {
    const node = dialog(title);
    const body = element('form');
    const inputs = fields.map((field) => {
      const label = element('label', field.label);
      const input = element('input');
      input.required = true;
      input.maxLength = field.max;
      input.value = field.value || '';
      label.append(input);
      body.append(label);
      return input;
    });
    const error = element('p');
    error.setAttribute('role', 'status');
    const save = element('button', 'Opslaan');
    save.type = 'submit';
    body.append(error, save);
    body.onsubmit = async (event) => {
      event.preventDefault();
      save.disabled = true;
      try {
        await submit(inputs.map((input) => input.value.trim()));
        node.close();
      } catch (e) {
        error.textContent = e instanceof Error ? e.message : 'Opslaan mislukt.';
      } finally {
        save.disabled = false;
      }
    };
    node.append(body);
    inputs[0]?.focus();
  };
  const changeGroup = async (groupId: number, action: string, extra = {}) => {
    await request('group-change', { groupId, action, ...extra });
    await refreshGroups();
    await refresh();
  };
  const refreshGroups = async () => {
    const version = ++groupsEpoch;
    try {
      const data = await request('groups', {});
      if (disposed || version !== groupsEpoch) return;
      ownId = data.userId;
      onGroups?.(Array.isArray(data.groups) ? data.groups : []);
      groupsList.replaceChildren();
      for (const group of data.groups) {
        const row = element('div');
        row.className = 'caspr-social-group-row';
        const count = unread[`group:${group.id}`] || 0;
        const enter = button(
          `${group.name} · ${group.members}${count ? ` · ${count} nieuw` : ''}${mentionCounts[`group:${group.id}`] ? ` · @${mentionCounts[`group:${group.id}`]}` : ''}`,
          () => openGroup(group.id, group.name),
        );
        enter.disabled = !group.accepted;
        enter.setAttribute('aria-pressed', String(room === `group:${group.id}`));
        row.append(enter);
        if (!group.accepted)
          row.append(
            button(
              'Accepteren',
              () => void changeGroup(group.id, 'accept').catch(report),
            ),
            button('Weigeren', () => void changeGroup(group.id, 'leave').catch(report)),
            button('Blokkeer eigenaar', () => {
              void request('block-user', { targetId: group.ownerId })
                .then(refreshGroups)
                .catch(report);
            }),
          );
        groupsList.append(row);
      }
      if (!data.groups.length)
        groupsList.append(element('p', 'Maak een groep voor je vrienden of groepswerk.'));
    } catch (e) {
      if (!disposed) report(e);
    }
  };
  const action = async (payload: unknown) => {
    await request('social-action', { ...(payload as object), room });
    await refresh();
  };
  const manage = () => {
    const group = state?.group;
    if (!group) return;
    const node = dialog(`Groep · ${group.name}`);
    node.classList.add('caspr-group-manager');
    const error = element('p');
    error.setAttribute('role', 'status');
    const perform = (action: string, extra = {}) => {
      void changeGroup(group.id, action, extra)
        .then(() => node.close())
        .catch((e) => {
          error.textContent = e.message;
        });
    };
    node.append(
      element('p', `${group.members.filter((m: any) => m.accepted).length}/20 leden`),
    );
    for (const member of group.members) {
      const row = element('div');
      row.className = 'caspr-social-member';
      row.append(
        element(
          'strong',
          `${member.name}${!member.accepted ? ' · uitgenodigd' : ''}${member.id === group.ownerId ? ' · eigenaar' : ''}`,
        ),
      );
      if (ownId === group.ownerId && member.id !== ownId) {
        row.append(
          button('Verwijderen', () => perform('remove', { targetId: member.id })),
        );
        if (member.accepted)
          row.append(
            button('Eigenaar maken', () => perform('transfer', { targetId: member.id })),
          );
      }
      node.append(row);
    }
    if (ownId === group.ownerId) {
      node.append(
        button('Naam wijzigen', () =>
          form(
            'Groepsnaam',
            [{ label: 'Naam', max: 60, value: group.name }],
            async ([name]) => {
              await changeGroup(group.id, 'rename', { name });
              node.close();
            },
          ),
        ),
      );
      const invite = element('select');
      invite.setAttribute('aria-label', 'Vriend uitnodigen');
      invite.append(new Option('Kies een vriend', ''));
      const inviteRow = element('div');
      inviteRow.className = 'caspr-group-invite-row';
      const inviteButton = button('Uitnodigen', () => {
        if (invite.value) perform('invite', { targetId: Number(invite.value) });
      });
      inviteButton.disabled = true;
      invite.onchange = () => {
        inviteButton.disabled = !invite.value;
      };
      inviteRow.append(invite, inviteButton);
      node.append(element('h3', 'Vriend uitnodigen'), inviteRow);
      const inviteHint = element('p', 'Vrienden laden…');
      inviteHint.className = 'caspr-group-invite-hint';
      node.append(inviteHint);
      void request('friends-list', {})
        .then((data) => {
          if (!node.isConnected) return;
          for (const friend of data.contacts.filter(
            (c: any) =>
              c.friendship === 'accepted' &&
              !group.members.some((m: any) => m.id === c.id),
          ))
            invite.append(new Option(friend.name, String(friend.id)));
          inviteHint.textContent =
            invite.options.length > 1
              ? 'Alleen geaccepteerde vrienden kunnen worden uitgenodigd.'
              : 'Geen vrienden beschikbaar. Voeg eerst een vriend toe via Chats.';
        })
        .catch((e) => {
          error.textContent = e.message;
        });
      const danger = element('div');
      danger.className = 'caspr-group-danger';
      danger.append(
        button('Groep verwijderen', () => {
          const confirm = dialog('Groep verwijderen?');
          confirm.append(
            element('p', 'Alle leden verliezen toegang tot het gesprek.'),
            button('Verwijderen', () => {
              confirm.close();
              perform('delete');
            }),
          );
        }),
      );
      node.append(danger);
    } else node.append(button('Groep verlaten', () => perform('leave')));
    node.append(error);
  };
  const render = () => {
    panel.replaceChildren();
    if (!state) return;
    const toolbar = element('div');
    toolbar.className = 'caspr-social-toolbar';
    toolbar.append(
      button('＋ Poll', () =>
        form(
          'Nieuwe poll',
          [
            { label: 'Vraag', max: 160 },
            { label: 'Opties, gescheiden met ;', max: 480 },
          ],
          async ([question, options]) =>
            action({
              action: 'poll-create',
              question,
              options: options.split(';').map((v) => v.trim()),
            }),
        ),
      ),
    );
    if (state.group) {
      toolbar.append(button('Groep beheren', manage));
      if (state.group.ownerId === ownId)
        toolbar.append(
          button('◷ Samen focussen', () =>
            form(
              'Samen focussen',
              [{ label: 'Minuten (1–120)', max: 3, value: '25' }],
              async ([value]) =>
                action({ action: 'focus-start', minutes: Number(value) }),
            ),
          ),
        );
    }
    panel.append(toolbar);
    appendSocialExtras(toolbar, panel, state, {
      room,
      ownId,
      request,
      action,
      dialog,
      report,
    });
    if (state.pin) {
      const pin = element('div');
      pin.className = 'caspr-social-pin';
      pin.append(
        element('small', `📌 Vastgezet · ${state.pin.name}`),
        element('p', state.pin.text || 'GIF'),
      );
      if (canPin())
        pin.append(
          button(
            'Losmaken',
            () => void action({ action: 'pin', messageId: null }).catch(report),
          ),
        );
      panel.append(pin);
    }
    if (state.focus) {
      const focus = element('div');
      focus.className = 'caspr-social-focus';
      const time = element('strong');
      time.dataset.focusEnd = String(state.focus.endsAt);
      focus.append(element('small', '🎯 Samen focussen'), time);
      if (state.group?.ownerId === ownId)
        focus.append(
          button('Stoppen', () => void action({ action: 'focus-stop' }).catch(report)),
        );
      panel.append(focus);
      tick();
    }
    if (state.polls.length) {
      const details = element('details');
      details.className = 'caspr-social-polls';
      details.append(element('summary', `Polls · ${state.polls.length}`));
      for (const poll of state.polls) {
        const card = element('article');
        card.className = 'caspr-social-poll';
        card.append(element('h3', poll.question));
        const total = poll.counts.reduce((a: number, b: number) => a + b, 0);
        poll.options.forEach((option: string, index: number) => {
          const choice = button(
            `${option} · ${poll.counts[index]}${poll.choice === index ? ' ✓' : ''}`,
            () =>
              void action({
                action: 'poll-vote',
                pollId: poll.id,
                choice: index,
              }).catch(report),
          );
          choice.disabled = !!poll.closed;
          choice.setAttribute('aria-pressed', String(poll.choice === index));
          choice.style.setProperty(
            '--vote-percent',
            `${total ? (poll.counts[index] / total) * 100 : 0}%`,
          );
          card.append(choice);
        });
        card.append(
          element('small', `${total} stemmen${poll.closed ? ' · gesloten' : ''}`),
        );
        if (!poll.closed && (poll.creatorId === ownId || canPin()))
          card.append(
            button(
              'Poll sluiten',
              () => void action({ action: 'poll-close', pollId: poll.id }).catch(report),
            ),
          );
        details.append(card);
      }
      panel.append(details);
    }
  };
  let role = 'member';
  const canPin = () =>
    !!state &&
    (state.group
      ? state.group.ownerId === ownId
      : room.startsWith('pm:') || ['mod', 'dev+'].includes(role));
  const refresh = async () => {
    const version = ++epoch;
    if (!room) return;
    try {
      const data = await request('social-state', { room });
      if (disposed || version !== epoch) return;
      state = data;
      panel.hidden = false;
      render();
      onState();
    } catch (e) {
      if (!disposed && version === epoch) report(e);
    }
  };
  const tick = () => {
    for (const time of panel.querySelectorAll<HTMLElement>('[data-focus-end]')) {
      const seconds = Math.max(
        0,
        Math.ceil((Number(time.dataset.focusEnd) - Date.now()) / 1000),
      );
      time.textContent = seconds
        ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
        : 'Focusronde klaar!';
    }
  };
  const timer = setInterval(tick, 1000);
  groups.append(
    element('h3', 'Privégroepen'),
    button('＋ Nieuwe groep', () =>
      form('Nieuwe privégroep', [{ label: 'Groepsnaam', max: 60 }], async ([name]) => {
        const result = await request('group-create', { name });
        await refreshGroups();
        openGroup(result.groupId, name);
      }),
    ),
    groupsList,
    status,
  );
  sidebar.append(groups);
  const openProfile = async (targetId: number) => {
    try {
      const data = await request('user-card', { targetId });
      if (disposed) return;
      const node = dialog(targetId === ownId ? 'Mijn profiel' : 'Chatprofiel');
      node.classList.add('caspr-profile-dialog');
      const identity = element('div');
      identity.className = 'caspr-profile-identity';
      const avatar = element(
        'span',
        String(data.user.name)
          .trim()
          .split(/\s+/)
          .map((part: string) => Array.from(part)[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
      );
      avatar.className = 'caspr-profile-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const details = element('div');
      details.append(
        element('h3', data.user.name),
        element('p', data.user.className || 'Geen klas ingesteld'),
      );
      identity.append(avatar, details);
      const badges = element('div');
      badges.className = 'caspr-profile-badges';
      for (const badge of [roleBadge(data.user.role), levelBadge(data.progression.level)])
        if (badge) badges.append(badge);
      const progress = element('section');
      progress.className = 'caspr-profile-progress';
      const xp = Math.max(0, Number(data.progression.xp) || 0);
      const level = Math.max(1, Number(data.progression.level) || 1);
      const floor = (level - 1) ** 2 * 100;
      const ceiling = level ** 2 * 100;
      const bar = element('progress');
      bar.max = ceiling - floor;
      bar.value = Math.max(0, Math.min(bar.max, xp - floor));
      bar.setAttribute('aria-label', `Voortgang naar level ${level + 1}`);
      progress.append(
        element('strong', `${xp} XP`),
        element('p', `Nog ${Math.max(0, ceiling - xp)} XP tot level ${level + 1}`),
        bar,
      );
      const rewards = element('section');
      rewards.className = 'caspr-profile-rewards';
      rewards.append(element('h3', 'Verdiende badges'));
      const rewardList = element('div');
      rewardList.className = 'caspr-profile-badges';
      for (const id of data.progression.badges) {
        const badge = rewardBadge(id);
        if (badge) rewardList.append(badge);
      }
      rewards.append(
        rewardList.children.length
          ? rewardList
          : element('p', 'Je eerste badge verdien je met je eerste resultaat.'),
      );
      node.append(identity, badges, progress, rewards);
      if (targetId !== ownId && Array.isArray(data.mutualFriends)) {
        const mutual = element('section');
        mutual.className = 'caspr-profile-mutual';
        mutual.append(
          element('h3', `Gemeenschappelijke vrienden · ${data.mutualFriends.length}`),
        );
        const list = element('div');
        list.className = 'caspr-profile-friends';
        for (const friend of data.mutualFriends) {
          const link = element('button', friend.name);
          link.type = 'button';
          link.title = friend.className || 'Chatprofiel openen';
          link.addEventListener('click', () => {
            node.close();
            void openProfile(friend.id);
          });
          list.append(link);
        }
        mutual.append(
          list.children.length
            ? list
            : element('p', 'Nog geen gemeenschappelijke vrienden.'),
        );
        node.append(mutual);
      }
    } catch (error) {
      report(error);
    }
  };
  return {
    setRoom(value: string, userId: number, userRole: string) {
      if (value !== room) {
        for (const node of dialogs) node.close();
        state = undefined;
        panel.hidden = true;
      }
      room = value;
      ownId = userId;
      ownProfile.disabled = !ownId;
      role = userRole;
      void refresh();
      void refreshGroups();
    },
    refresh,
    refreshGroups,
    canPin,
    inbox(rooms: { room: string; unread: number; mentions?: number }[]) {
      mentionCounts = Object.fromEntries(
        rooms.map((value) => [value.room, value.mentions || 0]),
      );
      unread = Object.fromEntries(rooms.map((value) => [value.room, value.unread]));
      void refreshGroups();
    },
    pin(messageId: number) {
      void action({ action: 'pin', messageId }).catch(report);
    },
    profile: openProfile,
    cleanup() {
      disposed = true;
      ++epoch;
      ++groupsEpoch;
      clearInterval(timer);
      for (const node of dialogs) node.close();
      groups.remove();
      ownProfile.remove();
      panel.remove();
    },
  };
}
