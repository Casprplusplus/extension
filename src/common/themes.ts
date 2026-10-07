export const themes = ["aurora", "midnight", "sunrise", "forest"] as const;
export type Theme = (typeof themes)[number];

export interface ThemeSettings {
  enabled: boolean;
  theme: Theme;
  splash: boolean;
}

export const defaults: ThemeSettings = {
  enabled: true,
  theme: "aurora",
  splash: true,
};

export function parseSettings(value: unknown): ThemeSettings {
  const data = (
    value && typeof value === "object" ? value : {}
  ) as Partial<ThemeSettings>;

  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : defaults.enabled,
    theme: themes.includes(data.theme as Theme) ? (data.theme as Theme) : defaults.theme,
    splash: typeof data.splash === "boolean" ? data.splash : defaults.splash,
  };
}

export const splashes = [
  "Je wachtwoord heeft meer hoofdletters dan je samenvatting.",
  "Je huiswerk is niet verdwenen. We hebben het gevraagd.",
  "Je motivatie wordt geladen… dit kan even duren.",
  "Ctrl+Z werkt helaas niet op een toets.",
  "Nog even aanmelden, dan professioneel naar je agenda staren.",
  "Je bent geen robot. Robots hebben hun huiswerk al af.",
  "Wachtwoord vergeten? Je bent tenminste consequent met je leerstof.",
  "Welkom terug. Je vakantieaanvraag is nog steeds wishful thinking.",
  "De schoolbel heeft helaas geen snoozeknop.",
];

export const loginSplashes = [
  "Huiswerk? Welke huiswerk?",
  "Motivatie niet inbegrepen!",
  "Respawn bij het volgende uur!",
  "Je brooddoos mist je!",
  "Snoozen is geen studiemethode!",
  "Vergeet je wachtwoord niet!",
  `It even works under water!`,
  `Hoelang is een chinees.`,
  `404 Splashtext not found`,
  `Home-made!`,
  `Pythagoras was used in this`, //WHERE????
  `What <i>DOES</i> the fox say?`,
  `Supercalifragilisticexpialidocious!`,
  `Hottentotententententoonstelling`,
  `Not on steam!`,
  `Made in Belgium!`,
  `De L in frans \n staat voor leuk!`,
  `Doesn't contain nuts!`,
  `Never gonna give you up ;)`,
  `I know what you did...`,
  `2 + 2 = 5`,
  `2 * 3 = 4`,
  `Je suis une baguette`,
  `Dikke BMW!`,
  `BINGO!`,
  `GEKOLONISEERD!`,
  `Made by Louis!`,
  `Not made in China!`,
  `How did we get here?`,
  `Do your homework!`,
  `[Insert funny splashtext]`,
  `"How to exit VIM???"`,
  `Are you hacking??`,
  `Ma alleee ik word \n gekilled door ne kerstboom!`,
  `SQL,<i> Squil</i> ✓`,
  `undefined is not a function`,
  `:p`,
  `MERGE CONFLICT!`,
  `In case of fire: git add . \n ; git commit ; git push`,
  `Always remove French language \npack: sudo rm -fr /`,
  `Is tHaT A JOjO ReFEreNce?`,
  `Beep beep I'm a sheep`,
  `I love yavascript !`,
  `Gele auto!`,
  `LET ME OUTTT!!!`,
  `HELP`,
  `Brood int frans`,
  `CORS >:(`,
  `Il est oraaaange! \n Il a des bras.. et des jambes`,
  `Took at least \n 5 hours to make!`,
  `Sometimes works!`,
  `Rode auto!`,
  `Are you serious?`,
  `nginx, <i>Enginks</i>`,
  `I love ECMAScript`,
  `bAcK iN My DaY!`,
  `I forgor 💀`,
  `Error 418 \n I'm a tea pot...`,
  `Do it`,
];
