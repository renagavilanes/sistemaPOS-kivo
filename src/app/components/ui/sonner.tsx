import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // Evita dependencias de Next/ThemeProvider en Vite.
      // `system` funciona bien y previene errores de mounting en móviles.
      theme={"system" as ToasterProps["theme"]}
      className="toaster group notranslate"
      position="top-center"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };