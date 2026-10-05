"use client";

/**
 * Last-resort error page, shown only when the root layout itself fails. It replaces the whole document, so it
 * has no translations, theme or fonts from the app: it speaks both languages and follows the system theme.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ta">
      <body>
        <title>பிழை · Error</title>
        <style>{`
          body { margin: 0; font-family: system-ui, "Noto Sans Tamil", sans-serif; background: #faf8f4; color: #1c1b19; }
          main { max-width: 32rem; margin: 15vh auto; padding: 0 1rem; line-height: 1.7; }
          button { font: inherit; padding: .6rem 1.2rem; border-radius: .75rem; border: 0; background: #7a2e2e; color: #fff; cursor: pointer; }
          small { color: #5f5b54; }
          @media (prefers-color-scheme: dark) {
            body { background: #111317; color: #ece9e3; }
            button { background: #e0a3a3; color: #111317; }
            small { color: #a9a49b; }
          }
        `}</style>
        <main id="main">
          <h1 lang="ta">ஏதோ தவறு நடந்துவிட்டது</h1>
          <p lang="ta">சற்று நேரம் கழித்து மீண்டும் முயலவும்.</p>
          <h2 lang="en">Something went wrong</h2>
          <p lang="en">Please try again in a moment.</p>
          <button type="button" onClick={() => retry()}>
            <span lang="ta">மீண்டும் முயல்க</span> · <span lang="en">Try again</span>
          </button>
          {error.digest ? (
            <p>
              <small>Ref: {error.digest}</small>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
