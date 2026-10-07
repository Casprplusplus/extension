export const reactionEmoji = ['👍', '❤️', '😂', '🔥', '🎉', '😮', '😢', '👀'];
export const composerEmoji = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😅',
  '😂',
  '🤣',
  '😊',
  '🥰',
  '😍',
  '😎',
  '🤓',
  '🤔',
  '🙃',
  '😴',
  '😭',
  '😮',
  '😢',
  '😤',
  '🫡',
  '👍',
  '👎',
  '👋',
  '🙌',
  '👏',
  '🙏',
  '💪',
  '🤝',
  '❤️',
  '💜',
  '💚',
  '🔥',
  '✨',
  '🎉',
  '🎯',
  '👀',
  '💯',
  '✅',
  '❌',
  '🪑',
  '📚',
  '📝',
  '🏫',
  '☕',
  '🍕',
  '🥪',
  '🚀',
  '💻',
];

export function validGifUrl(value: string): boolean {
  if (value.length > 500) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^(?:media[0-4]?|i)\.giphy\.com$/.test(url.hostname) &&
      /\.gif$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}
