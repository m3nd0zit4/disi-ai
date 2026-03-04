import localFont from "next/font/local";

/**
 * Fuente del logo DISI (Milven) desde public/fonts.
 * Usar .className en el elemento para aplicar la tipografía.
 */
export const logoFont = localFont({
  src: "../public/fonts/Milven-Regular.otf",
  variable: "--font-logo",
  display: "swap",
});
