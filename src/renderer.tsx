import { jsxRenderer } from 'hono/jsx-renderer';
import { Link, Script, ViteClient } from 'vite-ssr-components/hono';

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Excalidraw-CF</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
        <Script src="/src/client/canvas.ts" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
});
