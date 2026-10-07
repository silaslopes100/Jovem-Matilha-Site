const siteConfig = require("./tailwind.config");

module.exports = {
  ...siteConfig,
  content: ["./index.html"],
  theme: {
    ...siteConfig.theme,
    extend: {
      ...siteConfig.theme.extend,
      colors: {
        ...siteConfig.theme.extend.colors,
        "jm-dark": "#293119",
        "jm-green": "#738B4D",
        "jm-olive": "#8C8A5B",
        "jm-offwhite": "#F2F2EB",
      },
      fontFamily: {
        "headline-md": ['"Exo 2"', "sans-serif"],
        "body-md": ['"Libre Franklin"', "sans-serif"],
        "display-mobile": ['"Exo 2"', "sans-serif"],
        "label-eyebrow": ['"Libre Franklin"', "sans-serif"],
        "headline-sm": ['"Exo 2"', "sans-serif"],
        "label-button": ['"Libre Franklin"', "sans-serif"],
        display: ['"Exo 2"', "sans-serif"],
        "body-sm": ['"Libre Franklin"', "sans-serif"],
        "headline-lg": ['"Exo 2"', "sans-serif"],
        "headline-lg-mobile": ['"Exo 2"', "sans-serif"],
        "badge-seal": ['"Exo 2"', "sans-serif"],
        "body-lg": ['"Libre Franklin"', "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
  ],
};
