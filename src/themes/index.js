function toRgbChannels(hex) {
  const value = hex.slice(1);
  const channels = value.length === 3
    ? value.split('').map((channel) => Number.parseInt(channel + channel, 16))
    : value.match(/.{2}/g).map((channel) => Number.parseInt(channel, 16));

  return channels.join(' ');
}

function createTheme(id, palette) {
  const variables = {
    '--theme-accent': 'accent',
    '--theme-accent-hover': 'accentHover',
    '--theme-accent-text': 'accentText',
    '--theme-accent-text-hover': 'accentTextHover',
    '--theme-bg': 'background',
    '--theme-card-bg': 'paper',
    '--theme-text': 'ink',
    '--theme-text-secondary': 'secondaryInk',
    '--theme-border': 'border',
    '--theme-decorative': 'decoration',
    '--theme-icon': 'accent',
    '--theme-highlight': 'highlight',
    '--theme-tape': 'tape',
  };

  return {
    id,
    palette,
    themeColor: palette.background,
    cssVariables: Object.fromEntries(
      Object.entries(variables).map(([variable, color]) => [
        variable,
        toRgbChannels(palette[color]),
      ]),
    ),
  };
}

export const themes = {
  boy: createTheme('boy', {
    background: '#F0F7F9',
    paper: '#FFFEFA',
    accent: '#78AFC6',
    accentHover: '#28617B',
    accentText: '#2E6FA0',
    accentTextHover: '#245A82',
    ink: '#26414D',
    secondaryInk: '#5C747E',
    border: '#D4E3E7',
    decoration: '#C8E1E9',
    highlight: '#F2CC73',
    tape: '#F3E4AD',
  }),
  girl: createTheme('girl', {
    background: '#FFF5F8',
    paper: '#FFFCFA',
    accent: '#C7839F',
    accentHover: '#A54664',
    accentText: '#A54664',
    accentTextHover: '#89364F',
    ink: '#583949',
    secondaryInk: '#805E6C',
    border: '#EAD8E2',
    decoration: '#F1CBD8',
    highlight: '#E9B9C9',
    tape: '#D9CDE9',
  }),
  royal: createTheme('royal', {
    background: '#F8F5ED',
    paper: '#FFFCF5',
    accent: '#B69A63',
    accentHover: '#7C633A',
    accentText: '#24344D',
    accentTextHover: '#17253A',
    ink: '#383631',
    secondaryInk: '#716A5D',
    border: '#E9DFC9',
    decoration: '#E9DFC9',
    highlight: '#D8C493',
    tape: '#E9DFC9',
  }),
};

export const themeList = Object.values(themes);
export const DEFAULT_THEME = 'boy';

export function isTheme(value) {
  return Object.prototype.hasOwnProperty.call(themes, value);
}
