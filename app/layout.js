import './global.css';

export const metadata = {
  title: 'Community Hero',
  description: 'Hyperlocal problem solver powered by Gemini',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}