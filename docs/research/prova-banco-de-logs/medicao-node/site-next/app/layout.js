export const metadata = { title: 'Site sintético' };

export default function LayoutRaiz({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
